import React from 'react';
import type { Card as CardType } from '../types/game';
import { getCardId } from '../types/game';
import Card from './Card';
import './PlayerHand.css';

interface PlayerHandProps {
  cards: CardType[];
  isCurrentPlayer: boolean;
  faceDown?: boolean;
  playableCards?: CardType[];
  selectedCard?: CardType | null;
  onSelectCard?: (card: CardType) => void;
  playerName: string;
  score: string;
}

export const PlayerHand: React.FC<PlayerHandProps> = ({
  cards,
  isCurrentPlayer,
  faceDown = false,
  playableCards = [],
  selectedCard = null,
  onSelectCard,
  playerName,
  score,
}) => {
  const isPlayable = (card: CardType) =>
    playableCards.some((c) => getCardId(c) === getCardId(card));

  const isSelected = (card: CardType): boolean =>
    selectedCard !== null && getCardId(selectedCard) === getCardId(card);

  return (
    <div className={`player-hand ${isCurrentPlayer ? 'current-player' : ''}`}>
      <div className="player-info">
        <span className="player-name">{playerName}</span>
        <span className="player-score">Score: {score}</span>
        {isCurrentPlayer && <span className="turn-indicator">Your Turn</span>}
      </div>
      <div className="hand-cards">
        {cards.map((card, index) => (
          <div
            key={faceDown ? `back-${index}` : getCardId(card)}
            className="hand-card"
            style={{
              marginLeft: index > 0 ? '-25px' : '0',
              zIndex: index,
            }}
          >
            <Card
              card={card}
              faceDown={faceDown}
              isPlayable={!faceDown && isCurrentPlayer && isPlayable(card)}
              isSelected={isSelected(card)}
              onClick={
                !faceDown && isCurrentPlayer && onSelectCard
                  ? () => onSelectCard(card)
                  : undefined
              }
              size={faceDown ? 'small' : 'medium'}
            />
          </div>
        ))}
      </div>
      <div className="card-count">{cards.length} cards</div>
    </div>
  );
};

export default PlayerHand;
