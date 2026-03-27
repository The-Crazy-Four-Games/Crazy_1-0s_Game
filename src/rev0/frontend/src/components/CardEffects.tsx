import React, { useState, useEffect } from 'react';
import './CardEffects.css';

type EffectType = 'skip' | 'wildcard' | 'facecard' | null;

interface CardEffectsProps {
  effectType: EffectType;
  effectKey: number; // changes to re-trigger
}

const MATH_SYMBOLS = ['+', '−', '×', '÷', '=', '∑', '∫', 'π', '√', '%', '∞', 'Δ'];

const CardEffects: React.FC<CardEffectsProps> = ({ effectType, effectKey }) => {
  const [active, setActive] = useState(false);
  const [currentEffect, setCurrentEffect] = useState<EffectType>(null);

  useEffect(() => {
    if (effectType && effectKey > 0) {
      setCurrentEffect(effectType);
      setActive(true);
      const timer = setTimeout(() => {
        setActive(false);
        setCurrentEffect(null);
      }, effectType === 'skip' ? 1800 : 1500);
      return () => clearTimeout(timer);
    }
  }, [effectType, effectKey]);

  if (!active || !currentEffect) return null;

  if (currentEffect === 'skip') {
    return (
      <div className="effect-overlay" key={effectKey}>
        <div className="skip-clock-effect">
          <div className="clock-face">
            <div className="clock-center" />
            <div className="clock-hand" />
            {[...Array(12)].map((_, i) => (
              <div
                key={i}
                className="clock-mark"
                style={{ transform: `rotate(${i * 30}deg) translateY(-42px)` }}
              />
            ))}
          </div>
          <div className="skip-text">⏭ SKIP!</div>
        </div>
      </div>
    );
  }

  if (currentEffect === 'wildcard') {
    return (
      <div className="effect-overlay" key={effectKey}>
        <div className="wildcard-burst-effect">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="burst-particle"
              style={{
                '--angle': `${(i * 18) + Math.random() * 10}deg`,
                '--distance': `${80 + Math.random() * 120}px`,
                '--delay': `${Math.random() * 0.15}s`,
                '--size': `${8 + Math.random() * 16}px`,
                '--hue': `${Math.random() * 360}`,
                animationDelay: `${Math.random() * 0.15}s`,
              } as React.CSSProperties}
            />
          ))}
          {/* Star sparkles */}
          {[...Array(8)].map((_, i) => (
            <div
              key={`star-${i}`}
              className="burst-star"
              style={{
                '--angle': `${i * 45 + Math.random() * 20}deg`,
                '--distance': `${60 + Math.random() * 80}px`,
                '--delay': `${Math.random() * 0.2}s`,
              } as React.CSSProperties}
            >
              🌟
            </div>
          ))}
          <div className="wildcard-flash" />
          <div className="wildcard-text">🃏 WILD!</div>
        </div>
      </div>
    );
  }

  if (currentEffect === 'facecard') {
    return (
      <div className="effect-overlay effect-overlay-transparent" key={effectKey}>
        <div className="math-symbols-effect">
          {[...Array(18)].map((_, i) => {
            const sym = MATH_SYMBOLS[i % MATH_SYMBOLS.length];
            return (
              <div
                key={i}
                className="floating-symbol"
                style={{
                  '--x-start': `${10 + Math.random() * 80}%`,
                  '--x-drift': `${(Math.random() - 0.5) * 100}px`,
                  '--delay': `${Math.random() * 0.6}s`,
                  '--duration': `${1.2 + Math.random() * 0.8}s`,
                  '--scale': `${0.8 + Math.random() * 1.2}`,
                  '--rotation': `${(Math.random() - 0.5) * 60}deg`,
                  fontSize: `${1.5 + Math.random() * 2}rem`,
                } as React.CSSProperties}
              >
                {sym}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return null;
};

export default CardEffects;
