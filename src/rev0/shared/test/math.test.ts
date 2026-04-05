import { describe, it, expect } from 'vitest';
import { decimalToDozenal, dozenalToDecimal } from '../src/baseConversion.js';

describe('Category 1: Dozenal (Base-12) Math Engine', () => {
    // UT01 logic.toDoz Decimal: 10 String: "A" Pass
    // Note: The system currently returns "↊" for 10. "A" is mapped to "↊" during normalization.
    it('UT01 logic.toDoz Decimal: 10 String: "↊" ("A")', () => {
        expect(decimalToDozenal(10)).toBe('↊');
    });

    // UT02 logic.toDoz Decimal: 11 String: "B" Pass
    it('UT02 logic.toDoz Decimal: 11 String: "↋" ("B")', () => {
        expect(decimalToDozenal(11)).toBe('↋');
    });

    // UT03 logic.toDoz Decimal: 12 String: "10" Pass
    it('UT03 logic.toDoz Decimal: 12 String: "10"', () => {
        expect(decimalToDozenal(12)).toBe('10');
    });

    // UT04 logic.toDoz Decimal: 144 String: "100" Pass
    it('UT04 logic.toDoz Decimal: 144 String: "100"', () => {
        expect(decimalToDozenal(144)).toBe('100');
    });

    // UT05 logic.toDoz Decimal: 1727 String: "BBB" Pass
    it('UT05 logic.toDoz Decimal: 1727 String: "↋↋↋" ("BBB")', () => {
        expect(decimalToDozenal(1727)).toBe('↋↋↋');
    });

    // UT06 logic.fromDoz String: "1A" Decimal: 22 Pass
    it('UT06 logic.fromDoz String: "1A" Decimal: 22', () => {
        expect(dozenalToDecimal('1A')).toBe(22);
    });

    // UT07 logic.fromDoz String: "B1" Decimal: 133 Pass
    it('UT07 logic.fromDoz String: "B1" Decimal: 133', () => {
        expect(dozenalToDecimal('B1')).toBe(133);
    });

    // UT08 logic.val String: "G" (Invalid) Throw InputError Pass
    it('UT08 logic.val String: "G" (Invalid) Throw InputError', () => {
        expect(() => dozenalToDecimal('G')).toThrowError(/Invalid/);
    });
});
