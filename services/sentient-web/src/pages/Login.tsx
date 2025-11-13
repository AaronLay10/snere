import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import NeuralEyeLogo from '../components/NeuralEyeLogo';

export default function Login() {
  const navigate = useNavigate();
  const { login: authLogin, isLoading: authLoading, error: authError } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess(false);

    if (!email || !password) {
      return;
    }

    try {
      await authLogin(email, password);
      setSuccess(true);
      setTimeout(() => navigate('/dashboard'), 500);
    } catch (err) {
      // Error is handled by authStore
    }
  };

  return (
    <div className="min-h-screen bg-black overflow-hidden relative">
      {/* Animated Background */}
      <div className="fixed top-0 left-0 w-full h-full z-0">
        {/* Gradient Background */}
        <div
          className="absolute w-full h-full"
          style={{
            background: 'radial-gradient(ellipse at center top, rgba(0, 255, 255, 0.05) 0%, transparent 50%), radial-gradient(ellipse at center bottom, rgba(255, 0, 255, 0.05) 0%, transparent 50%)',
            animation: 'gradient-shift 10s ease-in-out infinite'
          }}
        />

        {/* Scanning Line Effect */}
        <div
          className="absolute w-full h-0.5 bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent top-0"
          style={{ animation: 'scan-vertical 8s linear infinite' }}
        />

        {/* Digital Rain Effect */}
        <DigitalRain />
      </div>

      {/* Main Login Container */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-5">
        <div
          className="w-full max-w-[500px] relative"
          style={{ animation: 'box-appear 1s ease-out' }}
        >
          {/* Login Box */}
          <div
            className="relative overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, rgba(10, 10, 10, 0.95) 0%, rgba(20, 20, 20, 0.95) 100%)',
              backdropFilter: 'blur(30px)',
              border: '1px solid rgba(0, 255, 255, 0.2)',
              borderRadius: '30px',
              padding: '60px 50px',
              boxShadow: '0 30px 80px rgba(0, 0, 0, 0.8), 0 0 150px rgba(0, 255, 255, 0.05), inset 0 0 100px rgba(0, 255, 255, 0.02)'
            }}
          >
            {/* Border Glow Animation */}
            <div
              className="absolute -inset-[2px] rounded-[30px] opacity-0 -z-10"
              style={{
                background: 'linear-gradient(45deg, #00ffff, transparent, #ff00ff, transparent, #00ffff)',
                animation: 'border-glow 4s linear infinite'
              }}
            />

            {/* Loading Overlay */}
            {authLoading && (
              <div className="absolute inset-0 bg-black/80 backdrop-blur-sm rounded-[30px] z-50 flex items-center justify-center">
                <div style={{ animation: 'loading-pulse 1s ease-in-out infinite' }}>
                  <NeuralEyeLoader />
                </div>
              </div>
            )}

            {/* Logo Section */}
            <div className="text-center mb-12">
              <div className="w-[120px] h-[120px] mx-auto mb-6">
                <NeuralEyeLogo />
              </div>
              <h1
                className="text-[42px] font-extralight tracking-[12px] mb-2"
                style={{
                  background: 'linear-gradient(90deg, #00ffff, #ff00ff, #00ffff)',
                  backgroundSize: '200% 100%',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  animation: 'gradient-slide 4s ease-in-out infinite',
                  textShadow: '0 0 40px rgba(0, 255, 255, 0.3)'
                }}
              >
                SENTIENT
              </h1>
              <p
                className="text-[10px] text-gray-400 uppercase tracking-[4px]"
                style={{ animation: 'fade-in 2s ease-out' }}
              >
                Escape Room Neural Engine
              </p>
            </div>

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="mt-10">
              {/* Email Input */}
              <div className="mb-7">
                <label className="block text-[10px] uppercase tracking-wider text-cyan-400 mb-2.5 opacity-70">
                  Identity Signature
                </label>
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Username or Email"
                  className="input-neural"
                  style={{ fontSize: '15px' }}
                  autoComplete="email"
                />
              </div>

              {/* Password Input */}
              <div className="mb-7">
                <label className="block text-[10px] uppercase tracking-wider text-cyan-400 mb-2.5 opacity-70">
                  Access Cipher
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter Access Code"
                    className="input-neural pr-12"
                    style={{ fontSize: '15px' }}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-cyan-400 opacity-50 hover:opacity-100 transition-opacity"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={authLoading}
                className="w-full py-4 border border-cyan-500/30 rounded-xl text-black text-sm font-semibold uppercase tracking-wider transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden hover:transform hover:-translate-y-0.5"
                style={{
                  background: 'linear-gradient(135deg, rgba(0, 255, 255, 0.9), rgba(0, 153, 204, 0.9))'
                }}
                onMouseEnter={(e) => {
                  if (!authLoading) {
                    e.currentTarget.style.boxShadow = '0 15px 40px rgba(0, 255, 255, 0.4), 0 5px 15px rgba(0, 0, 0, 0.4)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <span className="relative z-10">
                  {authLoading ? 'Synchronizing...' : 'Establish Neural Link'}
                </span>
              </button>

              {/* Status Message */}
              {authError && (
                <div
                  className="mt-6 p-3.5 rounded-xl text-xs text-center bg-red-500/10 border border-red-500/30 text-red-400"
                  style={{ animation: 'status-appear 0.5s ease-out' }}
                >
                  {authError}
                </div>
              )}

              {success && (
                <div
                  className="mt-6 p-3.5 rounded-xl text-xs text-center bg-green-500/10 border border-green-500/30 text-green-400"
                  style={{ animation: 'status-appear 0.5s ease-out' }}
                >
                  Consciousness synchronized. Accessing sentient core...
                </div>
              )}
            </form>

            {/* Footer */}
            <div className="mt-10 pt-6 border-t border-white/5 text-center">
              <p className="text-[11px] text-gray-700 tracking-wide">
                Not authorized?{' '}
                <a href="#" className="text-cyan-400 uppercase tracking-wide hover:text-magenta-500 transition-colors">
                  Request Access
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Digital Rain Component
function DigitalRain() {
  const columns = [
    { chars: ['S', '3', 'N', '7', '1', 'E', 'N', '7'], left: '5%', delay: '0s' },
    { chars: ['0', '1', '1', '0', '1', '0', '0', '1'], left: '15%', delay: '2s' },
    { chars: ['E', 'Y', '3', 'S', 'E', 'E', '1', 'N'], left: '25%', delay: '1s' },
    { chars: ['1', '0', '0', '1', '1', '1', '0', '1'], left: '35%', delay: '3s' },
    { chars: ['A', 'W', 'A', 'R', '3', 'A', 'I', '0'], left: '45%', delay: '2.5s' },
    { chars: ['0', '1', '0', '1', '1', '0', '1', '1'], left: '55%', delay: '0.5s' },
    { chars: ['M', '1', 'N', 'D', '7', 'H', '3', '0'], left: '65%', delay: '1.5s' },
    { chars: ['1', '1', '0', '0', '1', '0', '1', '1'], left: '75%', delay: '3.5s' },
    { chars: ['W', 'A', 'T', 'C', 'H', '1', 'N', 'G'], left: '85%', delay: '2.2s' },
    { chars: ['0', '0', '1', '1', '0', '1', '0', '1'], left: '95%', delay: '1.8s' },
  ];

  return (
    <div className="absolute w-full h-full opacity-10 pointer-events-none">
      {columns.map((column, i) => (
        <div
          key={i}
          className="absolute w-5 h-full -top-full"
          style={{
            left: column.left,
            animationDelay: column.delay,
            animationDuration: '15s',
            animation: 'rain-fall 15s linear infinite'
          }}
        >
          {column.chars.map((char, j) => (
            <div
              key={j}
              className="text-cyan-400 font-mono text-sm my-1.5"
              style={{
                textShadow: '0 0 10px currentColor',
                opacity: 0,
                animation: `char-glow 2s ease-in-out infinite`,
                animationDelay: j % 2 === 0 ? '0.5s' : '1s'
              }}
            >
              {char}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// Loading Eye Component
function NeuralEyeLoader() {
  return (
    <div
      className="w-[60px] h-[60px] relative"
      style={{ animation: 'loading-pulse 1s ease-in-out infinite' }}
    >
      <div
        className="w-full h-full border-[3px] border-cyan-400 rounded-full"
        style={{ animation: 'rotate 2s linear infinite' }}
      />
      <div
        className="absolute w-5 h-5 bg-cyan-400 rounded-full top-1/2 left-1/2"
        style={{
          transform: 'translate(-50%, -50%)',
          boxShadow: '0 0 20px #00ffff'
        }}
      />
    </div>
  );
}
