import { isValidSolanaAddress, snapshotBaseline } from '@apecheck/core';
import type { WatchlistItem } from '@apecheck/core';
import { getServerSupabase, getUserId, getAdminSupabase } from '@/lib/supabase-server';
import { createSolanaRpc } from '@apecheck/api-clients';
import { scanConfig } from '@/lib/env';
import { rowToScanResult } from '@/lib/scan-cache';
import { ok, fail } from '@/lib/api-response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/watchlist — list the current user's watched tokens (+ latest cache meta). */
export async function GET() {
  const userId = await getUserId();
  if (!userId) return fail('UNAUTHORIZED', 'Sign in to view your watchlist.');

  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from('watchlist')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return fail('INTERNAL', error.message);

  // Enrich with cached scan meta (name/symbol/risk) in one query.
  const addresses = (data || []).map((w) => w.token_address);
  const metaMap = await loadScanMeta(addresses);

  const items: WatchlistItem[] = (data || []).map((w) => ({
    id: w.id,
    tokenAddress: w.token_address,
    devWalletAddress: w.dev_wallet_address,
    initialDevBalance: w.initial_dev_balance,
    alertEnabled: w.alert_enabled,
    createdAt: w.created_at,
    meta: metaMap[w.token_address],
  }));

  return ok(items);
}

/** POST /api/watchlist — add a token. Body: { tokenAddress }. 409 if already watching. */
export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return fail('UNAUTHORIZED', 'Sign in to save tokens.');

  let body: { tokenAddress?: string };
  try {
    body = await req.json();
  } catch {
    return fail('INVALID_ADDRESS', 'Body must be JSON.');
  }
  const tokenAddress = (body.tokenAddress || '').trim();
  if (!isValidSolanaAddress(tokenAddress)) return fail('INVALID_ADDRESS', 'Invalid address.');

  const supabase = getServerSupabase();

  // Capture the dev wallet + balance and the extended baseline (from the cached scan).
  const { devAddress, devBalance, baseline } = await captureBaseline(tokenAddress);

  const { data, error } = await supabase
    .from('watchlist')
    .insert({
      user_id: userId,
      token_address: tokenAddress,
      dev_wallet_address: devAddress,
      initial_dev_balance: devBalance,
      baseline,
      alert_enabled: true,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') return fail('CONFLICT', 'Already on your watchlist.');
    return fail('INTERNAL', error.message);
  }

  const item: WatchlistItem = {
    id: data.id,
    tokenAddress: data.token_address,
    devWalletAddress: data.dev_wallet_address,
    initialDevBalance: data.initial_dev_balance,
    alertEnabled: data.alert_enabled,
    createdAt: data.created_at,
  };
  return ok(item, { status: 201 });
}

// ─────────────────────────────────────────────────────────────
// helpers
// ─────────────────────────────────────────────────────────────

async function loadScanMeta(
  addresses: string[],
): Promise<Record<string, WatchlistItem['meta']>> {
  if (addresses.length === 0) return {};
  const admin = getAdminSupabase();
  const { data } = await admin
    .from('scans')
    .select('token_address, risk_score, potential_score, raw_data')
    .in('token_address', addresses);
  const map: Record<string, WatchlistItem['meta']> = {};
  for (const row of data || []) {
    const meta = row.raw_data?.meta;
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

async function captureBaseline(tokenAddress: string): Promise<{
  devAddress: string | null;
  devBalance: number | null;
  baseline: ReturnType<typeof snapshotBaseline> | null;
}> {
  const empty = { devAddress: null, devBalance: null, baseline: null };
  try {
    // Read the cached scan: its dev wallet + full result seed both baselines.
    const admin = getAdminSupabase();
    const { data } = await admin
      .from('scans')
      .select('dev_wallet_address, raw_data')
      .eq('token_address', tokenAddress)
      .maybeSingle();
    if (!data) return empty;

    const baseline = data.raw_data ? snapshotBaseline(rowToScanResult(data), Date.now()) : null;

    const devAddress: string | null = data.dev_wallet_address ?? null;
    if (!devAddress) return { devAddress: null, devBalance: null, baseline };

    const rpc = createSolanaRpc(scanConfig().rpcUrl);
    const balance = await rpc.getOwnerTokenBalance(devAddress, tokenAddress);
    return { devAddress, devBalance: balance, baseline };
  } catch {
    return empty;
  }
}
