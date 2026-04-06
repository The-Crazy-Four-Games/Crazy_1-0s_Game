import { describe, expect, it } from "vitest";

import type { Card, RoundState } from "./rules.ts";
import {
  applyDraw,
  applyPlay,
  getPlayableCards,
  initRound,
  isPlayable,
  passTurn,
} from "./rules.ts";
import { DECIMAL_SYSTEM, DOZENAL_SYSTEM } from "./systems.ts";

const c = (suit: Card["suit"], rank: string): Card => ({ suit, rank });

describe("rules", () => {
  it("deals seven cards by default", () => {
    const round = initRound(DECIMAL_SYSTEM, ["P1", "P2"]);

    expect(round.hands.P1).toHaveLength(7);
    expect(round.hands.P2).toHaveLength(7);
    expect(round.topCard).toBeTruthy();
    expect(round.turn).toBe("P1");
  });

  it("recognizes wildcard and sum-rule moves", () => {
    const state: RoundState = {
      deck: [],
      discard: [],
      topCard: c("S", "4"),
      hands: {
        P1: [c("H", "10"), c("D", "6"), c("C", "2")],
        P2: [],
      },
      players: ["P1", "P2"],
      turn: "P1",
      drawCountThisTurn: 0,
    };

    expect(isPlayable(DECIMAL_SYSTEM, state, "P1", c("H", "10"))).toBe(true);
    expect(isPlayable(DECIMAL_SYSTEM, state, "P1", c("D", "6"))).toBe(true);
    expect(getPlayableCards(DECIMAL_SYSTEM, state, "P1")).toEqual([c("H", "10"), c("D", "6")]);
  });

  it("reshuffles the discard pile when the deck is empty", () => {
    const state: RoundState = {
      deck: [],
      discard: [c("H", "2"), c("D", "3")],
      topCard: c("S", "9"),
      hands: {
        P1: [],
        P2: [],
      },
      players: ["P1", "P2"],
      turn: "P1",
      drawCountThisTurn: 0,
    };

    const next = applyDraw(DECIMAL_SYSTEM, state, "P1");

    expect(next.topCard).toEqual(c("S", "9"));
    expect(next.hands.P1).toHaveLength(1);
    expect(next.deck).toHaveLength(1);
    expect(next.discard).toHaveLength(0);
  });

  it("wildcard 10 sets forced suit without triggering a challenge, and skip cards keep turn", () => {
    const wildcardState: RoundState = {
      deck: [],
      discard: [],
      topCard: c("S", "3"),
      hands: {
        P1: [c("H", "10")],
        P2: [c("D", "5")],
      },
      players: ["P1", "P2"],
      turn: "P1",
      drawCountThisTurn: 0,
    };

    const afterWildcard = applyPlay(DOZENAL_SYSTEM, wildcardState, "P1", c("H", "10"), "D");
    expect(afterWildcard.forcedSuit).toBe("D");
    // Wildcard 10 does NOT trigger arithmetic challenges — only face cards (J/Q/K/C) do
    expect(afterWildcard.activeChallenge).toBeUndefined();
    expect(afterWildcard.turn).toBe("P2");

    const skipState: RoundState = {
      ...wildcardState,
      hands: {
        P1: [c("H", "5")],
        P2: [c("D", "8")],
      },
      topCard: c("C", "8"),
    };

    const afterSkip = applyPlay(DECIMAL_SYSTEM, skipState, "P1", c("H", "5"));
    expect(afterSkip.turn).toBe("P1");
    expect(afterSkip.freePlayFor).toBe("P1");
  });

  it("passes turn and clears temporary state", () => {
    const state: RoundState = {
      deck: [],
      discard: [],
      topCard: c("S", "7"),
      forcedSuit: "H",
      freePlayFor: "P1",
      hands: {
        P1: [],
        P2: [],
      },
      players: ["P1", "P2"],
      turn: "P1",
      drawCountThisTurn: 2,
    };

    const next = passTurn(state);

    expect(next.turn).toBe("P2");
    expect(next.forcedSuit).toBeUndefined();
    expect(next.freePlayFor).toBeUndefined();
    expect(next.drawCountThisTurn).toBe(0);
  });
});
