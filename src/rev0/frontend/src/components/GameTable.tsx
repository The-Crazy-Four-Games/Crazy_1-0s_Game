import React from 'react';
import type { Card as CardType, Suit } from '../types/game';
import { SUIT_SYMBOLS, SUIT_COLORS } from '../types/game';
import Card from './Card';
import './GameTable.css';

interface DrawPileProps {
  onDraw: () => void;
  canDraw: boolean;
}

export const DrawPile: React.FC<DrawPileProps> = ({
  onDraw,
  canDraw,
}) => {
  // Create a mock card for the back
  const mockCard: CardType = {
    rank: 'A',
    suit: 'S',
  };

  return (
    <div className="draw-pile">
      <div className="pile-label">Draw Pile</div>
      <div
        className={`pile-stack ${canDraw ? 'can-draw' : ''}`}
        onClick={canDraw ? onDraw : undefined}
      >
        <div className="pile-card offset-2">
          <Card card={mockCard} faceDown size="large" />
        </div>
        <div className="pile-card offset-1">
          <Card card={mockCard} faceDown size="large" />
        </div>
        <div className="pile-card">
          <Card card={mockCard} faceDown size="large" />
        </div>
      </div>
      <div className="pile-info">
        {canDraw && <span className="draws-left">Click to draw</span>}
        {!canDraw && <span>Max 3 draws/turn</span>}
      </div>
    </div>
  );
};

interface DiscardPileProps {
  topCard: CardType | null;
  forcedSuit?: Suit;
}

export const DiscardPile: React.FC<DiscardPileProps> = ({
  topCard,
  forcedSuit,
}) => {
  return (
    <div className="discard-pile">
      <div className="pile-label">Discard Pile</div>
      <div className="pile-stack">
        {topCard ? (
          <Card card={topCard} size="large" />
        ) : (
          <div className="empty-pile">No cards</div>
        )}
      </div>
      {forcedSuit && (
        <div
          className="wild-choice"
          style={{ color: SUIT_COLORS[forcedSuit] }}
        >
          Current suit: {SUIT_SYMBOLS[forcedSuit]}
        </div>
      )}
    </div>
  );
};

interface SuitSelectorProps {
  onSelectSuit: (suit: Suit) => void;
  onCancel: () => void;
}

export const SuitSelector: React.FC<SuitSelectorProps> = ({
  onSelectSuit,
  onCancel,
}) => {
  const suits: Suit[] = ['S', 'H', 'D', 'C'];

  return (
    <div className="suit-selector-overlay">
      <div className="suit-selector">
        <h3>Choose a Suit</h3>
        <div className="suit-options">
          {suits.map((suit) => (
            <button
              key={suit}
              className="suit-button"
              style={{ color: SUIT_COLORS[suit] }}
              onClick={() => onSelectSuit(suit)}
            >
              <span className="suit-symbol">{SUIT_SYMBOLS[suit]}</span>
            </button>
          ))}
        </div>
        <button className="cancel-button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
};

interface GameActionsProps {
  selectedCard: CardType | null;
  canPlay: boolean;
  canDraw: boolean;
  canPass?: boolean;
  onPlay: () => void;
  onDraw: () => void;
  onPass: () => void;
  isWildCard: boolean;
}

export const GameActions: React.FC<GameActionsProps> = ({
  selectedCard,
  canPlay,
  canDraw,
  canPass = true,
  onPlay,
  onDraw,
  onPass,
  isWildCard,
}) => {
  return (
    <div className="game-actions">
      <button
        className="action-button play-button"
        onClick={onPlay}
        disabled={!canPlay || !selectedCard}
      >
        {isWildCard ? 'Play Wild Card' : 'Play Card'}
      </button>
      <button
        className="action-button draw-button"
        onClick={onDraw}
        disabled={!canDraw}
      >
        Draw Card
      </button>
      <button
        className="action-button pass-button"
        onClick={onPass}
        disabled={!canPass}
      >
        Pass Turn
      </button>
    </div>
  );
};
