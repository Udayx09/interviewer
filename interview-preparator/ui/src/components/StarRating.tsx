// src/components/StarRating.tsx
import React from 'react';

interface StarRatingProps {
  score: number; // Score out of 10
  maxScore?: number;
  maxStars?: number;
  size?: number; // Size of each star
}

const StarRating: React.FC<StarRatingProps> = ({
  score,
  maxScore = 10,
  maxStars = 5,
  size = 20, // Default star size
}) => {
  // Calculate the number of filled stars (proportionally)
  const normalizedScore = Math.max(0, Math.min(score, maxScore)); // Clamp score 0-maxScore
  const filledStars = Math.round((normalizedScore / maxScore) * maxStars);

  const starStyle: React.CSSProperties = {
      width: `${size}px`,
      height: `${size}px`,
      margin: `0 ${size * 0.05}px`, // Small margin between stars
      display: 'inline-block',
  };

  // Simple SVG Star Path (adjust points for different star shapes)
  const starPath = "M12 .587l3.668 7.568 8.332 1.151-6.064 5.828 1.48 8.279-7.416-3.966-7.417 3.966 1.481-8.279-6.064-5.828 8.332-1.151z";

  return (
    <div style={{ display: 'inline-block', lineHeight: '1' }}>
      {[...Array(maxStars)].map((_, index) => {
        const isFilled = index < filledStars;
        return (
          <svg
            key={index}
            style={starStyle}
            viewBox="0 0 24 24" // Common viewBox for star paths
            fill={isFilled ? '#ffc107' : '#e4e5e9'} // Gold for filled, light grey for empty
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d={starPath} />
          </svg>
        );
      })}
    </div>
  );
};

export default StarRating;