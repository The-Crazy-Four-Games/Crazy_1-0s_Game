
/**
 * @file baseConversion.ts
 * @module shared/baseConversion
 * @author The Crazy 4 Team
 * @date 2026
 * @purpose Utilities for arbitrary-base numeral systems: validation, normalization,
 *          parsing, and formatting of digit strings in any supported base
 *          (decimal, dozenal, octal, etc.).
 */

export class InvalidNumberFormat extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'InvalidNumberFormat';
    }
}

export type BaseSpec = Readonly<{
    base: number;                                   // Numeric base (e.g. 10 for decimal, 12 for dozenal)
    digits: readonly string[];                      // Ordered digit symbols; length must equal base
    aliases?: Readonly<Record<string, string>>;     // Optional alternative input symbols mapped to canonical digits
    allowPlusSign?: boolean;                        // Whether a leading '+' is accepted; defaults to false
    stripLeadingZeros?: boolean;                    // Whether leading zero digits are removed; defaults to true
}>

export function validateBaseSpec(spec: BaseSpec): void {
    const { base, digits } = spec;
    if (!Number.isInteger(base) || base < 2) {
        throw new InvalidNumberFormat(`Invalid base: ${base}. Base must be an integer >= 2.`);
    }
    if (digits.length !== base) {
        throw new Error('Digits array length must be equal to the base.');
    }
    const seen = new Set<string>();
    for (const d of digits) {
        if (typeof d !== "string" || d.length === 0) {
            throw new InvalidNumberFormat(`Digit symbols must be non-empty strings.`);
        }
        if (seen.has(d)) {
            throw new InvalidNumberFormat(`Duplicate digit symbol: "${d}".`);
        }
        seen.add(d);
    }
}



export function normalizeNumberString(input: string, spec: BaseSpec): string {
  validateBaseSpec(spec);

  const { digits, aliases, allowPlusSign = true, stripLeadingZeros = true } = spec;

  if (typeof input !== "string") {
    throw new InvalidNumberFormat(`Input must be a string.`);
  }

  let s = input.trim();
  if (s.length === 0) {
    throw new InvalidNumberFormat(`Empty string.`);
  }

  // Reject any internal whitespace characters
  if (/\s/.test(s)) {
    // trim already removed leading/trailing; any remaining whitespace means internal
    throw new InvalidNumberFormat(`Whitespace is not allowed inside the number.`);
  }

  // Handle sign
  let sign = "";
  if (s[0] === "-" || s[0] === "+") {
    if (s[0] === "+" && !allowPlusSign) {
      throw new InvalidNumberFormat(`Leading '+' is not allowed.`);
    }
    sign = s[0] === "-" ? "-" : "";
    s = s.slice(1);
    if (s.length === 0) throw new InvalidNumberFormat(`Missing digits after sign.`);
  }

  // Canonical digit set for O(1) membership lookup
  const canonicalSet = new Set(digits);

  // Resolve each input character to its canonical digit symbol,
  // accepting aliases case-insensitively when an exact match fails
  const outChars: string[] = [];
  for (const ch of Array.from(s)) {
    if (canonicalSet.has(ch)) {
      outChars.push(ch);
      continue;
    }
    const mapped =
      aliases?.[ch] ??
      aliases?.[ch.toUpperCase()] ??
      aliases?.[ch.toLowerCase()];
    if (mapped && canonicalSet.has(mapped)) {
      outChars.push(mapped);
      continue;
    }
    throw new InvalidNumberFormat(`Invalid digit symbol: "${ch}".`);
  }

  // Strip leading zeros (canonical zero is digits[0])
  let body = outChars.join("");
  if (stripLeadingZeros) {
    const zero = digits[0];
    // Keep at least one digit
    while (body.length > 1 && body.startsWith(zero)) {
      body = body.slice(1);
    }
  }

  return sign + body;
}


/** Returns true if the input string is a valid number in the given base; never throws. */
export function isValidNumberString(input: string, spec: BaseSpec): boolean {
  try {
    normalizeNumberString(input, spec);
    return true;
  } catch {
    return false;
  }
}

export function fromBase(input: string, spec: BaseSpec): bigint {
  const norm = normalizeNumberString(input, spec);
  const { base, digits } = spec;

  // Digit-to-value lookup table built from the spec
  const valueMap = new Map<string, bigint>();
  digits.forEach((sym, i) => valueMap.set(sym, BigInt(i)));

  let s = norm;
  let negative = false;
  if (s[0] === "-") {
    negative = true;
    s = s.slice(1);
  }

  let acc = 0n;
  const b = BigInt(base);
  for (const ch of Array.from(s)) {
    const v = valueMap.get(ch);
    if (v === undefined) {
      // Guard: normalizeNumberString should have already caught invalid symbols
      throw new InvalidNumberFormat(`Invalid digit symbol: "${ch}".`);
    }
    acc = acc * b + v;
  }
  return negative ? -acc : acc;
}

export function toBase(n: bigint, spec: BaseSpec): string {
  validateBaseSpec(spec);
  const { base, digits } = spec;

  const b = BigInt(base);
  if (n === 0n) return digits[0];

  let x = n;
  let sign = "";
  if (x < 0n) {
    sign = "-";
    x = -x;
  }

  const parts: string[] = [];
  while (x > 0n) {
    const r = x % b; // 0..base-1
    parts.push(digits[Number(r)]);
    x = x / b;
  }
  parts.reverse();
  return sign + parts.join("");
}

/** Parses a base-string into a JS number, throwing if the value exceeds safe-integer bounds. */
export function fromBaseToNumber(input: string, spec: BaseSpec): number {
  const bi = fromBase(input, spec);
  const num = Number(bi);
  // Ensure round-trip safety
  if (!Number.isSafeInteger(num)) {
    throw new InvalidNumberFormat(`Value exceeds JS safe integer range.`);
  }
  return num;
}

/** Converts a JS safe integer to its string representation in the given base. */
export function toBaseFromNumber(n: number, spec: BaseSpec): string {
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    throw new InvalidNumberFormat(`Input must be a finite integer.`);
  }
  if (!Number.isSafeInteger(n)) {
    throw new InvalidNumberFormat(`Input exceeds JS safe integer range.`);
  }
  return toBase(BigInt(n), spec);
}

/** Base-12 (dozenal) specification using Unicode digits ↊ (ten) and ↋ (eleven),
 *  with common ASCII aliases accepted on input (A/a/X/x for ten, B/b/E/e for eleven). */
export const DOZENAL_SPEC: BaseSpec = {
  base: 12,
  digits: ["0","1","2","3","4","5","6","7","8","9","↊","↋"] as const,
  aliases: {
    // Common ASCII fallbacks:
    A: "↊",
    B: "↋",
    X: "↊",
    E: "↋",
    a: "↊",
    b: "↋",
    x: "↊",
    e: "↋",
  },
  allowPlusSign: true,
  stripLeadingZeros: true,
};

// Convenience wrappers for the dozenal numeral system
export function decimalToDozenal(n: number): string {
  return toBaseFromNumber(n, DOZENAL_SPEC);
}
export function dozenalToDecimal(s: string): number {
  return fromBaseToNumber(s, DOZENAL_SPEC);
}
export function normalizeDozenal(s: string): string {
  return normalizeNumberString(s, DOZENAL_SPEC);
}
export function isValidDozenal(s: string): boolean {
  return isValidNumberString(s, DOZENAL_SPEC);
}