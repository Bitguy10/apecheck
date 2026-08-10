import { fetchJson } from './http';

/**
 * Solana Tracker (data.solanatracker.io) — wallet holdings + realized/unrealized
 * PnL, win rate, and trading volume. Requires an API key (x-api-key header), kept
 * server-side. Degrades to `available:false` if no key or the upstream fails, so
 * the Tracker still renders holdings from on-chain RPC.
 */

const BASE = 'https://data.solanatracker.io';

interface WalletResponse {
  tokens?: {
    token?: { name?: string; symbol?: string; mint?: string; image?: string; decimals?: number };
    balance?: number;
    value?: number;
  }[];
  total?: number; // total USD value of token holdings
  totalSol?: number;
}

interface PnlTokenEntry {
  total?: number;
  realized?: number;
  unrealized?: number;
  total_invested?: number;
  total_sold?: number;
  sold?: number;
  total_transactions?: number;
  buy_transactions?: number;
  sell_transactions?: number;
}

interface PnlResponse {
  tokens?: Record<string, PnlTokenEntry>;
  summary?: {
    realized?: number;
    unrealized?: number;
    total?: number;
    totalInvested?: number;
    totalWins?: number;
    totalLosses?: number;
    winPercentage?: number;
  };
}

export interface TrackerHolding {
  mint: string;
  name: string | null;
  symbol: string | null;
  imageUrl: string | null;
  amount: number;
  priceUsd: number | null;
  valueUsd: number | null;
}

export interface TrackerPnl {
  totalUsd: number | null;
  realizedUsd: number | null;
  unrealizedUsd: number | null;
  investedUsd: number | null;
  roiPct: number | null;
  winRatePct: number | null;
  wins: number | null;
  losses: number | null;
  /** All-time buy+sell volume (USD), summed from the per-token PnL map. */
  volumeUsd: number | null;
  /** Closed positions (wins + losses) — a proxy for trade count. */
  trades: number | null;
}

export interface TrackerData {
  available: boolean;
  holdings: TrackerHolding[];
  /** USD value of token holdings (excludes native SOL). */
  totalValueUsd: number | null;
  pnl: TrackerPnl;
  error?: string;
}

const EMPTY_PNL: TrackerPnl = {
  totalUsd: null,
  realizedUsd: null,
  unrealizedUsd: null,
  investedUsd: null,
  roiPct: null,
  winRatePct: null,
  wins: null,
  losses: null,
  volumeUsd: null,
  trades: null,
};

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Spot USD price for a single mint (used to value native SOL). */
export async function getSolanaTrackerPrice(mint: string, apiKey?: string): Promise<number | null> {
  if (!apiKey) return null;
  const res = await fetchJson<{ price?: number }>(`${BASE}/price?token=${mint}`, {
    source: 'SolanaTracker price',
    headers: { 'x-api-key': apiKey },
    timeoutMs: 8000,
  });
  return res.ok ? num(res.data.price) : null;
}

/** Fetch holdings + all-time PnL for a wallet in parallel and normalize. */
export async function getSolanaTrackerData(wallet: string, apiKey?: string): Promise<TrackerData> {
  if (!apiKey) return { available: false, holdings: [], totalValueUsd: null, pnl: EMPTY_PNL, error: 'No Solana Tracker API key configured' };

  const headers = { 'x-api-key': apiKey };
  const [walletRes, pnlRes] = await Promise.all([
    fetchJson<WalletResponse>(`${BASE}/wallet/${wallet}`, { source: 'SolanaTracker wallet', headers, timeoutMs: 12000 }),
    fetchJson<PnlResponse>(`${BASE}/pnl/${wallet}`, { source: 'SolanaTracker pnl', headers, timeoutMs: 12000 }),
  ]);

  if (!walletRes.ok && !pnlRes.ok) {
    return { available: false, holdings: [], totalValueUsd: null, pnl: EMPTY_PNL, error: walletRes.ok ? 'no data' : walletRes.error };
  }

  const holdings: TrackerHolding[] = [];
  let totalValueUsd: number | null = null;
  if (walletRes.ok) {
    const w = walletRes.data;
    totalValueUsd = num(w.total);
    for (const t of w.tokens || []) {
      const amount = num(t.balance) ?? 0;
      const valueUsd = num(t.value);
      holdings.push({
        mint: t.token?.mint || '',
        name: t.token?.name ?? null,
        symbol: t.token?.symbol ?? null,
        imageUrl: t.token?.image ?? null,
        amount,
        priceUsd: valueUsd != null && amount > 0 ? valueUsd / amount : null,
        valueUsd,
      });
    }
    holdings.sort((a, b) => (b.valueUsd ?? 0) - (a.valueUsd ?? 0));
  }

  let pnl: TrackerPnl = EMPTY_PNL;
  if (pnlRes.ok) {
    const s = pnlRes.data.summary || {};
    const invested = num(s.totalInvested);
    const total = num(s.total);
    // All-time volume = Σ(buy invested + sell proceeds) across the per-token map.
    // Trade count = Σ(total_transactions) across that map; fall back to closed
    // positions (wins + losses) only when the per-token breakdown is absent.
    let volumeUsd: number | null = null;
    let txCount: number | null = null;
    const entries = pnlRes.data.tokens ? Object.values(pnlRes.data.tokens) : [];
    if (entries.length) {
      volumeUsd = entries.reduce((sum, e) => sum + (num(e.total_invested) ?? 0) + (num(e.total_sold) ?? num(e.sold) ?? 0), 0);
      txCount = entries.reduce((sum, e) => {
        const t = num(e.total_transactions);
        if (t != null) return sum + t;
        return sum + (num(e.buy_transactions) ?? 0) + (num(e.sell_transactions) ?? 0);
      }, 0);
    }
    const wins = num(s.totalWins);
    const losses = num(s.totalLosses);
    const closedPositions = wins != null && losses != null ? wins + losses : null;
    pnl = {
      totalUsd: total,
      realizedUsd: num(s.realized),
      unrealizedUsd: num(s.unrealized),
      investedUsd: invested,
      roiPct: total != null && invested && invested > 0 ? Math.round((total / invested) * 1000) / 10 : null,
      winRatePct: num(s.winPercentage),
      wins,
      losses,
      volumeUsd,
      trades: txCount ?? closedPositions,
    };
  }

  return { available: true, holdings, totalValueUsd, pnl };
}
