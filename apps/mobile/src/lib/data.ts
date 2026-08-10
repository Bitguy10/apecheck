import type { WatchlistItem, AlertItem } from '@apecheck/core';
import { supabase } from './supabase';

/**
 * User-scoped data access via Supabase (RLS-protected). Mirrors the web API's
 * watchlist/alerts contract but talks to the DB directly from the app.
 */

export async function getWatchlist(): Promise<WatchlistItem[]> {
  const { data, error } = await supabase
    .from('watchlist')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;

  const rows = data ?? [];
  const addresses = rows.map((w) => w.token_address);
  const metaMap = await loadScanMeta(addresses);

  return rows.map((w) => ({
    id: w.id,
    tokenAddress: w.token_address,
    devWalletAddress: w.dev_wallet_address,
    initialDevBalance: w.initial_dev_balance,
    alertEnabled: w.alert_enabled,
    createdAt: w.created_at,
    meta: metaMap[w.token_address],
  }));
}

export async function isWatched(tokenAddress: string): Promise<WatchlistItem | null> {
  const { data, error } = await supabase
    .from('watchlist')
    .select('*')
    .eq('token_address', tokenAddress)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id,
    tokenAddress: data.token_address,
    devWalletAddress: data.dev_wallet_address,
    initialDevBalance: data.initial_dev_balance,
    alertEnabled: data.alert_enabled,
    createdAt: data.created_at,
  };
}

export async function addWatch(tokenAddress: string): Promise<WatchlistItem> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('Not signed in');

  // Seed dev wallet from the global scan cache (baseline balance is captured by the cron on first run).
  const { data: scan } = await supabase
    .from('scans')
    .select('dev_wallet_address')
    .eq('token_address', tokenAddress)
    .maybeSingle();

  const { data, error } = await supabase
    .from('watchlist')
    .insert({
      user_id: userId,
      token_address: tokenAddress,
      dev_wallet_address: scan?.dev_wallet_address ?? null,
      alert_enabled: true,
    })
    .select()
    .single();
  if (error) throw error;

  return {
    id: data.id,
    tokenAddress: data.token_address,
    devWalletAddress: data.dev_wallet_address,
    initialDevBalance: data.initial_dev_balance,
    alertEnabled: data.alert_enabled,
    createdAt: data.created_at,
  };
}

export async function removeWatch(id: string): Promise<void> {
  const { error } = await supabase.from('watchlist').delete().eq('id', id);
  if (error) throw error;
}

export async function setAlertEnabled(id: string, enabled: boolean): Promise<void> {
  const { error } = await supabase.from('watchlist').update({ alert_enabled: enabled }).eq('id', id);
  if (error) throw error;
}

export async function getAlerts(): Promise<AlertItem[]> {
  const { data, error } = await supabase
    .from('alerts')
    .select('*')
    .order('triggered_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []).map((a) => ({
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
}

/** Register an Expo push token for the signed-in user. */
export async function registerPushToken(token: string, platform: 'ios' | 'android'): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return;
  await supabase.from('push_tokens').upsert(
    { user_id: userId, token, platform },
    { onConflict: 'user_id,token' },
  );
}

// ─────────────────────────────────────────────────────────────
// helpers
// ─────────────────────────────────────────────────────────────

async function loadScanMeta(addresses: string[]): Promise<Record<string, WatchlistItem['meta']>> {
  if (addresses.length === 0) return {};
  const { data } = await supabase
    .from('scans')
    .select('token_address, risk_score, potential_score, raw_data')
    .in('token_address', addresses);
  const map: Record<string, WatchlistItem['meta']> = {};
  for (const row of data ?? []) {
    const meta = (row as any).raw_data?.meta;
    map[row.token_address] = {
      address: row.token_address,
      name: meta?.name ?? null,
      symbol: meta?.symbol ?? null,
      imageUrl: meta?.imageUrl ?? null,
      riskScore: row.risk_score ?? undefined,
      potentialScore: row.potential_score ?? undefined,
    };
  }
  return map;
}
