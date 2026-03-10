import { describe, expect, it } from "vitest";

import {
  DOZENAL_SPEC,
  InvalidNumberFormat,
  decimalToDozenal,
  dozenalToDecimal,
  fromBase,
  isValidDozenal,
  normalizeDozenal,
  normalizeNumberString,
  toBaseFromNumber,
} from "./baseConversion.ts";

describe("baseConversion", () => {
  it("converts between decimal and dozenal values", () => {
    expect(decimalToDozenal(10)).toBe("↊");
    expect(decimalToDozenal(11)).toBe("↋");
    expect(decimalToDozenal(144)).toBe("100");

    expect(dozenalToDecimal("↋1")).toBe(133);
    expect(dozenalToDecimal("XE")).toBe(131);
  });

  it("normalizes aliases, signs, and leading zeroes", () => {
    expect(normalizeDozenal("00x")).toBe("↊");
    expect(normalizeNumberString("+000E", DOZENAL_SPEC)).toBe("↋");
    expect(fromBase("-10", DOZENAL_SPEC)).toBe(-12n);
    expect(toBaseFromNumber(-14, DOZENAL_SPEC)).toBe("-12");
  });

  it("validates malformed inputs", () => {
    expect(isValidDozenal("19")).toBe(true);
    expect(isValidDozenal("1 9")).toBe(false);
    expect(() => normalizeDozenal("1G")).toThrow(InvalidNumberFormat);
    expect(() => normalizeNumberString("", DOZENAL_SPEC)).toThrow(InvalidNumberFormat);
  });
});
