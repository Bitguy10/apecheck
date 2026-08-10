import type { WalletScanHistoryItem } from '@apecheck/core';
import { getServerSupabase, getUserId } from '@/lib/supabase-server';
import { ok, fail } from '@/lib/api-response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/wallet-scan-history — the current user's scanned wallets (deduped, newest first). */
export async function GET() {
  const userId = await getUserId();
  if (!userId) return ok([]); // anonymous users keep wallet history locally on the client

  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from('wallet_scan_history')
    .select('*')
    .order('scanned_at', { ascending: false })
    .limit(50);

  if (error) return fail('INTERNAL', error.message);

  // Dedupe by wallet (keep newest scan of each).
  const seen = new Set<string>();
  const items: WalletScanHistoryItem[] = [];
  for (const r of data || []) {
    if (seen.has(r.wallet_address)) continue;
    seen.add(r.wallet_address);
    items.push({
      id: r.id,
      walletAddress: r.wallet_address,
      scannedAt: r.scanned_at,
      summary: r.summary ?? undefined,
    });
  }

  return ok(items);
}
