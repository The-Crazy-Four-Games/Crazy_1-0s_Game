// shared/src/scoring.ts
import type { Card } from "./rules.js";
import type { NumeralSystem } from "./systems.js";
import { isFace, numericValueDec, formatInSystem } from "./rules.js";

export function handPointsDec(hand: Card[], sys: NumeralSystem): number {
  let total = 0;
  for (const c of hand) {
    total += isFace(c.rank, sys) ? sys.facePointsDec : numericValueDec(c.rank, sys);
  }
  return total;
}

export function roundGainDec(loserHand: Card[], sys: NumeralSystem): number {
  return handPointsDec(loserHand, sys);
}

export function roundGain(loserHand: Card[], sys: NumeralSystem): { gainDec: number; gainText: string } {
  const gainDec = roundGainDec(loserHand, sys);
  return { gainDec, gainText: formatInSystem(gainDec, sys) };
}
