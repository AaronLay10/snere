/**
 * Animated Neural Eye Logo Component
 * Used throughout the application for consistent branding
 */

import React from 'react';

interface NeuralEyeLogoProps {
  eyeState?: 'idle' | 'watching' | 'flash';
  lookAtPosition?: { x: number; y: number } | null;
  isExecuting?: boolean;
  size?: 'small' | 'medium' | 'large';
}

/**
 * Full animated Neural Eye Logo with:
 * - 8 radiating neural connection lines with pulse animation
 * - Rotating rainbow iris ring
 * - Pulsing cyan pupil with breathing animation
 * - Moving pupil that can look at positions or randomly wander
 * - Flash state for executing commands
 */
export default function NeuralEyeLogo(props: NeuralEyeLogoProps) {
  const { eyeState = 'idle', lookAtPosition = null, size = 'medium' } = props;
  const [pupilPosition, setPupilPosition] = React.useState({ x: 0, y: 0 });

  // Size mapping
  const sizeMap = {
    small: { container: 40, pupil: 8, iris: 20, highlight: 3 },
    medium: { container: 120, pupil: 20, iris: 50, highlight: 6 },
    large: { container: 160, pupil: 26, iris: 66, highlight: 8 }
  };

  const dimensions = sizeMap[size];

  // Calculate pupil position to look at button
  React.useEffect(() => {
    if (lookAtPosition && eyeState === 'watching') {
      // Calculate angle and distance from center to button
      const eyeElement = document.querySelector('.neural-eye-container');
      if (eyeElement) {
        const eyeRect = eyeElement.getBoundingClientRect();
        const eyeCenterX = eyeRect.left + eyeRect.width / 2;
        const eyeCenterY = eyeRect.top + eyeRect.height / 2;

        const deltaX = lookAtPosition.x - eyeCenterX;
        const deltaY = lookAtPosition.y - eyeCenterY;
        // Move pupil to edge of iris (radius ~10px from center of 50px pupil)
        const angle = Math.atan2(deltaY, deltaX);
        const maxMove = 10; // pixels to move from center

        setPupilPosition({
          x: Math.cos(angle) * maxMove,
          y: Math.sin(angle) * maxMove
        });
      }
    } else if (eyeState === 'idle') {
      setPupilPosition({ x: 0, y: 0 });
    }
  }, [lookAtPosition, eyeState]);

  return (
    <div className="w-full h-full relative neural-eye-container" style={{ width: `${dimensions.container}px`, height: `${dimensions.container}px` }}>
      {/* Neural Connections - 8 lines radiating out */}
      <div style={{ position: 'absolute', width: '100%', height: '100%', top: 0, left: 0, zIndex: 2 }}>
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              width: size === 'small' ? '25px' : '75px',
              height: '1px',
              top: '50%',
              left: '50%',
              background: 'linear-gradient(90deg, rgba(255,255,255,1) 0%, rgba(0,255,255,1) 30%, rgba(0,255,255,0.5) 60%, transparent 90%)',
              transformOrigin: '0% 50%',
              transform: `translateY(-50%) rotate(${angle}deg)`,
              zIndex: 2,
              animation: 'pulse-line 8s infinite',
              animationDelay: `${[0.4, 2.8, 1.2, 4.4, 2.0, 5.6, 3.6, 6.8][i]}s`
            }}
          />
        ))}
      </div>

      {/* Neural iris ring - rotating rainbow */}
      <div
        style={{
          width: `${dimensions.container}px`,
          height: `${dimensions.container}px`,
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          borderRadius: '50%',
          border: size === 'small' ? '2px solid transparent' : '4px solid transparent',
          background: 'conic-gradient(from 0deg, #ff00ff, #00ffff, #ffff00, #00ff00, #ff00ff)',
          animation: 'rotate-iris 6s linear infinite',
          filter: 'brightness(1.2)',
          zIndex: 1
        }}
      >
        {/* Inner dark circle to create ring effect */}
        <div style={{
          position: 'absolute',
          width: size === 'small' ? 'calc(100% - 4px)' : 'calc(100% - 8px)',
          height: size === 'small' ? 'calc(100% - 4px)' : 'calc(100% - 8px)',
          top: size === 'small' ? '2px' : '4px',
          left: size === 'small' ? '2px' : '4px',
          borderRadius: '50%',
          background: '#0a0a0a',
          zIndex: 1
        }} />
        {/* Glow effect - contained within ring */}
        <div style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          boxShadow: 'inset 0 0 30px rgba(255, 0, 255, 0.3)',
          zIndex: 2
        }} />
      </div>

      {/* Iris - cyan glowing circle (stays centered, breathes) */}
      <div
        style={{
          width: `${dimensions.iris}px`,
          height: `${dimensions.iris}px`,
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          borderRadius: '50%',
          background: 'radial-gradient(circle at 30% 30%, #ffffff, #00ffff 40%, #0099cc)',
          boxShadow: eyeState === 'flash'
            ? '0 0 80px #ffffff, 0 0 120px rgba(255, 255, 255, 0.8), inset -5px -5px 20px rgba(0, 153, 204, 0.5)'
            : '0 0 40px #00ffff, 0 0 80px rgba(0, 255, 255, 0.5), inset -5px -5px 20px rgba(0, 153, 204, 0.5)',
          zIndex: 3,
          animation: 'neural-pulse 2s ease-in-out infinite'
        }}
      />

      {/* Pupil - black center (moves around and looks) */}
      <div style={{
        position: 'absolute',
        width: `${dimensions.pupil}px`,
        height: `${dimensions.pupil}px`,
        top: '50%',
        left: '50%',
        transform: eyeState === 'watching' || eyeState === 'flash'
          ? `translate(calc(-50% + ${pupilPosition.x}px), calc(-50% + ${pupilPosition.y}px))`
          : 'translate(-50%, -50%)',
        transition: eyeState === 'watching'
          ? 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
          : eyeState === 'idle'
            ? 'none'
            : 'transform 2s cubic-bezier(0.4, 0, 0.2, 1)',
        borderRadius: '50%',
        background: eyeState === 'flash' ? '#ffffff' : '#000',
        animation: eyeState === 'idle' ? 'pupil-look-around 15s ease-in-out infinite' : 'none',
        zIndex: 4,
        overflow: 'visible'
      }}>
        {/* Highlight dot - cyan shine on pupil (inside pupil, upper-left) */}
        {eyeState !== 'flash' && (
          <div style={{
            position: 'absolute',
            width: `${dimensions.highlight}px`,
            height: `${dimensions.highlight}px`,
            top: '4px',
            left: '4px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, #00ffff 0%, rgba(0, 255, 255, 0.6) 50%, transparent 100%)',
            filter: 'blur(0.5px)',
            boxShadow: '0 0 8px rgba(0, 255, 255, 1), 0 0 16px rgba(0, 255, 255, 0.8), 0 0 24px rgba(0, 255, 255, 0.6), 0 0 32px rgba(0, 255, 255, 0.4)'
          }} />
        )}
      </div>
    </div>
  );
}
