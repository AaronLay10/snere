/**
 * Touchscreen Lighting Control Interface
 * Optimized for 10" 1280x800 touchscreen display outside Clockwork room
 */

import React, { useState, useEffect } from 'react';
import { mqtt } from '../lib/api';
import { toast } from 'react-hot-toast';
import { Lightbulb, Power, Loader2 } from 'lucide-react';

interface LightingDevice {
  id: string;
  device_id: string;
  friendly_name: string;
  status: string;
  room_name: string;
  controller_id?: string;
}

interface LightingCommand {
  device_id: string;
  action: string;
  params?: Record<string, unknown>;
}

interface LightingPreset {
  name: string;
  description: string;
  icon: React.ReactNode;
  commands: LightingCommand[];
}

const TouchscreenLighting: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [executingCommand, setExecutingCommand] = useState<string | null>(null);

  // Eye interaction states
  const [eyeState, setEyeState] = useState<'idle' | 'watching' | 'flash'>('idle');
  const [lookAtPosition, setLookAtPosition] = useState<{ x: number; y: number } | null>(null);

  // Predefined lighting presets for quick control
  const lightingPresets: LightingPreset[] = [
    {
      name: "All Lights On",
      description: "Turn on all room lighting",
      icon: <Lightbulb className="w-8 h-8" />,
      commands: [
        { device_id: "study_lights", action: "set_brightness", params: { value: 255 } },
        { device_id: "boiler_lights", action: "set_brightness", params: { value: 255 } },
        { device_id: "lab_lights_squares", action: "set_squares_brightness", params: { value: 255 } },
        { device_id: "lab_lights_grates", action: "set_grates_brightness", params: { value: 255 } },
        { device_id: "sconces", action: "sconces_on" },
        { device_id: "crawlspace_lights", action: "crawlspace_on" }
      ]
    },
    {
      name: "All Lights Off",
      description: "Turn off all room lighting",
      icon: <Power className="w-8 h-8" />,
      commands: [
        { device_id: "study_lights", action: "set_brightness", params: { value: 0 } },
        { device_id: "boiler_lights", action: "set_brightness", params: { value: 0 } },
        { device_id: "lab_lights_squares", action: "set_squares_brightness", params: { value: 0 } },
        { device_id: "lab_lights_grates", action: "set_grates_brightness", params: { value: 0 } },
        { device_id: "sconces", action: "sconces_off" },
        { device_id: "crawlspace_lights", action: "crawlspace_off" }
      ]
    }
  ];

  useEffect(() => {
    // Touchscreen operates in standalone mode - no API calls needed
    // Just set loading to false immediately
    setLoading(false);
  }, []);

  const executeCommand = async (deviceId: string, action: string, params?: Record<string, unknown>) => {
    const commandKey = `${deviceId}-${action}`;

    try {
      setExecutingCommand(commandKey);

      // Build MQTT topic directly - touchscreen operates in standalone mode
      // Topic format: paragon/clockwork/commands/{controller}/{device}/{action}
      const topic = `paragon/clockwork/commands/main_lighting/${deviceId}/${action}`;
      const payload = {
        ...params,
        timestamp: Date.now()
      };

      // Publish via unauthenticated touchscreen MQTT endpoint
      await mqtt.touchscreenPublish(topic, payload);
      toast.success(`${deviceId} command executed`);

    } catch (error) {
      console.error(`Failed to execute ${action} on ${deviceId}:`, error);
      toast.error(`Command failed - check connection`);
    } finally {
      setExecutingCommand(null);
    }
  };

  const executePreset = async (preset: LightingPreset, event: React.MouseEvent<HTMLButtonElement>) => {
    try {
      setExecutingCommand(`preset-${preset.name}`);
      
      // Make eye look at the button that was pressed
      const buttonRect = event.currentTarget.getBoundingClientRect();
      const buttonCenterX = buttonRect.left + buttonRect.width / 2;
      const buttonCenterY = buttonRect.top + buttonRect.height / 2;
      setLookAtPosition({ x: buttonCenterX, y: buttonCenterY });
      setEyeState('watching');
      
      toast.loading(`Executing ${preset.name}...`, { duration: 2000 });
      
      // Execute commands sequentially with small delay
      for (const command of preset.commands) {
        await executeCommand(command.device_id, command.action, command.params);
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      // Flash recognition when complete
      setEyeState('flash');
      setTimeout(() => {
        setEyeState('idle');
        setLookAtPosition(null);
      }, 300);
      
      toast.success(`${preset.name} completed`);
    } catch (error) {
      console.error('Failed to execute preset:', error);
      toast.error(`Failed to execute ${preset.name}`);
      setEyeState('idle');
      setLookAtPosition(null);
    } finally {
      setExecutingCommand(null);
    }
  };



  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-white text-xl">Loading lighting controls...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black overflow-hidden relative">
      {/* Animated Background - match Login screen exactly */}
      <div className="fixed top-0 left-0 w-full h-full z-0 pointer-events-none">
        {/* Gradient Background */}
        <div
          className="absolute w-full h-full"
          style={{
            background: "linear-gradient(45deg, rgb(0, 255, 255), transparent, rgb(255, 0, 255), transparent, rgb(0, 255, 255))",
            animation: "10s linear infinite border-glow"
          }}
        />

        {/* Subtle brushed texture lines */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'repeating-linear-gradient(320deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 1px, rgba(0,0,0,0) 1px, rgba(0,0,0,0) 4px)',
            mixBlendMode: 'soft-light',
            opacity: 0.25,
            filter: 'contrast(110%)'
          }}
        />

        {/* Slow fade to black overlay (keeps scan line above) */}
        <div
          className="absolute inset-0 bg-black"
          style={{ animation: 'bg-fade 12s ease-in-out infinite' }}
        />


        {/* Scanning Line Effect (slightly faster) */}
        <div
          className="absolute w-full h-0.5 bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent top-0"
          style={{ animation: 'scan-vertical 6s linear infinite' }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 p-6">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-[120px] h-[120px] mx-auto mb-8">
          <NeuralEyeLogo 
            eyeState={eyeState}
            lookAtPosition={lookAtPosition}
            isExecuting={executingCommand !== null}
          />
        </div>
        <h1
          className="text-5xl tracking-[12px] mb-2"
          style={{
            fontWeight: 400,
            background: 'linear-gradient(90deg, #ff00ff, #00ffff, #ffff00, #00ff00, #ff00ff)',
            backgroundSize: '200% 100%',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            animation: 'gradient-slide 6s ease-in-out infinite',
            textShadow: '0 0 60px rgba(0, 255, 255, 0.3)'
          }}
        >
          SENTIENT
        </h1>
        <p className="text-xs text-gray-500 uppercase tracking-[4px] font-light mb-6">
          Escape Room Neural Engine
        </p>
        <h2 className="text-xl font-semibold text-cyan-400 mb-4">Clockwork Lighting Control</h2>
      </div>

      {/* Lighting Control Buttons */}
      <div className="mb-8 relative z-10" style={{ isolation: 'isolate' }}>
        {/* Opaque panel to occlude background scan line behind buttons */}
        <div className="relative max-w-4xl mx-auto rounded-3xl border border-cyan-500/20 overflow-hidden shadow-[0_30px_80px_rgba(0,0,0,0.6)]">
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(135deg, rgba(10, 10, 10, 0.98) 0%, rgba(20, 20, 20, 0.98) 100%)',
              backdropFilter: 'blur(8px)'
            }}
          />
          <div className="relative grid grid-cols-2 gap-6 p-6">
          {lightingPresets.map((preset) => (
            <button
              key={preset.name}
              onClick={(e) => executePreset(preset, e)}
              disabled={executingCommand?.startsWith('preset')}
              className="relative py-8 px-8 border border-cyan-500/30 rounded-2xl text-white font-semibold uppercase tracking-wider transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden group hover:transform hover:-translate-y-1"
              style={{
                background: preset.name === "All Lights On" 
                  ? 'linear-gradient(135deg, rgba(0, 255, 255, 0.25), rgba(0, 153, 204, 0.25))'
                  : 'linear-gradient(135deg, rgba(255, 0, 255, 0.25), rgba(153, 0, 204, 0.25))'
              }}
              onMouseEnter={(e) => {
                if (!executingCommand) {
                  e.currentTarget.style.boxShadow = preset.name === "All Lights On"
                    ? '0 15px 40px rgba(0, 255, 255, 0.3), 0 5px 15px rgba(0, 0, 0, 0.4)'
                    : '0 15px 40px rgba(255, 0, 255, 0.3), 0 5px 15px rgba(0, 0, 0, 0.4)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {/* Animated gradient overlay */}
              <div 
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{
                  background: preset.name === "All Lights On"
                    ? 'linear-gradient(135deg, rgba(0, 255, 255, 0.3), rgba(0, 153, 204, 0.3))'
                    : 'linear-gradient(135deg, rgba(255, 0, 255, 0.3), rgba(153, 0, 204, 0.3))'
                }}
              />
              
              <div className="relative z-10 flex flex-col items-center gap-4">
                {executingCommand === `preset-${preset.name}` ? (
                  <Loader2 className="w-10 h-10 animate-spin" />
                ) : (
                  preset.icon
                )}
                <div className="text-center">
                  <div className="text-2xl font-bold mb-1">{preset.name}</div>
                  <div className="text-xs opacity-70 uppercase tracking-wider">{preset.description}</div>
                </div>
              </div>
            </button>
          ))}
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-800 p-4 shadow-lg z-20">
        <div className="text-center">
          <p className="text-gray-300">
            Clockwork Corridor Lighting • 
            {executingCommand ? ' Executing command...' : ' Ready'}
          </p>
          <p className="text-gray-500 text-xs mt-1">
            © 2025 Paragon Escape Games. All Rights Reserved.
          </p>
        </div>
      </div>
      </div>

      {/* (Removed) Global sheen overlay to prevent color washout */}
    </div>
  );
};

// Digital Rain removed per request

// Neural Eye Logo Component - EXACT HTML version from reference
function NeuralEyeLogo(props: {
  eyeState?: 'idle' | 'watching' | 'flash';
  lookAtPosition?: { x: number; y: number } | null;
  isExecuting?: boolean;
}) {
  const { eyeState = 'idle', lookAtPosition = null } = props;
  const [pupilPosition, setPupilPosition] = React.useState({ x: 0, y: 0 });
  
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
    <div className="w-full h-full relative neural-eye-container" style={{ width: '120px', height: '120px' }}>
      {/* Neural Connections - 8 lines radiating out */}
      <div style={{ position: 'absolute', width: '100%', height: '100%', top: 0, left: 0, zIndex: 2 }}>
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              width: '75px',
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
          width: '120px',
          height: '120px',
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          borderRadius: '50%',
          border: '4px solid transparent',
          background: 'conic-gradient(from 0deg, #ff00ff, #00ffff, #ffff00, #00ff00, #ff00ff)',
          animation: 'rotate-iris 6s linear infinite',
          filter: 'brightness(1.2)',
          zIndex: 1
        }}
      >
        {/* Inner dark circle to create ring effect */}
        <div style={{
          position: 'absolute',
          width: 'calc(100% - 8px)',
          height: 'calc(100% - 8px)',
          top: '4px',
          left: '4px',
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
          width: '50px',
          height: '50px',
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
        width: '20px',
        height: '20px',
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
            width: '6px',
            height: '6px',
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

export default TouchscreenLighting;