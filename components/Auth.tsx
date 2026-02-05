import React, { useState } from 'react';
import { Lock, Mail, AlertCircle } from 'lucide-react';
import { Button } from './Button';
import { createSupabaseClient } from '../lib/supabase';

interface Props {
  supabaseUrl?: string;
  supabaseKey?: string;
  onLogin: (email: string, userId: string) => void;
  onError?: (error: string) => void;
}

export const Auth: React.FC<Props> = ({ supabaseUrl, supabaseKey, onLogin, onError }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Temporary dev credentials - TODO: Remove after Supabase setup
  const DEV_EMAIL = 'furkan@fixurelabs.dev';
  const DEV_PASSWORD = '1301';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    // Validate inputs
    if (!email || !password) {
      const errorMsg = 'Please enter both email and password.';
      setError(errorMsg);
      setIsLoading(false);
      return;
    }

    // DEV MODE: Check for hardcoded credentials when Supabase is not configured
    if (!supabaseUrl || !supabaseKey) {
      // Check dev credentials
      if (email.trim() === DEV_EMAIL && password === DEV_PASSWORD) {
        onLogin(DEV_EMAIL, 'dev-user-001');
        setIsLoading(false);
        return;
      } else {
        const errorMsg = 'Invalid credentials. (Dev Mode Active)';
        setError(errorMsg);
        if (onError) onError(errorMsg);
        setIsLoading(false);
        return;
      }
    }

    try {
      const supabase = createSupabaseClient(supabaseUrl, supabaseKey);

      // Authenticate with Supabase
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (authError) {
        const errorMsg = authError.message || 'Invalid email or password.';
        setError(errorMsg);
        if (onError) onError(errorMsg);
        setIsLoading(false);
        return;
      }

      if (data.user) {
        onLogin(data.user.email || email, data.user.id);
        setIsLoading(false);
      } else {
        throw new Error('Authentication failed');
      }
    } catch (err: any) {
      const errorMsg = err.message || 'An error occurred during authentication.';
      setError(errorMsg);
      if (onError) onError(errorMsg);
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen relative overflow-hidden">
      {/* Background Video */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      >
        <source src="/assets/workspace-header.webm" type="video/webm" />
      </video>
      {/* Dark overlay - reduced by 90% (from 80% to 8% opacity) */}
      <div className="absolute inset-0 bg-black/8 backdrop-blur-sm"></div>

      <div className="relative z-10 w-full max-w-md p-4 md:p-8 bg-carta-deep-800/40 backdrop-blur-xl rounded-2xl shadow-2xl border border-carta-mist-700/30 mx-4">
        <div className="flex flex-col items-center mb-8">
          {/* Logo - Responsive sizing for mobile */}
          <div className="mb-3 md:mb-4 relative">
            <img
              src="/assets/logo.png"
              alt="WORKSPACE"
              className="h-[120px] w-[120px] md:h-[200px] md:w-[200px] object-contain drop-shadow-2xl transition-transform duration-300 hover:scale-105"
              loading="eager"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
              }}
            />
          </div>
          <h1 className="text-xl md:text-3xl font-bold text-white tracking-tight mb-2 bg-gradient-to-r from-white via-carta-mist-200 to-white bg-clip-text text-transparent">
            WORKSPACE
          </h1>
          <p className="text-carta-mist-400 mt-2 text-xs md:text-sm text-center">Secure 3D Geospatial Asset Management</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-carta-mist-300 mb-1 ml-1">Email Access</label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 text-carta-mist-500" size={18} />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-carta-deep-900/50 backdrop-blur-sm border border-carta-mist-700/30 rounded-lg py-2.5 pl-10 text-white placeholder-carta-mist-500 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                placeholder="authorized@company.com"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-carta-mist-300 mb-1 ml-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 text-carta-mist-500" size={18} />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-carta-deep-900/50 backdrop-blur-sm border border-carta-mist-700/30 rounded-lg py-2.5 pl-10 text-white placeholder-carta-mist-500 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-3 flex items-start space-x-2">
              <AlertCircle size={16} className="text-red-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-red-300">{error}</p>
            </div>
          )}

          <Button
            type="submit"
            className="w-full py-3 mt-2 text-base shadow-lg shadow-emerald-900/40"
            disabled={isLoading}
          >
            {isLoading ? 'Authenticating...' : 'Authenticate Session'}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-[10px] text-gray-500">
            Restricted System. All activities are monitored and logged.
            <br />
            Powered by FixureLabs.
          </p>
        </div>
      </div>
    </div>
  );
};