import React, { useMemo, useState } from 'react';
import Card from './Card';
import { SUIT_SYMBOLS, SUIT_COLORS } from '../types/game';
import type { Suit } from '../types/game';
import './GameScreen.css';

type CardType = { suit: Suit; rank: string };

type PublicState = {
  gameId: string;
  baseId: 'doz' | 'dec';
  status: 'ONGOING' | 'GAME_OVER';
  turn: string;
  topCard: CardType;
  forcedSuit?: Suit;
  handsCount: Record<string, number>;
  scoresText: Record<string, string>;
  targetScoreText: string;
  faceRanks: string[];
  deckNumericSymbols: string[];
};

interface GameScreenProps {
  userId: string;
  ps: PublicState;
  myHand: CardType[];
  myTurn: boolean;
  log: string[];

  // Game actions
  onDraw: () => void;
  onPass: () => void;
  onPlay: (card: CardType, chosenSuit?: Suit) => void;

  // Back button
  onBackToLobby: () => void;

  // Restart game
  restartStatus: 'none' | 'waiting' | 'opponent_requested';
  onRequestRestart: () => void;
}

export const GameScreen: React.FC<GameScreenProps> = ({
  userId,
  ps,
  myHand,
  myTurn,
  log,
  onDraw,
  onPass,
  onPlay,
  onBackToLobby,
  restartStatus,
  onRequestRestart,
}) => {
  const [selectedCard, setSelectedCard] = useState<CardType | null>(null);
  const [showSuitPicker, setShowSuitPicker] = useState(false);
  const [pendingCard, setPendingCard] = useState<CardType | null>(null);
  const [showGameOverModal, setShowGameOverModal] = useState(true);

  // Get opponent info
  const opponentId = useMemo(() => {
    const players = Object.keys(ps.handsCount);
    return players.find((p) => p !== userId) || '';
  }, [ps.handsCount, userId]);

  const opponentHandCount = ps.handsCount[opponentId] || 0;
  const myScore = ps.scoresText[userId] || '0';
  const opponentScore = ps.scoresText[opponentId] || '0';

  // Determine winner when game is over
  const isGameOver = ps.status === 'GAME_OVER';
  const myHandCount = ps.handsCount[userId] || 0;
  const iWon = isGameOver && myHandCount === 0;

  // Helper to check if card is wildcard (rank "10")
  const isWildcard = (rank: string) => rank === '10';

  // Helper to check if card is skip card (rank "6" for dozenal, "5" for decimal)
  const skipRank = ps.baseId === 'doz' ? '6' : '5';
  const isSkipCard = (rank: string) => rank === skipRank;

  // Playable cards hint (client-side weak check)
  const playableCards = useMemo(() => {
    if (!ps) return [];
    const effSuit = ps.forcedSuit ?? ps.topCard.suit;
    return myHand.filter(
      (c) =>
        c.suit === effSuit ||
        c.rank === ps.topCard.rank ||
        isWildcard(c.rank) ||
        isSkipCard(c.rank)
    );
  }, [ps, myHand]);

  const isPlayable = (card: CardType) =>
    playableCards.some((c) => c.suit === card.suit && c.rank === card.rank);

  const isSelected = (card: CardType) =>
    selectedCard && selectedCard.suit === card.suit && selectedCard.rank === card.rank;

  const handleCardClick = (card: CardType) => {
    if (!myTurn) return;
    if (isSelected(card)) {
      // Double click or re-click to play
      if (isWildcard(card.rank)) {
        setPendingCard(card);
        setShowSuitPicker(true);
      } else {
        onPlay(card);
        setSelectedCard(null);
      }
    } else {
      setSelectedCard(card);
    }
  };

  const handlePlayButton = () => {
    if (!selectedCard || !myTurn) return;
    if (isWildcard(selectedCard.rank)) {
      setPendingCard(selectedCard);
      setShowSuitPicker(true);
    } else {
      onPlay(selectedCard);
      setSelectedCard(null);
    }
  };

  const handleSuitSelect = (suit: Suit) => {
    if (pendingCard) {
      onPlay(pendingCard, suit);
      setPendingCard(null);
      setSelectedCard(null);
    }
    setShowSuitPicker(false);
  };

  // Create opponent's face-down cards
  const opponentCards: CardType[] = Array(opponentHandCount).fill({ suit: 'S', rank: '?' });

  return (
    <div className="game-screen">
      {/* Header */}
      <header className="game-header">
        <button className="back-button" onClick={onBackToLobby}>
          ← Back
        </button>
        <h1>Crazy Tens</h1>
        <div className="game-base-info">
          Base: {ps.baseId === 'doz' ? 'Dozenal' : 'Decimal'}
        </div>
      </header>

      {/* Score Summary */}
      <div className="score-summary">
        <span>
          You: <strong>{myScore}</strong>
        </span>
        <span className="score-divider">|</span>
        <span>
          Opponent: <strong>{opponentScore}</strong>
        </span>
        <span className="score-divider">|</span>
        <span className="goal">
          Goal: <strong>{ps.targetScoreText}</strong>
        </span>
        <span className="score-divider">|</span>
        <span>
          Base: <strong>{ps.baseId}</strong>
        </span>
      </div>

      {/* Game Over Modal */}
      {isGameOver && showGameOverModal && (
        <div className="game-over-overlay">
          <div className="game-over-modal">
            <h2>{iWon ? '🎉 You Won!' : '😔 You Lost'}</h2>
            <div className="final-scores">
              <div className="score-row">
                <span>Your Score:</span>
                <strong>{myScore}</strong>
              </div>
              <div className="score-row">
                <span>Opponent Score:</span>
                <strong>{opponentScore}</strong>
              </div>
              <div className="score-row goal-row">
                <span>Goal:</span>
                <strong>{ps.targetScoreText}</strong>
              </div>
            </div>
            <p className="game-over-message">
              {iWon 
                ? 'Congratulations! You reached the goal first!' 
                : 'Better luck next time!'}
            </p>
            
            {/* Restart status messages */}
            {restartStatus === 'waiting' && (
              <p className="restart-status waiting">⏳ Waiting for opponent to accept rematch...</p>
            )}
            {restartStatus === 'opponent_requested' && (
              <p className="restart-status opponent-requested">🔔 Opponent wants a rematch!</p>
            )}
            
            <div className="game-over-actions">
              {restartStatus === 'none' && (
                <button className="modal-btn primary" onClick={onRequestRestart}>
                  🔄 Request Rematch
                </button>
              )}
              {restartStatus === 'opponent_requested' && (
                <button className="modal-btn primary" onClick={onRequestRestart}>
                  ✅ Accept Rematch
                </button>
              )}
              {restartStatus === 'waiting' && (
                <button className="modal-btn primary" disabled>
                  ⏳ Waiting...
                </button>
              )}
              <button className="modal-btn secondary" onClick={onBackToLobby}>
                Return to Lobby
              </button>
              <button className="modal-btn tertiary" onClick={() => setShowGameOverModal(false)}>
                View Board
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Game Over Banner (when modal is dismissed) */}
      {isGameOver && !showGameOverModal && (
        <div className="game-over-banner">
          <span>{iWon ? '🎉 You Won!' : '😔 Game Over'}</span>
          {restartStatus === 'opponent_requested' && (
            <span className="banner-notification">🔔 Opponent wants rematch!</span>
          )}
          {restartStatus === 'none' && (
            <button className="play-again-btn" onClick={onRequestRestart}>
              Request Rematch
            </button>
          )}
          {restartStatus === 'opponent_requested' && (
            <button className="play-again-btn" onClick={onRequestRestart}>
              Accept Rematch
            </button>
          )}
          {restartStatus === 'waiting' && (
            <button className="play-again-btn" disabled>
              Waiting...
            </button>
          )}
          <button className="lobby-btn" onClick={onBackToLobby}>
            Lobby
          </button>
        </div>
      )}

      {/* Turn indicator */}
      <div className={`turn-banner ${myTurn ? 'my-turn' : 'opponent-turn'}`}>
        {myTurn ? "✅ Your Turn" : `⏳ Opponent's Turn (${opponentId.slice(0, 8)}...)`}
      </div>

      {/* Opponent Area */}
      <div className="opponent-area">
        <div className="player-label">
          Opponent ({opponentId.slice(0, 8)}...) - {opponentHandCount} cards
        </div>
        <div className="opponent-hand">
          {opponentCards.map((card, idx) => (
            <div key={idx} className="opponent-card-wrapper" style={{ marginLeft: idx > 0 ? '-30px' : '0' }}>
              <Card card={card} faceDown size="small" />
            </div>
          ))}
        </div>
      </div>

      {/* Table Area */}
      <div className="table-area">
        {/* Draw Pile */}
        <div className="pile-section">
          <div className="pile-label">Draw Pile</div>
          <div className="draw-pile-stack" onClick={myTurn ? onDraw : undefined}>
            <Card card={{ suit: 'S', rank: '?' }} faceDown size="large" />
          </div>
          <button className="action-btn" disabled={!myTurn} onClick={onDraw}>
            Draw
          </button>
        </div>

        {/* Discard Pile / Top Card */}
        <div className="pile-section">
          <div className="pile-label">Discard Pile</div>
          <div className="top-card-display">
            <Card
              card={ps.topCard}
              size="large"
              isPlayable={false}
            />
          </div>
          {ps.forcedSuit && (
            <div className="forced-suit" style={{ color: SUIT_COLORS[ps.forcedSuit] }}>
              Suit: {SUIT_SYMBOLS[ps.forcedSuit]}
            </div>
          )}
        </div>
      </div>

      {/* Player Hand */}
      <div className="player-area">
        <div className="player-label">Your Hand ({myHand.length} cards)</div>
        <div className="player-hand">
          {myHand.map((card, idx) => (
            <div
              key={`${card.rank}${card.suit}-${idx}`}
              className="hand-card-wrapper"
              style={{ marginLeft: idx > 0 ? '-20px' : '0', zIndex: idx }}
            >
              <Card
                card={card}
                size="medium"
                isPlayable={myTurn && isPlayable(card)}
                isSelected={isSelected(card) || false}
                isWildcard={isWildcard(card.rank)}
                isSkipCard={isSkipCard(card.rank)}
                onClick={() => handleCardClick(card)}
              />
            </div>
          ))}
        </div>

        {/* Playable hint */}
        <div className="hint-section">
          <span className="hint-label">Playable:</span>
          <span className="hint-cards">
            {playableCards.length > 0
              ? playableCards.map((c) => `${c.rank}${c.suit}`).join(' ')
              : '(none)'}
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="action-bar">
        <button className="action-btn" disabled={!myTurn} onClick={onDraw}>
          DRAW
        </button>
        <button className="action-btn" disabled={!myTurn} onClick={onPass}>
          PASS
        </button>
        <button
          className="action-btn play-btn"
          disabled={!myTurn || !selectedCard}
          onClick={handlePlayButton}
        >
          PLAY {selectedCard ? `${selectedCard.rank}${selectedCard.suit}` : ''}
        </button>
      </div>

      {/* Suit Picker Modal */}
      {showSuitPicker && (
        <div className="suit-picker-overlay" onClick={() => setShowSuitPicker(false)}>
          <div className="suit-picker" onClick={(e) => e.stopPropagation()}>
            <h3>Choose a Suit (Wildcard)</h3>
            <div className="suit-options">
              {(['S', 'H', 'D', 'C'] as Suit[]).map((suit) => (
                <button
                  key={suit}
                  className="suit-btn"
                  style={{ color: SUIT_COLORS[suit] }}
                  onClick={() => handleSuitSelect(suit)}
                >
                  {SUIT_SYMBOLS[suit]}
                </button>
              ))}
            </div>
            <button className="cancel-btn" onClick={() => setShowSuitPicker(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Log Section */}
      <div className="log-section">
        <b>Log</b>
        <div className="log-container">
          {log.map((x, i) => (
            <div key={i}>{x}</div>
          ))}
        </div>
      </div>

      {/* Instructions */}
      <div className="game-instructions">
        <strong>Card Legend:</strong> 🌟 = Wildcard (10, changes suit) | ⏭️ = Skip ({skipRank}, grants free play)
      </div>
    </div>
  );
};

export default GameScreen;
