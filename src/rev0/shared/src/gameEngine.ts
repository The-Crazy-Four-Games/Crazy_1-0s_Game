// shared/src/gameEngine.ts
import type { PlayerID, RoundState, Card, MathChallenge } from "./rules.js";
import { initRound, applyDraw, applyPlay, passTurn, advanceTurn, isRoundOver, roundWinner, parseInSystem, formatInSystem, systemFromBaseId, getPlayableCards, canDraw } from "./rules.js";
import type { BaseId, NumeralSystem } from "./systems.js";
import { roundGainDec } from "./scoring.js";
import { type GameAction, withTimestamp, assertTurn } from "./gameActions.js";

export type GameStatus = "ONGOING" | "GAME_OVER";

export type RoundResult = {
  winner: string;
  loser: string;
  pointsGained: number;
  scoresDec: Record<string, number>;
};

export type GameState = Readonly<{
  gameId: string;
  sys: NumeralSystem;
  round: RoundState;
  scoresDec: Record<PlayerID, number>;
  status: GameStatus;
  actionLog: readonly GameAction[];
  lastSnapshot?: GameState;
  activeChallenge?: MathChallenge;
  lastRoundResult?: RoundResult;
}>;

export type { MathChallenge };

export type CreateGameOptions = Readonly<{
  players: [PlayerID, PlayerID];
  baseId: BaseId;            // more bases in future
  initialHandSize?: number;
  rngDeck?: Card[];
  gameId?: string;
}>;

function newGameId(): string {
  return `g_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;
}

export function createGame(opts: CreateGameOptions): GameState {
  const sys = systemFromBaseId(opts.baseId);
  const round = initRound(sys, opts.players, opts.initialHandSize ?? 7, opts.rngDeck);

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

  // Clear lastRoundResult on any new action so the popup dismisses
  if (game.lastRoundResult) {
    game = { ...game, lastRoundResult: undefined };
  }

  const a = withTimestamp(action);

  // Skip turn check for ANSWER_CHALLENGE and CHEAT_WIN
  if (a.type !== 'ANSWER_CHALLENGE' && a.type !== 'CHEAT_WIN') {
    assertTurn(game.round.turn, a);
  }

  const snapshot = game;
  let round = game.round;

  switch (a.type) {
    case "DRAW":
      round = applyDraw(game.sys, round, a.playerId);
      break;
    case "PLAY":
      round = applyPlay(game.sys, round, a.playerId, a.card, a.chosenSuit, a.chosenOperation);
      break;
    case "PASS":
      round = passTurn(round);
      break;
    case "ANSWER_CHALLENGE":
      if (!round.activeChallenge) throw new Error("NoActiveChallenge");

      const isCorrect = round.activeChallenge.answer === a.answer;
      // If correct, add points immediately to scoresDec
      if (isCorrect) {
        const reward = round.activeChallenge.reward;
        game = {
          ...game,
          scoresDec: {
            ...game.scoresDec,
            [a.playerId]: (game.scoresDec[a.playerId] ?? 0) + reward
          }
        };
      }

      // Clear challenge
      const shouldPass = round.activeChallenge.shouldPassTurn;
      round = { ...round, activeChallenge: undefined };

      if (shouldPass) {
        round = advanceTurn(round);
      }
      break;
    case "CHEAT_WIN":
      // Empty this player's hand → triggers round-over + scoring
      round = { ...round, hands: { ...round.hands, [a.playerId]: [] } };
      break;
  }

  let next: GameState = {
    ...game,
    round,
    actionLog: [...game.actionLog, a],
    lastSnapshot: snapshot,
  };

  // Auto-pass: if current player has no playable cards and can't draw, pass their turn
  if (!isRoundOver(next.round) && !next.round.activeChallenge) {
    const currentPlayer = next.round.turn;
    const playable = getPlayableCards(next.sys, next.round, currentPlayer);
    const deckAvailable = next.round.deck.length > 0 || next.round.discard.length > 0;
    const canDrawMore = canDraw(next.round) && deckAvailable;
    if (playable.length === 0 && !canDrawMore) {
      next = { ...next, round: passTurn(next.round) };
    }
  }

  // round end -> scoring + new round OR game over
  if (isRoundOver(next.round)) {
    const winner = roundWinner(next.round)!;
    const [p1, p2] = next.round.players;
    const loser = winner === p1 ? p2 : p1;

    const gainedDec = roundGainDec(next.round.hands[loser], next.sys);
    const scoresDec = { ...next.scoresDec, [winner]: (next.scoresDec[winner] ?? 0) + gainedDec };

    const roundResult: RoundResult = {
      winner,
      loser,
      pointsGained: gainedDec,
      scoresDec,
    };

    const targetDec = parseInSystem(next.sys.targetScoreText, next.sys);
    const over = Object.values(scoresDec).some(s => s >= targetDec);

    if (over) {
      next = { ...next, scoresDec, status: "GAME_OVER", lastRoundResult: roundResult };
    } else {
      const newRound = initRound(next.sys, next.round.players, 7);
      next = { ...next, scoresDec, round: newRound, lastRoundResult: roundResult };
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

  const safeChallenge = game.round.activeChallenge
    ? { ...game.round.activeChallenge, answer: undefined }
    : undefined;

  // Format lastRoundResult with base-aware text
  let lastRoundResultFormatted: any = undefined;
  if (game.lastRoundResult) {
    const r = game.lastRoundResult;
    const scoresResultText: Record<string, string> = {};
    for (const [pid, s] of Object.entries(r.scoresDec)) {
      scoresResultText[pid] = formatInSystem(s, game.sys);
    }
    lastRoundResultFormatted = {
      ...r,
      pointsGainedText: formatInSystem(r.pointsGained, game.sys),
      scoresText: scoresResultText,
    };
  }

  return {
    gameId: game.gameId,
    baseId: game.sys.id,
    status: game.status,
    turn: game.round.turn,
    topCard: game.round.topCard,
    forcedSuit: game.round.forcedSuit,
    activeChallenge: safeChallenge,
    handsCount: Object.fromEntries(Object.entries(game.round.hands).map(([pid, h]) => [pid, h.length])),
    scoresDec: game.scoresDec,
    scoresText,
    targetScoreDec: targetDec,
    targetScoreText: formatInSystem(targetDec, game.sys),
    faceRanks: game.sys.faceRanks,
    deckNumericSymbols: game.sys.deckNumericSymbols,
    lastRoundResult: lastRoundResultFormatted,
  };
}
