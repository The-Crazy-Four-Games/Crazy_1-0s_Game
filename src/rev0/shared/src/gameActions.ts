/**
 * @file gameActions.ts
 * @module shared/gameActions
 * @author The Crazy 4 Team
 * @date 2026
 * @purpose Defines the GameAction discriminated union (PLAY, DRAW, PASS,
 *          ANSWER_CHALLENGE, CHEAT_WIN), plus helpers for timestamping
 *          actions and asserting turn ownership before dispatch.
 */
import type { Card, PlayerID } from "./rules.js";
import type { Suit } from "./systems.js";

export type GameAction =
  | { type: "PLAY"; playerId: PlayerID; card: Card; chosenSuit?: Suit; chosenOperation?: '+' | '-' | '*' | '/'; at?: number }
  | { type: "DRAW"; playerId: PlayerID; at?: number }
  | { type: "PASS"; playerId: PlayerID; at?: number }
  | { type: "ANSWER_CHALLENGE"; playerId: PlayerID; answer: number; at?: number }
  | { type: "CHEAT_WIN"; playerId: PlayerID; at?: number };

export function withTimestamp<T extends GameAction>(a: T): T {
  return a.at ? a : ({ ...a, at: Date.now() } as T);
}

export function assertTurn(currentTurn: PlayerID, a: GameAction): void {
  if (a.playerId !== currentTurn) throw new Error("NotYourTurn");
  if (a.type === "PLAY" && !a.card) throw new Error("MissingCard");
}
