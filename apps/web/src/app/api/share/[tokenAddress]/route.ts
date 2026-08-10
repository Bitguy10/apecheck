import { isValidSolanaAddress } from '@apecheck/core';
import { getAdminSupabase } from '@/lib/supabase-server';
import { ok, fail } from '@/lib/api-response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/share/:tokenAddress — lightweight, PUBLIC scan summary for share cards / OG images.
 * Reads the global cache only (never triggers a live scan).
 */
export async function GET(_req: Request, { params }: { params: { tokenAddress: string } }) {
  const tokenAddress = (params.tokenAddress || '').trim();
  if (!isValidSolanaAddress(tokenAddress)) return fail('INVALID_ADDRESS', 'Invalid address.');

  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from('scans')
    .select('token_address, risk_score, potential_score, dev_wallet_percent, liquidity_usd, raw_data, scanned_at')
    .eq('token_address', tokenAddress)
    .maybeSingle();

  if (error || !data) return fail('NOT_FOUND', 'No scan found for this token yet.');

  const raw = data.raw_data;
  return ok({
    tokenAddress: data.token_address,
    name: raw?.meta?.name ?? null,
    symbol: raw?.meta?.symbol ?? null,
    imageUrl: raw?.meta?.imageUrl ?? null,
    riskScore: data.risk_score,
    riskBand: raw?.riskBand ?? null,
    riskBandLabel: raw?.riskBandLabel ?? null,
    potentialScore: data.potential_score,
    devWalletPercent: data.dev_wallet_percent,
    liquidityUsd: data.liquidity_usd,
    scannedAt: data.scanned_at,
  });
}
