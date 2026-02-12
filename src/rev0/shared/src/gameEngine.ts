// shared/src/gameEngine.ts
import type { PlayerID, RoundState, Card } from "./rules.js";
import { initRound, applyDraw, applyPlay, passTurn, isRoundOver, roundWinner, parseInSystem, formatInSystem, systemFromBaseId } from "./rules.js";
import type { BaseId, NumeralSystem } from "./systems.js";
import { roundGainDec } from "./scoring.js";
import { type GameAction, withTimestamp, assertTurn } from "./gameActions.js";

export type GameStatus = "ONGOING" | "GAME_OVER";

export type GameState = Readonly<{
  gameId: string;
  sys: NumeralSystem;
  round: RoundState;
  scoresDec: Record<PlayerID, number>;
  status: GameStatus;
  actionLog: readonly GameAction[];
  lastSnapshot?: GameState;
  activeChallenge?: MathChallenge;
}>;

export type MathChallenge = Readonly<{
  playerId: PlayerID;
  type: '+' | '-' | '*' | '/';
  op1: number;
  op2: number;
  answer: number;
  reward: number;
  shouldPassTurn: boolean;
}>;

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

  switch (a.type) {
    case "DRAW":
      round = applyDraw(game.sys, round, a.playerId);
      break;
    case "PLAY":
      round = applyPlay(game.sys, round, a.playerId, a.card, a.chosenSuit);
      break;
    case "PASS":
      round = passTurn(round);
      break;
    case "ANSWER_CHALLENGE":
          if (!round.activeChallenge) throw new Error("NoActiveChallenge");
          if (round.activeChallenge.playerId !== a.playerId) throw new Error("NotYourChallenge");

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
    const over = Object.values(scoresDec).some(s => s >= targetDec);

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

  const safeChallenge = game.round.activeChallenge
    ? { ...game.round.activeChallenge, answer: undefined }
    : undefined;

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
  };
}
