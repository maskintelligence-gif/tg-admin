import { useState, useEffect } from 'react';
import { Zap, Delete, AlertCircle } from 'lucide-react';
import { ADMIN_PIN } from '../lib/supabase';

interface LoginProps {
  onLogin: () => void;
}

export function Login({ onLogin }: LoginProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);

  useEffect(() => {
    if (pin.length === ADMIN_PIN.length) {
      if (pin === ADMIN_PIN) {
        try { localStorage.setItem('tg_admin_auth', '1'); } catch {}
        onLogin();
      } else {
        setError(true);
        setShake(true);
        setTimeout(() => { setPin(''); setError(false); setShake(false); }, 700);
      }
    }
  }, [pin]);

  const handleDigit = (d: string) => {
    if (pin.length < ADMIN_PIN.length) setPin(p => p + d);
  };

  const handleDelete = () => setPin(p => p.slice(0, -1));

  const dots = Array.from({ length: ADMIN_PIN.length }, (_, i) => i);
  const keys = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: 'var(--bg)' }}>
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

      {/* PIN dots */}
      <div className={`flex gap-4 mb-8 ${shake ? 'animate-pulse' : ''}`}>
        {dots.map((i) => (
          <div key={i} className="w-4 h-4 rounded-full border-2 transition-all duration-150"
            style={{
              borderColor: error ? 'var(--rose)' : 'var(--accent)',
              background: pin.length > i
                ? (error ? 'var(--rose)' : 'var(--accent)')
                : 'transparent',
              boxShadow: pin.length > i && !error ? '0 0 10px var(--accent-glow)' : 'none',
            }} />
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-1.5 mb-4 text-sm" style={{ color: 'var(--rose)' }}>
          <AlertCircle size={14} /> Wrong PIN
        </div>
      )}

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
        {keys.map((key, i) => {
          if (key === '') return <div key={i} />;
          return (
            <button
              key={i}
              onClick={() => key === '⌫' ? handleDelete() : handleDigit(key)}
              className="flex items-center justify-center h-16 rounded-2xl text-xl font-semibold transition-all active:scale-95"
              style={{
                background: key === '⌫' ? 'transparent' : 'var(--surface)',
                border: `1px solid var(--border)`,
                color: key === '⌫' ? 'var(--text2)' : 'var(--text)',
                fontFamily: key === '⌫' ? 'inherit' : "'DM Mono', monospace",
              }}
            >
              {key === '⌫' ? <Delete size={20} /> : key}
            </button>
          );
        })}
      </div>

      <p className="mt-10 text-xs" style={{ color: 'var(--text3)' }}>
        Enter your {ADMIN_PIN.length}-digit PIN to access dashboard
      </p>
    </div>
  );
}
