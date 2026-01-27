import type { Server as IOServer, Socket } from "socket.io";

import { applyAction, getPublicState } from "@rev0/shared";
import type { GameAction, GameState } from "@rev0/shared";

export const WS = {
  JOIN_GAME: "join_game",
  SUBMIT_ACTION: "submit_action",
  GAME_STATE: "game_state",
  MY_HAND: "my_hand",
  ERROR: "error",
} as const;

export type JoinGamePayload = { gameId: string };
export type SubmitActionPayload = { gameId: string; action: GameAction };

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
}) {
  const { io, auth, audit, gameSessions } = deps;

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

        const next = applyAction(cur, payload.action);
        gameSessions.set(payload.gameId, next);

        audit.logGameplayEvent?.({ type: "ACTION", at: Date.now(), userId, gameId: payload.gameId, action: payload.action });

        // broadcast new public state to room
        io.to(roomForGame(payload.gameId)).emit(WS.GAME_STATE, getPublicState(next));

        // emit private hands to players
        await emitHandsToRoom(payload.gameId, next);
      } catch (e: any) {
        emitError(socket, "ACTION_FAILED", e?.message ?? "Action failed");
      }
    });

    socket.on("disconnect", () => {
      const userId = (socket.data as any).userId;
      audit.logAuthEvent?.({ type: "WS_DISCONNECT", at: Date.now(), userId });
    });
  }

  function register() {
    io.on("connection", handleConnection);
  }

  return { register };
}
