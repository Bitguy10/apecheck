import { fetchJson } from './http';

// ─────────────────────────────────────────────────────────────
// Raw RugCheck report (partial, resilient — API returns a large object)
// ─────────────────────────────────────────────────────────────

interface RcTopHolder {
  address: string;
  amount?: number;
  pct?: number;
  uiAmount?: number;
  insider?: boolean;
  owner?: string;
}
interface RcMarketLp {
  lpLocked?: number;
  lpLockedPct?: number;
  lpLockedUSD?: number;
  lpTotalSupply?: number;
  lpMint?: string;
  lpCurrentSupply?: number;
}
interface RcMarket {
  marketType?: string;
  liquidityA?: string;
  liquidityB?: string;
  lp?: RcMarketLp;
}
interface RcTokenInfo {
  mintAuthority?: string | null;
  freezeAuthority?: string | null;
  supply?: number;
  decimals?: number;
}
interface RcReport {
  mint?: string;
  creator?: string;
  token?: RcTokenInfo;
  tokenMeta?: { name?: string; symbol?: string; uri?: string };
  fileMeta?: { name?: string; symbol?: string; image?: string };
  topHolders?: RcTopHolder[];
  markets?: RcMarket[];
  totalMarketLiquidity?: number;
  totalLPProviders?: number;
  rugged?: boolean;
  score?: number;
  score_normalised?: number;
  risks?: { name: string; description?: string; level?: string; score?: number }[];
  mintAuthority?: string | null;
  freezeAuthority?: string | null;
}

// ─────────────────────────────────────────────────────────────
// Normalized output
// ─────────────────────────────────────────────────────────────

export interface RugCheckData {
  available: boolean;
  name: string | null;
  symbol: string | null;
  imageUrl: string | null;
  mintAuthorityActive: boolean | null;
  freezeAuthorityActive: boolean | null;
  /** 0–1 fraction of LP locked/burned (max across markets). */
  lpLockedFraction: number | null;
  lpLocked: boolean | null;
  lpBurned: boolean | null;
  creator: string | null;
  totalMarketLiquidity: number | null;
  topHolders: { address: string; owner: string | null; pct: number; insider: boolean }[];
  /** Pool vault + LP token-account addresses, for labeling LP holders in the table. */
  marketAccounts: string[];
  /** RugCheck's own risk flags — surfaced as extra warnings. */
  riskFlags: { name: string; level: string; description: string }[];
  rugged: boolean | null;
  error?: string;
}

const EMPTY: RugCheckData = {
  available: false,
  name: null,
  symbol: null,
  imageUrl: null,
  mintAuthorityActive: null,
  freezeAuthorityActive: null,
  lpLockedFraction: null,
  lpLocked: null,
  lpBurned: null,
  creator: null,
  totalMarketLiquidity: null,
  topHolders: [],
  marketAccounts: [],
  riskFlags: [],
  rugged: null,
};

/**
 * Fetch + normalize RugCheck report. Public API; optional JWT raises rate limits.
 */
export async function getRugCheckData(tokenAddress: string, jwt?: string): Promise<RugCheckData> {
  const headers: Record<string, string> = {};
  if (jwt) headers.Authorization = `Bearer ${jwt}`;

  const res = await fetchJson<RcReport>(
    `https://api.rugcheck.xyz/v1/tokens/${tokenAddress}/report`,
    { source: 'RugCheck', headers, timeoutMs: 9000 },
  );

  if (!res.ok) return { ...EMPTY, error: res.error };
  const r = res.data;

  const mintAuth = r.token?.mintAuthority ?? r.mintAuthority ?? null;
  const freezeAuth = r.token?.freezeAuthority ?? r.freezeAuthority ?? null;

  // LP lock: take the deepest/most-locked market.
  let lpLockedFraction: number | null = null;
  let lpBurned: boolean | null = null;
  const marketAccounts: string[] = [];
  if (Array.isArray(r.markets) && r.markets.length > 0) {
    let maxPct = 0;
    for (const m of r.markets) {
      const pct = m.lp?.lpLockedPct;
      if (typeof pct === 'number') maxPct = Math.max(maxPct, pct);
      // Burned LP often shows as current supply ~0 with locked ~100%.
      if (m.lp?.lpCurrentSupply === 0 && (m.lp?.lpTotalSupply || 0) > 0) lpBurned = true;
      // Collect pool vault + LP-mint accounts so the scan engine can tag LP holders.
      if (m.liquidityA) marketAccounts.push(m.liquidityA);
      if (m.liquidityB) marketAccounts.push(m.liquidityB);
      if (m.lp?.lpMint) marketAccounts.push(m.lp.lpMint);
    }
    lpLockedFraction = Math.min(1, maxPct / 100);
    if (lpBurned == null) lpBurned = false;
  }

  const topHolders = (r.topHolders || [])
    .slice(0, 10)
    .map((h) => ({
      address: h.address,
      owner: h.owner ?? null,
      pct: typeof h.pct === 'number' ? h.pct : 0,
      insider: !!h.insider,
    }));

  const riskFlags = (r.risks || []).map((f) => ({
    name: f.name,
    level: f.level || 'warn',
    description: f.description || '',
  }));

  return {
    available: true,
    name: r.tokenMeta?.name ?? r.fileMeta?.name ?? null,
    symbol: r.tokenMeta?.symbol ?? r.fileMeta?.symbol ?? null,
    imageUrl: r.fileMeta?.image ?? null,
    mintAuthorityActive: mintAuth != null,
    freezeAuthorityActive: freezeAuth != null,
    lpLockedFraction,
    lpLocked: lpLockedFraction != null ? lpLockedFraction >= 0.9 : null,
    lpBurned,
    creator: r.creator ?? null,
    totalMarketLiquidity: r.totalMarketLiquidity ?? null,
    topHolders,
    marketAccounts,
    riskFlags,
    rugged: r.rugged ?? null,
  };
}
