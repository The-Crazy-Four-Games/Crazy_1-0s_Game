import React from 'react';
import './ArithmeticPopup.css';

/**
 * ArithmeticPopup - DEPRECATED
 * 
 * This component was part of the original frontend MVP that included
 * arithmetic challenges as a mini-game feature. The backend team has
 * not implemented this feature, so this component is no longer used.
 * 
 * It is kept here for potential future implementation.
 */

interface ArithmeticPopupProps {
  onComplete: (correct: boolean, pointsEarned: number) => void;
}

export const ArithmeticPopup: React.FC<ArithmeticPopupProps> = ({
  onComplete,
}) => {
  // This component is deprecated and not used
  React.useEffect(() => {
    console.warn('ArithmeticPopup is deprecated and should not be rendered');
    onComplete(false, 0);
  }, [onComplete]);

  return null;
};

export default ArithmeticPopup;
