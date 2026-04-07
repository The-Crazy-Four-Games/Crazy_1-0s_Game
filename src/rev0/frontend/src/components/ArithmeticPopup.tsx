/**
 * @file ArithmeticPopup.tsx
 * @module frontend/components/ArithmeticPopup
 * @author The Crazy 4 Team
 * @date 2026
 * @purpose Floating arithmetic challenge popup shown to both players when
 *          a face card is played.  Presents the equation in the active
 *          numeral base, accepts input via numpad, and displays the
 *          dual-player resolution result (win / wrong / timeout).
 */
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

const OCTAL_SPEC_LOCAL = {
  base: 8,
  digits: ['0', '1', '2', '3', '4', '5', '6', '7'] as readonly string[],
  allowPlusSign: true,
  stripLeadingZeros: true,
};

function getSpec(baseId: 'doz' | 'dec' | 'oct') {
  if (baseId === 'doz') return DOZENAL_SPEC;
  if (baseId === 'oct') return OCTAL_SPEC_LOCAL;
  return DECIMAL_SPEC_LOCAL;
}

type ChallengeResolution = {
  winnerId: string | null;
  correctAnswer: number;
  timedOut: boolean;
  bothWrong?: boolean;
  challengeData?: { type: string; op1: number; op2: number; reward: number };
};

interface ArithmeticPopupProps {
  challenge: MathChallenge;
  onAnswer: (answer: number) => void;
  baseId: 'doz' | 'dec' | 'oct';
  challengeResult?: { won: boolean; correct: boolean; tooLate: boolean } | null;
  challengeResolution?: ChallengeResolution | null;
  myId?: string;
  challengeStartTime?: number;
}

export const ArithmeticPopup: React.FC<ArithmeticPopupProps> = ({
  challenge,
  onAnswer,
  baseId,
  challengeResult,
  challengeResolution,
  myId,
  challengeStartTime,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [wrongFlash, setWrongFlash] = useState(false);
  const [lockedOut, setLockedOut] = useState(false);
  const [countdown, setCountdown] = useState(60);
  // Cache resolution data so message stays visible even after prop is cleared to null
  const [resolutionReceived, setResolutionReceived] = useState(false);
  const [cachedResolution, setCachedResolution] = useState<typeof challengeResolution>(null);

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

  // Countdown timer
  useEffect(() => {
    if (!challengeStartTime) return;
    const updateCountdown = () => {
      const elapsed = Math.floor((Date.now() - challengeStartTime) / 1000);
      setCountdown(Math.max(0, 60 - elapsed));
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [challengeStartTime]);

  // When server says wrong answer, lock out the player (one attempt only)
  // Guard: skip if already locked out (prevents re-trigger from legacy events)
  useEffect(() => {
    if (lockedOut) return;
    if (challengeResult && !challengeResult.correct && !challengeResult.tooLate && submitted) {
      setWrongFlash(true);
      const timer = setTimeout(() => {
        setLockedOut(true);
        setWrongFlash(false);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [challengeResult]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cache resolution data and mark as received — persists even after prop is cleared to null
  useEffect(() => {
    if (challengeResolution) {
      setResolutionReceived(true);
      setCachedResolution(challengeResolution);
    }
  }, [challengeResolution]);

  const handleSubmit = () => {
    if (submitted || lockedOut) return;
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
    : baseId === 'oct'
      ? ['1', '2', '3', '4', '5', '6', '7', '', '', '', '0', '']
      : ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', ''];

  const handleNumpadClick = (digit: string) => {
    if (submitted || lockedOut || !digit) return;
    setInputValue(prev => prev + digit);
  };

  const handleBackspace = () => {
    if (submitted || lockedOut) return;
    setInputValue(prev => prev.slice(0, -1));
  };

  // Display value with proper dozenal symbols
  const displayInput = sanitizeDozenalDisplay(inputValue);

  // Use live resolution OR cached resolution — message stays visible even after prop is cleared
  const effectiveResolution = challengeResolution ?? (resolutionReceived ? cachedResolution : null);

  // Resolution state (all derived from effectiveResolution)
  const hasResolution = !!effectiveResolution;
  const iWon = effectiveResolution?.winnerId === myId;
  const opponentWon = hasResolution && effectiveResolution?.winnerId && effectiveResolution.winnerId !== myId;
  const bothWrong = effectiveResolution?.bothWrong;
  const timedOut = effectiveResolution?.timedOut;

  // Legacy final result (fallback)
  const isFinalResult = challengeResult && (challengeResult.correct || challengeResult.tooLate);
  const isWon = challengeResult?.won ?? false;
  const isTooLate = challengeResult?.tooLate ?? false;

  // Determine what message to show
  const showResolutionMessage = hasResolution;
  const showLegacyResult = isFinalResult && !hasResolution;
  // Never show numpad after resolution (even if resolution prop is later cleared to null)
  const showNumpad = !submitted && !lockedOut && !hasResolution && !resolutionReceived;

  return (
    <div className="arithmetic-overlay">
      <div className="arithmetic-popup">
        {/* Header */}
        <div className="popup-header">
          <h2>{label} Challenge</h2>
          <div className="points-badge">+{formatNum(challenge.reward)} pts</div>
        </div>

        {/* Countdown timer */}
        <div className={`challenge-timer ${countdown <= 10 ? 'timer-urgent' : ''}`}>
          ⏱ {countdown}s
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

        {/* Numpad input — show when not submitted or locked out */}
        {showNumpad && (
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
            <span>Wrong! Waiting for opponent...</span>
          </div>
        )}

        {/* Locked out — waiting for opponent */}
        {lockedOut && !hasResolution && (
          <div className="result-message waiting">
            <span>❌ You answered incorrectly. Waiting for opponent...</span>
          </div>
        )}

        {/* Waiting for result after submitting */}
        {submitted && !lockedOut && !challengeResult && !wrongFlash && !hasResolution && (
          <div className="result-message waiting">
            <span>⏳ Waiting for result...</span>
          </div>
        )}

        {/* New resolution message (dual-player) */}
        {showResolutionMessage && (
          <div className={`result-message ${iWon ? 'correct' : 'incorrect'}`}>
            <span className="result-icon">{iWon ? '✅' : bothWrong ? '❌' : timedOut ? '⏰' : '❌'}</span>
            <span>
              {iWon
                ? `Correct! +${formatNum(challenge.reward)} points!`
                : opponentWon
                  ? `Opponent answered first! Answer: ${formatNum(correctAnswer)}`
                  : bothWrong
                    ? `Both wrong! Answer: ${formatNum(correctAnswer)}`
                    : timedOut
                      ? `Time's up! Answer: ${formatNum(correctAnswer)}`
                      : `Wrong! Answer: ${formatNum(correctAnswer)}`
              }
            </span>
          </div>
        )}

        {/* Legacy result (fallback for older server) */}
        {showLegacyResult && (
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
