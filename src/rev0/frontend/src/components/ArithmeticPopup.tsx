import React, { useMemo, useState, useRef, useEffect } from 'react';
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
}

export const ArithmeticPopup: React.FC<ArithmeticPopupProps> = ({
  challenge,
  onAnswer,
  baseId,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submittedAnswer, setSubmittedAnswer] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  // Auto-focus the input field
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleSubmit = () => {
    if (submitted) return;
    const parsed = parseInput(inputValue.trim());
    if (parsed === null) return;

    setSubmittedAnswer(parsed);
    setSubmitted(true);

    // Brief delay to show feedback, then send answer
    setTimeout(() => {
      onAnswer(parsed);
    }, 1000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  const isCorrect = submittedAnswer === correctAnswer;
  const label = getChallengeLabel(challenge.type);

  // Operator display
  const opSymbol = challenge.type === '*' ? '×' : challenge.type === '/' ? '÷' : challenge.type;

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
          {challenge.type === '+' && '10 card played — Addition!'}
          {challenge.type === '-' && 'Jack played — Subtraction!'}
          {challenge.type === '*' && 'Queen played — Multiplication!'}
          {challenge.type === '/' && 'King played — Division!'}
        </div>

        {/* Equation */}
        <div className="challenge-equation">
          <span className="operand">{formatNum(challenge.op1)}</span>
          <span className="operator">{opSymbol}</span>
          <span className="operand">{formatNum(challenge.op2)}</span>
          <span className="equals">=</span>
          {!submitted ? (
            <span className="operand answer-blank">?</span>
          ) : (
            <span className={`operand ${isCorrect ? 'answer-correct' : 'answer-incorrect'}`}>
              {formatNum(submittedAnswer!)}
            </span>
          )}
        </div>

        {/* Typed answer input */}
        {!submitted && (
          <div className="challenge-input-area">
            <input
              ref={inputRef}
              type="text"
              className="challenge-input"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={baseId === 'doz' ? 'Dozenal answer (use X for ↊, E for ↋)...' : 'Type your answer...'}
              autoFocus
            />
            <button
              className="submit-btn"
              onClick={handleSubmit}
              disabled={inputValue.trim() === '' || parseInput(inputValue.trim()) === null}
            >
              Submit
            </button>
          </div>
        )}

        {/* Feedback */}
        {submitted && (
          <div className={`result-message ${isCorrect ? 'correct' : 'incorrect'}`}>
            <span className="result-icon">{isCorrect ? '✅' : '❌'}</span>
            <span>
              {isCorrect
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
