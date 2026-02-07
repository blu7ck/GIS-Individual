import React, { useState } from 'react';
import { Lock, Mail, AlertCircle } from 'lucide-react';
import { Button } from '../common/Button';
import { createSupabaseClient } from '../../../lib/supabase';

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
    <div className="flex items-center justify-center min-h-screen relative overflow-hidden bg-engineering-bg text-white">
      {/* ========================================================================= */}
      {/* CSS-based GIS Background                                              */}
      {/* ========================================================================= */}
      <div className="absolute inset-0 z-0">
        {/* Base Grid */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: 'linear-gradient(var(--engineering-border) 1px, transparent 1px), linear-gradient(90deg, var(--engineering-border) 1px, transparent 1px)',
            backgroundSize: '40px 40px'
          }}
        />

        {/* Azure Glow (Top Left) */}
        <div className="absolute top-1/4 -left-1/4 w-[50vw] h-[50vw] bg-accent-azure/20 rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '8s' }} />

        {/* Orange Glow (Bottom Right) */}
        <div className="absolute bottom-1/4 -right-1/4 w-[50vw] h-[50vw] bg-accent-orange/10 rounded-full blur-[100px] animate-pulse" style={{ animationDuration: '10s' }} />

        {/* Cyan/Cam Böceği Pulse (Center) */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[30vw] h-[30vw] bg-accent-cyan/10 rounded-full blur-[80px] animate-ping" style={{ animationDuration: '4s' }} />
      </div>

      {/* Dark Overlay for contrast */}
      <div className="absolute inset-0 bg-engineering-bg/60 z-0 backdrop-blur-[2px]" />

      {/* ========================================================================= */}
      {/* Login Card                                                                */}
      {/* ========================================================================= */}
      <div className="relative z-10 w-full max-w-[400px] p-8 mx-4 overflow-hidden rounded-2xl shadow-glass border border-white/10 backdrop-blur-xl bg-white/5">

        {/* Card Header & GIS Graphic Placeholder */}
        <div className="flex flex-col items-center mb-8 relative">
          {/* Decorative Top Line */}
          <div className="absolute -top-8 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-accent-cyan to-transparent opacity-50" />

          <div className="mb-6 relative group">
            {/* Logo Container with Glow */}
            <div className="absolute inset-0 bg-accent-azure/20 rounded-full blur-xl group-hover:bg-accent-azure/40 transition-all duration-500" />
            <img
              src="/assets/logo.png"
              alt="Hekamap"
              className="h-20 w-20 relative z-10 object-contain drop-shadow-2xl opacity-90 group-hover:scale-105 transition-transform duration-500"
              onError={(e) => {
                // Fallback to text icon if image fails
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
              }}
            />
            {/* Fallback Icon if Image Missing (Hidden if image loads) */}
            <div className="hidden h-20 w-20 bg-gradient-to-br from-accent-azure to-accent-cyan rounded-xl flex items-center justify-center text-3xl font-bold shadow-lg">H</div>
          </div>

          <h1 className="text-2xl font-bold tracking-wider text-white bg-clip-text">
            WORKSPACE
          </h1>
          <div className="flex items-center gap-2 mt-2">
            <div className="h-px w-8 bg-gradient-to-r from-transparent to-accent-cyan" />
            <p className="text-xs text-accent-cyan uppercase tracking-[0.2em] font-medium">System Access</p>
            <div className="h-px w-8 bg-gradient-to-l from-transparent to-accent-cyan" />
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email Input */}
          <div className="group">
            <label className="block text-xs font-medium text-engineering-text-secondary mb-1.5 ml-1 group-focus-within:text-accent-azure transition-colors">
              Identity
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3 text-engineering-text-muted group-focus-within:text-accent-azure transition-colors" size={18} />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-engineering-panel/50 border border-engineering-border rounded-lg py-2.5 pl-10 pr-4 text-sm text-white placeholder-engineering-text-muted focus:ring-1 focus:ring-accent-azure focus:border-accent-azure outline-none transition-all duration-300 shadow-inner"
                placeholder="id@hekamap.com"
                required
              />
            </div>
          </div>

          {/* Password Input */}
          <div className="group">
            <label className="block text-xs font-medium text-engineering-text-secondary mb-1.5 ml-1 group-focus-within:text-accent-orange transition-colors">
              Passkey
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3 text-engineering-text-muted group-focus-within:text-accent-orange transition-colors" size={18} />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-engineering-panel/50 border border-engineering-border rounded-lg py-2.5 pl-10 pr-4 text-sm text-white placeholder-engineering-text-muted focus:ring-1 focus:ring-accent-orange focus:border-accent-orange outline-none transition-all duration-300 shadow-inner"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-start space-x-2 animate-in fade-in slide-in-from-top-1">
              <AlertCircle size={16} className="text-red-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-red-300 leading-snug">{error}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2">
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full relative overflow-hidden group bg-gradient-to-r from-accent-azure to-blue-600 hover:from-blue-500 hover:to-accent-azure text-white border-none shadow-lg shadow-blue-500/20 py-3 transition-all duration-300 transform hover:-translate-y-0.5"
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
              <span className="relative font-semibold tracking-wide flex items-center justify-center gap-2">
                {isLoading ? (
                  'Verifying...'
                ) : (
                  <>Initialize Session</>
                )}
              </span>
            </Button>
          </div>
        </form>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-white/5 text-center">
          <div className="flex justify-center items-center gap-4 mb-4 opacity-50">
            <div className="h-1 w-1 rounded-full bg-accent-orange animate-pulse" />
            <div className="h-1 w-1 rounded-full bg-accent-cyan animate-pulse delay-150" />
            <div className="h-1 w-1 rounded-full bg-accent-azure animate-pulse delay-300" />
          </div>
          <p className="text-[10px] text-engineering-text-muted uppercase tracking-widest font-mono">
            Hekamap Secure Environment
          </p>
        </div>
      </div>
    </div>
  );
};