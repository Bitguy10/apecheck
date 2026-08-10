import { fetchJson } from './http';

interface BeOverview {
  data?: {
    holder?: number;
    liquidity?: number;
    v24hUSD?: number;
    v24hChangePercent?: number;
    price?: number;
    supply?: number;
    mc?: number;
    name?: string;
    symbol?: string;
    logoURI?: string;
    decimals?: number;
  };
  success?: boolean;
}

interface BeSecurity {
  data?: {
    top10HolderPercent?: number; // fraction 0–1
    top10HolderBalance?: number;
    top10UserPercent?: number;
    ownerAddress?: string | null;
    creatorAddress?: string | null;
    creatorPercentage?: number; // fraction 0–1
    ownerPercentage?: number;
    freezeable?: boolean | null;
    freezeAuthority?: string | null;
    mintable?: boolean | null;
    totalSupply?: number;
  };
  success?: boolean;
}

export interface BirdeyeData {
  available: boolean;
  holderCount: number | null;
  top10HolderPercent: number | null; // 0–100
  priceUsd: number | null;
  marketCapUsd: number | null;
  priceChange24hPct: number | null;
  volume24hUsd: number | null;
  liquidityUsd: number | null;
  creatorAddress: string | null;
  creatorPercent: number | null; // 0–100
  name: string | null;
  symbol: string | null;
  imageUrl: string | null;
  decimals: number | null;
  totalSupply: number | null;
  error?: string;
}

const EMPTY: BirdeyeData = {
  available: false,
  holderCount: null,
  top10HolderPercent: null,
  priceUsd: null,
  marketCapUsd: null,
  priceChange24hPct: null,
  volume24hUsd: null,
  liquidityUsd: null,
  creatorAddress: null,
  creatorPercent: null,
  name: null,
  symbol: null,
  imageUrl: null,
  decimals: null,
  totalSupply: null,
};

/**
 * Fetch Birdeye overview + security. Requires a free-tier API key (X-API-KEY).
 * Degrades to `available:false` if no key or upstream fails.
 */
export async function getBirdeyeData(tokenAddress: string, apiKey?: string): Promise<BirdeyeData> {
  if (!apiKey) return { ...EMPTY, error: 'No Birdeye API key configured' };

  const headers = {
    'X-API-KEY': apiKey,
    'x-chain': 'solana',
  };

  const [overviewRes, securityRes] = await Promise.all([
    fetchJson<BeOverview>(
      `https://public-api.birdeye.so/defi/token_overview?address=${tokenAddress}`,
      { source: 'Birdeye overview', headers, timeoutMs: 8000 },
    ),
    fetchJson<BeSecurity>(
      `https://public-api.birdeye.so/defi/token_security?address=${tokenAddress}`,
      { source: 'Birdeye security', headers, timeoutMs: 8000 },
    ),
  ]);

  const overview = overviewRes.ok ? overviewRes.data.data : undefined;
  const security = securityRes.ok ? securityRes.data.data : undefined;

  if (!overview && !security) {
    const err = !overviewRes.ok ? overviewRes.error : 'Birdeye returned no data';
    return { ...EMPTY, error: err };
  }

  const top10 = security?.top10HolderPercent;
  const creatorPct = security?.creatorPercentage;

  return {
    available: true,
    holderCount: overview?.holder ?? null,
    top10HolderPercent: typeof top10 === 'number' ? Math.round(top10 * 1000) / 10 : null,
    priceUsd: overview?.price ?? null,
    marketCapUsd: overview?.mc ?? null,
    priceChange24hPct: typeof overview?.v24hChangePercent === 'number' ? overview.v24hChangePercent : null,
    volume24hUsd: overview?.v24hUSD ?? null,
    liquidityUsd: overview?.liquidity ?? null,
    creatorAddress: security?.creatorAddress ?? security?.ownerAddress ?? null,
    creatorPercent: typeof creatorPct === 'number' ? Math.round(creatorPct * 1000) / 10 : null,
    name: overview?.name ?? null,
    symbol: overview?.symbol ?? null,
    imageUrl: overview?.logoURI ?? null,
    decimals: overview?.decimals ?? null,
    totalSupply: overview?.supply ?? security?.totalSupply ?? null,
  };
}
