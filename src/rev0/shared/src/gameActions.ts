// shared/src/gameActions.ts
import type { Card, PlayerID } from "./rules.js";
import type { Suit } from "./systems.js";

export type GameAction =
  | { type: "PLAY"; playerId: PlayerID; card: Card; chosenSuit?: Suit; at?: number }
  | { type: "DRAW"; playerId: PlayerID; at?: number }
  | { type: "PASS"; playerId: PlayerID; at?: number }
  | { type: "ANSWER_CHALLENGE"; playerId: PlayerID; answer: number; at?: number };

export function withTimestamp<T extends GameAction>(a: T): T {
  return a.at ? a : ({ ...a, at: Date.now() } as T);
}

export function assertTurn(currentTurn: PlayerID, a: GameAction): void {
  if (a.playerId !== currentTurn) throw new Error("NotYourTurn");
  if (a.type === "PLAY" && !a.card) throw new Error("MissingCard");
}
