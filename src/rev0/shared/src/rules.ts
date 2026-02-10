// shared/src/rules.ts
import { fromBaseToNumber, toBaseFromNumber } from "./baseConversion.js";
import type { NumeralSystem, Suit } from "./systems.js";
import { getSystem } from "./systems.js";

export type PlayerID = string;
export type Rank = string;
export type Card = Readonly<{ suit: Suit; rank: Rank }>;

export type PendingChallenge = Readonly<{
  suit: Suit;
  op: "+" | "-" | "*" | "/";
  aDec: number;
  bDec: number;
  answerDec: number;
  resumeTurn: PlayerID;
}>;

export type RoundState = Readonly<{
  deck: Card[];
  discard: Card[];
  topCard: Card;
  forcedSuit?: Suit;
  hands: Record<PlayerID, Card[]>;
  players: [PlayerID, PlayerID];
  turn: PlayerID;
  drawCountThisTurn: number;
  freePlayFor?: PlayerID;
  pendingChallenge?: PendingChallenge;
}>;

// baseConversion usage
export function parseInSystem(text: string, sys: NumeralSystem): number {
  return fromBaseToNumber(text, sys.spec);
}
export function formatInSystem(nDec: number, sys: NumeralSystem): string {
  return toBaseFromNumber(nDec, sys.spec);
}

export function isFace(rank: Rank, sys: NumeralSystem): boolean {
  return sys.faceRanks.includes(rank);
}

export function numericValueDec(rank: Rank, sys: NumeralSystem): number {
  if (isFace(rank, sys)) throw new Error("FaceCardNoNumericValue");
  return parseInSystem(rank, sys);
}

export function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function createDeck(sys: NumeralSystem): Card[] {
  const suits: Suit[] = ["S", "H", "D", "C"];
  const deck: Card[] = [];
  for (const s of suits) {
    for (const n of sys.deckNumericSymbols) deck.push({ suit: s, rank: n });
    for (const f of sys.faceRanks) deck.push({ suit: s, rank: f });
  }
  return deck;
}

export function initRound(
  sys: NumeralSystem,
  players: [PlayerID, PlayerID],
  initialHandSize = 5,
  rngDeck?: Card[]
): RoundState {
  if (players[0] === players[1]) throw new Error("InvalidPlayers");
  const d = rngDeck ? [...rngDeck] : shuffle(createDeck(sys));
  if (d.length < 1 + initialHandSize * 2) throw new Error("DeckTooSmall");

  const hands: Record<PlayerID, Card[]> = { [players[0]]: [], [players[1]]: [] };
  for (let i = 0; i < initialHandSize; i++) {
    hands[players[0]].push(d.pop()!);
    hands[players[1]].push(d.pop()!);
  }
  const topCard = d.pop()!;

  return {
    deck: d,
    discard: [],
    topCard,
    forcedSuit: undefined,
    freePlayFor: undefined,
    hands,
    players,
    turn: players[0],
    drawCountThisTurn: 0,
  };
}

function effectiveSuit(state: RoundState): Suit {
  return state.forcedSuit ?? state.topCard.suit;
}
function nextPlayer(state: RoundState): PlayerID {
  const [p1, p2] = state.players;
  return state.turn === p1 ? p2 : p1;
}
function reshuffleIfNeeded(state: RoundState): RoundState {
  if (state.deck.length > 0) return state;
  if (state.discard.length === 0) return state;
  return { ...state, deck: shuffle([...state.discard]), discard: [] };
}

export function isPlayable(sys: NumeralSystem, state: RoundState, playerId: PlayerID, card: Card): boolean {
  if (state.turn !== playerId) return false;

  // ✅ freePlay：无视 topCard/forcedSuit，可出任意手牌
  if (state.freePlayFor === playerId) return true;

  const hand = state.hands[playerId] ?? [];
  const hasCard = hand.some(c => c.suit === card.suit && c.rank === card.rank);
  if (!hasCard) return false;

  // wildcards always playable
  if (card.rank === sys.wildcardTenSymbol) return true;
  if (card.rank === sys.wildcardSkipSymbol) return true;

  if (card.suit === effectiveSuit(state)) return true; // match suit
  if (card.rank === state.topCard.rank) return true; // match rank

  // sum rule: numeric + numeric = target
  if (!isFace(card.rank, sys) && !isFace(state.topCard.rank, sys)) {
    const targetSumDec = parseInSystem(sys.targetSumText, sys);
    const sum = numericValueDec(card.rank, sys) + numericValueDec(state.topCard.rank, sys);
    if (sum === targetSumDec) return true;
  }

  return false;
}

export function getPlayableCards(sys: NumeralSystem, state: RoundState, playerId: PlayerID): Card[] {
  return (state.hands[playerId] ?? []).filter(c => isPlayable(sys, state, playerId, c));
}

export function canDraw(state: RoundState): boolean {
  return state.drawCountThisTurn < 3;
}

export function applyDraw(sys: NumeralSystem, state: RoundState, playerId: PlayerID): RoundState {
  if (state.turn !== playerId) throw new Error("NotYourTurn");
  if (!canDraw(state)) throw new Error("DrawLimitReached");

  let s = reshuffleIfNeeded(state);
  if (s.deck.length === 0) throw new Error("EmptyDeck");

  const drawn = s.deck.pop()!;
  s = {
    ...s,
    hands: { ...s.hands, [playerId]: [...s.hands[playerId], drawn] },
    drawCountThisTurn: s.drawCountThisTurn + 1,
  };

  // ✅ 抽满3次仍无可出牌：自动切到对面 + 对面 freePlay 1 次
  if (s.drawCountThisTurn >= 3 && getPlayableCards(sys, s, playerId).length === 0) {
    const nxt = nextPlayer(s);
    s = {
      ...s,
      turn: nxt,
      drawCountThisTurn: 0,
      freePlayFor: nxt,
      forcedSuit: undefined, // clear forced suit
    };
  }
  return s;
}

export function applyPlay(
  sys: NumeralSystem,
  state: RoundState,
  playerId: PlayerID,
  card: Card,
  chosenSuit?: Suit
): RoundState {
  if (!isPlayable(sys, state, playerId, card)) throw new Error("IllegalMove");

  const hand = state.hands[playerId];
  const idx = hand.findIndex(c => c.suit === card.suit && c.rank === card.rank);
  if (idx < 0) throw new Error("CardNotInHand");

  const newHand = hand.slice(0, idx).concat(hand.slice(idx + 1));
  const newDiscard = [...state.discard, state.topCard];

  let forcedSuit: Suit | undefined = undefined;
  if (card.rank === sys.wildcardTenSymbol) {
    if (!chosenSuit) throw new Error("NeedChosenSuitForWildcardTen");
    forcedSuit = chosenSuit;
  }

  // ✅ 默认：本次出牌后清除 freePlay（因为已经“用掉”了）
  let nextFreePlayFor: PlayerID | undefined = undefined;

  // ✅ skip：同一玩家继续，并获得 1 次 freePlay（下一张随便出）
  if (card.rank === sys.wildcardSkipSymbol) {
    nextFreePlayFor = playerId;
  }

  const after: RoundState = {
    ...state,
    discard: newDiscard,
    topCard: card,
    forcedSuit,
    freePlayFor: nextFreePlayFor,
    hands: { ...state.hands, [playerId]: newHand },
    drawCountThisTurn: 0,
  };

  // skip wildcard -> same player continues
  if (card.rank === sys.wildcardSkipSymbol) return after;

  return {
    ...after,
    turn: nextPlayer(after),
    drawCountThisTurn: 0,
  };
}

export function passTurn(state: RoundState): RoundState {
  const nxt = nextPlayer(state);
  return {
    ...state,
    turn: nxt,
    drawCountThisTurn: 0,
    freePlayFor: undefined,
    forcedSuit: undefined,
  };
}

export function isRoundOver(state: RoundState): boolean {
  const [p1, p2] = state.players;
  return state.hands[p1].length === 0 || state.hands[p2].length === 0;
}

export function roundWinner(state: RoundState): PlayerID | null {
  const [p1, p2] = state.players;
  if (state.hands[p1].length === 0) return p1;
  if (state.hands[p2].length === 0) return p2;
  return null;
}

// Convenience for engine: build system from baseId
export function systemFromBaseId(baseId: import("./systems.js").BaseId): NumeralSystem {
  return getSystem(baseId);
}
