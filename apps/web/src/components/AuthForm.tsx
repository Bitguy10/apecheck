'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getBrowserSupabase } from '@/lib/supabase-client';

type Mode = 'signin' | 'signup';

/**
 * Email + password auth. Instant login — no email confirmation step (the Supabase
 * project has "Confirm email" disabled), so a successful sign-up returns a session
 * immediately and we route the user straight in.
 */
export function AuthForm({ redirectTo = '/' }: { redirectTo?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function signInWithGoogle() {
    setError(null);
    setNotice(null);
    setGoogleLoading(true);
    try {
      const supabase = getBrowserSupabase();
      const callback = `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`;
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: callback },
      });
      // On success the browser is redirected to Google; nothing renders after.
      if (err) {
        setError(err.message);
        setGoogleLoading(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Google sign-in failed.');
      setGoogleLoading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    const supabase = getBrowserSupabase();

    try {
      if (mode === 'signup') {
        const { data, error: err } = await supabase.auth.signUp({ email, password });
        if (err) {
          setError(err.message);
          return;
        }
        // Confirmations disabled → session present immediately.
        if (data.session) {
          router.replace(redirectTo);
          router.refresh();
          return;
        }
        // Fallback: some projects still gate first sign-in — try an immediate login.
        const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
        if (signInErr) {
          setNotice('Account created. You can sign in now.');
          setMode('signin');
          return;
        }
        router.replace(redirectTo);
        router.refresh();
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) {
          setError(err.message.includes('Invalid') ? 'Wrong email or password.' : err.message);
          return;
        }
        router.replace(redirectTo);
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-4 flex rounded-lg border border-border bg-panel-2 p-1">
        {(['signin', 'signup'] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => {
              setMode(m);
              setError(null);
              setNotice(null);
            }}
            className={`flex-1 rounded-md px-3 py-1.5 font-mono text-xs uppercase tracking-wider transition-colors ${
              mode === m ? 'bg-signal-green/15 text-signal-green' : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            {m === 'signin' ? 'sign in' : 'sign up'}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={signInWithGoogle}
        disabled={googleLoading || loading}
        className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-border bg-panel-2 py-2.5 font-display text-sm font-semibold text-text-primary transition-colors hover:border-text-secondary/60 disabled:opacity-50"
      >
        <GoogleIcon />
        {googleLoading ? 'redirecting…' : `Continue with Google`}
      </button>

      <div className="my-4 flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">or {mode === 'signin' ? 'sign in' : 'sign up'} with email</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-text-muted">email</label>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="degen@wallet.sol"
            className="w-full rounded-md border border-border bg-jungle-black px-3 py-2 font-mono text-sm text-text-primary outline-none focus:border-solana-purple"
          />
        </div>
        <div>
          <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-text-muted">password</label>
          <input
            type="password"
            required
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full rounded-md border border-border bg-jungle-black px-3 py-2 font-mono text-sm text-text-primary outline-none focus:border-solana-purple"
          />
        </div>

        {error && <p className="rounded-md border border-rug-red/40 bg-rug-red/5 px-3 py-2 text-xs text-rug-red">{error}</p>}
        {notice && (
          <p className="rounded-md border border-signal-green/40 bg-signal-green/5 px-3 py-2 text-xs text-signal-green">
            {notice}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-solana-purple py-2.5 font-display text-sm font-bold text-white transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-50"
        >
          {loading ? 'working…' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>
      </form>

      <p className="mt-3 text-center font-mono text-[10px] text-text-muted">
        instant access · no email confirmation needed
      </p>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}
