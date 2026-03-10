// Game Types aligned with backend shared types

export type Suit = 'S' | 'H' | 'D' | 'C'; // Spades, Hearts, Diamonds, Clubs
export type BaseId = 'dec' | 'doz';

// Card type matching backend
export interface Card {
  suit: Suit;
  rank: string;
}

// Public state received from backend
export interface PublicState {
  gameId: string;
  baseId: BaseId;
  status: 'ONGOING' | 'GAME_OVER';
  turn: string; // current player's userId
  topCard: Card;
  forcedSuit?: Suit;
  handsCount: Record<string, number>;
  scoresDec: Record<string, number>;
  scoresText: Record<string, string>;
  targetScoreDec: number;
  targetScoreText: string;
  faceRanks: readonly string[];
  deckNumericSymbols: readonly string[];
}

// Action types matching backend
export type GameAction =
  | { type: 'PLAY'; playerId: string; card: Card; chosenSuit?: Suit }
  | { type: 'DRAW'; playerId: string }
  | { type: 'PASS'; playerId: string };

// WebSocket events
export const WS_EVENTS = {
  JOIN_GAME: 'join_game',
  SUBMIT_ACTION: 'submit_action',
  GAME_STATE: 'game_state',
  MY_HAND: 'my_hand',
  ERROR: 'error',
} as const;

// Suit display helpers
export const SUIT_SYMBOLS: Record<Suit, string> = {
  H: '♥',
  D: '♦',
  C: '♣',
  S: '♠',
};

export const SUIT_COLORS: Record<Suit, string> = {
  H: '#e74c3c',
  D: '#e74c3c',
  C: '#2c3e50',
  S: '#2c3e50',
};

export const SUIT_NAMES: Record<Suit, string> = {
  H: 'Hearts',
  D: 'Diamonds',
  C: 'Clubs',
  S: 'Spades',
};

// Helper to create card ID for React keys
export function getCardId(card: Card): string {
  return `${card.rank}${card.suit}`;
}

// Helper to format rank for display (convert dozenal symbols)
export function formatRank(rank: string): string {
  if (rank === '↊') return 'X'; // dozenal 10
  if (rank === '↋') return 'E'; // dozenal 11
  return rank;
}

// Check if a card is a wildcard (rank "10" changes suit)
export function isWildcard(rank: string): boolean {
  return rank === '10';
}

// Check if a card is a skip card (rank "6")
export function isSkipCard(rank: string): boolean {
  return rank === '6';
}

// Client-side playability hint (weak check - server is authoritative)
export function getPlayableCards(
  hand: Card[],
  topCard: Card,
  forcedSuit: Suit | undefined,
  faceRanks: readonly string[]
): Card[] {
  const effectiveSuit = forcedSuit ?? topCard.suit;
  
  return hand.filter((card) => {
    // Wildcards can always be played
    if (isWildcard(card.rank)) return true;
    // Skip cards can always be played
    if (isSkipCard(card.rank)) return true;
    // Match suit
    if (card.suit === effectiveSuit) return true;
    // Match rank
    if (card.rank === topCard.rank) return true;
    
    // Sum to target (12 in dozenal, 10 in decimal) - only for numeric cards
    if (!faceRanks.includes(card.rank) && !faceRanks.includes(topCard.rank)) {
      // This is a simplified check - the actual sum logic is on server
      return true; // Let server validate
    }
    
    return false;
  });
}
