/**
 * MIS of Base Conversion Module (M18)
 * Module: Base Conversion
 *
 * Exported Constants:
 *  - DozenalBase: nat := 12
 *  - DecimalBase: nat := 10
 *
 * Exported Access Programs:
 *  - decimalToDozenal(n: int) -> string throws InvalidNumberFormat
 *  - dozenalToDecimal(s: string) -> int throws InvalidNumberFormat
 *  - normalizeDozenal(s: string) -> string throws InvalidNumberFormat
 *  - isValidDozenal(s: string) -> boolean
 */

export const DozenalBase: number = 12;
export const DecimalBase: number = 10;

/** Exception */
export class InvalidNumberFormat extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidNumberFormat";
  }
}

const DOZENAL_DIGITS: readonly string[] = Object.freeze([
  "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "X", "E",
]);

const ALT_SYMBOL_MAP: Readonly<Record<string, string>> = Object.freeze({
  x: "X",
  e: "E",
  a: "X",
  b: "E",
  "↊": "X",
  "↋": "E",
});

function isValidFiniteInteger(n: number): boolean {
  return Number.isFinite(n) && Number.isInteger(n) && Number.isSafeInteger(n);
}

export function decimalToDozenal(n: number): string {
  if (!isValidFiniteInteger(n)) {
    throw new InvalidNumberFormat("Input must be a valid finite integer.");
  }

  if (n === 0) return "0";

  const negative = n < 0;
  let value = BigInt(negative ? -n : n);

  let out = "";
  const base = 12n;

  while (value > 0n) {
    const rem = Number(value % base); // 0..11
    out = DOZENAL_DIGITS[rem] + out;
    value = value / base;
  }

  return negative ? `-${out}` : out;
}

export function isValidDozenal(s: string): boolean {
  if (typeof s !== "string") return false;
  if (s.length === 0) return false;
  if (/\s/.test(s)) return false; // whitespace not allowed here

  let i = 0;
  if (s[0] === "-" || s[0] === "+") i = 1;
  if (i >= s.length) return false;

  for (; i < s.length; i++) {
    const ch = s[i];
    if (ch >= "0" && ch <= "9") continue;
    if (ch === "X" || ch === "E") continue;
    return false;
  }

  return true;
}

export function normalizeDozenal(s: string): string {
  if (typeof s !== "string") {
    throw new InvalidNumberFormat("Input must be a string.");
  }

  let raw = s.trim();
  if (raw.length === 0) {
    throw new InvalidNumberFormat("Dozenal string cannot be empty.");
  }

  // sign handling
  let sign = "";
  if (raw[0] === "-" || raw[0] === "+") {
    sign = raw[0] === "-" ? "-" : "";
    raw = raw.slice(1);
  }

  if (raw.length === 0) {
    throw new InvalidNumberFormat("Dozenal string missing digits.");
  }

  // normalize digits
  let normalizedDigits = "";
  for (const ch of raw) {
    if (/\s/.test(ch)) {
      throw new InvalidNumberFormat("Dozenal string contains whitespace.");
    }

    if (ch >= "0" && ch <= "9") {
      normalizedDigits += ch;
      continue;
    }

    // canonicalize X/E, map alternates
    const lower = ch.toLowerCase();
    if (lower === "x") {
      normalizedDigits += "X";
      continue;
    }
    if (lower === "e") {
      normalizedDigits += "E";
      continue;
    }

    const mapped = ALT_SYMBOL_MAP[lower] ?? ALT_SYMBOL_MAP[ch];
    if (mapped === "X" || mapped === "E") {
      normalizedDigits += mapped;
      continue;
    }

    throw new InvalidNumberFormat(`Invalid dozenal digit symbol: '${ch}'.`);
  }

  // remove leading zeros
  normalizedDigits = normalizedDigits.replace(/^0+(?!$)/, "");

  // canonicalize -0 to 0
  if (normalizedDigits === "0") return "0";

  const canonical = sign + normalizedDigits;
  if (!isValidDozenal(canonical)) {
    throw new InvalidNumberFormat("Dozenal string could not be normalized into a valid form.");
  }

  return canonical;
}


export function dozenalToDecimal(s: string): number {
  const canonical = normalizeDozenal(s);

  let negative = false;
  let digits = canonical;

  if (digits[0] === "-") {
    negative = true;
    digits = digits.slice(1);
  }

  // digits must now be canonical dozenal with no sign
  if (!isValidDozenal(digits)) {
    throw new InvalidNumberFormat("Invalid dozenal format after normalization.");
  }

  let value = 0n;
  const base = 12n;

  for (const ch of digits) {
    let digitVal: number;
    if (ch >= "0" && ch <= "9") digitVal = ch.charCodeAt(0) - 48;
    else if (ch === "X") digitVal = 10;
    else if (ch === "E") digitVal = 11;
    else throw new InvalidNumberFormat(`Invalid dozenal digit symbol: '${ch}'.`);

    value = value * base + BigInt(digitVal);
  }

  if (negative) value = -value;

  const num = Number(value);
  if (!Number.isSafeInteger(num)) {
    throw new InvalidNumberFormat("Result exceeds safe integer range.");
  }

  return num;
}
