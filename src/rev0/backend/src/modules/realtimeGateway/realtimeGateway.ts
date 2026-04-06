import type { Server as IOServer, Socket } from "socket.io";
import crypto from "crypto";

import { applyAction, getPublicState, createGame, parseInSystem } from "@rev0/shared";
import type { GameAction, GameState } from "@rev0/shared";
import type { Repository } from "../../types/repository";

export const WS = {
  JOIN_GAME: "join_game",
  SUBMIT_ACTION: "submit_action",
  GAME_STATE: "game_state",
  MY_HAND: "my_hand",
  ERROR: "error",
  // Restart events
  REQUEST_RESTART: "request_restart",
  RESTART_REQUESTED: "restart_requested",
  RESTART_CONFIRMED: "restart_confirmed",
  GAME_RESTARTED: "game_restarted",
  DECLINE_RESTART: "decline_restart",
  RESTART_DECLINED: "restart_declined",
  // Leave events
  OPPONENT_LEFT: "opponent_left",
  LEAVE_GAME: "leave_game",
  FORCE_LOGOUT: "force_logout",
  // Chat
  CHAT_SEND: "chat_send",
  CHAT_MSG: "chat_msg",
  // Admin
  ROOM_DELETED: "room_deleted",
  // Challenge result (server → individual player)
  CHALLENGE_RESULT: "challenge_result",
  // Challenge resolved (server → room)
  CHALLENGE_RESOLVED: "challenge_resolved",
  // Challenge wrong (server → individual player)
  CHALLENGE_WRONG: "challenge_wrong",
} as const;

export type JoinGamePayload = { gameId: string };
export type SubmitActionPayload = { gameId: string; action: GameAction };
export type RestartRequestPayload = { gameId: string };

export type AuthService = {
  verifyToken: (token: string) => { userId: string; username?: string; role?: string };
};

export type AuditStore = {
  logAuthEvent?: (e: any) => void;
  logGameplayEvent?: (e: any) => void;
  logSystemEvent?: (e: any) => void;
};

export function makeRealtimeGateway(deps: {
  io: IOServer;
  auth: AuthService;
  audit: AuditStore;
  gameSessions: Map<string, GameState>;
  repo: Repository;
}) {
  const { io, auth, audit, gameSessions, repo } = deps;

  // Track restart requests per game: gameId -> Set of userIds who requested restart
  const restartRequests = new Map<string, Set<string>>();

  // Track userId -> socketId for targeted events (force-logout)
  const userSockets = new Map<string, string>();

  // Challenge tracking per game: tracks wrong answers and timeout
  type ChallengeTracker = {
    wrongPlayers: Set<string>;
    timer: ReturnType<typeof setTimeout>;
    correctAnswer: number;
    challengeData: { type: string; op1: number; op2: number; reward: number };
  };
  const activeChallenges = new Map<string, ChallengeTracker>();

  // Per-game challenge stats: gameId -> { playerId -> { attempted, correct, first } }
  const challengeStats = new Map<string, Map<string, { attempted: number; correct: number; first: number }>>();

  function getOrCreateStats(gameId: string, playerId: string) {
    if (!challengeStats.has(gameId)) challengeStats.set(gameId, new Map());
    const gs = challengeStats.get(gameId)!;
    if (!gs.has(playerId)) gs.set(playerId, { attempted: 0, correct: 0, first: 0 });
    return gs.get(playerId)!;
  }

  // Start challenge timeout for a game
  function startChallengeTimer(gameId: string, game: GameState) {
    const challenge = game.round?.activeChallenge;
    if (!challenge) return;

    const timer = setTimeout(async () => {
      // Timeout: resolve challenge, reveal answer, advance turn
      const curGame = gameSessions.get(gameId);
      if (!curGame || !curGame.round?.activeChallenge) return;

      const correctAnswer = curGame.round.activeChallenge.answer!;
      const tracker = activeChallenges.get(gameId);

      // Clear challenge and advance turn
      const updatedRound = { ...curGame.round, activeChallenge: undefined };
      // Advance turn
      const players = updatedRound.players;
      const currentIdx = players.indexOf(updatedRound.turn);
      updatedRound.turn = players[(currentIdx + 1) % players.length];
      (updatedRound as any).drawCountThisTurn = 0;

      const next = { ...curGame, round: updatedRound };
      gameSessions.set(gameId, next);

      // Broadcast resolution
      io.to(roomForGame(gameId)).emit(WS.CHALLENGE_RESOLVED, {
        winnerId: null,
        correctAnswer,
        timedOut: true,
        challengeData: tracker?.challengeData,
      });

      // Broadcast updated state
      io.to(roomForGame(gameId)).emit(WS.GAME_STATE, getPublicState(next));
      await emitHandsToRoom(gameId, next);

      activeChallenges.delete(gameId);
    }, 60000); // 60 seconds

    activeChallenges.set(gameId, {
      wrongPlayers: new Set(),
      timer,
      correctAnswer: challenge.answer!,
      challengeData: {
        type: challenge.type,
        op1: challenge.op1,
        op2: challenge.op2,
        reward: challenge.reward,
      },
    });
  }

  const roomForGame = (gameId: string) => `game:${gameId}`;

  const emitError = (socket: Socket, code: string, message: string) => {
    socket.emit(WS.ERROR, { code, message });
  };

  function getToken(socket: Socket): string | null {
    const t = (socket.handshake.auth as any)?.token;
    if (t && typeof t === "string") return t;
    const h = socket.handshake.headers["authorization"];
    if (typeof h === "string") {
      const m = h.match(/^Bearer\s+(.+)$/i);
      if (m) return m[1];
    }
    return null;
  }

  function requireUser(socket: Socket) {
    const token = getToken(socket);
    console.log("WS token head:", token?.slice(0, 20));
    if (!token) throw new Error("MissingToken");
    const claims = auth.verifyToken(token);
    (socket.data as any).userId = claims.userId;
    (socket.data as any).role = claims.role;
    return claims;
  }

  function assertPlayerInGame(game: GameState, userId: string) {
    // hands uses playerId as keys
    if (!game.round.hands[userId]) throw new Error("NotPlayerInGame");
  }

  function emitMyHand(socket: Socket, game: GameState) {
    const userId = (socket.data as any).userId as string;
    const hand = game.round.hands[userId] ?? [];
    socket.emit(WS.MY_HAND, { hand });
  }

  async function emitHandsToRoom(gameId: string, game: GameState) {
    const room = roomForGame(gameId);
    const sockets = await io.in(room).fetchSockets();
    for (const s of sockets) {
      const uid = (s.data as any).userId as string | undefined;
      if (!uid) continue;
      const hand = game.round.hands[uid] ?? [];
      s.emit(WS.MY_HAND, { hand });
    }
  }

  function handleConnection(socket: Socket) {
    try {
      const claims = requireUser(socket);
      audit.logAuthEvent?.({ type: "WS_CONNECT", at: Date.now(), userId: claims.userId });
      // Track userId -> socketId
      userSockets.set(claims.userId, socket.id);
    } catch (e: any) {
      emitError(socket, "UNAUTHORIZED", e?.message ?? "Unauthorized");
      socket.disconnect(true);
      return;
    }

    socket.on(WS.JOIN_GAME, (payload: JoinGamePayload) => {
      try {
        const userId = (socket.data as any).userId as string;
        if (!payload?.gameId) throw new Error("BadRequest");

        const game = gameSessions.get(payload.gameId);
        if (!game) throw new Error("GameNotFound");

        // only players can join
        assertPlayerInGame(game, userId);

        socket.join(roomForGame(payload.gameId));

        // public + private
        socket.emit(WS.GAME_STATE, getPublicState(game));
        emitMyHand(socket, game);

        audit.logSystemEvent?.({ type: "WS_JOIN_GAME", at: Date.now(), userId, gameId: payload.gameId });
      } catch (e: any) {
        emitError(socket, "JOIN_FAILED", e?.message ?? "Join failed");
      }
    });

    socket.on(WS.SUBMIT_ACTION, async (payload: SubmitActionPayload) => {
      try {
        const userId = (socket.data as any).userId as string;
        if (!payload?.gameId || !payload?.action) throw new Error("BadRequest");

        const cur = gameSessions.get(payload.gameId);
        if (!cur) throw new Error("GameNotFound");

        // anti-cheat: playerId in action must match userId
        if ((payload.action as any).playerId !== userId) {
          throw new Error("PlayerIdMismatch");
        }

        // only players can act
        assertPlayerInGame(cur, userId);

        // Capture score before action to detect if this player scored
        const scoreBefore = cur.scoresDec?.[userId] ?? 0;
        const hadChallenge = !!cur.round?.activeChallenge;

        const next = applyAction(cur, payload.action);
        gameSessions.set(payload.gameId, next);

        const scoreAfter = next.scoresDec?.[userId] ?? 0;

        audit.logGameplayEvent?.({ type: "ACTION", at: Date.now(), userId, gameId: payload.gameId, action: payload.action });

        // broadcast new public state to room
        const pubState = getPublicState(next);
        io.to(roomForGame(payload.gameId)).emit(WS.GAME_STATE, pubState);

        // emit private hands to players
        await emitHandsToRoom(payload.gameId, next);

        // Start challenge timer when a new challenge appears
        if (!hadChallenge && !!next.round?.activeChallenge) {
          startChallengeTimer(payload.gameId, next);
        }

        // Handle challenge answers with dual-player competition
        if (hadChallenge && (payload.action as any).type === "ANSWER_CHALLENGE") {
          const won = scoreAfter > scoreBefore;
          const stillActive = !!next.round?.activeChallenge;
          const tracker = activeChallenges.get(payload.gameId);

          if (won) {
            // Correct answer — this player wins
            const stats = getOrCreateStats(payload.gameId, userId);
            stats.attempted++;
            stats.correct++;
            stats.first++;

            // Also count attempt for opponent if they answered wrong
            const players = next.round.players;
            const opponentId = players.find(p => p !== userId);
            if (opponentId && tracker?.wrongPlayers.has(opponentId)) {
              // Opponent already attempted and got wrong
            }

            // Clear timer
            if (tracker) {
              clearTimeout(tracker.timer);
              activeChallenges.delete(payload.gameId);
            }

            // Send resolution to room
            io.to(roomForGame(payload.gameId)).emit(WS.CHALLENGE_RESOLVED, {
              winnerId: userId,
              correctAnswer: tracker?.correctAnswer,
              timedOut: false,
              challengeData: tracker?.challengeData,
            });

            // Legacy result for backward compat
            socket.emit(WS.CHALLENGE_RESULT, { won: true, correct: true, tooLate: false });
          } else if (!won && !stillActive) {
            // Wrong answer — challenge cleared by game engine somehow
            const stats = getOrCreateStats(payload.gameId, userId);
            stats.attempted++;
            socket.emit(WS.CHALLENGE_RESULT, { won: false, correct: false, tooLate: false });
          } else if (stillActive) {
            // Wrong answer but challenge still active (opponent hasn't answered yet / or this is 1st wrong)
            const stats = getOrCreateStats(payload.gameId, userId);
            stats.attempted++;

            if (tracker) {
              tracker.wrongPlayers.add(userId);

              // Check if ALL players have now answered wrong
              const players = cur.round.players;
              const allWrong = players.every(p => tracker.wrongPlayers.has(p));

              if (allWrong) {
                // Both wrong — clear challenge, advance turn, broadcast resolution
                clearTimeout(tracker.timer);

                // Manually clear activeChallenge and advance turn in game state
                const curGame = gameSessions.get(payload.gameId);
                if (curGame) {
                  const updatedRound = { ...curGame.round, activeChallenge: undefined };
                  const currentIdx = updatedRound.players.indexOf(updatedRound.turn);
                  updatedRound.turn = updatedRound.players[(currentIdx + 1) % updatedRound.players.length];
                  (updatedRound as any).drawCountThisTurn = 0;
                  const clearedGame = { ...curGame, round: updatedRound };
                  gameSessions.set(payload.gameId, clearedGame);

                  // Broadcast both-wrong resolution FIRST
                  io.to(roomForGame(payload.gameId)).emit(WS.CHALLENGE_RESOLVED, {
                    winnerId: null,
                    correctAnswer: tracker.correctAnswer,
                    timedOut: false,
                    bothWrong: true,
                    challengeData: tracker.challengeData,
                  });

                  // Then broadcast updated game state (no active challenge)
                  io.to(roomForGame(payload.gameId)).emit(WS.GAME_STATE, getPublicState(clearedGame));
                  await emitHandsToRoom(payload.gameId, clearedGame);
                }

                activeChallenges.delete(payload.gameId);
              }
            }

            // Notify this player they were wrong
            socket.emit(WS.CHALLENGE_WRONG, { playerId: userId });
            // Legacy result
            socket.emit(WS.CHALLENGE_RESULT, { won: false, correct: false, tooLate: false });
          }
        }

        // Record match results when game ends
        if (next.status === "GAME_OVER" && pubState.lastRoundResult) {
          const lr = pubState.lastRoundResult as any;
          const players = next.round.players;
          const scores = next.scoresDec ?? {};
          const now = Date.now();
          const baseId = next.sys?.id ?? "dec";

          // Determine winner — the lastRoundResult.winner is the round winner,
          // but for the overall game, check if someone reached targetScore.
          // The game is over, so we can look at scores to determine who won.
          let winnerId: string | undefined;
          const targetScoreDec = next.sys?.targetScoreText ? parseInSystem(next.sys.targetScoreText, next.sys) : 100;
          for (const pid of players) {
            if ((scores as any)[pid] >= targetScoreDec) {
              winnerId = pid;
              break;
            }
          }

          for (const pid of players) {
            const opponentId = players.find(p => p !== pid);
            const outcome = winnerId === pid ? "win" as const : winnerId ? "lose" as const : "draw" as const;
            const cStats = challengeStats.get(payload.gameId)?.get(pid);
            try {
              await repo.saveMatchResult({
                id: crypto.randomUUID(),
                playerId: pid,
                opponentId,
                outcome,
                playerScore: (scores as any)[pid] ?? 0,
                opponentScore: opponentId ? (scores as any)[opponentId] ?? 0 : 0,
                baseId,
                timestamp: now,
                challengesAttempted: cStats?.attempted ?? 0,
                challengesCorrect: cStats?.correct ?? 0,
                challengesFirst: cStats?.first ?? 0,
              });
            } catch (e) {
              console.error("Failed to save match result:", e);
            }
          }

          // Clean up challenge stats for this game
          challengeStats.delete(payload.gameId);
        }
      } catch (e: any) {
        // If it's a late challenge answer (NoActiveChallenge), send feedback instead of generic error
        if (e?.message === "NoActiveChallenge" && (payload?.action as any)?.type === "ANSWER_CHALLENGE") {
          socket.emit(WS.CHALLENGE_RESULT, { won: false, correct: false, tooLate: true });
          return;
        }
        emitError(socket, "ACTION_FAILED", e?.message ?? "Action failed");
      }
    });

    // Handle restart request
    socket.on(WS.REQUEST_RESTART, async (payload: RestartRequestPayload) => {
      try {
        const userId = (socket.data as any).userId as string;
        if (!payload?.gameId) throw new Error("BadRequest");

        const game = gameSessions.get(payload.gameId);
        if (!game) throw new Error("GameNotFound");

        // Only allow restart requests when game is over
        if (game.status !== "GAME_OVER") {
          throw new Error("GameNotOver");
        }

        assertPlayerInGame(game, userId);

        // Track this player's restart request
        if (!restartRequests.has(payload.gameId)) {
          restartRequests.set(payload.gameId, new Set());
        }
        const requests = restartRequests.get(payload.gameId)!;
        requests.add(userId);

        audit.logSystemEvent?.({ type: "RESTART_REQUESTED", at: Date.now(), userId, gameId: payload.gameId });

        // Get both players
        const players = game.round.players;

        // Check if both players have requested restart
        if (requests.size >= 2 && players.every(p => requests.has(p))) {
          // Both players agreed - create a new game
          const newGame = createGame({
            baseId: game.sys.id,
            players: players,
            initialHandSize: 8,
          });

          // Store the new game
          gameSessions.set(newGame.gameId, newGame);

          // Clear restart requests for old game
          restartRequests.delete(payload.gameId);

          audit.logSystemEvent?.({ type: "GAME_RESTARTED", at: Date.now(), oldGameId: payload.gameId, newGameId: newGame.gameId });

          // Notify all players in the room about the new game
          io.to(roomForGame(payload.gameId)).emit(WS.GAME_RESTARTED, {
            oldGameId: payload.gameId,
            newGameId: newGame.gameId,
            publicState: getPublicState(newGame),
          });

          // Move all sockets to the new game room
          const sockets = await io.in(roomForGame(payload.gameId)).fetchSockets();
          for (const s of sockets) {
            s.leave(roomForGame(payload.gameId));
            s.join(roomForGame(newGame.gameId));
            // Send each player their hand
            const uid = (s.data as any).userId as string | undefined;
            if (uid) {
              const hand = newGame.round.hands[uid] ?? [];
              s.emit(WS.MY_HAND, { hand });
            }
          }
        } else {
          // Notify the other player that restart was requested
          socket.to(roomForGame(payload.gameId)).emit(WS.RESTART_REQUESTED, {
            requestedBy: userId,
            waitingFor: players.filter(p => !requests.has(p)),
          });

          // Confirm to the requester
          socket.emit(WS.RESTART_CONFIRMED, {
            message: "Waiting for opponent to accept restart",
            waitingFor: players.filter(p => !requests.has(p)),
          });
        }
      } catch (e: any) {
        emitError(socket, "RESTART_FAILED", e?.message ?? "Restart failed");
      }
    });

    // Handle decline restart
    socket.on(WS.DECLINE_RESTART, (payload: RestartRequestPayload) => {
      try {
        const userId = (socket.data as any).userId as string;
        if (!payload?.gameId) throw new Error("BadRequest");

        // Clear restart requests
        restartRequests.delete(payload.gameId);

        // Notify the other player that restart was declined
        socket.to(roomForGame(payload.gameId)).emit(WS.RESTART_DECLINED, {
          declinedBy: userId,
          message: "Opponent declined the rematch.",
        });

        audit.logSystemEvent?.({ type: "RESTART_DECLINED", at: Date.now(), userId, gameId: payload.gameId });
      } catch (e: any) {
        emitError(socket, "DECLINE_FAILED", e?.message ?? "Decline failed");
      }
    });

    // --- Chat ---
    socket.on(WS.CHAT_SEND, (payload: { gameId: string; text: string }) => {
      try {
        const userId = (socket.data as any).userId as string;
        if (!payload.gameId || !payload.text) return;
        const msg = payload.text.slice(0, 200); // limit length
        // Broadcast to entire room including sender
        io.in(roomForGame(payload.gameId)).emit(WS.CHAT_MSG, {
          from: userId,
          text: msg,
          ts: Date.now(),
        });
      } catch { /* ignore */ }
    });

    // --- Leave Game (voluntarily back to lobby) ---
    socket.on(WS.LEAVE_GAME, (payload: { gameId: string }) => {
      try {
        const userId = (socket.data as any).userId as string;
        if (!payload?.gameId) return;
        const gameId = payload.gameId;
        const room = roomForGame(gameId);

        // Clean up restart requests
        restartRequests.delete(gameId);

        // Check if game is still ongoing
        const game = gameSessions.get(gameId);
        const wasOngoing = game && game.status !== "GAME_OVER";

        if (wasOngoing) {
          gameSessions.delete(gameId);
          audit.logSystemEvent?.({ type: "GAME_PLAYER_LEFT", at: Date.now(), userId, gameId });
        }

        // Notify opponent
        socket.to(room).emit(WS.OPPONENT_LEFT, {
          userId,
          message: wasOngoing
            ? "Opponent left the game. No match recorded."
            : "Opponent has left.",
          aborted: !!wasOngoing,
        });

        // Leave the WS room
        socket.leave(room);
      } catch { /* ignore */ }
    });

    socket.on("disconnect", async () => {
      const userId = (socket.data as any).userId;
      const role = (socket.data as any).role;
      audit.logAuthEvent?.({ type: "WS_DISCONNECT", at: Date.now(), userId });

      // Remove from userId-socket tracking
      if (userId && userSockets.get(userId) === socket.id) {
        userSockets.delete(userId);
      }

      // Notify other players in any game rooms this socket was in
      for (const room of socket.rooms) {
        if (room.startsWith("game:")) {
          const gameId = room.replace("game:", "");
          // Clean up restart requests for this game
          restartRequests.delete(gameId);

          // Check if game is still ongoing (not GAME_OVER)
          const game = gameSessions.get(gameId);
          const wasOngoing = game && game.status !== "GAME_OVER";

          if (wasOngoing) {
            // Remove the game session so no match result gets recorded
            gameSessions.delete(gameId);
            audit.logSystemEvent?.({ type: "GAME_ABORTED", at: Date.now(), userId, gameId });
          }

          // Notify remaining players
          socket.to(room).emit(WS.OPPONENT_LEFT, {
            userId,
            message: wasOngoing
              ? "Opponent disconnected — game aborted. No match recorded."
              : "Your opponent has left the game.",
            aborted: !!wasOngoing,
          });
        }
      }

      // If guest, delete their player record from DB
      if (role === "guest" && userId) {
        try {
          await repo.deletePlayer(userId);
        } catch { /* ignore */ }
      }
    });
  }

  function register() {
    io.on("connection", handleConnection);
  }

  async function forceDisconnectUser(userId: string) {
    const socketId = userSockets.get(userId);
    if (socketId) {
      const socket = io.sockets.sockets.get(socketId);
      if (socket) {
        socket.emit(WS.FORCE_LOGOUT, { message: "You have been force-logged out by an admin." });
        socket.disconnect(true);
      }
      userSockets.delete(userId);
    }
  }

  async function kickUserFromRoom(userId: string) {
    const socketId = userSockets.get(userId);
    if (socketId) {
      const socket = io.sockets.sockets.get(socketId);
      if (socket) {
        socket.emit(WS.ROOM_DELETED, { message: "Your room has been deleted by an admin." });
        socket.disconnect(true);
      }
      userSockets.delete(userId);
    }
  }

  return { register, forceDisconnectUser, kickUserFromRoom };
}
