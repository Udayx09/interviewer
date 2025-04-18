// src/components/CircularTimer.tsx
import React from 'react';

interface CircularTimerProps {
  timeLeft: number; // Seconds remaining
  totalTime: number; // Initial total seconds
  size?: number; // Optional size of the timer (diameter)
  strokeWidth?: number; // Optional thickness of the circle strokes
}

const CircularTimer: React.FC<CircularTimerProps> = ({
  timeLeft,
  totalTime,
  size = 80, // Default size 80px
  strokeWidth = 8, // Default stroke width 8px
}) => {
  if (totalTime <= 0) totalTime = 1; // Avoid division by zero

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Calculate the progress (0 to 1)
  const progress = Math.max(0, timeLeft) / totalTime; // Ensure progress doesn't go below 0

  // Calculate the dash offset
  // Start with full circle (offset 0), move towards full offset (circumference) as time decreases
  const offset = circumference * (1 - progress);

  // Determine color based on time remaining
  let color = '#28a745'; // Green (default)
  const lowTimeThreshold = 0.2 * totalTime; // 20%
  const warningTimeThreshold = 0.5 * totalTime; // 50%

  if (timeLeft <= lowTimeThreshold) {
    color = '#dc3545'; // Red
  } else if (timeLeft <= warningTimeThreshold) {
    color = '#ffc107'; // Yellow
  }

  // Format time display (MM:SS)
  const formatTime = (seconds: number): string => {
    const safeSeconds = Math.max(0, seconds); // Ensure we don't display negative time
    const mins = Math.floor(safeSeconds / 60);
    const secs = Math.floor(safeSeconds % 60); // Use floor to avoid decimals during countdown
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Background Circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#e9ecef" // Light grey background track
        strokeWidth={strokeWidth}
      />
      {/* Progress Circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color} // Dynamic color
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round" // Makes the ends of the stroke rounded
        transform={`rotate(-90 ${size / 2} ${size / 2})`} // Rotate to start from top
        style={{ transition: 'stroke-dashoffset 0.3s linear, stroke 0.5s linear' }} // Smooth transitions
      />
      {/* Time Text */}
      <text
        x="50%"
        y="50%"
        dy=".3em" // Vertical alignment adjustment
        textAnchor="middle" // Horizontal alignment
        fontSize={size * 0.25} // Adjust font size relative to timer size
        fill={color} // Match text color to progress color
        fontWeight="bold"
      >
        {formatTime(timeLeft)}
      </text>
    </svg>
  );
};

export default CircularTimer;