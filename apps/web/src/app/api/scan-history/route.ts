import type { ScanHistoryItem } from '@apecheck/core';
import { getServerSupabase, getUserId, getAdminSupabase } from '@/lib/supabase-server';
import { ok, fail } from '@/lib/api-response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/scan-history — the current user's recent scans (deduped, newest first). */
export async function GET() {
  const userId = await getUserId();
  if (!userId) return ok([]); // anonymous users keep history locally on the client

  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from('scan_history')
    .select('*')
    .order('scanned_at', { ascending: false })
    .limit(50);

  if (error) return fail('INTERNAL', error.message);

  // Dedupe by token (keep newest) and enrich with cached name/symbol/risk.
  const seen = new Set<string>();
  const unique = (data || []).filter((r) => {
    if (seen.has(r.token_address)) return false;
    seen.add(r.token_address);
    return true;
  });

  const admin = getAdminSupabase();
  const { data: scans } = await admin
    .from('scans')
    .select('token_address, risk_score, raw_data')
    .in(
      'token_address',
      unique.map((u) => u.token_address),
    );
  const metaMap: Record<string, any> = {};
  for (const s of scans || []) {
    metaMap[s.token_address] = {
      address: s.token_address,
      name: s.raw_data?.meta?.name ?? null,
      symbol: s.raw_data?.meta?.symbol ?? null,
      imageUrl: s.raw_data?.meta?.imageUrl ?? null,
      riskScore: s.risk_score ?? undefined,
    };
  }

  const items: ScanHistoryItem[] = unique.map((r) => ({
    id: r.id,
    tokenAddress: r.token_address,
    scannedAt: r.scanned_at,
    meta: metaMap[r.token_address],
  }));

  return ok(items);
}
