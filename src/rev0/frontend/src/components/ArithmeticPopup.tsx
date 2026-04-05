import React, { useMemo, useState, useEffect } from 'react';
import type { MathChallenge } from '../types/game';
import { getChallengeLabel, computeChallengeAnswer, sanitizeDozenalDisplay } from '../types/game';
import { toBaseFromNumber, fromBaseToNumber, DOZENAL_SPEC } from '@rev0/shared';
import './ArithmeticPopup.css';

const DECIMAL_SPEC_LOCAL = {
  base: 10,
  digits: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'] as readonly string[],
  allowPlusSign: true,
  stripLeadingZeros: true,
};

function getSpec(baseId: 'doz' | 'dec') {
  return baseId === 'doz' ? DOZENAL_SPEC : DECIMAL_SPEC_LOCAL;
}

interface ArithmeticPopupProps {
  challenge: MathChallenge;
  onAnswer: (answer: number) => void;
  baseId: 'doz' | 'dec';
  challengeResult?: { won: boolean; correct: boolean; tooLate: boolean } | null;
}

export const ArithmeticPopup: React.FC<ArithmeticPopupProps> = ({
  challenge,
  onAnswer,
  baseId,
  challengeResult,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [wrongFlash, setWrongFlash] = useState(false);

  const correctAnswer = useMemo(
    () => computeChallengeAnswer(challenge.type, challenge.op1, challenge.op2),
    [challenge]
  );

  // Format a decimal number in the current base
  const spec = getSpec(baseId);
  const formatNum = (n: number) => sanitizeDozenalDisplay(toBaseFromNumber(n, spec));
  const parseInput = (s: string): number | null => {
    try {
      return fromBaseToNumber(s, spec);
    } catch {
      return null;
    }
  };

  // When server says wrong answer (correct: false, tooLate: false), reset to allow retry
  useEffect(() => {
    if (challengeResult && !challengeResult.correct && !challengeResult.tooLate && submitted) {
      setWrongFlash(true);
      const timer = setTimeout(() => {
        setSubmitted(false);
        setInputValue('');
        setWrongFlash(false);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [challengeResult]);

  const handleSubmit = () => {
    if (submitted) return;
    const parsed = parseInput(inputValue.trim());
    if (parsed === null) return;

    setSubmitted(true);
    onAnswer(parsed);
  };

  const label = getChallengeLabel(challenge.type);

  // Operator display
  const opSymbol = challenge.type === '*' ? '×' : challenge.type === '/' ? '÷' : challenge.type;

  // Numpad digits
  const numpadDigits = baseId === 'doz'
    ? ['1', '2', '3', '4', '5', '6', '7', '8', '9', '↊', '0', '↋']
    : ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', ''];

  const handleNumpadClick = (digit: string) => {
    if (submitted || !digit) return;
    setInputValue(prev => prev + digit);
  };

  const handleBackspace = () => {
    if (submitted) return;
    setInputValue(prev => prev.slice(0, -1));
  };

  // Display value with proper dozenal symbols
  const displayInput = sanitizeDozenalDisplay(inputValue);

  // Final result (won or tooLate) — these dismiss the popup
  const isFinalResult = challengeResult && (challengeResult.correct || challengeResult.tooLate);
  const isWon = challengeResult?.won ?? false;
  const isTooLate = challengeResult?.tooLate ?? false;

  return (
    <div className="arithmetic-overlay">
      <div className="arithmetic-popup">
        {/* Header */}
        <div className="popup-header">
          <h2>{label} Challenge</h2>
          <div className="points-badge">+{formatNum(challenge.reward)} pts</div>
        </div>

        {/* Card info */}
        <div className="challenge-card-info">
          Face card played —{' '}
          {challenge.type === '+' && 'Addition!'}
          {challenge.type === '-' && 'Subtraction!'}
          {challenge.type === '*' && 'Multiplication!'}
          {challenge.type === '/' && 'Division!'}
        </div>

        {/* Equation */}
        <div className="challenge-equation">
          <span className="operand">{formatNum(challenge.op1)}</span>
          <span className="operator">{opSymbol}</span>
          <span className="operand">{formatNum(challenge.op2)}</span>
          <span className="equals">=</span>
          <span className={`operand answer-blank ${wrongFlash ? 'answer-incorrect' : ''}`}>
            {displayInput || '?'}
          </span>
        </div>

        {/* Numpad input — show when not submitted or after wrong answer reset */}
        {!submitted && !isFinalResult && (
          <div className="numpad-area">
            <div className="numpad-grid">
              {numpadDigits.map((digit, i) => (
                <button
                  key={i}
                  className={`numpad-btn ${!digit ? 'numpad-empty' : ''}`}
                  onClick={() => handleNumpadClick(digit)}
                  disabled={!digit}
                >
                  {digit}
                </button>
              ))}
            </div>
            <div className="numpad-actions">
              <button className="numpad-action-btn backspace-btn" onClick={handleBackspace}>
                ⌫
              </button>
              <button
                className="numpad-action-btn submit-btn"
                onClick={handleSubmit}
                disabled={inputValue.trim() === '' || parseInput(inputValue.trim()) === null}
              >
                ✓ Submit
              </button>
            </div>
          </div>
        )}

        {/* Wrong answer flash */}
        {wrongFlash && (
          <div className="result-message incorrect">
            <span className="result-icon">❌</span>
            <span>Wrong! Try again...</span>
          </div>
        )}

        {/* Waiting for server result */}
        {submitted && !challengeResult && !wrongFlash && (
          <div className="result-message waiting">
            <span>⏳ Waiting for result...</span>
          </div>
        )}

        {/* Final result (correct or too late) */}
        {isFinalResult && (
          <div className={`result-message ${isWon ? 'correct' : 'incorrect'}`}>
            <span className="result-icon">{isWon ? '✅' : '❌'}</span>
            <span>
              {isTooLate
                ? `Too slow! Opponent answered first. Answer: ${formatNum(correctAnswer)}`
                : isWon
                  ? `Correct! +${formatNum(challenge.reward)} points!`
                  : `Wrong! The answer was ${formatNum(correctAnswer)}`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ArithmeticPopup;
