import type { SupabaseClient } from '@supabase/supabase-js';
import { SCAN_CACHE_TTL_SECONDS, type ScanCache, type ScanResult } from '@apecheck/core';

/**
 * Supabase-backed implementation of the core ScanCache interface.
 * The `scans` table is a GLOBAL cache (one row per token). Reads are open; writes
 * go through the service-role client (RLS blocks anon writes).
 */
export function createSupabaseScanCache(admin: SupabaseClient, nowMs: number): ScanCache {
  return {
    async get(tokenAddress: string): Promise<ScanResult | null> {
      const { data, error } = await admin
        .from('scans')
        .select('*')
        .eq('token_address', tokenAddress)
        .maybeSingle();
      if (error || !data) return null;

      // Freshness: expired rows are treated as a miss.
      if (data.expires_at && new Date(data.expires_at).getTime() < nowMs) return null;
      if (!data.raw_data) return null;

      return rowToScanResult(data);
    },

    async set(result: ScanResult): Promise<void> {
      const row = scanResultToRow(result, nowMs);
      await admin.from('scans').upsert(row, { onConflict: 'token_address' });
    },
  };
}

// ─────────────────────────────────────────────────────────────
// Row <-> ScanResult mappers
// ─────────────────────────────────────────────────────────────

/**
 * The full ScanResult is stored in raw_data (jsonb) so we never lose fidelity;
 * the flat columns exist for querying/analytics + the cron + OG cards.
 */
export function scanResultToRow(result: ScanResult, nowMs: number): Record<string, unknown> {
  return {
    token_address: result.tokenAddress,
    risk_score: result.riskScore,
    potential_score: result.potentialScore,
    dev_wallet_address: result.devWallet.address,
    dev_wallet_percent: result.devWallet.percentHeld,
    holder_count: result.holders.count,
    top_holder_percent: result.holders.topHolderPercent,
    liquidity_usd: result.liquidity.usd,
    lp_locked: result.liquidity.locked,
    mint_authority_active: result.authorities.mintActive,
    freeze_authority_active: result.authorities.freezeActive,
    token_age_hours: Math.round(result.ageHours),
    website_url: result.socials.website.url,
    x_handle: result.socials.x.handle,
    telegram_url: result.socials.telegram.url,
    socials_verified: result.socials,
    dex_listings: result.dexListings,
    raw_data: result,
    scanned_at: result.scannedAt,
    expires_at: new Date(nowMs + SCAN_CACHE_TTL_SECONDS * 1000).toISOString(),
  };
}

export function rowToScanResult(row: Record<string, any>): ScanResult {
  // raw_data holds the canonical object; re-stamp cached flag at call site.
  const raw = row.raw_data as ScanResult;
  return { ...raw, cached: true };
}
