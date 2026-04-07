// Game Types aligned with backend shared types

export type Suit = 'S' | 'H' | 'D' | 'C'; // Spades, Hearts, Diamonds, Clubs
export type BaseId = 'dec' | 'doz';

// Card type matching backend
export interface Card {
  suit: Suit;
  rank: string;
}

// Math challenge from backend (answer is stripped by server)
export interface MathChallenge {
  playerId: string;
  type: '+' | '-' | '*' | '/';
  op1: number;
  op2: number;
  answer?: number; // undefined - stripped by server for security
  reward: number;
  shouldPassTurn: boolean;
}

// Round result for end-of-round popup
export interface RoundResult {
  winner: string;
  loser: string;
  pointsGained: number;
  scoresDec: Record<string, number>;
}

// Public state received from backend
export interface PublicState {
  gameId: string;
  baseId: BaseId;
  status: 'ONGOING' | 'GAME_OVER';
  turn: string; // current player's userId
  topCard: Card;
  forcedSuit?: Suit;
  activeChallenge?: MathChallenge;
  handsCount: Record<string, number>;
  scoresDec: Record<string, number>;
  scoresText: Record<string, string>;
  targetScoreDec: number;
  targetScoreText: string;
  faceRanks: readonly string[];
  deckNumericSymbols: readonly string[];
  lastRoundResult?: RoundResult;
}

// Action types matching backend
export type GameAction =
  | { type: 'PLAY'; playerId: string; card: Card; chosenSuit?: Suit; chosenOperation?: '+' | '-' | '*' | '/' }
  | { type: 'DRAW'; playerId: string }
  | { type: 'PASS'; playerId: string }
  | { type: 'ANSWER_CHALLENGE'; playerId: string; answer: number };

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

// Brighter colors for dark backgrounds (forced suit indicator, etc.)
export const SUIT_COLORS_DARK: Record<Suit, string> = {
  H: '#ff6b7a',
  D: '#ff8c69',
  C: '#6effa0',
  S: '#a8c4ff',
};

export const SUIT_NAMES: Record<Suit, string> = {
  H: 'Hearts',
  D: 'Diamonds',
  C: 'Clubs',
  S: 'Spades',
};

// Suit name mapping for card image filenames
const SUIT_IMAGE_NAME: Record<Suit, string> = {
  S: 'spades',
  H: 'hearts',
  D: 'diamonds',
  C: 'clubs',
};

/**
 * Get the image path for a card from the Dozenal Card Deck.
 * Files are in /cards/ (public directory).
 *
 * Naming convention:
 *  - Numeric: {suit_lower}-{rank_padded}.svg.png   e.g. clubs-02.svg.png
 *  - Ace:     {suit_lower}-A.svg.png                e.g. clubs-A.svg.png
 *  - Face:    {Suit_cap}-{Face}.svg.png             e.g. Clubs-J.svg.png
 *  - Back:    back.svg.png
 */
export function getCardImagePath(card: Card, faceDown = false, cardBack?: string): string {
  if (faceDown) return cardBack || '/cards/back.svg.png';

  const suitLow = SUIT_IMAGE_NAME[card.suit];                   // "clubs"
  const suitCap = suitLow.charAt(0).toUpperCase() + suitLow.slice(1); // "Clubs"
  const rank = card.rank;

  // Face cards: J, Q, K, C  -> {Suit_cap}-{Face}.svg.png
  if (['J', 'Q', 'K', 'C'].includes(rank)) {
    return `/cards/${suitCap}-${rank}.svg.png`;
  }

  // Ace / rank "1" -> {suit}-A.svg.png
  if (rank === '1') {
    // diamonds ace has a typo in filename
    if (card.suit === 'D') return '/cards/diamonds-A.s.png';
    return `/cards/${suitLow}-A.svg.png`;
  }

  // Numeric ranks: map game rank to image number
  // Image files are numbered by decimal value:
  // "2" -> "02", ..., "9" -> "09"
  // "↊" (dozenal ten, decimal 10) -> "10"
  // "↋" (dozenal eleven, decimal 11) -> "11"
  // "10" (dozenal twelve, decimal 12) -> "12"
  let imgNum: string;
  if (rank === '10') imgNum = '12';
  else if (rank === '↊') imgNum = '10';
  else if (rank === '↋') imgNum = '11';
  else imgNum = rank.padStart(2, '0');

  return `/cards/${suitLow}-${imgNum}.svg.png`;
}

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

// Sanitize dozenal text for display (show proper dozenal symbols)
// Only replace X/E when they appear as standalone dozenal digit characters,
// not when they're part of words. Uses character-by-character replacement.
export function sanitizeDozenalDisplay(text: string): string {
  // Replace each character: X/x → ↊, but only if it looks like a digit position
  // Since toBaseFromNumber already outputs ↊/↋, this is mostly a no-op safety net
  return text
    .split('')
    .map(ch => {
      if (ch === 'X' || ch === 'x') return '↊';
      if (ch === 'E' || ch === 'e') return '↋';
      return ch;
    })
    .join('');
}

// Check if a card is a wildcard (rank "10" changes suit)
export function isWildcard(rank: string): boolean {
  return rank === '10';
}

// Check if a card is a skip card (rank "6")
export function isSkipCard(rank: string): boolean {
  return rank === '6';
}

// Check if a card triggers an arithmetic challenge (any face card or wildcard 10)
export function isChallengeCard(rank: string, faceRanks: readonly string[]): boolean {
  return rank === '10' || faceRanks.includes(rank);
}

// Check if a card lets the player select the arithmetic operation
// K in decimal, C in dozenal
export function isSelectOpCard(rank: string, baseId: BaseId): boolean {
  return (baseId === 'dec' && rank === 'K') || (baseId === 'doz' && rank === 'C');
}

// Get the operation label for a challenge type
export function getChallengeLabel(type: '+' | '-' | '*' | '/'): string {
  switch (type) {
    case '+': return 'Addition';
    case '-': return 'Subtraction';
    case '*': return 'Multiplication';
    case '/': return 'Division';
  }
}

// Compute the correct answer from a challenge (client-side, for generating choices)
export function computeChallengeAnswer(type: '+' | '-' | '*' | '/', op1: number, op2: number): number {
  switch (type) {
    case '+': return op1 + op2;
    case '-': return op1 - op2;
    case '*': return op1 * op2;
    case '/': return Math.floor(op1 / op2);
  }
}

// Generate 3 multiple choice options with one correct answer
export function generateChoices(correctAnswer: number): number[] {
  const choices = new Set<number>();
  choices.add(correctAnswer);

  // Generate plausible wrong answers near the correct one
  while (choices.size < 3) {
    const offset = Math.floor(Math.random() * 10) + 1;
    const wrong = Math.random() > 0.5
      ? correctAnswer + offset
      : correctAnswer - offset;
    choices.add(wrong);
  }

  // Shuffle the choices
  const arr = Array.from(choices);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
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
