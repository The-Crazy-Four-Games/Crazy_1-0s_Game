import React, { useMemo, useState } from 'react';
import Card from './Card';
import ArithmeticPopup from './ArithmeticPopup';
import { SUIT_SYMBOLS, SUIT_COLORS, sanitizeDozenalDisplay, isSelectOpCard as checkSelectOpCard } from '../types/game';
import type { Suit, MathChallenge } from '../types/game';
import './GameScreen.css';

type CardType = { suit: Suit; rank: string };

type RoundResult = {
  winner: string;
  loser: string;
  pointsGained: number;
  scoresDec: Record<string, number>;
};

type PublicState = {
  gameId: string;
  baseId: 'doz' | 'dec';
  status: 'ONGOING' | 'GAME_OVER';
  turn: string;
  topCard: CardType;
  forcedSuit?: Suit;
  activeChallenge?: MathChallenge;
  handsCount: Record<string, number>;
  scoresDec: Record<string, number>;
  scoresText: Record<string, string>;
  targetScoreDec: number;
  targetScoreText: string;
  faceRanks: string[];
  deckNumericSymbols: string[];
  lastRoundResult?: RoundResult;
};

interface GameScreenProps {
  userId: string;
  ps: PublicState;
  myHand: CardType[];
  myTurn: boolean;
  log: string[];

  // Game actions
  onDraw: () => void;
  onPlay: (card: CardType, chosenSuit?: Suit, chosenOperation?: '+' | '-' | '*' | '/') => void;
  onAnswerChallenge: (answer: number) => void;

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
  onPlay,
  onAnswerChallenge,
  onBackToLobby,
  restartStatus,
  onRequestRestart,
}) => {
  const [selectedCard, setSelectedCard] = useState<CardType | null>(null);
  const [showSuitPicker, setShowSuitPicker] = useState(false);
  const [pendingCard, setPendingCard] = useState<CardType | null>(null);
  const [showGameOverModal, setShowGameOverModal] = useState(true);
  const [showRoundEndModal, setShowRoundEndModal] = useState(true);
  const [showOpPicker, setShowOpPicker] = useState(false);
  const [pendingOpCard, setPendingOpCard] = useState<CardType | null>(null);
  const [pendingOpSuit, setPendingOpSuit] = useState<Suit | undefined>(undefined);

  // Get opponent info
  const opponentId = useMemo(() => {
    const players = Object.keys(ps.handsCount);
    return players.find((p) => p !== userId) || '';
  }, [ps.handsCount, userId]);

  const opponentHandCount = ps.handsCount[opponentId] || 0;
  // Always display scores in decimal
  const myScore = String(ps.scoresDec?.[userId] ?? 0);
  const opponentScore = String(ps.scoresDec?.[opponentId] ?? 0);
  const targetScore = String(ps.targetScoreDec ?? 100);

  // Determine winner when game is over
  const isGameOver = ps.status === 'GAME_OVER';
  const myHandCount = ps.handsCount[userId] || 0;
  const iWon = isGameOver && myHandCount === 0;

  // Helper to check if card is wildcard (rank "10")
  const isWildcard = (rank: string) => rank === '10';

  // Helper to check if card is skip card (rank "6" for dozenal, "5" for decimal)
  const skipRank = ps.baseId === 'doz' ? '6' : '5';
  const isSkipCard = (rank: string) => rank === skipRank;

  // Helper to check if card triggers operation selection (K in decimal, C in dozenal)
  const isSelectOp = (rank: string) => checkSelectOpCard(rank, ps.baseId);

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
      } else if (isSelectOp(card.rank)) {
        setPendingOpCard(card);
        setPendingOpSuit(undefined);
        setShowOpPicker(true);
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
    } else if (isSelectOp(selectedCard.rank)) {
      setPendingOpCard(selectedCard);
      setPendingOpSuit(undefined);
      setShowOpPicker(true);
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

  const handleOpSelect = (op: '+' | '-' | '*' | '/') => {
    if (pendingOpCard) {
      onPlay(pendingOpCard, pendingOpSuit, op);
      setPendingOpCard(null);
      setPendingOpSuit(undefined);
      setSelectedCard(null);
    }
    setShowOpPicker(false);
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
        <h1>Crazy 1-0's</h1>
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
          Goal: <strong>{targetScore}</strong>
        </span>
        <span className="score-divider">|</span>
        <span>
          Base: <strong>{ps.baseId}</strong>
        </span>
      </div>

      {/* Round End Popup */}
      {ps.lastRoundResult && showRoundEndModal && !isGameOver && (
        <div className="game-over-overlay">
          <div className="game-over-modal">
            <h2>{ps.lastRoundResult.winner === userId ? '🎉 You Won This Round!' : '😔 You Lost This Round'}</h2>
            <div className="final-scores">
              <div className="score-row">
                <span>Points Won This Round:</span>
                <strong>{ps.lastRoundResult.pointsGained}</strong>
              </div>
              <div className="score-row">
                <span>Your Total Score:</span>
                <strong>{ps.lastRoundResult.scoresDec[userId] ?? 0}</strong>
              </div>
              <div className="score-row">
                <span>Opponent Total Score:</span>
                <strong>{ps.lastRoundResult.scoresDec[opponentId] ?? 0}</strong>
              </div>
              <div className="score-row goal-row">
                <span>Goal:</span>
                <strong>{targetScore}</strong>
              </div>
            </div>
            <p className="game-over-message">
              {ps.lastRoundResult.winner === userId
                ? 'Great job! Next round is ready.'
                : 'Keep going! Next round is ready.'}
            </p>
            <div className="game-over-actions">
              <button className="modal-btn primary" onClick={() => setShowRoundEndModal(false)}>
                Continue to Next Round
              </button>
            </div>
          </div>
        </div>
      )}

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
                <strong>{targetScore}</strong>
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
              ? playableCards.map((c) => `${sanitizeDozenalDisplay(c.rank)}${c.suit}`).join(' ')
              : '(none)'}
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="action-bar">
        <button className="action-btn" disabled={!myTurn} onClick={onDraw}>
          DRAW
        </button>
        <button
          className="action-btn play-btn"
          disabled={!myTurn || !selectedCard}
          onClick={handlePlayButton}
        >
          PLAY {selectedCard ? `${sanitizeDozenalDisplay(selectedCard.rank)}${selectedCard.suit}` : ''}
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

      {/* Operation Picker Modal (for K in decimal / C in dozenal) */}
      {showOpPicker && (
        <div className="suit-picker-overlay" onClick={() => setShowOpPicker(false)}>
          <div className="suit-picker" onClick={(e) => e.stopPropagation()}>
            <h3>Choose Arithmetic Operation</h3>
            <div className="suit-options">
              <button className="suit-btn op-btn" onClick={() => handleOpSelect('+')}>+</button>
              <button className="suit-btn op-btn" onClick={() => handleOpSelect('-')}>−</button>
              <button className="suit-btn op-btn" onClick={() => handleOpSelect('*')}>×</button>
              <button className="suit-btn op-btn" onClick={() => handleOpSelect('/')}>÷</button>
            </div>
            <button className="cancel-btn" onClick={() => setShowOpPicker(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Arithmetic Challenge Popup - shown to BOTH players */}
      {ps.activeChallenge && (
        <ArithmeticPopup
          challenge={ps.activeChallenge}
          onAnswer={onAnswerChallenge}
        />
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
        <strong>Card Legend:</strong> 🌟 = Wildcard (10, changes suit + Addition) | ⏭️ = Skip ({skipRank}, grants free play) | Face Cards (J, Q{ps.baseId === 'doz' ? ', K' : ''}) = Random Arithmetic | {ps.baseId === 'dec' ? 'K' : 'C'} = Choose Arithmetic Op
      </div>
    </div>
  );
};

export default GameScreen;
