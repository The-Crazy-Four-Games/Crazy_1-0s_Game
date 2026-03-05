import React, { useState } from 'react';
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
  lobbyStatus: 'idle' | 'created' | 'joined' | 'starting' | 'ready';
  onCreateLobby: () => void;
  onJoinLobby: () => void;
  onStartGame: () => void;

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
  lobbyStatus,
  onCreateLobby,
  onJoinLobby,
  onStartGame,
  log,
}) => {
  const [copied, setCopied] = useState(false);
  const isLoggedIn = !!token && !!userId;

  const copyLobbyId = () => {
    navigator.clipboard.writeText(lobbyId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="lobby-screen">
      <h1 className="lobby-title">Crazy Tens</h1>
      <p className="lobby-subtitle">Dozenal Card Game</p>

      {/* Step 1: Auth */}
      <div className="lobby-section">
        <h3 className="section-title">
          {isLoggedIn ? '✅ Logged In' : '1. Sign In'}
        </h3>

        {!isLoggedIn ? (
          <div className="auth-form">
            <input
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <input
              placeholder="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <div className="auth-buttons">
              <button className="btn-primary" onClick={onLogin}>
                Login
              </button>
              <button className="btn-secondary" onClick={onRegister}>
                Register
              </button>
            </div>
          </div>
        ) : (
          <div className="auth-logged-in">
            <span className="user-badge">👤 {username}</span>
            <button className="btn-small btn-outline" onClick={onLogout}>
              Logout
            </button>
          </div>
        )}
      </div>

      {/* Step 2: Lobby - only show when logged in */}
      {isLoggedIn && (
        <div className="lobby-section">
          <h3 className="section-title">2. Join or Create a Lobby</h3>

          {/* Base selection */}
          <div className="base-selector">
            <label>Number Base:</label>
            <select
              value={baseId}
              onChange={(e) => setBaseId(e.target.value as 'doz' | 'dec')}
              disabled={lobbyStatus !== 'idle'}
            >
              <option value="doz">Dozenal (Base 12)</option>
              <option value="dec">Decimal (Base 10)</option>
            </select>
          </div>

          {lobbyStatus === 'idle' && (
            <div className="lobby-actions">
              {/* Create lobby */}
              <div className="lobby-action-group">
                <button className="btn-primary btn-large" onClick={onCreateLobby}>
                  Create Lobby
                </button>
                <span className="action-hint">Host a new game</span>
              </div>

              <div className="lobby-divider">OR</div>

              {/* Join lobby */}
              <div className="lobby-action-group">
                <div className="join-row">
                  <input
                    placeholder="Enter Lobby ID"
                    value={lobbyId}
                    onChange={(e) => setLobbyId(e.target.value)}
                    className="lobby-input"
                  />
                  <button
                    className="btn-primary"
                    onClick={onJoinLobby}
                    disabled={!lobbyId}
                  >
                    Join
                  </button>
                </div>
                <span className="action-hint">Join a friend's lobby</span>
              </div>
            </div>
          )}

          {/* Host created lobby - waiting + start */}
          {lobbyStatus === 'created' && (
            <div className="lobby-waiting">
              <div className="lobby-id-display">
                <span className="lobby-id-label">Your Lobby ID:</span>
                <div className="lobby-id-value">
                  <code>{lobbyId}</code>
                  <button className="btn-small btn-copy" onClick={copyLobbyId}>
                    {copied ? '✅ Copied!' : '📋 Copy'}
                  </button>
                </div>
                <span className="lobby-id-hint">
                  Share this ID with your opponent
                </span>
              </div>

              <button className="btn-primary btn-large btn-start" onClick={onStartGame}>
                Start Game
              </button>
              <span className="action-hint">
                Click once your opponent has joined the lobby
              </span>
            </div>
          )}

          {/* Joiner - waiting for host to start */}
          {lobbyStatus === 'joined' && (
            <div className="lobby-waiting">
              <div className="waiting-indicator">
                <span className="spinner">⏳</span>
                <span>Waiting for host to start the game...</span>
              </div>
              <span className="action-hint">
                The game will start automatically when the host begins
              </span>
            </div>
          )}

          {/* Starting */}
          {lobbyStatus === 'starting' && (
            <div className="lobby-waiting">
              <div className="waiting-indicator">
                <span className="spinner">🔄</span>
                <span>Starting game...</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Log */}
      <div className="lobby-section log-section">
        <b>Activity Log</b>
        <div className="log-container">
          {log.map((x, i) => (
            <div key={i}>{x}</div>
          ))}
        </div>
      </div>

      {/* Instructions */}
      <div className="instructions">
        <strong>How to play:</strong> Open this page in two different browsers
        (or one normal + one incognito window).
        <br />
        Player 1: Login → Create Lobby → Share Lobby ID → Start Game
        <br />
        Player 2: Login → Enter Lobby ID → Join → Game starts automatically!
      </div>
    </div>
  );
};

export default LobbyScreen;
