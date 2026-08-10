import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { registerForPushNotifications } from '../lib/push';

interface AuthState {
  session: Session | null;
  loading: boolean;
  email: string | null;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      // Register for push once signed in (best-effort).
      if (s?.user) registerForPushNotifications();
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const value: AuthState = {
    session,
    loading,
    email: session?.user?.email ?? null,
    async signIn(email: string, password: string) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        return { error: error.message.includes('Invalid') ? 'Wrong email or password.' : error.message };
      }
      return { error: null };
    },
    async signUp(email: string, password: string) {
      // Confirmations disabled on the Supabase project → sign-up returns a session immediately.
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) return { error: error.message };
      if (data.session) return { error: null };
      // Fallback: if the project still gates first sign-in, try an immediate login.
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
      return { error: signInErr?.message ?? null };
    },
    async signOut() {
      await supabase.auth.signOut();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
