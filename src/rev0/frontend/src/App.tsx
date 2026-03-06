import { useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import LobbyScreen from "./components/LobbyScreen";
import GameScreen from "./components/GameScreen";
import ProfilePage from "./components/ProfilePage";
import AdminPage from "./components/AdminPage";
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
  DECLINE_RESTART: "decline_restart",
  RESTART_DECLINED: "restart_declined",
  // Leave events
  OPPONENT_LEFT: "opponent_left",
  FORCE_LOGOUT: "force_logout",
  // Chat
  CHAT_SEND: "chat_send",
  CHAT_MSG: "chat_msg",
  // Admin
  ROOM_DELETED: "room_deleted",
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
  const [username, setUsername] = useState(() => sessionStorage.getItem("username") || "u1");
  const [password, setPassword] = useState("123456");
  const [token, setToken] = useState<string>(() => sessionStorage.getItem("token") || "");
  const [userId, setUserId] = useState<string>(() => sessionStorage.getItem("userId") || "");

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
  const [savedGameId, setSavedGameId] = useState<string>(() => sessionStorage.getItem("savedGameId") || "");

  // Room list for lobby browser
  const [rooms, setRooms] = useState<any[]>([]);

  // Profile page visibility
  const [showProfile, setShowProfile] = useState(false);

  // Track if opponent has joined the room
  const [roomHasGuest, setRoomHasGuest] = useState(false);

  // Admin mode
  const [isAdmin, setIsAdmin] = useState(false);

  // Guest mode
  const [isGuest, setIsGuest] = useState(() => sessionStorage.getItem("isGuest") === "true");

  // Chat
  const [chatMessages, setChatMessages] = useState<{ from: string; text: string; ts: number }[]>([]);

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
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("userId");
    sessionStorage.removeItem("username");
    sessionStorage.removeItem("isGuest");
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

      const returnToLobby = () => {
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
        pushLog(payload.aborted
          ? "Returned to lobby — game aborted, no match recorded."
          : "Returned to lobby — opponent left.");
      };

      // If game was aborted (mid-game disconnect), return immediately
      if (payload.aborted) {
        alert("Opponent disconnected — game aborted. No match recorded.");
        returnToLobby();
      } else {
        alert("Opponent has left the game. Returning to lobby.");
        returnToLobby();
      }
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
    const pollInterval = setInterval(async () => {
      try {
        const status = await getJSON<{ lobby: any; gameId?: string | null }>(
          `${API}/lobby/status?lobbyId=${encodeURIComponent(lid)}`, tok
        );
        // Track guest presence dynamically
        setRoomHasGuest(!!status.lobby?.guestId);
      } catch (e: any) {
        // Room was deleted (admin or auto-empty)
        if (e.message?.includes('LobbyNotFound') || e.message?.includes('404')) {
          clearInterval(pollInterval);
          setLobbyId('');
          setLobbyStatus('idle');
          setRoomHasGuest(false);
          pushLog('⚠️ Room was deleted. Returning to lobby.');
          alert('Your room has been deleted by an admin.');
        }
      }
    }, 2000);
  }

  // Leave a room before game starts
  async function handleLeaveRoom() {
    if (!token || !lobbyId) return;
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
    setLobbyStatus("starting");
    pushLog("Starting game...");

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
      } catch (e: any) {
        // Room was deleted by admin or host left
        if (e.message?.includes('LobbyNotFound') || e.message?.includes('404')) {
          clearInterval(interval);
          setLobbyId('');
          setLobbyStatus('idle');
          pushLog('⚠️ Room was deleted. Returning to lobby.');
          alert('The room has been deleted.');
        }
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
    handleBackToLobby();
  }

  function sendChat(text: string) {
    const s = sockRef.current;
    if (!s || !gameId) return;
    s.emit(WS.CHAT_SEND, { gameId, text });
  }

  const myTurn = ps ? ps.turn === userId : false;

  // Back to lobby handler
  function handleBackToLobby() {
    // Save game ID for rejoin if game is still ongoing
    if (ps && ps.status !== "GAME_OVER" && gameId) {
      setSavedGameId(gameId);
      sessionStorage.setItem("savedGameId", gameId);
    } else {
      setSavedGameId("");
      sessionStorage.removeItem("savedGameId");
    }
    setGameJoined(false);
    setPs(null);
    setMyHand([]);
    setRestartStatus("none");
    setLobbyStatus("idle");
    setGameId("");
    setLobbyId("");
    setChatMessages([]);
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
        onDeclineRestart={declineRestart}
        onCheatWin={doCheatWin}
        chatMessages={chatMessages}
        onSendChat={sendChat}
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
      onRegister={() => doRegister().catch((e) => pushLog(`Error: ${e.message}`))}
      onLogin={() => doLogin().catch((e) => pushLog(`Error: ${e.message}`))}
      onLogout={doLogoutLocal}
      baseId={baseId}
      setBaseId={setBaseId}
      lobbyId={lobbyId}
      setLobbyId={setLobbyId}
      lobbyStatus={lobbyStatus}
      onCreateLobby={() => handleCreateLobby().catch((e) => pushLog(`Error: ${e.message}`))}
      onJoinRoom={(id: string) => handleJoinRoom(id).catch((e) => pushLog(`Error: ${e.message}`))}
      onStartGame={() => handleStartGame().catch((e) => pushLog(`Error: ${e.message}`))}
      savedGameId={savedGameId}
      onRejoinGame={handleRejoinGame}
      rooms={rooms}
      onRefreshRooms={fetchRooms}
      onOpenProfile={() => setShowProfile(true)}
      onAdminLogin={() => doAdminLogin().catch((e) => pushLog(`Error: ${e.message}`))}
      onGuestLogin={() => doGuestLogin().catch((e) => pushLog(`Error: ${e.message}`))}
      onLeaveRoom={handleLeaveRoom}
      roomHasGuest={roomHasGuest}
      log={log}
      isGuest={isGuest}
    />
  );
}
