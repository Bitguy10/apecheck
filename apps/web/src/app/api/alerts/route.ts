import type { AlertItem } from '@apecheck/core';
import { getServerSupabase, getUserId } from '@/lib/supabase-server';
import { ok, fail } from '@/lib/api-response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/alerts — triggered dev-wallet-dump alerts for the current user. */
export async function GET() {
  const userId = await getUserId();
  if (!userId) return fail('UNAUTHORIZED', 'Sign in to view alerts.');

  const supabase = getServerSupabase();
  // RLS restricts alerts to those whose parent watchlist row belongs to the user.
  const { data, error } = await supabase
    .from('alerts')
    .select('*')
    .order('triggered_at', { ascending: false })
    .limit(100);

  if (error) return fail('INTERNAL', error.message);

  const items: AlertItem[] = (data || []).map((a) => ({
    id: a.id,
    watchlistId: a.watchlist_id,
    tokenAddress: a.token_address,
    alertType: a.alert_type ?? 'dev_dump',
    title: a.title ?? null,
    body: a.body ?? null,
    detail: a.detail ?? null,
    triggeredAt: a.triggered_at,
    notified: a.notified,
    devWalletAddress: a.dev_wallet_address ?? null,
    balanceBefore: a.balance_before ?? null,
    balanceAfter: a.balance_after ?? null,
    percentDropped: a.percent_dropped ?? null,
  }));

  return ok(items);
}
