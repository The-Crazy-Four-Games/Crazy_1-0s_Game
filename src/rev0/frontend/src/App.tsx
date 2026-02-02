import { useRef, useState } from "react";
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

type PublicState = {
  gameId: string;
  baseId: "doz" | "dec";
  status: "ONGOING" | "GAME_OVER";
  turn: string;
  topCard: Card;
  forcedSuit?: "S" | "H" | "D" | "C";
  handsCount: Record<string, number>;
  scoresText: Record<string, string>;
  targetScoreText: string;
  faceRanks: string[];
  deckNumericSymbols: string[];
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
  const pushLog = (s: string) => setLog((x) => [s, ...x].slice(0, 200));

  // Track if we've joined the game via WS
  const [gameJoined, setGameJoined] = useState(false);

  // Restart state
  const [restartStatus, setRestartStatus] = useState<"none" | "waiting" | "opponent_requested">("none");

  // Determine if we should show game screen
  // Show game screen when: we have public state AND game is started
  const showGameScreen = ps !== null && gameJoined;

  // --- auth ---
  async function doRegister() {
    const out = await postJSON<AuthResult>(`${API}/auth/register`, { username, password });
    setToken(out.token);
    setUserId(out.user.userId);
    localStorage.setItem("token", out.token);
    localStorage.setItem("userId", out.user.userId);
    pushLog(`REGISTER ok. userId=${out.user.userId}`);
  }
  async function doLogin() {
    const out = await postJSON<AuthResult>(`${API}/auth/login`, { username, password });
    setToken(out.token);
    setUserId(out.user.userId);
    localStorage.setItem("token", out.token);
    localStorage.setItem("userId", out.user.userId);
    pushLog(`LOGIN ok. userId=${out.user.userId}`);
  }
  function doLogoutLocal() {
    setToken("");
    setUserId("");
    localStorage.removeItem("token");
    localStorage.removeItem("userId");
    pushLog("Local logout");
    if (sockRef.current) {
      sockRef.current.disconnect();
      sockRef.current = null;
      setWsStatus("disconnected");
    }
    // Reset game state
    setPs(null);
    setGameJoined(false);
    setMyHand([]);
    setGameId("");
  }

  // --- lobby ---
  async function createLobby() {
    if (!token) throw new Error("Need login first");
    const out = await postJSON<{ lobby: any; gameId?: string | null }>(`${API}/lobby/create`, {}, token);
    setLobbyId(out.lobby.lobbyId);
    if (out.gameId) setGameId(out.gameId);
    pushLog(`Created lobby: ${out.lobby.lobbyId}`);
  }

  async function joinLobby() {
    if (!token) throw new Error("Need login first");
    if (!lobbyId) throw new Error("Enter lobbyId");
    const out = await postJSON<{ lobby: any; gameId?: string | null }>(`${API}/lobby/join`, { lobbyId }, token);
    pushLog(`Joined lobby: ${out.lobby.lobbyId}`);

    // auto sync after join
    await syncGameId().catch(() => {});
  }

  async function syncGameId() {
    if (!token) throw new Error("Need login first");
    if (!lobbyId) throw new Error("Need lobbyId");
    const out = await getJSON<{ lobby: any; gameId?: string | null }>(`${API}/lobby/status?lobbyId=${encodeURIComponent(lobbyId)}`, token);
    if (out.gameId) {
      setGameId(out.gameId);
      pushLog(`Synced gameId from lobby: ${out.gameId}`);
    } else {
      pushLog("Lobby has no gameId yet (host not started).");
    }
  }

  async function startMatch() {
    if (!token) throw new Error("Need login first");
    if (!lobbyId) throw new Error("Need lobbyId");
    const out = await postJSON<{ gameId: string; publicState: PublicState }>(
      `${API}/lobby/start`,
      { lobbyId, baseId },
      token
    );
    setGameId(out.gameId);
    setPs(out.publicState);
    pushLog(`Started match: gameId=${out.gameId}`);
  }

  // --- websocket ---
  function connectWS() {
    if (!token) return pushLog("Need login first");
    if (sockRef.current) return pushLog("WS already connected");

    const s = io(WS_URL, { auth: { token }, transports: ["websocket"] });
    sockRef.current = s;

    s.on("connect", () => { setWsStatus("connected"); pushLog(`WS connected (${s.id})`); });
    s.on("disconnect", (r: string) => { 
      setWsStatus("disconnected"); 
      pushLog(`WS disconnected: ${r}`); 
      sockRef.current = null; 
      setGameJoined(false);
    });
    s.on(WS.ERROR, (e: unknown) => pushLog(`WS ERROR: ${JSON.stringify(e)}`));

    s.on(WS.GAME_STATE, (state: PublicState) => {
      setPs(state);
      pushLog(`STATE: top=${state.topCard.rank}${state.topCard.suit} forced=${state.forcedSuit ?? "-"} turn=${state.turn.slice(0, 6)}...`);
    });

    s.on(WS.MY_HAND, (payload: any) => {
      setMyHand(payload?.hand ?? []);
      pushLog(`HAND updated: ${payload?.hand?.length ?? 0} cards`);
    });

    // Restart event handlers
    s.on(WS.RESTART_REQUESTED, (payload: { requestedBy: string }) => {
      setRestartStatus("opponent_requested");
      pushLog(`Opponent requested restart`);
    });

    s.on(WS.RESTART_CONFIRMED, (payload: { message: string }) => {
      setRestartStatus("waiting");
      pushLog(payload.message);
    });

    s.on(WS.GAME_RESTARTED, (payload: { oldGameId: string; newGameId: string; publicState: PublicState }) => {
      setGameId(payload.newGameId);
      setPs(payload.publicState);
      setRestartStatus("none");
      pushLog(`Game restarted! New game: ${payload.newGameId}`);
    });
  }

  function joinGameWS() {
    const s = sockRef.current;
    if (!s) return pushLog("WS not connected");
    if (!gameId) return pushLog("Need gameId (host start or sync first)");
    s.emit(WS.JOIN_GAME, { gameId });
    pushLog(`Sent join_game ${gameId}`);
    setGameJoined(true);
  }

  function emitAction(action: any) {
    const s = sockRef.current;
    if (!s) return pushLog("WS not connected");
    if (!gameId) return pushLog("Need gameId");
    s.emit(WS.SUBMIT_ACTION, { gameId, action });
  }

  function doDraw() {
    if (!userId) return pushLog("No userId");
    emitAction({ type: "DRAW", playerId: userId });
  }
  function doPass() {
    if (!userId) return pushLog("No userId");
    emitAction({ type: "PASS", playerId: userId });
  }
  function doPlay(card: Card, chosenSuit?: "S" | "H" | "D" | "C") {
    if (!userId) return pushLog("No userId");
    emitAction({ type: "PLAY", playerId: userId, card, chosenSuit });
  }

  function requestRestart() {
    const s = sockRef.current;
    if (!s) return pushLog("WS not connected");
    if (!gameId) return pushLog("Need gameId");
    s.emit(WS.REQUEST_RESTART, { gameId });
    pushLog("Requested restart...");
  }

  const myTurn = ps ? ps.turn === userId : false;

  // Back to lobby handler
  function handleBackToLobby() {
    setGameJoined(false);
    setPs(null);
    setMyHand([]);
    setRestartStatus("none");
  }

  // Render appropriate screen
  if (showGameScreen && ps) {
    return (
      <GameScreen
        userId={userId}
        ps={ps}
        myHand={myHand}
        myTurn={myTurn}
        log={log}
        onDraw={doDraw}
        onPass={doPass}
        onPlay={doPlay}
        onBackToLobby={handleBackToLobby}
        restartStatus={restartStatus}
        onRequestRestart={requestRestart}
      />
    );
  }

  return (
    <LobbyScreen
      username={username}
      setUsername={setUsername}
      password={password}
      setPassword={setPassword}
      token={token}
      userId={userId}
      onRegister={() => doRegister().catch((e) => pushLog(`ERR: ${e.message}`))}
      onLogin={() => doLogin().catch((e) => pushLog(`ERR: ${e.message}`))}
      onLogout={doLogoutLocal}
      baseId={baseId}
      setBaseId={setBaseId}
      lobbyId={lobbyId}
      setLobbyId={setLobbyId}
      gameId={gameId}
      onCreateLobby={() => createLobby().catch((e) => pushLog(`ERR: ${e.message}`))}
      onJoinLobby={() => joinLobby().catch((e) => pushLog(`ERR: ${e.message}`))}
      onStartMatch={() => startMatch().catch((e) => pushLog(`ERR: ${e.message}`))}
      onSyncGameId={() => syncGameId().catch((e) => pushLog(`ERR: ${e.message}`))}
      wsStatus={wsStatus}
      onConnectWS={connectWS}
      onJoinGameWS={joinGameWS}
      log={log}
    />
  );
}
