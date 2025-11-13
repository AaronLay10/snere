import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import NeuralBackground from '../components/NeuralBackground';

export default function Login() {
  const navigate = useNavigate();
  const { login: authLogin } = useAuthStore();
  const [credentials, setCredentials] = useState({
    email: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await authLogin(credentials.email, credentials.password);
      // Redirect to dashboard
      navigate('/dashboard');
    } catch (err: any) {
      console.error('[Login] Login error:', err);
      setError(err.response?.data?.error || 'Invalid credentials. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center">
      {/* Animated Neural Background */}
      <NeuralBackground />

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-md px-6 animate-fade-in">
        {/* Logo / Title with Glow */}
        <div className="text-center mb-8 animate-slide-up">
          <div className="inline-block relative">
            {/* Pulsing glow rings */}
            <div className="pulse-ring w-32 h-32 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" />
            <div className="pulse-ring w-32 h-32 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ animationDelay: '1s' }} />

            {/* Brain/Neural Icon */}
            <div className="relative w-32 h-32 mx-auto mb-4">
              <svg
                viewBox="0 0 100 100"
                className="w-full h-full drop-shadow-[0_0_20px_rgba(0,171,255,0.6)]"
              >
                <circle cx="50" cy="50" r="45" fill="none" stroke="url(#neural-gradient)" strokeWidth="2" className="animate-pulse-slow" />
                <circle cx="30" cy="30" r="6" fill="#00abff" className="animate-pulse" />
                <circle cx="70" cy="30" r="6" fill="#00abff" className="animate-pulse" style={{ animationDelay: '0.3s' }} />
                <circle cx="50" cy="50" r="8" fill="#7300e6" className="animate-pulse" style={{ animationDelay: '0.6s' }} />
                <circle cx="30" cy="70" r="6" fill="#00abff" className="animate-pulse" style={{ animationDelay: '0.9s' }} />
                <circle cx="70" cy="70" r="6" fill="#00abff" className="animate-pulse" style={{ animationDelay: '1.2s' }} />

                {/* Neural connections */}
                <line x1="30" y1="30" x2="50" y2="50" stroke="#00abff" strokeWidth="1.5" opacity="0.6" />
                <line x1="70" y1="30" x2="50" y2="50" stroke="#00abff" strokeWidth="1.5" opacity="0.6" />
                <line x1="50" y1="50" x2="30" y2="70" stroke="#00abff" strokeWidth="1.5" opacity="0.6" />
                <line x1="50" y1="50" x2="70" y2="70" stroke="#00abff" strokeWidth="1.5" opacity="0.6" />

                <defs>
                  <linearGradient id="neural-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#00abff" />
                    <stop offset="100%" stopColor="#7300e6" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          </div>

          <h1 className="text-4xl font-bold mb-2">
            <span className="text-neural-glow">SENTIENT</span>
            <span className="text-gray-300"> ENGINE</span>
          </h1>
          <p className="text-gray-400 text-sm tracking-wider">GAMING NEURAL CONTROL SYSTEM</p>
        </div>

        {/* Login Form Card */}
        <div className="card-neural-glow">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email Input */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={credentials.email}
                onChange={(e) => setCredentials({ email: e.target.value, password: credentials.password })}
                className="input-neural"
                placeholder="admin@sentientengine.ai"
                required
                autoComplete="email"
                autoFocus
              />
            </div>

            {/* Password Input */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={credentials.password}
                onChange={(e) => setCredentials({ email: credentials.email, password: e.target.value })}
                className="input-neural"
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-neural-error-500/10 border border-neural-error-500 rounded-lg p-3 animate-fade-in">
                <p className="text-neural-error-400 text-sm">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="btn-neural w-full relative overflow-hidden group"
            >
              <span className="relative z-10 flex items-center justify-center">
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Authenticating...
                  </>
                ) : (
                  'Initialize Connection'
                )}
              </span>

              {/* Animated background glow */}
              <div className="absolute inset-0 bg-gradient-to-r from-neural-primary-500 to-neural-accent-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </button>
          </form>

          {/* Footer Info */}
          <div className="mt-6 pt-6 border-t border-neural-border">
            <p className="text-center text-xs text-gray-500">
              Powered by <span className="text-neural-primary-500">Neural AI</span> • Escape Room Orchestration Platform
            </p>
          </div>
        </div>

        {/* Version Badge */}
        <div className="mt-6 text-center">
          <span className="inline-block px-3 py-1 bg-neural-surface border border-neural-border rounded-full text-xs text-gray-400">
            Vite Frontend • v1.0.0
          </span>
        </div>
      </div>
    </div>
  );
}
