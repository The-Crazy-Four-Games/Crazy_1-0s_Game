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

  // Show game-themed login screen when not logged in
  if (!isLoggedIn) {
    return (
      <div className="login-screen">
        {/* Animated background cards */}
        <div className="login-bg-cards">
          {['♠', '♥', '♦', '♣', '🃏', '♠', '♥', '♦', '♣', '🃏'].map((s, i) => (
            <span key={i} className="floating-suit" style={{
              '--x': `${10 + (i * 9) % 80}%`,
              '--delay': `${i * 0.7}s`,
              '--duration': `${6 + (i % 4) * 2}s`,
              '--size': `${1.5 + (i % 3) * 1.2}rem`,
            } as React.CSSProperties}>{s}</span>
          ))}
        </div>

        {/* Title */}
        <div className="login-header">
          <h1 className="login-game-title">Crazy 1-0's</h1>
          <p className="login-game-subtitle">The Dozenal Card Game</p>
        </div>

        {/* Login Card */}
        <div className="login-card">
          <div className="login-card-suits">♠ ♥ ♦ ♣</div>
          <h2 className="login-card-title">Enter the Game</h2>

          <div className="login-form">
            <div className="login-input-group">
              <span className="login-input-icon">👤</span>
              <input
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onLogin()}
              />
            </div>
            <div className="login-input-group">
              <span className="login-input-icon">🔒</span>
              <input
                placeholder="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onLogin()}
              />
            </div>

            <button className="login-btn-play" onClick={onLogin}>
              ▶ PLAY
            </button>
            <button className="login-btn-register" onClick={onRegister}>
              Create Account
            </button>
            <div className="login-divider"><span>or</span></div>
            <button className="login-btn-guest" onClick={onGuestLogin}>
              🎭 Quick Play as Guest
            </button>
          </div>

          <button className="login-admin-link" onClick={onAdminLogin}>
            Admin Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="lobby-screen lobby-loggedin">
      {/* Floating bg suits */}
      <div className="login-bg-cards">
        {['♠', '♥', '♦', '♣', '🃏', '♠', '♥', '♦', '♣'].map((s, i) => (
          <span key={i} className="floating-suit" style={{
            '--x': `${5 + (i * 11) % 90}%`,
            '--delay': `${i * 1.1}s`,
            '--duration': `${8 + (i % 3) * 3}s`,
            '--size': `${1.2 + (i % 3) * 0.8}rem`,
          } as React.CSSProperties}>{s}</span>
        ))}
      </div>

      {/* Header bar */}
      <div className="lobby-header-bar">
        <h1 className="lobby-title-game">Crazy 1-0's</h1>
        <div className="lobby-user-bar">
          <span className="lobby-user-name">👤 {username}{isGuest ? ' (Guest)' : ''}</span>
          <div className="lobby-user-actions">
            {!isGuest && (
              <button className="lobby-icon-btn" onClick={onOpenProfile} title="Profile">📊</button>
            )}
            <button className="lobby-icon-btn" onClick={onLogout} title="Logout">🚪</button>
          </div>
        </div>
      </div>

      {/* Game Room Section */}
      {lobbyStatus === 'idle' && (
        <div className="lobby-section lobby-section-game">
          <h3 className="section-title-game">🎮 Game Rooms</h3>

          {/* Rejoin */}
          {savedGameId && onRejoinGame && (
            <button className="lobby-rejoin-btn" onClick={onRejoinGame}>
              🔄 Rejoin Active Game
            </button>
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
            <button className="btn-create-room" onClick={onCreateLobby}>
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

      {/* Host waiting */}
      {lobbyStatus === 'created' && (
        <div className="lobby-section lobby-section-game">
          <h3 className="section-title-game">🏠 Your Room</h3>
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
            <button className="btn-start-game" onClick={onStartGame} disabled={!roomHasGuest}>
              🚀 Start Game
            </button>
            <button className="btn-leave-room" onClick={onLeaveRoom}>
              🚪 Leave Room
            </button>
          </div>
        </div>
      )}

      {/* Joiner waiting */}
      {lobbyStatus === 'joined' && (
        <div className="lobby-section lobby-section-game">
          <h3 className="section-title-game">🎯 Joined Room</h3>
          <div className="lobby-waiting">
            <div className="waiting-indicator">
              <span className="spinner">⏳</span>
              <span>Waiting for host to start the game...</span>
            </div>
            <button className="btn-leave-room" onClick={onLeaveRoom}>
              🚪 Leave Room
            </button>
          </div>
        </div>
      )}

      {/* Starting */}
      {lobbyStatus === 'starting' && (
        <div className="lobby-section lobby-section-game">
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
      <div className="lobby-instructions">
        <strong>🎴 How to play:</strong> Open in two browsers. Create a room, wait for opponent, start!
      </div>
    </div>
  );
};

export default LobbyScreen;

