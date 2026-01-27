
export class InvalidNumberFormat extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'InvalidNumberFormat';
    }
}

export type BaseSpec = Readonly<{
    base: number; // dozenal, hexadecimal, etc.
    digits: readonly string[]; //length must be equal to base
    aliases?: Readonly<Record<string, string>>; // alternative representations for digits
    allowPlusSign?: boolean;// whether to allow '+' sign in the number string. false by default
    stripLeadingZeros?: boolean; // whether to strip leading zeros from the number string. true by default
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

  // Build reverse map of canonical digits -> value
  const canonicalSet = new Set(digits);

  // Apply alias mapping and also normalize ASCII case (optional)
  // Strategy:
  // - For each symbol, first try direct match in canonical digits
  // - Else try alias mapping (case-sensitive first, then uppercase fallback)
  // Note: If your digit symbols are multi-char tokens, you'd need tokenization.
  // For card games, digits are typically single-char, so char-based is fine.
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


// Check validity without throwing; returns boolean.
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

  // Prepare symbol -> value
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
      // Shouldn't happen if normalize validated
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

/** Convenience: parse to JS number if safe. */
export function fromBaseToNumber(input: string, spec: BaseSpec): number {
  const bi = fromBase(input, spec);
  const num = Number(bi);
  // Ensure round-trip safety
  if (!Number.isSafeInteger(num)) {
    throw new InvalidNumberFormat(`Value exceeds JS safe integer range.`);
  }
  return num;
}

/** Convenience: convert JS number (safe integer) to base string. */
export function toBaseFromNumber(n: number, spec: BaseSpec): string {
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    throw new InvalidNumberFormat(`Input must be a finite integer.`);
  }
  if (!Number.isSafeInteger(n)) {
    throw new InvalidNumberFormat(`Input exceeds JS safe integer range.`);
  }
  return toBase(BigInt(n), spec);
}

/** ----------- Dozenal spec (↊ ↋) + aliases ----------- */

// If you prefer ASCII canonical, swap digits[10],digits[11] to "A","B"
// and keep aliases mapping to also accept ↊↋.
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

// Wrappers matching your MIS names (optional)
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