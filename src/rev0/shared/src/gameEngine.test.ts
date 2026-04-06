import { describe, expect, it } from "vitest";

import type { GameState } from "./gameEngine.ts";
import { applyAction, createGame, getPublicState } from "./gameEngine.ts";
import type { Card, RoundState } from "./rules.ts";
import { roundGainDec } from "./scoring.ts";
import { DECIMAL_SYSTEM, DOZENAL_SYSTEM } from "./systems.ts";

const c = (suit: Card["suit"], rank: string): Card => ({ suit, rank });

function makeRound(overrides: Partial<RoundState> = {}): RoundState {
  return {
    deck: [],
    discard: [],
    topCard: c("S", "7"),
    hands: {
      P1: [c("H", "7")],
      P2: [c("D", "3"), c("C", "4")],
    },
    players: ["P1", "P2"],
    turn: "P1",
    drawCountThisTurn: 0,
    ...overrides,
  };
}

describe("gameEngine", () => {
  it("creates games with seven-card hands and the new target score", () => {
    const game = createGame({
      baseId: "dec",
      players: ["P1", "P2"],
    });

    expect(game.round.hands.P1).toHaveLength(7);
    expect(game.round.hands.P2).toHaveLength(7);

    const publicState = getPublicState(game);
    expect(publicState.targetScoreText).toBe("100");
    expect(publicState.targetScoreDec).toBe(100);
  });

  it("settles a round, adds points, and starts the next round", () => {
    const loserHand = [c("D", "3"), c("C", "4")];
    const game: GameState = {
      gameId: "g_test",
      sys: DECIMAL_SYSTEM,
      round: makeRound({ hands: { P1: [c("H", "7")], P2: loserHand } }),
      scoresDec: { P1: 0, P2: 0 },
      status: "ONGOING",
      actionLog: [],
    };

    const next = applyAction(game, {
      type: "PLAY",
      playerId: "P1",
      card: c("H", "7"),
    });

    expect(next.scoresDec.P1).toBe(roundGainDec(loserHand, DECIMAL_SYSTEM));
    expect(next.status).toBe("ONGOING");
    expect(next.round.hands.P1).toHaveLength(7);
    expect(next.round.hands.P2).toHaveLength(7);
    expect(next.actionLog).toHaveLength(1);
  });

  it("resolves arithmetic challenges and hides answers in public state", () => {
    const game: GameState = {
      gameId: "g_challenge",
      sys: DOZENAL_SYSTEM,
      round: makeRound({
        turn: "P1",
        deck: [c("H", "1"), c("D", "2"), c("C", "3")],
        activeChallenge: {
          playerId: "both",
          type: "/",
          op1: 24,
          op2: 2,
          answer: 12,
          reward: 10,
          shouldPassTurn: true,
        },
      }),
      scoresDec: { P1: 10, P2: 11 },
      status: "ONGOING",
      actionLog: [],
    };

    const hiddenChallenge = getPublicState(game).activeChallenge;
    expect(hiddenChallenge).toBeTruthy();
    expect(hiddenChallenge?.answer).toBeUndefined();

    const next = applyAction(game, {
      type: "ANSWER_CHALLENGE",
      playerId: "P1",
      answer: 12,
    });

    expect(next.scoresDec.P1).toBe(20);
    expect(next.round.turn).toBe("P2");
    expect(next.round.activeChallenge).toBeUndefined();

    const publicState = getPublicState(next);
    expect(publicState.scoresText.P1).toBe("18");
    expect(publicState.scoresText.P2).toBe("↋");
    expect(publicState.targetScoreText).toBe("100");
    expect(publicState.targetScoreDec).toBe(144);
    expect(publicState.activeChallenge).toBeUndefined();
  });
});
