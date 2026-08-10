import { fetchJson } from './http';

// ─────────────────────────────────────────────────────────────
// Raw DexScreener response shapes (partial, resilient)
// ─────────────────────────────────────────────────────────────

interface DsToken {
  address: string;
  name?: string;
  symbol?: string;
}
interface DsPair {
  chainId: string;
  dexId: string;
  url?: string;
  pairAddress: string;
  baseToken: DsToken;
  quoteToken: DsToken;
  priceUsd?: string;
  liquidity?: { usd?: number; base?: number; quote?: number };
  volume?: { h24?: number; h6?: number; h1?: number };
  priceChange?: { h24?: number; h6?: number; h1?: number };
  pairCreatedAt?: number; // ms epoch
  fdv?: number;
  marketCap?: number;
  info?: {
    imageUrl?: string;
    websites?: { label?: string; url: string }[];
    socials?: { type?: string; platform?: string; handle?: string; url: string }[];
  };
}
interface DsResponse {
  schemaVersion?: string;
  pairs: DsPair[] | null;
}

// ─────────────────────────────────────────────────────────────
// Normalized output
// ─────────────────────────────────────────────────────────────

export interface DexScreenerData {
  name: string | null;
  symbol: string | null;
  imageUrl: string | null;
  priceUsd: number | null;
  priceChange24hPct: number | null;
  totalLiquidityUsd: number;
  volume24hUsd: number;
  fdv: number | null;
  marketCap: number | null;
  /** Earliest pair creation across all pairs (ms epoch), for token age. */
  earliestPairCreatedAt: number | null;
  /** Deepest pair (dexId + pairAddress), used to embed the live chart / trades. */
  primaryPair: { dexId: string; pairAddress: string } | null;
  listings: {
    dexName: string;
    pairAddress: string;
    liquidityUsd: number;
    volume24hUsd: number;
    url?: string;
  }[];
  socials: {
    website: string | null;
    x: string | null; // full URL
    telegram: string | null;
    discord: string | null;
  };
  available: boolean;
  error?: string;
}

const EMPTY: DexScreenerData = {
  name: null,
  symbol: null,
  imageUrl: null,
  priceUsd: null,
  priceChange24hPct: null,
  totalLiquidityUsd: 0,
  volume24hUsd: 0,
  fdv: null,
  marketCap: null,
  earliestPairCreatedAt: null,
  primaryPair: null,
  listings: [],
  socials: { website: null, x: null, telegram: null, discord: null },
  available: false,
};

function normalizeSocial(url: string): { kind: string; url: string } | null {
  const u = url.toLowerCase();
  if (u.includes('t.me') || u.includes('telegram')) return { kind: 'telegram', url };
  if (u.includes('twitter.com') || u.includes('x.com')) return { kind: 'x', url };
  if (u.includes('discord')) return { kind: 'discord', url };
  return null;
}

/**
 * Fetch + normalize DexScreener data for a Solana token. No API key required.
 */
export async function getDexScreenerData(tokenAddress: string): Promise<DexScreenerData> {
  const res = await fetchJson<DsResponse>(
    `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`,
    { source: 'DexScreener', timeoutMs: 12000, retries: 2 },
  );

  if (!res.ok) return { ...EMPTY, error: res.error };
  const pairs = (res.data.pairs || []).filter((p) => p.chainId === 'solana');
  if (pairs.length === 0) return { ...EMPTY, available: true };

  // Pick the deepest pair as the "primary" for meta/socials.
  const sorted = [...pairs].sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));
  const primary = sorted[0];

  const totalLiquidityUsd = pairs.reduce((s, p) => s + (p.liquidity?.usd || 0), 0);
  const volume24hUsd = pairs.reduce((s, p) => s + (p.volume?.h24 || 0), 0);

  const createdTimes = pairs.map((p) => p.pairCreatedAt).filter((t): t is number => typeof t === 'number');
  const earliestPairCreatedAt = createdTimes.length ? Math.min(...createdTimes) : null;

  // De-dup listings by dexId, keeping deepest pair per DEX.
  const byDex = new Map<string, DexScreenerData['listings'][number]>();
  for (const p of sorted) {
    const key = p.dexId;
    const liq = p.liquidity?.usd || 0;
    const existing = byDex.get(key);
    if (!existing || liq > existing.liquidityUsd) {
      byDex.set(key, {
        dexName: p.dexId,
        pairAddress: p.pairAddress,
        liquidityUsd: liq,
        volume24hUsd: p.volume?.h24 || 0,
        url: p.url,
      });
    }
  }

  // Socials from primary pair info.
  const socials: DexScreenerData['socials'] = { website: null, x: null, telegram: null, discord: null };
  const info = primary.info;
  if (info?.websites?.length) socials.website = info.websites[0].url;
  if (info?.socials?.length) {
    for (const s of info.socials) {
      const norm = normalizeSocial(s.url || '');
      if (!norm) continue;
      if (norm.kind === 'x' && !socials.x) socials.x = norm.url;
      if (norm.kind === 'telegram' && !socials.telegram) socials.telegram = norm.url;
      if (norm.kind === 'discord' && !socials.discord) socials.discord = norm.url;
    }
  }

  return {
    name: primary.baseToken.name || null,
    symbol: primary.baseToken.symbol || null,
    imageUrl: info?.imageUrl || null,
    priceUsd: primary.priceUsd ? Number(primary.priceUsd) : null,
    priceChange24hPct: typeof primary.priceChange?.h24 === 'number' ? primary.priceChange.h24 : null,
    totalLiquidityUsd,
    volume24hUsd,
    fdv: primary.fdv ?? null,
    marketCap: primary.marketCap ?? null,
    earliestPairCreatedAt,
    primaryPair: { dexId: primary.dexId, pairAddress: primary.pairAddress },
    listings: [...byDex.values()],
    socials,
    available: true,
  };
}
