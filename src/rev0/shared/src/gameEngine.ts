// shared/src/gameEngine.ts
import type { PlayerID, RoundState, Card } from "./rules.js";
import {
  initRound,
  applyDraw,
  applyPlay,
  passTurn,
  isRoundOver,
  roundWinner,
  parseInSystem,
  formatInSystem,
  systemFromBaseId,
} from "./rules.js";
import type { BaseId, NumeralSystem, Suit } from "./systems.js";
import { roundGainDec } from "./scoring.js";
import { type GameAction, withTimestamp, assertTurn } from "./gameActions.js";

// Challenge system: always dozenal (base-12) for the math question, regardless of the game base.
const CHALLENGE_SYS = systemFromBaseId("doz");

function opBySuit(s: Suit): "+" | "-" | "*" | "/" {
  switch (s) {
    case "S":
      return "+"; // Spades
    case "C":
      return "-"; // Clubs
    case "H":
      return "*"; // Hearts
    case "D":
      return "/"; // Diamonds
  }
}

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function genChallenge(suit: Suit) {
  const op = opBySuit(suit);
  let aDec = 0,
    bDec = 0,
    answerDec = 0;

  switch (op) {
    case "+":
      aDec = randInt(1, 20);
      bDec = randInt(1, 20);
      answerDec = aDec + bDec;
      break;
    case "-":
      aDec = randInt(1, 20);
      bDec = randInt(1, aDec);
      answerDec = aDec - bDec;
      break;
    case "*":
      aDec = randInt(1, 10);
      bDec = randInt(1, 10);
      answerDec = aDec * bDec;
      break;
    case "/": {
      // Ensure exact division
      const q = randInt(1, 10);
      const d = randInt(1, 10);
      aDec = q * d;
      bDec = d;
      answerDec = q;
      break;
    }
  }

  return { suit, op, aDec, bDec, answerDec };
}

export type GameStatus = "ONGOING" | "GAME_OVER";

export type GameState = Readonly<{
  gameId: string;
  sys: NumeralSystem;
  round: RoundState;
  scoresDec: Record<PlayerID, number>;
  status: GameStatus;
  actionLog: readonly GameAction[];
  lastSnapshot?: GameState;
}>;

export type CreateGameOptions = Readonly<{
  players: [PlayerID, PlayerID];
  baseId: BaseId; // more bases in future
  initialHandSize?: number;
  rngDeck?: Card[];
  gameId?: string;
}>;

function newGameId(): string {
  return `g_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;
}

export function createGame(opts: CreateGameOptions): GameState {
  const sys = systemFromBaseId(opts.baseId);
  const round = initRound(sys, opts.players, opts.initialHandSize ?? 5, opts.rngDeck);

  return {
    gameId: opts.gameId ?? newGameId(),
    sys,
    round,
    scoresDec: { [opts.players[0]]: 0, [opts.players[1]]: 0 },
    status: "ONGOING",
    actionLog: [],
    lastSnapshot: undefined,
  };
}

export function applyAction(game: GameState, action: GameAction): GameState {
  if (game.status === "GAME_OVER") throw new Error("GameOver");

  const a = withTimestamp(action);
  assertTurn(game.round.turn, a);

  const snapshot = game;
  let round = game.round;

  if (round.pendingChallenge && a.type !== "ANSWER_CHALLENGE") {
    throw new Error("MustAnswerChallengeFirst");
  }

  switch (a.type) {
    case "DRAW":
      round = applyDraw(game.sys, round, a.playerId);
      break;

    case "PLAY":
      if (a.card.rank === game.sys.wildcardTenSymbol) {
        if (!a.chosenSuit) throw new Error("NeedChosenSuitForWildcardTen");

        const applied = applyPlay(game.sys, round, a.playerId, a.card, a.chosenSuit);

        const resumeTurn = applied.turn;

        round = {
          ...applied,
          turn: a.playerId,
          pendingChallenge: {
            ...genChallenge(a.chosenSuit),
            resumeTurn,
          },
        };
        break;
      }

      round = applyPlay(game.sys, round, a.playerId, a.card, a.chosenSuit);
      break;

    case "PASS":
      round = passTurn(round);
      break;

    case "ANSWER_CHALLENGE": {
      const ch = round.pendingChallenge;
      if (!ch) throw new Error("NoPendingChallenge");

      const userDec = parseInSystem(a.answer, CHALLENGE_SYS);
      if (userDec !== ch.answerDec) throw new Error("WrongChallengeAnswer");

      round = {
        ...round,
        pendingChallenge: undefined,
        turn: ch.resumeTurn,
      };
      break;
    }
  }

  let next: GameState = {
    ...game,
    round,
    actionLog: [...game.actionLog, a],
    lastSnapshot: snapshot,
  };

  // round end -> scoring + new round OR game over
  if (isRoundOver(next.round)) {
    const winner = roundWinner(next.round)!;
    const [p1, p2] = next.round.players;
    const loser = winner === p1 ? p2 : p1;

    const gainedDec = roundGainDec(next.round.hands[loser], next.sys);
    const scoresDec = { ...next.scoresDec, [winner]: (next.scoresDec[winner] ?? 0) + gainedDec };

    const targetDec = parseInSystem(next.sys.targetScoreText, next.sys);
    const over = Object.values(scoresDec).some((s) => s >= targetDec);

    if (over) {
      next = { ...next, scoresDec, status: "GAME_OVER" };
    } else {
      const newRound = initRound(next.sys, next.round.players, 5);
      next = { ...next, scoresDec, round: newRound };
    }
  }

  return next;
}

export function undo(game: GameState): GameState {
  return game.lastSnapshot ?? game;
}

export function getPublicState(game: GameState) {
  const scoresText: Record<PlayerID, string> = {} as any;
  for (const [pid, s] of Object.entries(game.scoresDec)) {
    scoresText[pid as PlayerID] = formatInSystem(s, game.sys);
  }
  const targetDec = parseInSystem(game.sys.targetScoreText, game.sys);

  const pendingChallenge = game.round.pendingChallenge
    ? {
        suit: game.round.pendingChallenge.suit,
        op: game.round.pendingChallenge.op,
        aText: formatInSystem(game.round.pendingChallenge.aDec, CHALLENGE_SYS),
        bText: formatInSystem(game.round.pendingChallenge.bDec, CHALLENGE_SYS),
      }
    : undefined;

  return {
    gameId: game.gameId,
    baseId: game.sys.id,
    status: game.status,
    turn: game.round.turn,
    topCard: game.round.topCard,
    forcedSuit: game.round.forcedSuit,
    pendingChallenge,
    handsCount: Object.fromEntries(Object.entries(game.round.hands).map(([pid, h]) => [pid, h.length])),
    scoresDec: game.scoresDec,
    scoresText,
    targetScoreDec: targetDec,
    targetScoreText: formatInSystem(targetDec, game.sys),
    faceRanks: game.sys.faceRanks,
    deckNumericSymbols: game.sys.deckNumericSymbols,
  };
}
