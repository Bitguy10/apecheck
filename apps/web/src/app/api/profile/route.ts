import type { Profile, AccountType } from '@apecheck/core';
import { getServerSupabase, getAdminSupabase } from '@/lib/supabase-server';
import { ok, fail } from '@/lib/api-response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/profile — the signed-in user's account profile.
 * Combines the auth user (email, verification, identities) with the account_type
 * from the `profiles` table. `hasPassword` reflects whether an email/password
 * identity exists (Google-only users can set one from the profile page).
 */
export async function GET() {
  const supabase = getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return fail('UNAUTHORIZED', 'Sign in to view your profile.');

  // Ensure a profile row exists (trigger normally creates it) and read the tier.
  let accountType: AccountType = 'REGULAR';
  try {
    const admin = getAdminSupabase();
    const { data } = await admin
      .from('profiles')
      .upsert({ id: user.id }, { onConflict: 'id' })
      .select('account_type')
      .single();
    if (data?.account_type === 'PRO') accountType = 'PRO';
  } catch {
    /* default REGULAR if the profiles table isn't reachable */
  }

  const identities = user.identities || [];
  // A password may exist even when there's no separate "email" identity — e.g. a
  // Google user who set one from this page. Supabase doesn't always add an email
  // identity in that case, so we also stamp `has_password` into user_metadata on
  // save (see profile page) and honor either signal. Otherwise the row would
  // wrongly revert to "not set" on every refresh.
  const meta = (user.user_metadata as Record<string, unknown>) || {};
  const hasPassword = meta.has_password === true || identities.some((i) => i.provider === 'email');
  const emailVerified = !!(user.email_confirmed_at || (user.user_metadata as Record<string, unknown>)?.email_verified);

  const profile: Profile = {
    id: user.id,
    email: user.email ?? null,
    accountType,
    hasPassword,
    emailVerified,
    createdAt: user.created_at ?? null,
  };

  return ok(profile);
}
