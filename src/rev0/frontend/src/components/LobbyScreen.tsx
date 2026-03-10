import React from 'react';
import './LobbyScreen.css';

interface LobbyScreenProps {
  // Auth
  username: string;
  setUsername: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  token: string;
  userId: string;
  onRegister: () => void;
  onLogin: () => void;
  onLogout: () => void;

  // Lobby
  baseId: 'doz' | 'dec';
  setBaseId: (v: 'doz' | 'dec') => void;
  lobbyId: string;
  setLobbyId: (v: string) => void;
  gameId: string;
  onCreateLobby: () => void;
  onJoinLobby: () => void;
  onStartMatch: () => void;
  onSyncGameId: () => void;

  // Realtime
  wsStatus: 'disconnected' | 'connected';
  onConnectWS: () => void;
  onJoinGameWS: () => void;

  // Log
  log: string[];
}

export const LobbyScreen: React.FC<LobbyScreenProps> = ({
  username,
  setUsername,
  password,
  setPassword,
  token,
  userId,
  onRegister,
  onLogin,
  onLogout,
  baseId,
  setBaseId,
  lobbyId,
  setLobbyId,
  gameId,
  onCreateLobby,
  onJoinLobby,
  onStartMatch,
  onSyncGameId,
  wsStatus,
  onConnectWS,
  onJoinGameWS,
  log,
}) => {
  return (
    <div className="lobby-screen">
      <h2 className="lobby-title">Rev0 Two-Player Web Sim (one player per browser)</h2>

      {/* Auth Section */}
      <div className="lobby-section">
        <div className="section-row">
          <b>Auth</b>
          <input
            placeholder="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            placeholder="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button onClick={onRegister}>register</button>
          <button onClick={onLogin}>login</button>
          <button onClick={onLogout}>local logout</button>
        </div>
        <div className="section-info">
          userId: {userId || '(none)'}
          <br />
          token: {token ? token.slice(0, 28) + '...' : '(none)'}
        </div>
      </div>

      {/* Lobby Section */}
      <div className="lobby-section">
        <div className="section-row">
          <b>Lobby</b>
          <span>base:</span>
          <select value={baseId} onChange={(e) => setBaseId(e.target.value as any)}>
            <option value="doz">doz</option>
            <option value="dec">dec</option>
          </select>
          <button onClick={onCreateLobby}>create</button>
          <input
            placeholder="lobbyId"
            value={lobbyId}
            onChange={(e) => setLobbyId(e.target.value)}
            style={{ width: 180 }}
          />
          <button onClick={onJoinLobby}>join</button>
          <button onClick={onStartMatch}>start</button>
          <button onClick={onSyncGameId}>sync gameId</button>
        </div>
        <div className="section-info">gameId: {gameId || '(none)'}</div>
      </div>

      {/* Realtime Section */}
      <div className="lobby-section">
        <div className="section-row">
          <b>Realtime</b>
          <button onClick={onConnectWS}>connect ws</button>
          <button onClick={onJoinGameWS}>join_game</button>
          <span>
            ws: <b>{wsStatus}</b>
          </span>
        </div>
      </div>

      {/* Log Section */}
      <div className="lobby-section log-section">
        <b>Log</b>
        <div className="log-container">
          {log.map((x, i) => (
            <div key={i}>{x}</div>
          ))}
        </div>
      </div>

      {/* Instructions */}
      <div className="instructions">
        How to use：P1 open in normal window；P2 open in "incognito window/another browser"
        (localStorage is not shared).
        <br />
        P1 register/login → create lobby (copy lobbyId to P2) → P2 join → P1 start → P2 click
        sync gameId → both connect ws + join_game → start playing.
      </div>
    </div>
  );
};

export default LobbyScreen;
