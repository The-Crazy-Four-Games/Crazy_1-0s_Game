import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import Card from './Card';
import CardEffects from './CardEffects';
import ArithmeticPopup from './ArithmeticPopup';
import { SUIT_SYMBOLS, SUIT_COLORS_DARK, sanitizeDozenalDisplay, isSelectOpCard as checkSelectOpCard } from '../types/game';
import type { Suit, MathChallenge } from '../types/game';
import { isFace, numericValueDec, parseInSystem, formatInSystem, DECIMAL_SYSTEM, DOZENAL_SYSTEM, OCTAL_SYSTEM } from '@rev0/shared';
import type { NumeralSystem } from '@rev0/shared';
import './GameScreen.css';

type CardType = { suit: Suit; rank: string };

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
  baseId: 'doz' | 'dec' | 'oct';
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
  onPass: () => void;
  onAnswerChallenge: (answer: number) => void;
  challengeResult?: { won: boolean; correct: boolean; tooLate: boolean } | null;

  // Back button
  onBackToLobby: () => void;

  // Restart game
  restartStatus: 'none' | 'waiting' | 'opponent_requested';
  onRequestRestart: () => void;
  onDeclineRestart: () => void;

  // Chat
  chatMessages: { from: string; text: string; ts: number }[];
  onSendChat: (text: string) => void;

  // Cheat (testing)
  onCheatWin?: () => void;

  // Opponent disconnect notification
  opponentLeftMsg?: string;

  // Toast notification
  toast?: { message: string; type: 'error' | 'info' } | null;
  onClearToast?: () => void;

  // Challenge resolution (new dual-player system)
  challengeResolution?: {
    winnerId: string | null;
    correctAnswer: number;
    timedOut: boolean;
    bothWrong?: boolean;
    challengeData?: { type: string; op1: number; op2: number; reward: number };
  } | null;
  challengeHistory?: {
    type: string;
    op1: number;
    op2: number;
    correctAnswer: number;
    won: boolean;
    timedOut: boolean;
    timestamp: number;
  }[];
  challengeStartTime?: number | null;
}

export const GameScreen: React.FC<GameScreenProps> = ({
  userId,
  ps,
  myHand,
  myTurn,
  log,
  onDraw,
  onPlay,
  onPass,
  onAnswerChallenge,
  challengeResult,
  onBackToLobby,
  restartStatus,
  onRequestRestart,
  onDeclineRestart,
  chatMessages,
  onSendChat,
  onCheatWin,
  opponentLeftMsg,
  toast,
  onClearToast,
  challengeResolution,
  challengeHistory = [],
  challengeStartTime,
}) => {
  const [selectedCard, setSelectedCard] = useState<CardType | null>(null);
  const [showSuitPicker, setShowSuitPicker] = useState(false);
  const [pendingCard, setPendingCard] = useState<CardType | null>(null);
  const [showGameOverModal, setShowGameOverModal] = useState(true);
  const [showRoundEndModal, setShowRoundEndModal] = useState(true);
  const [showLog, setShowLog] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatSide, setChatSide] = useState<'left' | 'right'>('right');
  const [showHints, setShowHints] = useState(false);
  const [hintsTab, setHintsTab] = useState<'rules' | 'addition' | 'multiplication'>('rules');
  const [sortMode, setSortMode] = useState<'none' | 'rank' | 'suit'>('none');
  const [handShake, setHandShake] = useState(false);
  const [sortAnimating, setSortAnimating] = useState(false);
  const [showChallengeHistory, setShowChallengeHistory] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = React.useRef<HTMLDivElement>(null);

  // Auto-scroll chat to bottom on new messages
  React.useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);
  const [showOpPicker, setShowOpPicker] = useState(false);
  const [pendingOpCard, setPendingOpCard] = useState<CardType | null>(null);
  const [pendingOpSuit, setPendingOpSuit] = useState<Suit | undefined>(undefined);

  // Highlight options (all default OFF)
  const [highlightSuit, setHighlightSuit] = useState(false);
  const [highlightRank, setHighlightRank] = useState(false);
  const [highlightSum, setHighlightSum] = useState(false);
  const [showOptions, setShowOptions] = useState(false);

  // Track hand changes for deal-in animation
  const prevHandSizeRef = useRef(myHand.length);
  const [newCardIndices, setNewCardIndices] = useState<Set<number>>(new Set());

  useEffect(() => {
    const prevSize = prevHandSizeRef.current;
    const currentSize = myHand.length;
    if (currentSize > prevSize) {
      // New cards were added — mark them for animation
      const indices = new Set<number>();
      for (let i = prevSize; i < currentSize; i++) {
        indices.add(i);
      }
      setNewCardIndices(indices);
      // Clear animation class after animation completes
      const timer = setTimeout(() => setNewCardIndices(new Set()), 500);
      prevHandSizeRef.current = currentSize;
      return () => clearTimeout(timer);
    }
    prevHandSizeRef.current = currentSize;
  }, [myHand.length]);

  // Top card animation key + card play effect
  const [topCardKey, setTopCardKey] = useState(0);
  const [cardEffect, setCardEffect] = useState<'skip' | 'wildcard' | 'facecard' | null>(null);
  const [effectKey, setEffectKey] = useState(0);
  const prevTopCardRef = useRef(ps.topCard);
  useEffect(() => {
    if (prevTopCardRef.current.rank !== ps.topCard.rank || prevTopCardRef.current.suit !== ps.topCard.suit) {
      setTopCardKey(k => k + 1);

      // Determine effect type based on the new top card
      const newRank = ps.topCard.rank;
      const skip = ps.baseId === 'doz' ? '6' : '5';
      if (newRank === skip) {
        setCardEffect('skip');
        setEffectKey(k => k + 1);
      } else if (newRank === '10') {
        setCardEffect('wildcard');
        setEffectKey(k => k + 1);
      } else if (['J', 'Q', 'K', 'C'].includes(newRank)) {
        setCardEffect('facecard');
        setEffectKey(k => k + 1);
      }

      prevTopCardRef.current = ps.topCard;
    }
  }, [ps.topCard]);

  // Drag-and-drop state
  const [dragOverDiscard, setDragOverDiscard] = useState(false);
  const [draggedCard, setDraggedCard] = useState<CardType | null>(null);

  const handleDragStart = useCallback((card: CardType, e: React.DragEvent) => {
    setDraggedCard(card);
    e.dataTransfer.effectAllowed = 'move';
    // Set a transparent drag image for custom feel
    const el = e.currentTarget as HTMLElement;
    e.dataTransfer.setDragImage(el, 40, 60);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedCard(null);
    setDragOverDiscard(false);
  }, []);

  const handleDiscardDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverDiscard(true);
  }, []);

  const handleDiscardDragLeave = useCallback(() => {
    setDragOverDiscard(false);
  }, []);

  const handleDiscardDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOverDiscard(false);
    if (draggedCard && myTurn) {
      // Directly play the card (skip the select step)
      if (isWildcard(draggedCard.rank)) {
        setPendingCard(draggedCard);
        setShowSuitPicker(true);
      } else if (isSelectOp(draggedCard.rank)) {
        setPendingOpCard(draggedCard);
        setPendingOpSuit(undefined);
        setShowOpPicker(true);
      } else {
        onPlay(draggedCard);
        setSelectedCard(null);
      }
    }
    setDraggedCard(null);
  }, [draggedCard, myTurn]);

  // Card back selection (persisted in localStorage)
  const CARD_BACKS = [
    { id: 'default', path: '/cards/back.svg.png', label: 'Default' },
    { id: 'cyberpunk', path: '/cards/backs/back_cyberpunk.png', label: 'Cyberpunk' },
    { id: 'dark', path: '/cards/backs/back_dark.png', label: 'Dark' },
    { id: 'jhe', path: '/cards/backs/back_jhe.png', label: 'JHE' },
    { id: 'persona', path: '/cards/backs/back_persona.png', label: 'Persona' },
    { id: 'persona3', path: '/cards/backs/back_persona3.png', label: 'Persona 3' },
  ];
  const [cardBack, setCardBack] = useState(() => localStorage.getItem('cardBack') || '/cards/back.svg.png');
  const handleCardBackChange = (path: string) => {
    setCardBack(path);
    localStorage.setItem('cardBack', path);
  };

  // Snapshot of the challenge to keep popup alive after ps.activeChallenge clears
  const [activeChallengeCopy, setActiveChallengeCopy] = useState<MathChallenge | null>(null);

  // Ref-based dismiss timer: won't be cancelled by React effect cleanups
  const dismissTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleDismiss = React.useCallback((delayMs: number) => {
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    dismissTimerRef.current = setTimeout(() => {
      setActiveChallengeCopy(null);
      dismissTimerRef.current = null;
    }, delayMs);
  }, []);

  // When a new challenge appears, snapshot it
  React.useEffect(() => {
    if (ps.activeChallenge) {
      // New challenge — cancel any pending dismiss and snapshot
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = null;
      }
      setActiveChallengeCopy(ps.activeChallenge);
    } else if (activeChallengeCopy) {
      // Challenge cleared by server = challenge is definitively over
      // Give user 3.5s to read the result, then dismiss
      scheduleDismiss(3500);
    }
  }, [ps.activeChallenge]); // eslint-disable-line react-hooks/exhaustive-deps

  // For correct answers: dismiss a bit faster (2s) since it's a positive result
  React.useEffect(() => {
    if (challengeResult?.correct && activeChallengeCopy) {
      scheduleDismiss(2500);
    }
  }, [challengeResult]); // eslint-disable-line react-hooks/exhaustive-deps

  // Get opponent info
  const opponentId = useMemo(() => {
    const players = Object.keys(ps.handsCount);
    return players.find((p) => p !== userId) || '';
  }, [ps.handsCount, userId]);

  const opponentHandCount = ps.handsCount[opponentId] || 0;
  // Display scores in the correct base (dozenal or decimal)
  const myScore = ps.scoresText?.[userId] ?? String(ps.scoresDec?.[userId] ?? 0);
  const opponentScore = ps.scoresText?.[opponentId] ?? String(ps.scoresDec?.[opponentId] ?? 0);
  const targetScore = ps.targetScoreText ?? String(ps.targetScoreDec ?? 100);

  // Score change animation
  const prevMyScoreRef = useRef(myScore);
  const [scoreGain, setScoreGain] = useState<string | null>(null);
  const [scoreAnimKey, setScoreAnimKey] = useState(0);
  useEffect(() => {
    if (prevMyScoreRef.current !== myScore && prevMyScoreRef.current !== '0') {
      // Score changed! Show gain animation
      const prevDec = ps.scoresDec[userId] || 0;
      const prevPrev = parseInt(prevMyScoreRef.current, 10) || 0;
      if (prevDec > prevPrev || myScore !== prevMyScoreRef.current) {
        setScoreGain(`+`);
        setScoreAnimKey(k => k + 1);
        const timer = setTimeout(() => setScoreGain(null), 1500);
        prevMyScoreRef.current = myScore;
        return () => clearTimeout(timer);
      }
    }
    prevMyScoreRef.current = myScore;
  }, [myScore]);

  // Determine winner when game is over
  const isGameOver = ps.status === 'GAME_OVER';
  const myScoreDec = ps.scoresDec[userId] || 0;
  const opponentScoreDec = ps.scoresDec[opponentId] || 0;
  const iWon = isGameOver && myScoreDec >= ps.targetScoreDec && myScoreDec >= opponentScoreDec;

  // Helper to check if card is wildcard (rank "10")
  const isWildcard = (rank: string) => rank === '10';

  // Get the numeral system for sum-to-10 checks (defined first, before skipRank)
  const sys: NumeralSystem = ps.baseId === 'doz' ? DOZENAL_SYSTEM : ps.baseId === 'oct' ? OCTAL_SYSTEM : DECIMAL_SYSTEM;

  // Helper to check if card is skip card (rank "6" for dozenal, "4" for octal, "5" for decimal)
  const skipRank = sys.wildcardSkipSymbol;
  const isSkipCard = (rank: string) => rank === skipRank;

  // Helper to check if card triggers operation selection (K in decimal, C in dozenal, none in octal)
  const isSelectOp = (rank: string) => ps.baseId !== 'oct' && checkSelectOpCard(rank, ps.baseId as 'doz' | 'dec');

  // Bug Fix 4: Reset round-end modal when a new round result arrives
  useEffect(() => {
    if (ps.lastRoundResult) {
      setShowRoundEndModal(true);
    }
  }, [ps.lastRoundResult]);

  // Error toast: trigger hand shake on illegal move errors
  useEffect(() => {
    if (toast && toast.type === 'error' && (toast.message.includes('IllegalMove') || toast.message.includes('NotYourTurn') || toast.message.includes('DrawLimitReached'))) {
      setHandShake(true);
      const timer = setTimeout(() => setHandShake(false), 600);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Sorted hand (Feature 1)
  const sortedHand = useMemo(() => {
    if (sortMode === 'none') return myHand;
    const copy = [...myHand];
    const suitOrder: Record<string, number> = { S: 0, H: 1, D: 2, C: 3 };
    const getRankValue = (rank: string): number => {
      try {
        if (isFace(rank, sys)) {
          const faceOrder: Record<string, number> = { J: 100, Q: 101, K: 102, C: 103 };
          return faceOrder[rank] ?? 199;
        }
        return numericValueDec(rank, sys);
      } catch {
        return 999;
      }
    };
    if (sortMode === 'rank') {
      copy.sort((a, b) => getRankValue(a.rank) - getRankValue(b.rank));
    } else {
      copy.sort((a, b) => {
        const sd = (suitOrder[a.suit] ?? 9) - (suitOrder[b.suit] ?? 9);
        if (sd !== 0) return sd;
        return getRankValue(a.rank) - getRankValue(b.rank);
      });
    }
    return copy;
  }, [myHand, sortMode, sys]);

  // Dozenal-aware count formatter
  const fmtCount = (n: number) => ps.baseId !== 'dec' ? formatInSystem(n, sys) : String(n);

  // Sort with animation
  const handleSortChange = (mode: 'rank' | 'suit') => {
    const newMode = sortMode === mode ? 'none' : mode;
    setSortAnimating(true);
    setTimeout(() => {
      setSortMode(newMode);
      setTimeout(() => setSortAnimating(false), 350);
    }, 300);
  };


  // Highlighted cards — filtered by active toggles
  const highlightedCards = useMemo(() => {
    if (!ps) return [];
    if (!highlightSuit && !highlightRank && !highlightSum) return [];
    const effSuit = ps.forcedSuit ?? ps.topCard.suit;
    const targetSumDec = parseInSystem(sys.targetSumText, sys);
    return myHand.filter((c) => {
      // Wildcards and skip cards: always highlighted if any toggle is on
      if (isWildcard(c.rank) || isSkipCard(c.rank)) return true;
      if (highlightSuit && c.suit === effSuit) return true;
      if (highlightRank && c.rank === ps.topCard.rank) return true;
      if (highlightSum && !isFace(c.rank, sys) && !isFace(ps.topCard.rank, sys)) {
        const sum = numericValueDec(c.rank, sys) + numericValueDec(ps.topCard.rank, sys);
        if (sum === targetSumDec) return true;
      }
      return false;
    });
  }, [ps, myHand, highlightSuit, highlightRank, highlightSum]);

  const isHighlighted = (card: CardType) =>
    highlightedCards.some((c) => c.suit === card.suit && c.rank === card.rank);



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
    <>
      <CardEffects effectType={cardEffect} effectKey={effectKey} />
      <div className="game-screen">
        {/* Animated Background */}
        <div className="game-bg-suits" aria-hidden="true">
          {['♠','♥','♦','♣','♠','♥','♦','♣','♠','♥','♦','♣'].map((suit, i) => (
            <span
              key={i}
              className="game-bg-suit"
              style={{
                left: `${(i * 8.5) % 100}%`,
                top: `${(i * 13 + 10) % 90}%`,
                '--dur': `${15 + (i % 5) * 4}s`,
                '--delay': `${-(i * 3.1)}s`,
              } as React.CSSProperties}
            >
              {suit}
            </span>
          ))}
        </div>
        <header className="game-header">
          <button className="back-button" onClick={onBackToLobby}>
            ← Back
          </button>
          <h1>Crazy 1-0's</h1>
          <div className="game-base-info">
            Base: {ps.baseId === 'doz' ? 'Dozenal' : ps.baseId === 'oct' ? 'Octal 🧪' : 'Decimal'}
          </div>
        </header>

        {/* Toast Notification */}
        {toast && (
          <div className={`game-toast game-toast-${toast.type}`} onClick={onClearToast}>
            <span className="game-toast-icon">{toast.type === 'error' ? '⚠️' : 'ℹ️'}</span>
            <span className="game-toast-msg">{toast.message}</span>
            <button className="game-toast-close" onClick={onClearToast}>✕</button>
          </div>
        )}

        {/* Score Summary */}
        <div className="score-summary">
          <span className={`score-you ${scoreGain ? 'score-pulse' : ''}`} style={{ position: 'relative' }}>
            You: <strong key={`sc-${scoreAnimKey}`} className={scoreGain ? 'score-highlight-anim' : ''}>{myScore}</strong>
            {scoreGain && (
              <span key={`gain-${scoreAnimKey}`} className="score-gain-float">{scoreGain}</span>
            )}
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
                  <strong>{ps.lastRoundResult.pointsGainedText ?? ps.lastRoundResult.pointsGained}</strong>
                </div>
                <div className="score-row">
                  <span>Your Total Score:</span>
                  <strong>{ps.lastRoundResult.scoresText?.[userId] ?? ps.lastRoundResult.scoresDec[userId] ?? 0}</strong>
                </div>
                <div className="score-row">
                  <span>Opponent Total Score:</span>
                  <strong>{ps.lastRoundResult.scoresText?.[opponentId] ?? ps.lastRoundResult.scoresDec[opponentId] ?? 0}</strong>
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
                  <>
                    <button className="modal-btn primary" onClick={onRequestRestart}>
                      ✅ Accept Rematch
                    </button>
                    <button className="modal-btn secondary" onClick={onDeclineRestart}>
                      ❌ Decline & Return to Lobby
                    </button>
                  </>
                )}
                {restartStatus === 'waiting' && (
                  <button className="modal-btn primary" disabled>
                    ⏳ Waiting...
                  </button>
                )}
                {restartStatus !== 'opponent_requested' && (
                  <button className="modal-btn secondary" onClick={onBackToLobby}>
                    Return to Lobby
                  </button>
                )}
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
              <>
                <button className="play-again-btn" onClick={onRequestRestart}>
                  Accept Rematch
                </button>
                <button className="lobby-btn" onClick={onDeclineRestart}>
                  Decline
                </button>
              </>
            )}
            {restartStatus === 'waiting' && (
              <button className="play-again-btn" disabled>
                Waiting...
              </button>
            )}
            {restartStatus !== 'opponent_requested' && (
              <button className="lobby-btn" onClick={onBackToLobby}>
                Lobby
              </button>
            )}
          </div>
        )}

        {/* Turn indicator */}
        <div className={`turn-banner ${myTurn ? 'my-turn' : 'opponent-turn'}`}>
          {myTurn ? "✅ Your Turn" : `⏳ Opponent's Turn (${opponentId.slice(0, 8)}...)`}
        </div>

        {/* Opponent Area */}
        <div className="opponent-area">
          <div className="player-label">
            Opponent ({opponentId.slice(0, 8)}...) - {fmtCount(opponentHandCount)} cards
          </div>
          <div className="opponent-hand">
            {opponentCards.map((card, idx) => (
              <div key={idx} className="opponent-card-wrapper" style={{ marginLeft: idx > 0 ? '-30px' : '0' }}>
                <Card card={card} faceDown size="small" cardBack={cardBack} />
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
              <Card card={{ suit: 'S', rank: '?' }} faceDown size="large" cardBack={cardBack} />
            </div>
            <button className="action-btn" disabled={!myTurn} onClick={onDraw}>
              Draw
            </button>
          </div>

          {/* Discard Pile / Top Card */}
          <div
            className={`pile-section ${dragOverDiscard ? 'discard-drop-active' : ''}`}
            onDragOver={handleDiscardDragOver}
            onDragLeave={handleDiscardDragLeave}
            onDrop={handleDiscardDrop}
          >
            <div className="pile-label">Discard Pile {dragOverDiscard && '⬇️'}</div>
            <div className="top-card-display">
              <Card
                key={`top-${topCardKey}`}
                card={ps.topCard}
                size="large"
                isPlayable={false}
                animClass="card-arrive-top"
              />
            </div>
            {ps.forcedSuit && (
              <div className="forced-suit" style={{ color: SUIT_COLORS_DARK[ps.forcedSuit] }}>
                Suit: {SUIT_SYMBOLS[ps.forcedSuit]}
              </div>
            )}
          </div>
        </div>

        {/* Player Hand */}
        <div className="player-area">
          {/* Sort Controls */}
          <div className="sort-controls">
            <button
              className={`sort-control-btn ${sortMode === 'rank' ? 'active' : ''}`}
              onClick={() => handleSortChange('rank')}
              title="Sort by rank"
            >
              <span className="sort-icon">♠♥</span> Sort by Rank
            </button>
            <button
              className={`sort-control-btn ${sortMode === 'suit' ? 'active' : ''}`}
              onClick={() => handleSortChange('suit')}
              title="Sort by suit"
            >
              <span className="sort-icon">♣♦</span> Sort by Suit
            </button>
          </div>

          <div className="player-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span>Your Hand ({fmtCount(myHand.length)} cards)</span>
            <button
              className="options-gear-btn"
              onClick={() => setShowOptions(v => !v)}
              title="Highlight Options"
            >
              ⚙️
            </button>
          </div>

          {/* Options Panel */}
          {showOptions && (
            <div className="options-panel">
              <div className="options-section">
                <div className="options-section-title">Highlight</div>
                <div className="options-toggles">
                  <label className="option-toggle">
                    <input type="checkbox" checked={highlightSuit} onChange={e => setHighlightSuit(e.target.checked)} />
                    <span>Suit Match</span>
                  </label>
                  <label className="option-toggle">
                    <input type="checkbox" checked={highlightRank} onChange={e => setHighlightRank(e.target.checked)} />
                    <span>Rank Match</span>
                  </label>
                  <label className="option-toggle">
                    <input type="checkbox" checked={highlightSum} onChange={e => setHighlightSum(e.target.checked)} />
                    <span>Sum to {sanitizeDozenalDisplay(sys.targetSumText)}</span>
                  </label>
                </div>
              </div>
              <div className="options-section">
                <div className="options-section-title">Card Back</div>
                <div className="card-back-picker">
                  {CARD_BACKS.map(b => (
                    <button
                      key={b.id}
                      className={`card-back-option ${cardBack === b.path ? 'selected' : ''}`}
                      onClick={() => handleCardBackChange(b.path)}
                      title={b.label}
                    >
                      <img src={b.path} alt={b.label} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className={`player-hand ${handShake ? 'hand-shake' : ''} ${sortAnimating ? 'hand-shuffling' : ''}`}>
            {sortedHand.map((card, idx) => (
              <div
                key={`${card.rank}${card.suit}-${idx}`}
                className="hand-card-wrapper"
                style={{ marginLeft: idx > 0 ? '-8px' : '0', zIndex: idx, animationDelay: newCardIndices.has(idx) ? `${(idx - Math.min(...newCardIndices)) * 0.06}s` : undefined }}
                onDragEnd={handleDragEnd}
              >
                <Card
                  card={card}
                  size="medium"
                  isPlayable={myTurn && isHighlighted(card)}
                  isSelected={isSelected(card) || false}
                  isWildcard={isWildcard(card.rank)}
                  isSkipCard={isSkipCard(card.rank)}
                  onClick={() => handleCardClick(card)}
                  draggable={myTurn}
                  onDragStart={(e) => handleDragStart(card, e)}
                  animClass={newCardIndices.has(idx) ? 'card-deal-in' : undefined}
                />
              </div>
            ))}
          </div>

        </div>

        {/* Action Buttons */}
        <div className="action-bar">
          <button className="action-btn" disabled={!myTurn} onClick={onDraw}>
            🃏 DRAW
          </button>
          <button
            className="action-btn pass-btn"
            disabled={!myTurn}
            onClick={onPass}
          >
            ⏭ PASS
          </button>
          <button
            className="action-btn play-btn"
            disabled={!myTurn || !selectedCard}
            onClick={handlePlayButton}
          >
            🎯 PLAY {selectedCard ? `${sanitizeDozenalDisplay(selectedCard.rank)}${selectedCard.suit}` : ''}
          </button>
          {onCheatWin && (
            <button
              style={{
                position: 'fixed',
                top: '4px',
                right: '4px',
                width: '14px',
                height: '14px',
                borderRadius: '50%',
                border: 'none',
                background: 'rgba(255,80,80,0.25)',
                cursor: 'pointer',
                padding: 0,
                fontSize: 0,
                opacity: 0.3,
                zIndex: 9999,
              }}
              title=""
              onClick={onCheatWin}
            />
          )}
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
                    className={`suit-btn suit-btn-${suit}`}
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
        {activeChallengeCopy && (
          <ArithmeticPopup
            challenge={activeChallengeCopy}
            onAnswer={onAnswerChallenge}
            baseId={ps.baseId}
            challengeResult={challengeResult}
            challengeResolution={challengeResolution}
            myId={userId}
            challengeStartTime={challengeStartTime ?? undefined}
          />
        )}

        {/* Challenge History Button */}
        {challengeHistory.length > 0 && (
          <button
            className="challenge-history-btn"
            onClick={() => setShowChallengeHistory(v => !v)}
            title="View Challenge History"
          >
            📊 Challenges ({challengeHistory.length})
          </button>
        )}

        {/* Challenge History Panel */}
        {showChallengeHistory && challengeHistory.length > 0 && (
          <div className="challenge-history-overlay" onClick={() => setShowChallengeHistory(false)}>
            <div className="challenge-history-panel" onClick={e => e.stopPropagation()}>
              <div className="challenge-history-header">
                <h3>📊 Challenge History</h3>
                <button className="hints-close-btn" onClick={() => setShowChallengeHistory(false)}>✖</button>
              </div>
              <div className="challenge-history-list">
                {challengeHistory.map((ch, i) => {
                  const opSymbol = ch.type === '*' ? '×' : ch.type === '/' ? '÷' : ch.type;
                  const fmtN = (n: number) => {
                    if (ps.baseId === 'dec') return String(n);
                    return formatInSystem(n, sys);
                  };
                  return (
                    <div key={i} className={`challenge-history-item ${ch.won ? 'won' : ch.timedOut ? 'timed-out' : 'lost'}`}>
                      <span className="ch-equation">
                        {fmtN(ch.op1)} {opSymbol} {fmtN(ch.op2)} = {fmtN(ch.correctAnswer)}
                      </span>
                      <span className="ch-result">
                        {ch.won ? '✅ Won' : ch.timedOut ? '⏰ Timeout' : '❌ Lost'}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="challenge-history-summary">
                Won: {challengeHistory.filter(c => c.won).length} / {challengeHistory.length}
              </div>
            </div>
          </div>
        )}

        {/* Opponent disconnect notification */}
        {opponentLeftMsg && (
          <div className="arithmetic-overlay">
            <div className="arithmetic-popup" style={{ minWidth: '360px' }}>
              <div className="popup-header">
                <h2>⚠️ Opponent Left</h2>
              </div>
              <div className="challenge-card-info" style={{ marginBottom: '20px', fontSize: '1.1rem' }}>
                {opponentLeftMsg}
              </div>
              <button
                className="submit-btn"
                style={{ width: '100%', height: '50px', fontSize: '1.1rem', borderRadius: '12px', cursor: 'pointer' }}
                onClick={onBackToLobby}
              >
                🚪 Return to Lobby
              </button>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="game-instructions">
          <strong>Card Legend:</strong> 🌟 = Wildcard ({sys.wildcardTenSymbol}, changes suit) | ⏭️ = Skip ({skipRank}, grants free play) | Face Cards (J, Q{ps.baseId === 'doz' ? ', K' : ''}) = Random Arithmetic{ps.baseId !== 'oct' ? ` | ${ps.baseId === 'dec' ? 'K' : 'C'} = Choose Arithmetic Op` : ''}
        </div>
      </div>

      {/* Chat Sidebar */}
      {
        showChat ? (
          <div className={`chat-sidebar ${chatSide}`}>
            <div className="chat-sidebar-header">
              <span>💬 Chat</span>
              <div className="chat-sidebar-btns">
                <button title="Move sidebar" onClick={() => setChatSide(s => s === 'right' ? 'left' : 'right')}>
                  {chatSide === 'right' ? '⬅' : '➡'}
                </button>
                <button title="Close chat" onClick={() => setShowChat(false)}>✖</button>
              </div>
            </div>
            <div className="chat-messages">
              {chatMessages.length === 0 && (
                <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem', fontStyle: 'italic', textAlign: 'center', marginTop: '20px' }}>
                  No messages yet
                </div>
              )}
              {chatMessages.map((m, i) => (
                <div key={i} className={`chat-bubble ${m.from === userId ? 'mine' : 'theirs'}`}>
                  <span className="chat-sender">{m.from === userId ? 'You' : 'Opponent'}</span>
                  <span className="chat-text">{m.text}</span>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <div className="chat-input-row">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && chatInput.trim()) {
                    onSendChat(chatInput.trim());
                    setChatInput('');
                  }
                }}
                placeholder="Type a message..."
                maxLength={200}
              />
              <button
                onClick={() => {
                  if (chatInput.trim()) {
                    onSendChat(chatInput.trim());
                    setChatInput('');
                  }
                }}
              >
                ➤
              </button>
            </div>
          </div>
        ) : (
          <button
            className={`chat-open-btn ${chatSide}`}
            onClick={() => setShowChat(true)}
            title="Open chat"
          >
            💬
          </button>
        )
      }

      {/* Tutorial Floating Button */}
      <button
        className={`tutorial-open-btn ${chatSide === 'right' ? 'left' : 'right'}`}
        onClick={() => setShowHints(true)}
        title="Game Tutorial & Reference Tables"
      >
        <span className="tutorial-btn-icon">📚</span>
        <span className="tutorial-btn-label">Tutorial</span>
      </button>

      {/* Activity Log — Small Floating Corner Button */}
      <button
        className="log-float-btn"
        onClick={() => setShowLog(v => !v)}
        title="Activity Log"
      >
        📋
      </button>
      {showLog && (
        <div className="log-float-panel">
          <div className="log-float-header">
            <span>📋 Activity Log</span>
            <button className="hints-close-btn" onClick={() => setShowLog(false)}>✖</button>
          </div>
          <div className="log-float-content">
            {log.length === 0
              ? <div className="log-empty">No activity yet.</div>
              : log.map((x, i) => <div key={i} className="log-entry">{x}</div>)
            }
          </div>
        </div>
      )}

      {/* Hints Popup Modal */}
      {showHints && (
        <div className="hints-overlay" onClick={() => setShowHints(false)}>
          <div className="hints-modal" onClick={(e) => e.stopPropagation()}>
            <div className="hints-header">
              <h2>📖 Game Reference</h2>
              <button className="hints-close-btn" onClick={() => setShowHints(false)}>✖</button>
            </div>
            <div className="hints-tabs">
              <button
                className={`hints-tab ${hintsTab === 'rules' ? 'active' : ''}`}
                onClick={() => setHintsTab('rules')}
              >
                🎴 Game Rules
              </button>
              <button
                className={`hints-tab ${hintsTab === 'addition' ? 'active' : ''}`}
                onClick={() => setHintsTab('addition')}
              >
                ➕ Addition Table
              </button>
              <button
                className={`hints-tab ${hintsTab === 'multiplication' ? 'active' : ''}`}
                onClick={() => setHintsTab('multiplication')}
              >
                ✖️ Multiplication Table
              </button>
            </div>
            <div className="hints-content">
              {hintsTab === 'rules' && (
                <div className="hints-image-wrapper">
                  <img src="/hints/gameplay_rules.png" alt="Game Rules" />
                </div>
              )}
              {hintsTab === 'addition' && (() => {
                // Octal: digits 0-7, format in base-8
                if (ps.baseId === 'oct') {
                  const d = ['0','1','2','3','4','5','6','7'];
                  const fmtOct = (n: number): string => {
                    if (n === 0) return '0';
                    let s = ''; let v = n;
                    while (v > 0) { s = String(v % 8) + s; v = Math.floor(v / 8); }
                    return s;
                  };
                  return (
                    <div className="hints-table-wrapper">
                      <div className="hints-table-title">Octal Addition Table (Base 8)</div>
                      <table className="dozenal-table">
                        <thead><tr><th>+</th>{d.map((c,i) => <th key={i}>{c}</th>)}</tr></thead>
                        <tbody>
                          {d.map((r, ri) => (
                            <tr key={ri}>
                              <th>{r}</th>
                              {d.map((_, ci) => <td key={ci}>{fmtOct(ri + ci)}</td>)}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                }
                // Dozenal: digits 0-↋
                const d = ['0','1','2','3','4','5','6','7','8','9','↊','↋'];
                const fmt = (n: number): string => {
                  if (n < 10) return String(n);
                  if (n === 10) return '↊';
                  if (n === 11) return '↋';
                  const hi = Math.floor(n / 12);
                  const lo = n % 12;
                  return fmt(hi) + (lo < 10 ? String(lo) : lo === 10 ? '↊' : '↋');
                };
                return (
                  <div className="hints-table-wrapper">
                    <table className="dozenal-table">
                      <thead><tr><th>+</th>{d.map((c,i) => <th key={i}>{c}</th>)}</tr></thead>
                      <tbody>
                        {d.map((r, ri) => {
                          const rv = ri;
                          return (
                            <tr key={ri}>
                              <th>{r}</th>
                              {d.map((_, ci) => <td key={ci}>{fmt(rv + ci)}</td>)}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
              {hintsTab === 'multiplication' && (() => {
                // Octal: 1-7 × 1-7, results in octal
                if (ps.baseId === 'oct') {
                  const d = ['1','2','3','4','5','6','7'];
                  const vals = [1,2,3,4,5,6,7];
                  const fmtOct = (n: number): string => {
                    if (n === 0) return '0';
                    let s = ''; let v = n;
                    while (v > 0) { s = String(v % 8) + s; v = Math.floor(v / 8); }
                    return s;
                  };
                  return (
                    <div className="hints-table-wrapper">
                      <div className="hints-table-title">Octal Multiplication Table (Base 8)</div>
                      <table className="dozenal-table">
                        <thead><tr><th>×</th>{d.map((c,i) => <th key={i}>{c}</th>)}</tr></thead>
                        <tbody>
                          {vals.map((rv, ri) => (
                            <tr key={ri}>
                              <th>{d[ri]}</th>
                              {vals.map((cv, ci) => (
                                <td key={ci} className={ri === ci ? 'perfect-square' : ''}>
                                  {fmtOct(rv * cv)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                }
                // Dozenal: 1-10 × 1-10
                const d = ['1','2','3','4','5','6','7','8','9','↊','↋','10'];
                const vals = [1,2,3,4,5,6,7,8,9,10,11,12];
                const fmt = (n: number): string => {
                  if (n === 0) return '0';
                  let s = '';
                  let v = n;
                  while (v > 0) {
                    const rem = v % 12;
                    s = (rem < 10 ? String(rem) : rem === 10 ? '↊' : '↋') + s;
                    v = Math.floor(v / 12);
                  }
                  return s;
                };
                return (
                  <div className="hints-table-wrapper">
                    <table className="dozenal-table">
                      <thead><tr><th>×</th>{d.map((c,i) => <th key={i}>{c}</th>)}</tr></thead>
                      <tbody>
                        {vals.map((rv, ri) => (
                          <tr key={ri}>
                            <th>{d[ri]}</th>
                            {vals.map((cv, ci) => (
                              <td key={ci} className={ri === ci ? 'perfect-square' : ''}>
                                {fmt(rv * cv)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default GameScreen;
