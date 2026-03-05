import React, { useMemo, useState, useRef, useEffect } from 'react';
import type { MathChallenge } from '../types/game';
import { getChallengeLabel, computeChallengeAnswer } from '../types/game';
import './ArithmeticPopup.css';

interface ArithmeticPopupProps {
  challenge: MathChallenge;
  onAnswer: (answer: number) => void;
}

export const ArithmeticPopup: React.FC<ArithmeticPopupProps> = ({
  challenge,
  onAnswer,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submittedAnswer, setSubmittedAnswer] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const correctAnswer = useMemo(
    () => computeChallengeAnswer(challenge.type, challenge.op1, challenge.op2),
    [challenge]
  );

  // Auto-focus the input field
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleSubmit = () => {
    if (submitted) return;
    const parsed = parseInt(inputValue, 10);
    if (isNaN(parsed)) return;

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
          <div className="points-badge">+{challenge.reward} pts</div>
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
          <span className="operand">{challenge.op1}</span>
          <span className="operator">{opSymbol}</span>
          <span className="operand">{challenge.op2}</span>
          <span className="equals">=</span>
          {!submitted ? (
            <span className="operand answer-blank">?</span>
          ) : (
            <span className={`operand ${isCorrect ? 'answer-correct' : 'answer-incorrect'}`}>
              {submittedAnswer}
            </span>
          )}
        </div>

        {/* Typed answer input */}
        {!submitted && (
          <div className="challenge-input-area">
            <input
              ref={inputRef}
              type="number"
              className="challenge-input"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your answer..."
              autoFocus
            />
            <button
              className="submit-btn"
              onClick={handleSubmit}
              disabled={inputValue.trim() === '' || isNaN(parseInt(inputValue, 10))}
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
                ? `Correct! +${challenge.reward} points!`
                : `Wrong! The answer was ${correctAnswer}`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ArithmeticPopup;
