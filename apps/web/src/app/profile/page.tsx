'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Profile } from '@apecheck/core';
import { getBrowserSupabase } from '@/lib/supabase-client';
import { api, ApiClientError } from '@/lib/api';

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    setNeedsAuth(false);
    try {
      setProfile(await api.getProfile());
    } catch (e) {
      if (e instanceof ApiClientError && e.status === 401) setNeedsAuth(true);
      else setError(e instanceof Error ? e.message : 'Failed to load profile.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) return <div className="py-10"><div className="h-40 animate-pulse rounded-xl border border-border bg-panel/40" /></div>;

  if (needsAuth) {
    return (
      <div className="py-10">
        <div className="rounded-lg border border-dashed border-border bg-panel/40 p-8 text-center">
          <div className="text-3xl">🔒</div>
          <h2 className="mt-2 font-display text-lg font-bold text-text-primary">Sign in to view your profile</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-text-secondary">Manage your account, password, and plan.</p>
          <Link href="/login?next=/profile" className="mt-3 inline-block font-mono text-xs text-signal-green hover:underline">
            → sign in / sign up
          </Link>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="py-10">
        <div className="rounded-lg border border-rug-red/40 bg-rug-red/5 p-6 text-center text-sm text-rug-red">
          {error || 'Profile unavailable.'}
        </div>
      </div>
    );
  }

  const initial = (profile.email?.trim().charAt(0) || '?').toUpperCase();

  return (
    <div className="py-6">
      <h1 className="mb-4 font-display text-2xl font-bold text-text-primary">Profile settings</h1>

      {/* Account header */}
      <section className="rounded-xl border border-border bg-panel/60 p-5">
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-solana-purple/20 font-display text-xl font-bold text-solana-purple">
            {initial}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate font-display text-lg font-bold text-text-primary">{profile.email}</div>
            <div className="mt-1 flex items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">account type</span>
              {profile.accountType === 'PRO' ? (
                <span className="rounded-full border border-solana-purple/50 bg-solana-purple/15 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-solana-purple">★ pro</span>
              ) : (
                <span className="rounded-full border border-border bg-panel-2 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-text-muted">regular</span>
              )}
            </div>
          </div>
          {profile.accountType === 'REGULAR' && (
            <div className="flex flex-col items-stretch gap-1.5">
              <Link
                href="/pro"
                className="rounded-lg bg-gradient-to-r from-solana-purple to-signal-green px-4 py-2 text-center font-display text-sm font-bold text-white transition-transform hover:scale-[1.03]"
              >
                ⚡ PRO Upgrade
              </Link>
              <Link href="/pro" className="text-center font-mono text-[10px] text-text-muted hover:text-signal-green">
                See PRO benefits →
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Email + security */}
      <section className="mt-4 rounded-xl border border-border bg-panel/60 p-5">
        <h2 className="mb-3 font-mono text-[10px] uppercase tracking-widest text-text-muted">email</h2>

        <Field label="Email address">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-text-primary">{profile.email}</span>
            {profile.emailVerified ? (
              <span className="rounded-full border border-signal-green/40 bg-signal-green/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-signal-green">verified</span>
            ) : (
              <span className="rounded-full border border-warning-amber/40 bg-warning-amber/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-warning-amber">unverified</span>
            )}
          </div>
        </Field>

        <div className="my-3 h-px bg-border/60" />

        <PasswordSection hasPassword={profile.hasPassword} />
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 py-1">
      <span className="font-mono text-[11px] text-text-muted">{label}</span>
      {children}
    </div>
  );
}

/**
 * Set or change the account password. Works for OAuth-only users too — Supabase
 * adds an email/password identity when a Google user sets a password here, so
 * they can subsequently sign in with either method.
 */
function PasswordSection({ hasPassword }: { hasPassword: boolean }) {
  const [editing, setEditing] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  // Track set/unset locally: the `hasPassword` prop is fetched once on load and
  // won't update after we set a password, so the row would otherwise still read
  // "not set" right next to the "✓ updated" note. Flip it on a successful save.
  const [isSet, setIsSet] = useState(hasPassword);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) return setError('Password must be at least 6 characters.');
    if (password !== confirm) return setError('Passwords do not match.');

    setBusy(true);
    try {
      const { error: err } = await getBrowserSupabase().auth.updateUser({ password });
      if (err) {
        setError(err.message);
        return;
      }
      setIsSet(true);
      setDone(true);
      setEditing(false);
      setPassword('');
      setConfirm('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Field label="Password">
        {!editing && (
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm text-text-primary">{isSet ? '••••••••' : 'not set'}</span>
            <button
              onClick={() => {
                setEditing(true);
                setDone(false);
              }}
              className="font-mono text-[11px] text-signal-green transition-colors hover:underline"
            >
              {isSet ? 'Change password' : 'Set password'}
            </button>
          </div>
        )}
      </Field>

      {done && !editing && (
        <p className="mt-1 font-mono text-[11px] text-signal-green">✓ Password updated. You can now sign in with email + password.</p>
      )}

      {editing && (
        <form onSubmit={save} className="mt-2 space-y-2">
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="new password"
            className="w-full rounded-md border border-border bg-jungle-black px-3 py-2 font-mono text-sm text-text-primary outline-none focus:border-solana-purple"
          />
          <input
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="confirm password"
            className="w-full rounded-md border border-border bg-jungle-black px-3 py-2 font-mono text-sm text-text-primary outline-none focus:border-solana-purple"
          />
          {error && <p className="text-xs text-rug-red">{error}</p>}
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded-md bg-solana-purple px-3 py-1.5 font-display text-sm font-bold text-white transition-transform hover:scale-[1.02] disabled:opacity-50"
            >
              {busy ? 'saving…' : 'Save password'}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setError(null);
                setPassword('');
                setConfirm('');
              }}
              className="rounded-md border border-border px-3 py-1.5 font-mono text-xs text-text-muted hover:text-text-secondary"
            >
              cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
