import { useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import LobbyScreen from "./components/LobbyScreen";
import GameScreen from "./components/GameScreen";
import './App.css';

const API = "http://localhost:3001/api/v1";
const WS_URL = "http://localhost:3001";

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
} as const;

type AuthResult = { token: string; user: { userId: string; username: string; role: string } };

type Card = { suit: "S" | "H" | "D" | "C"; rank: string };

type RoundResult = {
  winner: string;
  loser: string;
  pointsGained: number;
  scoresDec: Record<string, number>;
};

type PublicState = {
  gameId: string;
  baseId: "doz" | "dec";
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
  const [username, setUsername] = useState("u1");
  const [password, setPassword] = useState("123456");
  const [token, setToken] = useState<string>(() => localStorage.getItem("token") || "");
  const [userId, setUserId] = useState<string>(() => localStorage.getItem("userId") || "");

  const [baseId, setBaseId] = useState<"doz" | "dec">("doz");
  const [lobbyId, setLobbyId] = useState("");

  const [gameId, setGameId] = useState("");
  const [ps, setPs] = useState<PublicState | null>(null);

  const [wsStatus, setWsStatus] = useState<"disconnected" | "connected">("disconnected");
  const sockRef = useRef<Socket | null>(null);

  const [myHand, setMyHand] = useState<Card[]>([]);

  const [log, setLog] = useState<string[]>([]);
  const pushLog = useCallback((s: string) => setLog((x) => [s, ...x].slice(0, 200)), []);

  // Track if we've joined the game via WS
  const [gameJoined, setGameJoined] = useState(false);

  // Lobby status
  const [lobbyStatus, setLobbyStatus] = useState<"idle" | "created" | "joined" | "starting" | "ready">("idle");

  // Restart state
  const [restartStatus, setRestartStatus] = useState<"none" | "waiting" | "opponent_requested">("none");

  // Saved game ID for rejoin
  const [savedGameId, setSavedGameId] = useState<string>(() => localStorage.getItem("savedGameId") || "");

  // Determine if we should show game screen
  const showGameScreen = ps !== null && gameJoined;

  // --- auth ---
  async function doRegister() {
    const out = await postJSON<AuthResult>(`${API}/auth/register`, { username, password });
    setToken(out.token);
    setUserId(out.user.userId);
    localStorage.setItem("token", out.token);
    localStorage.setItem("userId", out.user.userId);
    pushLog(`Registered as ${out.user.username}`);
  }
  async function doLogin() {
    const out = await postJSON<AuthResult>(`${API}/auth/login`, { username, password });
    setToken(out.token);
    setUserId(out.user.userId);
    localStorage.setItem("token", out.token);
    localStorage.setItem("userId", out.user.userId);
    pushLog(`Logged in as ${out.user.username}`);
  }
  function doLogoutLocal() {
    setToken("");
    setUserId("");
    localStorage.removeItem("token");
    localStorage.removeItem("userId");
    pushLog("Logged out");
    if (sockRef.current) {
      sockRef.current.disconnect();
      sockRef.current = null;
      setWsStatus("disconnected");
    }
    setPs(null);
    setGameJoined(false);
    setMyHand([]);
    setGameId("");
    setLobbyId("");
    setLobbyStatus("idle");
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
      setWsStatus("connected");
      pushLog(`Connected to server`);
      // Auto-join the game room once connected
      s.emit(WS.JOIN_GAME, { gameId: gId });
      pushLog(`Joining game...`);
      setGameJoined(true);
    });

    s.on("disconnect", (r: string) => {
      setWsStatus("disconnected");
      pushLog(`Disconnected: ${r}`);
      sockRef.current = null;
      setGameJoined(false);
    });

    s.on(WS.ERROR, (e: unknown) => pushLog(`ERROR: ${JSON.stringify(e)}`));

    s.on(WS.GAME_STATE, (state: PublicState) => {
      setPs(state);
      if (state.status === "GAME_OVER") {
        setSavedGameId("");
        localStorage.removeItem("savedGameId");
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
  }

  // --- Rejoin a previously active game ---
  function handleRejoinGame() {
    if (!savedGameId || !token) return;
    setGameId(savedGameId);
    connectAndJoinGame(token, savedGameId);
    setSavedGameId("");
    localStorage.removeItem("savedGameId");
    pushLog(`Rejoining game ${savedGameId}...`);
  }

  // --- Simplified lobby flow ---

  // P1: Create lobby
  async function handleCreateLobby() {
    if (!token) throw new Error("Need login first");
    const out = await postJSON<{ lobby: any; gameId?: string | null }>(`${API}/lobby/create`, {}, token);
    setLobbyId(out.lobby.lobbyId);
    if (out.gameId) setGameId(out.gameId);
    setLobbyStatus("created");
    pushLog(`Lobby created: ${out.lobby.lobbyId}`);
  }

  // P2: Join lobby
  async function handleJoinLobby() {
    if (!token) throw new Error("Need login first");
    if (!lobbyId) throw new Error("Enter lobby ID");
    await postJSON<{ lobby: any; gameId?: string | null }>(`${API}/lobby/join`, { lobbyId }, token);
    setLobbyStatus("joined");
    pushLog(`Joined lobby: ${lobbyId}`);

    // Start polling for game start
    pollForGameStart(lobbyId, token);
  }

  // P1: Start the game -> auto connect WS + join
  async function handleStartGame() {
    if (!token) throw new Error("Need login first");
    if (!lobbyId) throw new Error("Need lobbyId");
    setLobbyStatus("starting");
    pushLog("Starting game...");

    const out = await postJSON<{ gameId: string; publicState: PublicState }>(
      `${API}/lobby/start`,
      { lobbyId, baseId },
      token
    );
    setGameId(out.gameId);
    setPs(out.publicState);
    pushLog(`Game started!`);

    // Auto connect WS and join game
    connectAndJoinGame(token, out.gameId);
  }

  // P2: Poll lobby status until game starts, then auto-join
  function pollForGameStart(lid: string, tok: string) {
    pushLog("Waiting for host to start...");
    const interval = setInterval(async () => {
      try {
        const out = await getJSON<{ lobby: any; gameId?: string | null }>(
          `${API}/lobby/status?lobbyId=${encodeURIComponent(lid)}`,
          tok
        );
        if (out.gameId) {
          clearInterval(interval);
          setGameId(out.gameId);
          pushLog(`Game found! Connecting...`);
          // Auto connect WS and join game
          connectAndJoinGame(tok, out.gameId);
        }
      } catch {
        // Keep polling
      }
    }, 1500);

    // Clean up after 5 minutes
    setTimeout(() => clearInterval(interval), 300000);
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
    emitAction({ type: "ANSWER_CHALLENGE", playerId: userId, answer });
  }

  function requestRestart() {
    const s = sockRef.current;
    if (!s) return pushLog("Not connected");
    if (!gameId) return pushLog("No active game");
    s.emit(WS.REQUEST_RESTART, { gameId });
    pushLog("Requested rematch...");
  }

  const myTurn = ps ? ps.turn === userId : false;

  // Back to lobby handler
  function handleBackToLobby() {
    // Save game ID for rejoin if game is still ongoing
    if (ps && ps.status !== "GAME_OVER" && gameId) {
      setSavedGameId(gameId);
      localStorage.setItem("savedGameId", gameId);
    } else {
      setSavedGameId("");
      localStorage.removeItem("savedGameId");
    }
    setGameJoined(false);
    setPs(null);
    setMyHand([]);
    setRestartStatus("none");
    setLobbyStatus("idle");
    setGameId("");
    setLobbyId("");
    if (sockRef.current) {
      sockRef.current.disconnect();
      sockRef.current = null;
      setWsStatus("disconnected");
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
        onAnswerChallenge={doAnswerChallenge}
        onBackToLobby={handleBackToLobby}
        restartStatus={restartStatus}
        onRequestRestart={requestRestart}
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
      onRegister={() => doRegister().catch((e) => pushLog(`Error: ${e.message}`))}
      onLogin={() => doLogin().catch((e) => pushLog(`Error: ${e.message}`))}
      onLogout={doLogoutLocal}
      baseId={baseId}
      setBaseId={setBaseId}
      lobbyId={lobbyId}
      setLobbyId={setLobbyId}
      lobbyStatus={lobbyStatus}
      onCreateLobby={() => handleCreateLobby().catch((e) => pushLog(`Error: ${e.message}`))}
      onJoinLobby={() => handleJoinLobby().catch((e) => pushLog(`Error: ${e.message}`))}
      onStartGame={() => handleStartGame().catch((e) => pushLog(`Error: ${e.message}`))}
      savedGameId={savedGameId}
      onRejoinGame={handleRejoinGame}
      log={log}
    />
  );
}
