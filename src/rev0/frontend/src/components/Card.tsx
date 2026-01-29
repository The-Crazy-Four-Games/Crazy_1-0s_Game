import React from 'react';
import type { Card as CardType } from '../types/game';
import { SUIT_SYMBOLS, SUIT_COLORS, formatRank } from '../types/game';
import './Card.css';

interface CardProps {
  card: CardType;
  faceDown?: boolean;
  onClick?: () => void;
  isPlayable?: boolean;
  isSelected?: boolean;
  isWildcard?: boolean;
  isSkipCard?: boolean;
  size?: 'small' | 'medium' | 'large';
}

export const Card: React.FC<CardProps> = ({
  card,
  faceDown = false,
  onClick,
  isPlayable = false,
  isSelected = false,
  isWildcard = false,
  isSkipCard = false,
  size = 'medium',
}) => {
  const suitSymbol = SUIT_SYMBOLS[card.suit];
  const suitColor = SUIT_COLORS[card.suit];
  const displayRank = formatRank(card.rank);

  const handleClick = () => {
    if (onClick && !faceDown) {
      onClick();
    }
  };

  if (faceDown) {
    return (
      <div className={`card card-back card-${size}`}>
        <div className="card-back-pattern">
          <span>🎴</span>
        </div>
      </div>
    );
  }

  const cardClasses = [
    'card',
    `card-${size}`,
    isPlayable ? 'playable' : '',
    isSelected ? 'selected' : '',
    isWildcard ? 'wildcard' : '',
    isSkipCard ? 'skip-card' : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={cardClasses}
      onClick={handleClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      {/* Special card indicators */}
      {isWildcard && <div className="card-badge wildcard-badge">🌟</div>}
      {isSkipCard && <div className="card-badge skip-badge">⏭️</div>}
      
      <div className="card-corner top-left" style={{ color: suitColor }}>
        <span className="card-rank">{displayRank}</span>
        <span className="card-suit">{suitSymbol}</span>
      </div>
      <div className="card-center" style={{ color: suitColor }}>
        <span className="card-suit-large">{suitSymbol}</span>
      </div>
      <div className="card-corner bottom-right" style={{ color: suitColor }}>
        <span className="card-rank">{displayRank}</span>
        <span className="card-suit">{suitSymbol}</span>
      </div>
    </div>
  );
};

export default Card;
