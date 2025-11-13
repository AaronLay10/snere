/**
 * Simple Sentient Neural Eye Logo Component
 * For touchscreen header display
 */

import React from 'react';

interface SentientLogoProps {
  size?: 'small' | 'medium' | 'large';
  showText?: boolean;
  className?: string;
}

const SentientLogo: React.FC<SentientLogoProps> = ({ 
  size = 'medium', 
  showText = true, 
  className = '' 
}) => {
  const sizeClasses = {
    small: { container: 'w-8 h-8', text: 'text-lg' },
    medium: { container: 'w-12 h-12', text: 'text-xl' },
    large: { container: 'w-16 h-16', text: 'text-2xl' }
  };

  const sizes = sizeClasses[size];

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Neural Eye */}
      <div className={`relative ${sizes.container} flex-shrink-0`}>
        {/* Outer Ring */}
        <div 
          className="absolute inset-0 rounded-full border-2 animate-spin"
          style={{
            borderImage: 'conic-gradient(from 0deg, #ff00ff, #00ffff, #ffff00, #00ff00, #ff00ff) 1',
            animationDuration: '6s'
          }}
        />
        
        {/* Inner Background */}
        <div className="absolute inset-1 bg-gray-900 rounded-full" />
        
        {/* Pupil */}
        <div 
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full animate-pulse"
          style={{
            background: 'radial-gradient(circle at 30% 30%, #ffffff, #00ffff 40%, #0099cc)',
            boxShadow: '0 0 10px #00ffff',
            animationDuration: '2s'
          }}
        >
          {/* Inner pupil */}
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-1 h-1 bg-black rounded-full" />
        </div>
      </div>

      {/* Text */}
      {showText && (
        <div 
          className={`font-light tracking-widest ${sizes.text} text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-cyan-400 to-green-400 animate-pulse`}
          style={{ animationDuration: '4s' }}
        >
          SENTIENT
        </div>
      )}
    </div>
  );
};

export default SentientLogo;