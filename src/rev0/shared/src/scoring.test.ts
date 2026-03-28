import { describe, expect, it } from "vitest";

import type { Card } from "./rules.ts";
import { handPointsDec, roundGain, roundGainDec } from "./scoring.ts";
import { DOZENAL_SYSTEM } from "./systems.ts";

const c = (suit: Card["suit"], rank: string): Card => ({ suit, rank });

describe("scoring", () => {
  it("scores numeric and face cards in decimal and formatted dozenal", () => {
    const hand = [c("S", "↊"), c("H", "↋"), c("D", "C")];

    expect(handPointsDec(hand, DOZENAL_SYSTEM)).toBe(33);
    expect(roundGainDec(hand, DOZENAL_SYSTEM)).toBe(33);
    expect(roundGain(hand, DOZENAL_SYSTEM)).toEqual({ gainDec: 33, gainText: "29" });
  });
});
