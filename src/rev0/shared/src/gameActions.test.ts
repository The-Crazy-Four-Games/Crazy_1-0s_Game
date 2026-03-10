import { describe, expect, it } from "vitest";

import { assertTurn, withTimestamp } from "./gameActions.ts";

describe("gameActions", () => {
  it("adds a timestamp when one is missing", () => {
    const stamped = withTimestamp({ type: "DRAW", playerId: "P1", at: undefined });

    expect(stamped.at).toEqual(expect.any(Number));
  });

  it("rejects actions from the wrong player or malformed plays", () => {
    expect(() => assertTurn("P1", { type: "DRAW", playerId: "P2" })).toThrow("NotYourTurn");
    expect(() =>
      assertTurn("P1", { type: "PLAY", playerId: "P1", card: undefined as never })
    ).toThrow("MissingCard");
  });
});
