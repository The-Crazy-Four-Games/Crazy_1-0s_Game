import React, { useEffect, useMemo, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

const API = "http://localhost:3001/api/v1";
const WS_URL = "http://localhost:3001";

const WS = {
  JOIN_GAME: "join_game",
  SUBMIT_ACTION: "submit_action",
  GAME_STATE: "game_state",
  MY_HAND: "my_hand",
  ERROR: "error",
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

// input like "1H", "10S", "AH", "BH", "JD"
function parseCard(text: string): Card {
  const s = text.trim().toUpperCase();
  if (s.length < 2) throw new Error("Bad card format. Use like: 1H, 10S, AH, BH, JH");

  const suit = s.slice(-1);
  const rankRaw = s.slice(0, -1);

  if (!["S", "H", "D", "C"].includes(suit)) throw new Error("Suit must be S/H/D/C");

  const rank =
    rankRaw === "A" ? "↊" :
    rankRaw === "B" ? "↋" :
    rankRaw;

  return { suit: suit as any, rank };
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
  const [inputCard, setInputCard] = useState("1H");
  const [chosenSuit, setChosenSuit] = useState<"S" | "H" | "D" | "C">("S");

  const [log, setLog] = useState<string[]>([]);
  const pushLog = (s: string) => setLog((x) => [s, ...x].slice(0, 200));

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
    s.on("disconnect", (r) => { setWsStatus("disconnected"); pushLog(`WS disconnected: ${r}`); sockRef.current = null; });
    s.on(WS.ERROR, (e) => pushLog(`WS ERROR: ${JSON.stringify(e)}`));

    s.on(WS.GAME_STATE, (state: PublicState) => {
      setPs(state);
      pushLog(`STATE: top=${state.topCard.rank}${state.topCard.suit} forced=${state.forcedSuit ?? "-"} turn=${state.turn.slice(0, 6)}...`);
    });

    s.on(WS.MY_HAND, (payload: any) => {
      setMyHand(payload?.hand ?? []);
      pushLog(`HAND updated: ${payload?.hand?.length ?? 0} cards`);
    });
  }

  function joinGameWS() {
    const s = sockRef.current;
    if (!s) return pushLog("WS not connected");
    if (!gameId) return pushLog("Need gameId (host start or sync first)");
    s.emit(WS.JOIN_GAME, { gameId });
    pushLog(`Sent join_game ${gameId}`);
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
  function doPlay() {
    if (!userId) return pushLog("No userId");
    const card = parseCard(inputCard);
    emitAction({ type: "PLAY", playerId: userId, card, chosenSuit });
  }

  const myTurn = ps ? ps.turn === userId : false;

  const playableHint = useMemo(() => {
    if (!ps) return [];
    // weak hint 
    const effSuit = ps.forcedSuit ?? ps.topCard.suit;
    return myHand.filter((c) => c.suit === effSuit || c.rank === ps.topCard.rank || c.rank === "10");
  }, [ps, myHand]);

  const topLine = ps
    ? `TOP: ${ps.topCard.rank}${ps.topCard.suit}   FORCED: ${ps.forcedSuit ?? "-"}   BASE: ${ps.baseId}`
    : "TOP: -";

  const handLine = myHand.length
    ? myHand.map((c) => `${c.rank}${c.suit}`).join("  ")
    : "(empty)";

  const hintLine = ps
    ? (playableHint.length
        ? playableHint.map((c) => `${c.rank}${c.suit}`).join("  ")
        : "(no playable cards)")
    : "(no state)";

  return (
    <div style={{ padding: 16, maxWidth: 900, margin: "0 auto", fontFamily: "system-ui" }}>
      <h2>Rev0 Two-Player Web Sim (one player per browser)</h2>

      <div style={{ display: "grid", gap: 10, border: "1px solid #ddd", padding: 12, borderRadius: 10 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <b>Auth</b>
          <input placeholder="username" value={username} onChange={(e) => setUsername(e.target.value)} />
          <input placeholder="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button onClick={() => doRegister().catch((e) => pushLog(`ERR: ${e.message}`))}>register</button>
          <button onClick={() => doLogin().catch((e) => pushLog(`ERR: ${e.message}`))}>login</button>
          <button onClick={doLogoutLocal}>local logout</button>
        </div>
        <div style={{ fontFamily: "monospace", fontSize: 12, wordBreak: "break-all" }}>
          userId: {userId || "(none)"}<br />
          token: {token ? token.slice(0, 28) + "..." : "(none)"}
        </div>
      </div>

      <div style={{ marginTop: 12, display: "grid", gap: 10, border: "1px solid #ddd", padding: 12, borderRadius: 10 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <b>Lobby</b>
          <span>base:</span>
          <select value={baseId} onChange={(e) => setBaseId(e.target.value as any)}>
            <option value="doz">doz</option>
            <option value="dec">dec</option>
          </select>

          <button onClick={() => createLobby().catch((e) => pushLog(`ERR: ${e.message}`))}>create</button>

          <input placeholder="lobbyId" value={lobbyId} onChange={(e) => setLobbyId(e.target.value)} style={{ width: 180 }} />
          <button onClick={() => joinLobby().catch((e) => pushLog(`ERR: ${e.message}`))}>join</button>
          <button onClick={() => startMatch().catch((e) => pushLog(`ERR: ${e.message}`))}>start</button>

          {/* guest can also get gameID */}
          <button onClick={() => syncGameId().catch((e) => pushLog(`ERR: ${e.message}`))}>sync gameId</button>

          <span style={{ fontFamily: "monospace" }}>gameId: {gameId || "(none)"}</span>
        </div>
      </div>

      <div style={{ marginTop: 12, display: "grid", gap: 10, border: "1px solid #ddd", padding: 12, borderRadius: 10 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <b>Realtime</b>
          <button onClick={connectWS}>connect ws</button>
          <button onClick={joinGameWS}>join_game</button>
          <span>ws: <b>{wsStatus}</b></span>
        </div>

        <div style={{ fontFamily: "monospace", fontSize: 14 }}>
          {topLine}
          <div style={{ marginTop: 8 }}>
            TURN: {ps ? (ps.turn === userId ? "YOU ✅" : ps.turn.slice(0, 8) + "...") : "-"}
            {ps ? `   SCORE: ${ps.scoresText[userId] ?? "?"} / ${ps.targetScoreText}` : ""}
          </div>
          <div style={{ marginTop: 8 }}>
            YOUR HAND:
            {/* fix : white text can't be seen in white background */}
            <div style={{ marginTop: 4, padding: 8, background: "#f7f7f7", color: "#111", borderRadius: 8 }}>
              {handLine}
            </div>
          </div>
          <div style={{ marginTop: 8 }}>
            HINT (playable):
            <div style={{ marginTop: 4, padding: 8, background: "#f7f7f7", color: "#111", borderRadius: 8 }}>
              {hintLine}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button disabled={!myTurn} onClick={doDraw}>DRAW</button>
          <button disabled={!myTurn} onClick={doPass}>PASS</button>

          <span>PLAY:</span>
          <input value={inputCard} onChange={(e) => setInputCard(e.target.value)} style={{ width: 120 }} />
          <span>chosenSuit(for rank=10 wildcard):</span>
          <select value={chosenSuit} onChange={(e) => setChosenSuit(e.target.value as any)}>
            <option value="S">S</option>
            <option value="H">H</option>
            <option value="D">D</option>
            <option value="C">C</option>
          </select>
          <button disabled={!myTurn} onClick={doPlay}>PLAY</button>

          <span style={{ fontSize: 12, opacity: 0.8 }}>
            input example: 1H / 10S / AH(=↊) / BH(=↋) / JH / QD / KC / CH
          </span>
        </div>
      </div>

      <div style={{ marginTop: 12, border: "1px solid #ddd", padding: 12, borderRadius: 10 }}>
        <b>Log</b>
        <div style={{ fontFamily: "monospace", fontSize: 12, whiteSpace: "pre-wrap", maxHeight: 260, overflow: "auto", marginTop: 8 }}>
          {log.map((x, i) => <div key={i}>{x}</div>)}
        </div>
      </div>

      <div style={{ marginTop: 12, fontSize: 12, opacity: 0.8 }}>
        How to use ：P1 open in normal window；P2 open in "incognito window/another browser" (localStorage is not shared).<br />
        P1 register/login → create lobby (copy lobbyId to P2) → P2 join → P1 start → P2 click sync gameId → both connect ws + join_game → start playing.
      </div>
    </div>
  );
}
