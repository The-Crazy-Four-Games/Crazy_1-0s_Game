import React, { useState, useEffect } from 'react';
import './LobbyScreen.css';

type Room = {
  lobbyId: string;
  hostId: string;
  hostUsername: string;
  guestId?: string;
  baseId: 'doz' | 'dec';
  createdAt: number;
  status: 'OPEN' | 'STARTED';
};

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

  // Room creation
  baseId: 'doz' | 'dec';
  setBaseId: (v: 'doz' | 'dec') => void;
  lobbyId: string;
  setLobbyId: (v: string) => void;
  lobbyStatus: 'idle' | 'created' | 'joined' | 'starting' | 'ready';
  onCreateLobby: () => void;
  onJoinRoom: (lobbyId: string) => void;
  onStartGame: () => void;

  // Rejoin
  savedGameId?: string;
  onRejoinGame?: () => void;

  // Room list
  rooms: Room[];
  onRefreshRooms: () => void;

  // Profile
  onOpenProfile: () => void;

  // Admin
  onAdminLogin: () => void;

  // Guest
  onGuestLogin: () => void;
  isGuest: boolean;

  // Room leave
  onLeaveRoom: () => void;

  // Room join status
  roomHasGuest: boolean;

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
  setLobbyId: _setLobbyId,
  lobbyStatus,
  onCreateLobby,
  onJoinRoom,
  onStartGame,
  savedGameId,
  onRejoinGame,
  rooms,
  onRefreshRooms,
  onOpenProfile,
  onAdminLogin,
  onGuestLogin,
  isGuest,
  onLeaveRoom,
  roomHasGuest,
  log,
}) => {
  const isLoggedIn = !!token && !!userId;
  const [showLog, setShowLog] = useState(false);

  // Auto-refresh room list every 3 seconds when logged in and idle
  useEffect(() => {
    if (!isLoggedIn || lobbyStatus !== 'idle') return;
    onRefreshRooms(); // initial fetch
    const interval = setInterval(onRefreshRooms, 3000);
    return () => clearInterval(interval);
  }, [isLoggedIn, lobbyStatus]);

  const baseName = (bid: string) => bid === 'doz' ? 'Dozenal' : 'Decimal';

  return (
    <div className="lobby-screen">
      <h1 className="lobby-title">Crazy 1-0's</h1>
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
            <button
              className="btn-outline"
              onClick={onGuestLogin}
              style={{ marginTop: '8px', width: '100%', padding: '8px', fontSize: '0.85rem' }}
            >
              🎭 Play as Guest
            </button>
            <button
              className="admin-login-link"
              onClick={onAdminLogin}
              style={{
                background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)',
                cursor: 'pointer', fontSize: '0.75rem', marginTop: '6px',
                textDecoration: 'underline',
              }}
            >
              Admin Login
            </button>
          </div>
        ) : (
          <div className="auth-logged-in">
            <span className="user-badge">👤 {username}{isGuest ? ' (Guest)' : ''}</span>
            <div className="auth-actions">
              {!isGuest && (
                <button className="btn-small btn-outline" onClick={onOpenProfile}>
                  Profile
                </button>
              )}
              <button className="btn-small btn-outline" onClick={onLogout}>
                Logout
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Step 2: Game Room - only show when logged in */}
      {isLoggedIn && lobbyStatus === 'idle' && (
        <div className="lobby-section">
          <h3 className="section-title">2. Game Rooms</h3>

          {/* Rejoin button */}
          {savedGameId && onRejoinGame && (
            <div className="lobby-action-group" style={{ marginBottom: '1rem' }}>
              <button className="btn-primary btn-large" onClick={onRejoinGame}>
                🔄 Rejoin Active Game
              </button>
              <span className="action-hint">You have an active game in progress</span>
            </div>
          )}

          {/* Create room */}
          <div className="create-room-bar">
            <select
              value={baseId}
              onChange={(e) => setBaseId(e.target.value as 'doz' | 'dec')}
              className="base-select"
            >
              <option value="doz">Dozenal (Base 12)</option>
              <option value="dec">Decimal (Base 10)</option>
            </select>
            <button className="btn-primary" onClick={onCreateLobby}>
              + Create Room
            </button>
          </div>

          {/* Room list */}
          <div className="room-list">
            {rooms.length === 0 ? (
              <div className="room-list-empty">
                <span>🕐 No open rooms — create one!</span>
              </div>
            ) : (
              rooms.map((room) => {
                const isMine = room.hostId === userId;
                const isFull = !!room.guestId;
                return (
                  <div key={room.lobbyId} className={`room-row ${isMine ? 'room-mine' : ''}`}>
                    <div className="room-info">
                      <span className="room-host">
                        👤 {room.hostUsername}
                        {isMine && <span className="room-you-badge">(you)</span>}
                      </span>
                      <span className={`room-base room-base-${room.baseId}`}>
                        {baseName(room.baseId)}
                      </span>
                      <span className={`room-players ${isFull ? 'full' : ''}`}>
                        {isFull ? '2/2' : '1/2'}
                      </span>
                    </div>
                    {!isMine && !isFull && (
                      <button
                        className="btn-primary btn-join"
                        onClick={() => onJoinRoom(room.lobbyId)}
                      >
                        Join
                      </button>
                    )}
                    {isMine && (
                      <span className="room-status-text">Your room</span>
                    )}
                    {!isMine && isFull && (
                      <span className="room-status-text">Full</span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Host created room - waiting + start */}
      {isLoggedIn && lobbyStatus === 'created' && (
        <div className="lobby-section">
          <h3 className="section-title">Your Room</h3>
          <div className="lobby-waiting">
            {roomHasGuest ? (
              <div className="waiting-indicator room-ready">
                <span>✅</span> Room full — ready to start!
              </div>
            ) : (
              <div className="waiting-indicator">
                <span className="dots">⏳</span> Waiting for an opponent to join...
              </div>
            )}

            <button className="btn-primary btn-large btn-start" onClick={onStartGame} disabled={!roomHasGuest}>
              Start Game
            </button>
            <button className="btn-secondary" onClick={onLeaveRoom} style={{ marginTop: '8px' }}>
              🚪 Leave Room
            </button>
            {!roomHasGuest && (
              <span className="action-hint">
                Game will start once an opponent joins
              </span>
            )}
          </div>
        </div>
      )}

      {/* Joiner - waiting for host to start */}
      {isLoggedIn && lobbyStatus === 'joined' && (
        <div className="lobby-section">
          <h3 className="section-title">Joined Room</h3>
          <div className="lobby-waiting">
            <div className="waiting-indicator">
              <span className="spinner">⏳</span>
              <span>Waiting for host to start the game...</span>
            </div>
            <button className="btn-secondary" onClick={onLeaveRoom} style={{ marginTop: '8px' }}>
              🚪 Leave Room
            </button>
            <span className="action-hint">
              The game will start automatically when the host begins
            </span>
          </div>
        </div>
      )}

      {/* Starting */}
      {isLoggedIn && lobbyStatus === 'starting' && (
        <div className="lobby-section">
          <div className="lobby-waiting">
            <div className="waiting-indicator">
              <span className="spinner">🔄</span>
              <span>Starting game...</span>
            </div>
          </div>
        </div>
      )}

      {/* Log — collapsible */}
      <div className="lobby-section log-section">
        <button
          className="log-toggle"
          onClick={() => setShowLog(v => !v)}
          style={{
            background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)',
            cursor: 'pointer', fontSize: '0.85rem', padding: '4px 0',
          }}
        >
          📋 Activity Log {showLog ? '▼' : '▶'}
        </button>
        {showLog && (
          <div className="log-container">
            {log.map((x, i) => (
              <div key={i}>{x}</div>
            ))}
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="instructions">
        <strong>How to play:</strong> Open this page in two different browsers
        (or one normal + one incognito window).
        <br />
        Player 1: Login → Create Room → Wait for opponent → Start Game
        <br />
        Player 2: Login → Browse rooms → Join → Game starts automatically!
      </div>
    </div>
  );
};

export default LobbyScreen;
