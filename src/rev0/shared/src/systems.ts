// shared/src/systems.ts
import type { BaseSpec } from "./baseConversion.js";
import { DOZENAL_SPEC } from "./baseConversion.js";

export type BaseId = "dec" | "doz"; // can add more later

export type Suit = "S" | "H" | "D" | "C";

export type NumeralSystem = Readonly<{
  id: BaseId;
  name: string;
  spec: BaseSpec;

  // numeric cards that exist in the deck (symbols)
  deckNumericSymbols: readonly string[];

  // face cards that exist in the deck (symbols)
  faceRanks: readonly string[];

  // symbol -> decimal value for numeric ranks
  valueOf: Readonly<Record<string, number>>;

  // rule constants expressed in this base (parsed via baseConversion)
  targetSumText: string;     // e.g. "10"
  targetScoreText: string;   // e.g. "50"

  // wildcards
  wildcardTenSymbol: string; // dozenal: "↊", decimal: "X" (custom)
  wildcardSkipSymbol: string;// usually "6"

  // scoring
  facePointsDec: number;     // e.g. 10
}>;

export const DECIMAL_SPEC: BaseSpec = {
  base: 10,
  digits: ["0","1","2","3","4","5","6","7","8","9"] as const,
  allowPlusSign: true,
  stripLeadingZeros: true,
};


// decimal system
export const DECIMAL_SYSTEM: NumeralSystem = (() => {
  const deckNumericSymbols = ["1","2","3","4","5","6","7","8","9","10"] as const;
  const valueOf: Record<string, number> = {};
  for (let i = 0; i <= 9; i++) valueOf[String(i)] = i;
  valueOf["X"] = 10;

  return {
    id: "dec",
    name: "Decimal",
    spec: DECIMAL_SPEC,
    deckNumericSymbols,
    faceRanks: ["J","Q","K"] as const,
    valueOf,
    targetSumText: "10",     // base10 10
    targetScoreText: "50",   // base10 50
    wildcardTenSymbol: "10",
    wildcardSkipSymbol: "6",
    facePointsDec: 10,
  };
})();

// dozenal system
export const DOZENAL_SYSTEM: NumeralSystem = (() => {
  const digits = ["1","2","3","4","5","6","7","8","9","10","↊","↋"] as const;
  const valueOf: Record<string, number> = {};
  digits.forEach((d, i) => (valueOf[d] = i));

  return {
    id: "doz",
    name: "Dozenal",
    spec: DOZENAL_SPEC,
    deckNumericSymbols: digits,
    faceRanks: ["J","Q","K","C"] as const,
    valueOf,
    targetSumText: "10",     // base12 "10" => 12 dec
    targetScoreText: "50",   // base12 "50" => 60 dec
    wildcardTenSymbol: "10",
    wildcardSkipSymbol: "6",
    facePointsDec: 10,
  };
})();

export const SYSTEMS: Record<BaseId, NumeralSystem> = {
  dec: DECIMAL_SYSTEM,
  doz: DOZENAL_SYSTEM,
};

export function getSystem(id: BaseId): NumeralSystem {
  return SYSTEMS[id];
}
