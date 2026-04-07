import { useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import LobbyScreen from "./components/LobbyScreen";
import GameScreen from "./components/GameScreen";
import ProfilePage from "./components/ProfilePage";
import AdminPage from "./components/AdminPage";
import './App.css';

const API = import.meta.env.VITE_API_URL || "/api/v1";
const WS_URL = import.meta.env.VITE_WS_URL || "";

const WS = {
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
  // Challenge result
  CHALLENGE_RESULT: "challenge_result",
  CHALLENGE_RESOLVED: "challenge_resolved",
  CHALLENGE_WRONG: "challenge_wrong",
} as const;

type AuthResult = { token: string; user: { userId: string; username: string; role: string } };

type Card = { suit: "S" | "H" | "D" | "C"; rank: string };

type RoundResult = {
  winner: string;
  loser: string;
  pointsGained: number;
  pointsGainedText?: string;
  scoresDec: Record<string, number>;
  scoresText?: Record<string, string>;
};

type PublicState = {
  gameId: string;
  baseId: "doz" | "dec" | "oct";
  status: "ONGOING" | "GAME_OVER";
  turn: string;
  topCard: Card;
  forcedSuit?: "S" | "H" | "D" | "C";
  activeChallenge?: {
    playerId: string;
    type: '+' | '-' | '*' | '/';
    op1: number;
    op2: number;
    answer?: number;
    reward: number;
    shouldPassTurn: boolean;
  };
  handsCount: Record<string, number>;
  scoresDec: Record<string, number>;
  scoresText: Record<string, string>;
  targetScoreDec: number;
  targetScoreText: string;
  faceRanks: string[];
  deckNumericSymbols: string[];
  lastRoundResult?: RoundResult;
};

async function postJSON<T>(url: string, body: any, token?: string): Promise<T> {
  const r = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body ?? {}),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.message || data?.error || `HTTP ${r.status}`);
  return data as T;
}

async function getJSON<T>(url: string, token?: string): Promise<T> {
  const r = await fetch(url, {
    method: "GET",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.message || data?.error || `HTTP ${r.status}`);
  return data as T;
}

export default function App() {
  const [username, setUsername] = useState(() => sessionStorage.getItem("username") || "u1");
  const [password, setPassword] = useState("123456");
  const [token, setToken] = useState<string>(() => sessionStorage.getItem("token") || "");
  const [userId, setUserId] = useState<string>(() => sessionStorage.getItem("userId") || "");

  const [baseId, setBaseId] = useState<"doz" | "dec" | "oct">("doz");
  const [lobbyId, setLobbyId] = useState("");

  const [gameId, setGameId] = useState("");
  const [ps, setPs] = useState<PublicState | null>(null);

  const sockRef = useRef<Socket | null>(null);

  const [challengeResult, setChallengeResult] = useState<{ won: boolean; correct: boolean; tooLate: boolean } | null>(null);

  // Ref for lobby poll interval so it can be cleared on leave
  const lobbyPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [myHand, setMyHand] = useState<Card[]>([]);

  const [log, setLog] = useState<string[]>([]);
  const pushLog = useCallback((s: string) => setLog((x) => [s, ...x].slice(0, 200)), []);

  // Track if we've joined the game via WS
  const [gameJoined, setGameJoined] = useState(false);

  // Lobby status
  const [lobbyStatus, setLobbyStatus] = useState<"idle" | "created" | "joined" | "starting" | "ready">("idle");

  // Restart state
  const [restartStatus, setRestartStatus] = useState<'none' | 'waiting' | 'opponent_requested'>('none');
  const [opponentLeftMsg, setOpponentLeftMsg] = useState<string>('');

  // Saved game ID for rejoin
  const [savedGameId, setSavedGameId] = useState<string>(() => sessionStorage.getItem("savedGameId") || "");

  // Room list for lobby browser
  const [rooms, setRooms] = useState<any[]>([]);

  // Profile page visibility
  const [showProfile, setShowProfile] = useState(false);

  // Track if opponent has joined the room
  const [roomHasGuest, setRoomHasGuest] = useState(false);

  // Admin mode
  const [isAdmin, setIsAdmin] = useState(() => sessionStorage.getItem("isAdmin") === "true");

  // Guest mode
  const [isGuest, setIsGuest] = useState(() => sessionStorage.getItem("isGuest") === "true");

  // Chat
  const [chatMessages, setChatMessages] = useState<{ from: string; text: string; ts: number }[]>([]);

  // Challenge resolution (new dual-player system)
  type ChallengeResolution = {
    winnerId: string | null;
    correctAnswer: number;
    timedOut: boolean;
    bothWrong?: boolean;
    challengeData?: { type: string; op1: number; op2: number; reward: number };
  };
  const [challengeResolution, setChallengeResolution] = useState<ChallengeResolution | null>(null);

  // Challenge history for current game
  type ChallengeHistoryEntry = {
    type: string;
    op1: number;
    op2: number;
    correctAnswer: number;
    myAnswer?: number;
    won: boolean;
    timedOut: boolean;
    timestamp: number;
  };
  const [challengeHistory, setChallengeHistory] = useState<ChallengeHistoryEntry[]>([]);

  // Challenge start timestamp (for countdown timer)
  const [challengeStartTime, setChallengeStartTime] = useState<number | null>(null);
  // Tracks last challenge signature to avoid resetting timer on repeated GAME_STATE events
  const prevChallengeRef = useRef<string | null>(null);

  // Toast notification
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'info' } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((message: string, type: 'error' | 'info' = 'error') => {
    setToast({ message, type });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 4000);
  }, []);
  const clearToast = useCallback(() => {
    setToast(null);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);

  // Determine if we should show game screen
  const showGameScreen = ps !== null && gameJoined;

  // --- auth ---
  async function doRegister() {
    const out = await postJSON<AuthResult>(`${API}/auth/register`, { username, password });
    setToken(out.token);
    setUserId(out.user.userId);
    setUsername(out.user.username);
    sessionStorage.setItem("token", out.token);
    sessionStorage.setItem("userId", out.user.userId);
    sessionStorage.setItem("username", out.user.username);
    pushLog(`Registered as ${out.user.username}`);
  }
  async function doLogin() {
    const out = await postJSON<AuthResult>(`${API}/auth/login`, { username, password });
    setToken(out.token);
    setUserId(out.user.userId);
    setUsername(out.user.username);
    sessionStorage.setItem("token", out.token);
    sessionStorage.setItem("userId", out.user.userId);
    sessionStorage.setItem("username", out.user.username);
    pushLog(`Logged in as ${out.user.username}`);
  }
  async function doAdminLogin() {
    const out = await postJSON<AuthResult>(`${API}/admin/login`, { username, password });
    setToken(out.token);
    setUserId(out.user.userId);
    setIsAdmin(true);
    sessionStorage.setItem("token", out.token);
    sessionStorage.setItem("userId", out.user.userId);
    sessionStorage.setItem("isAdmin", "true");
    pushLog(`Admin login as ${out.user.username}`);
  }
  async function doGuestLogin() {
    const tag = Math.random().toString(36).slice(2, 8);
    const out = await postJSON<AuthResult>(`${API}/auth/guest`, { deviceId: tag });
    setToken(out.token);
    setUserId(out.user.userId);
    setUsername(out.user.username);
    setIsGuest(true);
    sessionStorage.setItem("token", out.token);
    sessionStorage.setItem("userId", out.user.userId);
    sessionStorage.setItem("username", out.user.username);
    sessionStorage.setItem("isGuest", "true");
    pushLog(`Guest login as ${out.user.username}`);
  }
  async function doLogoutLocal() {
    // Call backend to clear session IAT (prevents "already logged in" on re-login)
    if (token) {
      try {
        await fetch(`${API}/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ token }),
        });
      } catch { /* ignore network errors during logout */ }
    }
    setToken("");
    setUserId("");
    setUsername("");
    setIsGuest(false);
    setIsAdmin(false);
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("userId");
    sessionStorage.removeItem("username");
    sessionStorage.removeItem("isGuest");
    sessionStorage.removeItem("isAdmin");
    pushLog("Logged out");
    if (sockRef.current) {
      sockRef.current.disconnect();
      sockRef.current = null;
    }
    setPs(null);
    setGameJoined(false);
    setMyHand([]);
    setGameId("");
    setLobbyId("");
    setLobbyStatus("idle");
    setSavedGameId("");
    sessionStorage.removeItem("savedGameId");
    // Clear lobby poll
    if (lobbyPollRef.current) {
      clearInterval(lobbyPollRef.current);
      lobbyPollRef.current = null;
    }
  }

  // --- Helper: connect WS, then join game room ---
  function connectAndJoinGame(tok: string, gId: string) {
    if (sockRef.current) {
      // Already connected, just join
      sockRef.current.emit(WS.JOIN_GAME, { gameId: gId });
      pushLog(`Joining game ${gId}...`);
      setGameJoined(true);
      return;
    }

    const s = io(WS_URL, { auth: { token: tok }, transports: ["websocket"] });
    sockRef.current = s;

    s.on("connect", () => {
      pushLog(`Connected to server`);
      // Auto-join the game room once connected
      s.emit(WS.JOIN_GAME, { gameId: gId });
      pushLog(`Joining game...`);
      setGameJoined(true);
    });

    s.on("disconnect", (r: string) => {
      pushLog(`Disconnected: ${r}`);
      sockRef.current = null;
      setGameJoined(false);
    });

    s.on(WS.ERROR, (e: unknown) => {
      const msg = typeof e === 'object' && e !== null && 'message' in e ? (e as any).message : JSON.stringify(e);
      pushLog(`ERROR: ${msg}`);
      showToast(msg, 'error');
    });

    s.on(WS.GAME_STATE, (state: PublicState) => {
      setPs(state);
      if (state.activeChallenge) {
        // Build a signature for this challenge to detect if it's truly new
        const sig = `${state.activeChallenge.type}-${state.activeChallenge.op1}-${state.activeChallenge.op2}`;
        if (prevChallengeRef.current !== sig) {
          // Genuinely new challenge — reset everything
          prevChallengeRef.current = sig;
          setChallengeResult(null);
          setChallengeResolution(null);
          setChallengeStartTime(Date.now());
        }
        // If same challenge, don't reset timer or clear results
      } else {
        // No active challenge
        prevChallengeRef.current = null;
        setChallengeStartTime(null);
      }
      if (state.status === "GAME_OVER") {
        setSavedGameId("");
        sessionStorage.removeItem("savedGameId");
      }
    });

    s.on(WS.MY_HAND, (payload: any) => {
      setMyHand(payload?.hand ?? []);
    });

    // Restart event handlers
    s.on(WS.RESTART_REQUESTED, () => {
      setRestartStatus("opponent_requested");
      pushLog(`Opponent requested rematch`);
    });

    s.on(WS.RESTART_CONFIRMED, (payload: { message: string }) => {
      setRestartStatus("waiting");
      pushLog(payload.message);
    });

    s.on(WS.GAME_RESTARTED, (payload: { oldGameId: string; newGameId: string; publicState: PublicState }) => {
      setGameId(payload.newGameId);
      setPs(payload.publicState);
      setRestartStatus("none");
      pushLog(`Game restarted!`);
    });

    s.on(WS.OPPONENT_LEFT, (payload: { userId: string; message: string; aborted?: boolean }) => {
      pushLog(`⚠️ ${payload.message}`);
      setRestartStatus("none");
      // Show notification instead of auto-returning
      setOpponentLeftMsg(payload.aborted
        ? "Opponent disconnected — game aborted. No match recorded."
        : "Opponent has left the game.");
    });

    s.on(WS.RESTART_DECLINED, (payload: { declinedBy: string; message: string }) => {
      pushLog(`❌ ${payload.message}`);
      setRestartStatus("none");
      // Auto-return to lobby
      setTimeout(() => {
        setGameJoined(false);
        setPs(null);
        setMyHand([]);
        setRestartStatus("none");
        setLobbyStatus("idle");
        setGameId("");
        setLobbyId("");
        setSavedGameId("");
        sessionStorage.removeItem("savedGameId");
        if (sockRef.current) {
          sockRef.current.disconnect();
          sockRef.current = null;
        }
        pushLog("Returned to lobby — rematch declined.");
      }, 2000);
    });

    // Force-logout: admin kicked the user
    s.on(WS.FORCE_LOGOUT, (payload: { message: string }) => {
      pushLog(`⚠️ ${payload.message}`);
      doLogoutLocal();
    });

    // Chat
    s.on(WS.CHAT_MSG, (payload: { from: string; text: string; ts: number }) => {
      setChatMessages(prev => [...prev, payload]);
    });

    // Room deleted by admin (kick back to lobby, don't logout)
    s.on(WS.ROOM_DELETED, (payload: { message: string }) => {
      pushLog(`⚠️ ${payload.message}`);
      alert(payload.message);
      // Return to lobby without logging out
      setGameJoined(false);
      setPs(null);
      setMyHand([]);
      setRestartStatus("none");
      setLobbyStatus("idle");
      setGameId("");
      setLobbyId("");
      setChatMessages([]);
      setSavedGameId("");
      sessionStorage.removeItem("savedGameId");
      if (sockRef.current) {
        sockRef.current.disconnect();
        sockRef.current = null;
      }
    });

    // Challenge result from server (legacy)
    s.on(WS.CHALLENGE_RESULT, (payload: { won: boolean; correct: boolean; tooLate: boolean }) => {
      setChallengeResult(payload);
    });

    // Challenge resolved (new dual-player system)
    s.on(WS.CHALLENGE_RESOLVED, (payload: ChallengeResolution) => {
      setChallengeResolution(payload);
      // Add to history
      if (payload.challengeData) {
        setChallengeHistory(prev => [...prev, {
          type: payload.challengeData!.type,
          op1: payload.challengeData!.op1,
          op2: payload.challengeData!.op2,
          correctAnswer: payload.correctAnswer,
          won: payload.winnerId === sessionStorage.getItem('userId'),
          timedOut: payload.timedOut,
          timestamp: Date.now(),
        }]);
      }
      // Auto-dismiss after 3 seconds
      setTimeout(() => {
        setChallengeResolution(null);
      }, 3000);
    });

    // Challenge wrong (server tells this player they're wrong)
    s.on(WS.CHALLENGE_WRONG, (_payload: { playerId: string }) => {
      // Already handled by CHALLENGE_RESULT for UI
    });
  }

  // --- Rejoin a previously active game ---
  function handleRejoinGame() {
    if (!savedGameId || !token) return;
    setGameId(savedGameId);
    connectAndJoinGame(token, savedGameId);
    setSavedGameId("");
    sessionStorage.removeItem("savedGameId");
    pushLog(`Rejoining game ${savedGameId}...`);
  }

  // --- Lobby flow ---

  async function fetchRooms() {
    if (!token) return;
    try {
      const out = await getJSON<{ rooms: any[] }>(`${API}/lobby/list`, token);
      setRooms(out.rooms);
    } catch {
      // ignore fetch errors
    }
  }

  // P1: Create game room
  async function handleCreateLobby() {
    if (!token) throw new Error("Need login first");
    const out = await postJSON<{ lobby: any; gameId?: string | null }>(
      `${API}/lobby/create`,
      { baseId, username },
      token
    );
    setLobbyId(out.lobby.lobbyId);
    if (out.gameId) setGameId(out.gameId);
    setLobbyStatus("created");
    setRoomHasGuest(false);
    pushLog(`Room created: ${out.lobby.lobbyId}`);

    // Poll lobby status continuously (detect guest join/leave, room deletion)
    const lid = out.lobby.lobbyId;
    const tok = token;
    // Clear any previous poll interval
    if (lobbyPollRef.current) {
      clearInterval(lobbyPollRef.current);
      lobbyPollRef.current = null;
    }
    lobbyPollRef.current = setInterval(async () => {
      try {
        const status = await getJSON<{ lobby: any; gameId?: string | null }>(
          `${API}/lobby/status?lobbyId=${encodeURIComponent(lid)}`, tok
        );
        // Track guest presence dynamically — only update on change to avoid flicker
        const hasGuest = !!status.lobby?.guestId;
        setRoomHasGuest(prev => prev === hasGuest ? prev : hasGuest);
      } catch (e: any) {
        // Room was deleted (admin or host left)
        if (e.message?.includes('LobbyNotFound') || e.message?.includes('404')) {
          if (lobbyPollRef.current) {
            clearInterval(lobbyPollRef.current);
            lobbyPollRef.current = null;
          }
          setLobbyId('');
          setLobbyStatus('idle');
          setRoomHasGuest(false);
          pushLog('⚠️ Room was deleted.');
        }
      }
    }, 2000);
  }

  // Leave a room before game starts
  async function handleLeaveRoom() {
    if (!token || !lobbyId) return;
    // Clear poll interval before leaving
    if (lobbyPollRef.current) {
      clearInterval(lobbyPollRef.current);
      lobbyPollRef.current = null;
    }
    try {
      await postJSON(`${API}/lobby/leave`, { lobbyId }, token);
      pushLog("Left room.");
    } catch (e: any) {
      pushLog(`Error leaving: ${e.message}`);
    }
    setLobbyId("");
    setLobbyStatus("idle");
    setRoomHasGuest(false);
  }

  // P2: Join game room from room list
  async function handleJoinRoom(roomLobbyId: string) {
    if (!token) throw new Error("Need login first");
    await postJSON<{ lobby: any; gameId?: string | null }>(`${API}/lobby/join`, { lobbyId: roomLobbyId }, token);
    setLobbyId(roomLobbyId);
    setLobbyStatus("joined");
    pushLog(`Joined room: ${roomLobbyId}`);

    // Start polling for game start
    pollForGameStart(roomLobbyId, token);
  }

  // P1: Start the game -> auto connect WS + join
  async function handleStartGame() {
    if (!token) throw new Error("Need login first");
    if (!lobbyId) throw new Error("Need lobbyId");
    // Clear lobby poll before starting
    if (lobbyPollRef.current) {
      clearInterval(lobbyPollRef.current);
      lobbyPollRef.current = null;
    }
    setLobbyStatus("starting");
    pushLog("Starting game...");

    try {
      const out = await postJSON<{ gameId: string; publicState: PublicState }>(
        `${API}/lobby/start`,
        { lobbyId },
        token
      );
      setGameId(out.gameId);
      setPs(out.publicState);
      pushLog(`Game started!`);

      // Auto connect WS and join game
      connectAndJoinGame(token, out.gameId);
    } catch (e: any) {
      // Race condition: guest left right before start
      pushLog(`⚠️ Could not start: ${e.message}`);
      setLobbyStatus("created");
      setRoomHasGuest(false);
      // Restart the lobby poll so we can detect new guests
      const lid = lobbyId;
      const tok = token;
      lobbyPollRef.current = setInterval(async () => {
        try {
          const status = await getJSON<{ lobby: any; gameId?: string | null }>(
            `${API}/lobby/status?lobbyId=${encodeURIComponent(lid)}`, tok
          );
          const hasGuest = !!status.lobby?.guestId;
          setRoomHasGuest(prev => prev === hasGuest ? prev : hasGuest);
        } catch (err: any) {
          if (err.message?.includes('LobbyNotFound') || err.message?.includes('404')) {
            if (lobbyPollRef.current) {
              clearInterval(lobbyPollRef.current);
              lobbyPollRef.current = null;
            }
            setLobbyId('');
            setLobbyStatus('idle');
            setRoomHasGuest(false);
            pushLog('⚠️ Room was deleted.');
          }
        }
      }, 2000);
    }
  }

  // P2: Poll lobby status until game starts, then auto-join
  function pollForGameStart(lid: string, tok: string) {
    pushLog("Waiting for host to start...");
    // Clear any previous poll
    if (lobbyPollRef.current) {
      clearInterval(lobbyPollRef.current);
      lobbyPollRef.current = null;
    }
    const interval = setInterval(async () => {
      try {
        const out = await getJSON<{ lobby: any; gameId?: string | null }>(
          `${API}/lobby/status?lobbyId=${encodeURIComponent(lid)}`,
          tok
        );
        if (out.gameId) {
          clearInterval(interval);
          lobbyPollRef.current = null;
          setGameId(out.gameId);
          pushLog(`Game found! Connecting...`);
          // Auto connect WS and join game
          connectAndJoinGame(tok, out.gameId);
        }
      } catch (e: any) {
        // Room was deleted by admin or host left
        if (e.message?.includes('LobbyNotFound') || e.message?.includes('404')) {
          clearInterval(interval);
          lobbyPollRef.current = null;
          setLobbyId('');
          setLobbyStatus('idle');
          pushLog('⚠️ Room was deleted by host.');
        }
      }
    }, 1500);
    lobbyPollRef.current = interval;

    // Clean up after 5 minutes
    setTimeout(() => {
      if (lobbyPollRef.current === interval) {
        clearInterval(interval);
        lobbyPollRef.current = null;
      }
    }, 300000);
  }

  // --- Game actions ---
  function emitAction(action: any) {
    const s = sockRef.current;
    if (!s) return pushLog("Not connected");
    if (!gameId) return pushLog("No active game");
    s.emit(WS.SUBMIT_ACTION, { gameId, action });
  }

  function doDraw() {
    if (!userId) return;
    emitAction({ type: "DRAW", playerId: userId });
  }

  function doPass() {
    if (!userId) return;
    emitAction({ type: "PASS", playerId: userId });
  }

  function doPlay(card: Card, chosenSuit?: "S" | "H" | "D" | "C", chosenOperation?: '+' | '-' | '*' | '/') {
    if (!userId) return;
    emitAction({ type: "PLAY", playerId: userId, card, chosenSuit, chosenOperation });
  }
  function doAnswerChallenge(answer: number) {
    if (!userId) return;
    setChallengeResult(null); // Clear previous result
    emitAction({ type: "ANSWER_CHALLENGE", playerId: userId, answer });
  }
  function doCheatWin() {
    if (!userId) return;
    emitAction({ type: "CHEAT_WIN", playerId: userId });
  }

  function requestRestart() {
    const s = sockRef.current;
    if (!s) return pushLog("Not connected");
    if (!gameId) return pushLog("No active game");
    s.emit(WS.REQUEST_RESTART, { gameId });
    pushLog("Requested rematch...");
  }

  function declineRestart() {
    const s = sockRef.current;
    if (!s) return pushLog("Not connected");
    if (!gameId) return pushLog("No active game");
    s.emit(WS.DECLINE_RESTART, { gameId });
    pushLog("Declined rematch.");
    // Delay to let server process DECLINE_RESTART before we disconnect
    setTimeout(() => handleBackToLobby(), 300);
  }

  function sendChat(text: string) {
    const s = sockRef.current;
    if (!s || !gameId) return;
    s.emit(WS.CHAT_SEND, { gameId, text });
  }

  const myTurn = ps ? ps.turn === userId : false;

  // Back to lobby handler
  function handleBackToLobby() {
    // Voluntary leave: do NOT save gameId for rejoin (game will be deleted by LEAVE_GAME)
    setSavedGameId("");
    sessionStorage.removeItem("savedGameId");
    // Emit LEAVE_GAME before disconnecting so server can notify opponent
    const s = sockRef.current;
    const gid = gameId;
    if (s && gid) {
      s.emit(WS.LEAVE_GAME, { gameId: gid });
    }
    setGameJoined(false);
    setPs(null);
    setMyHand([]);
    setRestartStatus("none");
    setOpponentLeftMsg("");
    setLobbyStatus("idle");
    setGameId("");
    setLobbyId("");
    setChatMessages([]);
    setChallengeHistory([]);
    setChallengeResolution(null);
    setChallengeStartTime(null);
    // Delay disconnect so server has time to process LEAVE_GAME and notify opponent
    if (s) {
      setTimeout(() => {
        s.disconnect();
        if (sockRef.current === s) sockRef.current = null;
      }, 300);
    }
  }

  // Render game screen
  if (showGameScreen && ps) {
    return (
      <GameScreen
        userId={userId}
        ps={ps}
        myHand={myHand}
        myTurn={myTurn}
        log={log}
        onDraw={doDraw}
        onPlay={doPlay}
        onPass={doPass}
        onAnswerChallenge={doAnswerChallenge}
        challengeResult={challengeResult}
        onBackToLobby={handleBackToLobby}
        restartStatus={restartStatus}
        onRequestRestart={requestRestart}
        onDeclineRestart={declineRestart}
        onCheatWin={doCheatWin}
        chatMessages={chatMessages}
        onSendChat={sendChat}
        opponentLeftMsg={opponentLeftMsg}
        toast={toast}
        onClearToast={clearToast}
        challengeResolution={challengeResolution}
        challengeHistory={challengeHistory}
        challengeStartTime={challengeStartTime}
      />
    );
  }

  // Render admin page
  if (isAdmin && token) {
    return (
      <AdminPage
        token={token}
        onLogout={() => {
          doLogoutLocal();
          setIsAdmin(false);
        }}
      />
    );
  }

  // Render profile page
  if (showProfile) {
    return (
      <ProfilePage
        token={token}
        username={username}
        onBack={() => setShowProfile(false)}
        onLogout={() => {
          doLogoutLocal();
          setShowProfile(false);
        }}
      />
    );
  }

  // Render lobby screen
  return (
    <LobbyScreen
      username={username}
      setUsername={setUsername}
      password={password}
      setPassword={setPassword}
      token={token}
      userId={userId}
      onRegister={() => doRegister().catch((e) => { pushLog(`Error: ${e.message}`); showToast(e.message, 'error'); })}
      onLogin={() => doLogin().catch((e) => { pushLog(`Error: ${e.message}`); showToast(e.message, 'error'); })}
      onLogout={doLogoutLocal}
      baseId={baseId}
      setBaseId={setBaseId}
      lobbyId={lobbyId}
      setLobbyId={setLobbyId}
      lobbyStatus={lobbyStatus}
      onCreateLobby={() => handleCreateLobby().catch((e) => { pushLog(`Error: ${e.message}`); showToast(e.message, 'error'); })}
      onJoinRoom={(id: string) => handleJoinRoom(id).catch((e) => { pushLog(`Error: ${e.message}`); showToast(e.message, 'error'); })}
      onStartGame={() => handleStartGame().catch((e) => { pushLog(`Error: ${e.message}`); showToast(e.message, 'error'); })}
      savedGameId={savedGameId}
      onRejoinGame={handleRejoinGame}
      rooms={rooms}
      onRefreshRooms={fetchRooms}
      onOpenProfile={() => setShowProfile(true)}
      onAdminLogin={() => doAdminLogin().catch((e) => { pushLog(`Error: ${e.message}`); showToast(e.message, 'error'); })}
      onGuestLogin={() => doGuestLogin().catch((e) => { pushLog(`Error: ${e.message}`); showToast(e.message, 'error'); })}
      onLeaveRoom={handleLeaveRoom}
      roomHasGuest={roomHasGuest}
      log={log}
      isGuest={isGuest}
      toast={toast}
      onClearToast={clearToast}
    />
  );
}
