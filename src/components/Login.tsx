import { useState } from 'react';
import { Zap, Mail, Lock, AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface LoginProps {
  onLogin: () => void;
}

export function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    setError('');

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (authError) {
      setError(
        authError.message === 'Invalid login credentials'
          ? 'Wrong email or password. Try again.'
          : authError.message
      );
      setLoading(false);
      return;
    }

    onLogin();
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: 'var(--bg)' }}>

      {/* Logo */}
      <div className="mb-10 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
          style={{ background: 'var(--accent)', boxShadow: '0 0 32px var(--accent-glow)' }}>
          <Zap size={28} color="white" fill="white" />
        </div>
        <h1 className="font-display text-2xl font-bold tracking-tight" style={{ color: 'var(--text)' }}>
          TOOROGADGETS
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text2)' }}>Admin Dashboard</p>
      </div>

      {/* Form */}
      <div className="w-full max-w-sm space-y-3">

        {/* Email */}
        <div className="relative">
          <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: 'var(--text3)' }} />
          <input
            type="email"
            value={email}
            onChange={e => { setEmail(e.target.value); setError(''); }}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            placeholder="Admin email"
            autoComplete="email"
            inputMode="email"
            className="w-full pl-11 pr-4 py-4 rounded-2xl text-sm focus:outline-none transition-all"
            style={{
              background: 'var(--surface)',
              color: 'var(--text)',
              border: `1px solid ${error ? 'var(--rose)' : 'var(--border)'}`,
            }}
          />
        </div>

        {/* Password */}
        <div className="relative">
          <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: 'var(--text3)' }} />
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={e => { setPassword(e.target.value); setError(''); }}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            placeholder="Password"
            autoComplete="current-password"
            className="w-full pl-11 pr-12 py-4 rounded-2xl text-sm focus:outline-none transition-all"
            style={{
              background: 'var(--surface)',
              color: 'var(--text)',
              border: `1px solid ${error ? 'var(--rose)' : 'var(--border)'}`,
            }}
          />
          <button
            type="button"
            onClick={() => setShowPassword(v => !v)}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-1"
            style={{ color: 'var(--text3)' }}>
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl"
            style={{ background: 'var(--rose)15', border: '1px solid var(--rose)30' }}>
            <AlertCircle size={14} style={{ color: 'var(--rose)' }} />
            <p className="text-sm" style={{ color: 'var(--rose)' }}>{error}</p>
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2 transition-all active:scale-98"
          style={{
            background: 'var(--accent)',
            color: 'white',
            opacity: loading ? 0.7 : 1,
            boxShadow: '0 0 24px var(--accent-glow)',
          }}>
          {loading
            ? <><Loader2 size={18} className="animate-spin" /> Signing in…</>
            : 'Sign In'}
        </button>
      </div>

      <p className="mt-10 text-xs text-center max-w-xs" style={{ color: 'var(--text3)' }}>
        Use the admin account created in your Supabase dashboard.
        Not your personal email.
      </p>
    </div>
  );
}
