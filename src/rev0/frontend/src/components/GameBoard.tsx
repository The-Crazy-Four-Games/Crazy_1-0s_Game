import React, { useState } from 'react';
import { useGameState } from '../hooks/useGameState';
import PlayerHand from './PlayerHand';
import { DrawPile, DiscardPile, SuitSelector, GameActions } from './GameTable';
import { getCardId, isWildcard } from '../types/game';
import './GameBoard.css';

export const GameBoard: React.FC = () => {
  // For MVP, we'll use simple inputs for auth/game info
  // In production, this would come from auth context and routing
  const [token, setToken] = useState<string | null>(null);
  const [gameId, setGameId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [inputToken, setInputToken] = useState('');
  const [inputGameId, setInputGameId] = useState('');
  const [inputUserId, setInputUserId] = useState('');

  const {
    connected,
    connect,
    disconnect,
    joinGame,
    publicState,
    myHand,
    isPlayerTurn,
    topCard,
    playableCards,
    selectedCard,
    selectCard,
    showSuitSelector,
    playCard,
    selectSuit,
    cancelSuitSelection,
    drawCard,
    passTurn,
    message,
  } = useGameState(token, gameId, userId);

  // Handle connection setup
  const handleSetCredentials = () => {
    setToken(inputToken || 'test-token');
    setGameId(inputGameId || 'test-game');
    setUserId(inputUserId || 'player1');
  };

  // Computed values
  const isGameOver = publicState?.status === 'GAME_OVER';
  const canDraw = isPlayerTurn && !isGameOver;
  const canPlay = !!(
    isPlayerTurn &&
    selectedCard &&
    playableCards.some((c) => getCardId(c) === getCardId(selectedCard)) &&
    !isGameOver
  );
  const canPass = isPlayerTurn && !isGameOver;

  // If not connected, show connection UI
  if (!token || !gameId || !userId) {
    return (
      <div className="game-board">
        <header className="game-header">
          <h1>Crazy Tens</h1>
        </header>
        <div className="connection-panel">
          <h2>Connect to Game</h2>
          <div className="input-group">
            <label htmlFor="token">Token:</label>
            <input
              id="token"
              type="text"
              value={inputToken}
              onChange={(e) => setInputToken(e.target.value)}
              placeholder="Enter auth token"
            />
          </div>
          <div className="input-group">
            <label htmlFor="gameId">Game ID:</label>
            <input
              id="gameId"
              type="text"
              value={inputGameId}
              onChange={(e) => setInputGameId(e.target.value)}
              placeholder="Enter game ID"
            />
          </div>
          <div className="input-group">
            <label htmlFor="userId">User ID:</label>
            <input
              id="userId"
              type="text"
              value={inputUserId}
              onChange={(e) => setInputUserId(e.target.value)}
              placeholder="Enter your user ID"
            />
          </div>
          <button className="connect-button" onClick={handleSetCredentials}>
            Set Credentials
          </button>
        </div>
      </div>
    );
  }

  // Connection status panel
  if (!connected) {
    return (
      <div className="game-board">
        <header className="game-header">
          <h1>Crazy Tens</h1>
        </header>
        <div className="connection-panel">
          <h2>Connection</h2>
          <p>User: {userId}</p>
          <p>Game: {gameId}</p>
          <p className="status disconnected">● Not Connected</p>
          {message && <p className="message">{message}</p>}
          <button className="connect-button" onClick={connect}>
            Connect to Server
          </button>
          <button className="secondary-button" onClick={() => {
            setToken(null);
            setGameId(null);
            setUserId(null);
          }}>
            Change Credentials
          </button>
        </div>
      </div>
    );
  }

  // Connected but no game state yet
  if (!publicState) {
    return (
      <div className="game-board">
        <header className="game-header">
          <h1>Crazy Tens</h1>
        </header>
        <div className="connection-panel">
          <h2>Join Game</h2>
          <p>User: {userId}</p>
          <p>Game: {gameId}</p>
          <p className="status connected">● Connected</p>
          {message && <p className="message">{message}</p>}
          <button className="connect-button" onClick={joinGame}>
            Join Game Room
          </button>
          <button className="secondary-button" onClick={disconnect}>
            Disconnect
          </button>
        </div>
      </div>
    );
  }

  // Get opponent info from public state
  const opponentId = Object.keys(publicState.handsCount).find(id => id !== userId) || 'opponent';
  const opponentHandCount = publicState.handsCount[opponentId] || 0;
  const playerScore = publicState.scoresText?.[userId] || '0';
  const opponentScore = publicState.scoresText?.[opponentId] || '0';

  return (
    <div className="game-board">
      <header className="game-header">
        <h1>Crazy Tens</h1>
        <div className="score-summary">
          <span className="score-item">
            You: <strong>{playerScore}</strong>
          </span>
          <span className="score-divider">|</span>
          <span className="score-item">
            Opponent: <strong>{opponentScore}</strong>
          </span>
          <span className="score-divider">|</span>
          <span className="score-item goal">
            Goal: {publicState.targetScoreText}
          </span>
        </div>
        <button className="disconnect-btn" onClick={disconnect}>
          Disconnect
        </button>
      </header>

      {/* Opponent Hand (face down) */}
      <div className="opponent-area">
        <PlayerHand
          cards={Array(opponentHandCount).fill({ suit: 'S' as const, rank: '?' })}
          isCurrentPlayer={publicState.turn === opponentId}
          faceDown={true}
          playerName="Opponent"
          score={opponentScore}
        />
      </div>

      {/* Game Table */}
      <div className="table-area">
        <DrawPile
          onDraw={drawCard}
          canDraw={canDraw}
        />

        <DiscardPile
          topCard={topCard}
          forcedSuit={publicState.forcedSuit}
        />
      </div>

      {/* Game Actions */}
      {isPlayerTurn && !isGameOver && (
        <GameActions
          selectedCard={selectedCard}
          canPlay={canPlay}
          canDraw={canDraw}
          canPass={canPass}
          onPlay={playCard}
          onDraw={drawCard}
          onPass={passTurn}
          isWildCard={selectedCard ? isWildcard(selectedCard.rank) : false}
        />
      )}

      {/* Status Message */}
      {message && <div className="status-message">{message}</div>}

      {/* Waiting for opponent */}
      {!isPlayerTurn && !isGameOver && (
        <div className="waiting-message">
          <span className="waiting-spinner">⏳</span>
          Opponent is thinking...
        </div>
      )}

      {/* Player Hand */}
      <div className="player-area">
        <PlayerHand
          cards={myHand}
          isCurrentPlayer={isPlayerTurn && !isGameOver}
          playableCards={playableCards}
          selectedCard={selectedCard}
          onSelectCard={selectCard}
          playerName="You"
          score={playerScore}
        />
      </div>

      {/* Suit Selector Modal */}
      {showSuitSelector && (
        <SuitSelector onSelectSuit={selectSuit} onCancel={cancelSuitSelection} />
      )}

      {/* Game Over Modal */}
      {isGameOver && (
        <div className="game-end-overlay">
          <div className="game-end-modal">
            <h2 className="game-end-title">
              {(publicState.scoresDec[userId] ?? 0) >= publicState.targetScoreDec
                ? '🎉 You Win!'
                : '😔 Opponent Wins'}
            </h2>
            <p className="game-end-subtitle">Game Over!</p>
            <div className="final-scores">
              <div className="final-score">
                <span>You</span>
                <strong>{playerScore}</strong>
              </div>
              <div className="final-score">
                <span>Opponent</span>
                <strong>{opponentScore}</strong>
              </div>
            </div>
            <button className="secondary-button" onClick={disconnect}>
              Leave Game
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GameBoard;
