/**
 * @file Card.tsx
 * @module frontend/components/Card
 * @author The Crazy 4 Team
 * @date 2026
 * @purpose Renders a single playing card as an image, supporting
 *          face-up / face-down states, interactive selection,
 *          wildcard / skip visual badges, and drag-and-drop.
 */
import React from 'react';
import type { Card as CardType } from '../types/game';
import { getCardImagePath } from '../types/game';
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
  cardBack?: string;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  animClass?: string;
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
  cardBack,
  draggable = false,
  onDragStart,
  animClass,
}) => {
  const imagePath = getCardImagePath(card, faceDown, cardBack);

  const handleClick = () => {
    if (onClick && !faceDown) {
      onClick();
    }
  };

  const cardClasses = [
    'card',
    `card-${size}`,
    faceDown ? 'card-back' : '',
    isPlayable ? 'playable' : '',
    isSelected ? 'selected' : '',
    isWildcard && !faceDown ? 'wildcard' : '',
    isSkipCard && !faceDown ? 'skip-card' : '',
    animClass || '',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={cardClasses}
      onClick={handleClick}
      style={{ cursor: (onClick && !faceDown) || draggable ? 'pointer' : 'default' }}
      draggable={draggable}
      onDragStart={onDragStart}
    >
      {/* Special card indicators */}
      {!faceDown && isWildcard && <div className="card-badge wildcard-badge">🌟</div>}
      {!faceDown && isSkipCard && <div className="card-badge skip-badge">⏭️</div>}

      <img
        src={imagePath}
        alt={faceDown ? 'Card back' : `${card.rank} of ${card.suit}`}
        className="card-image"
        draggable={false}
      />
    </div>
  );
};

export default Card;
