import { fetchJson } from './http';

const SOL_MINT = 'So11111111111111111111111111111111111111112';

interface JupQuoteResponse {
  inputMint?: string;
  outputMint?: string;
  outAmount?: string;
  routePlan?: { swapInfo?: { label?: string; ammKey?: string } }[];
  priceImpactPct?: string;
  error?: string;
}

export interface JupiterData {
  available: boolean;
  tradable: boolean;
  /** DEX labels found in the best route (e.g. Raydium, Orca, Meteora). */
  routeLabels: string[];
  priceImpactPct: number | null;
  error?: string;
}

/**
 * Ask Jupiter for a quote swapping 0.1 SOL → token. If a route exists the token
 * is tradable, and the route reveals which DEXs have active liquidity.
 * Public endpoint (no key). lite-api host is the free tier.
 */
export async function getJupiterData(tokenAddress: string): Promise<JupiterData> {
  const amount = 100_000_000; // 0.1 SOL in lamports
  const url =
    `https://lite-api.jup.ag/swap/v1/quote?inputMint=${SOL_MINT}` +
    `&outputMint=${tokenAddress}&amount=${amount}&slippageBps=300`;

  const res = await fetchJson<JupQuoteResponse>(url, { source: 'Jupiter', timeoutMs: 8000 });

  if (!res.ok) {
    // 400 from Jupiter usually means "no route" (not tradable via aggregator).
    return { available: res.status !== 0, tradable: false, routeLabels: [], priceImpactPct: null, error: res.error };
  }

  const q = res.data;
  if (q.error || !q.outAmount) {
    return { available: true, tradable: false, routeLabels: [], priceImpactPct: null };
  }

  const labels = Array.from(
    new Set((q.routePlan || []).map((r) => r.swapInfo?.label).filter((l): l is string => !!l)),
  );

  return {
    available: true,
    tradable: true,
    routeLabels: labels,
    priceImpactPct: q.priceImpactPct ? Number(q.priceImpactPct) : null,
  };
}

export interface SellCheckResult {
  /** true = a sell route back to SOL exists; false = likely honeypot; null = unknown. */
  sellable: boolean | null;
  /** Round-trip loss beyond expected slippage, ≈ implied transfer tax (0–100). */
  impliedTaxPct: number | null;
  buyPriceImpactPct: number | null;
  sellPriceImpactPct: number | null;
  note: string;
}

async function quote(params: string): Promise<JupQuoteResponse | null> {
  const res = await fetchJson<JupQuoteResponse>(`https://lite-api.jup.ag/swap/v1/quote?${params}`, {
    source: 'Jupiter',
    timeoutMs: 8000,
  });
  if (!res.ok) return null;
  return res.data.error ? null : res.data;
}

/**
 * Honeypot / "can I sell?" simulation. Quote a small SOL→token BUY, then quote
 * selling those exact tokens back to SOL. If the sell route is missing the token
 * is likely a honeypot; if the round-trip loses far more than slippage, that gap
 * is an implied transfer tax. Pure quotes — no transaction is ever signed or sent.
 */
export async function getSellCheck(tokenAddress: string): Promise<SellCheckResult> {
  const inLamports = 100_000_000; // 0.1 SOL
  const slippageBps = 500;

  const buy = await quote(
    `inputMint=${SOL_MINT}&outputMint=${tokenAddress}&amount=${inLamports}&slippageBps=${slippageBps}`,
  );
  if (!buy || !buy.outAmount) {
    return {
      sellable: null,
      impliedTaxPct: null,
      buyPriceImpactPct: null,
      sellPriceImpactPct: null,
      note: 'No buy route via Jupiter — could not simulate a sell.',
    };
  }
  const tokensReceived = buy.outAmount;
  const buyImpact = buy.priceImpactPct ? Number(buy.priceImpactPct) * 100 : null;

  const sell = await quote(
    `inputMint=${tokenAddress}&outputMint=${SOL_MINT}&amount=${tokensReceived}&slippageBps=${slippageBps}`,
  );
  if (!sell || !sell.outAmount) {
    return {
      sellable: false,
      impliedTaxPct: null,
      buyPriceImpactPct: buyImpact,
      sellPriceImpactPct: null,
      note: 'Buy route exists but NO sell route — classic honeypot pattern. High risk.',
    };
  }

  const solBack = Number(sell.outAmount);
  const sellImpact = sell.priceImpactPct ? Number(sell.priceImpactPct) * 100 : null;
  // Round-trip loss vs. the ~2x price-impact we'd expect from a fair pool.
  const roundTripLossPct = ((inLamports - solBack) / inLamports) * 100;
  const expectedImpact = (Math.abs(buyImpact ?? 0) + Math.abs(sellImpact ?? 0));
  const impliedTaxPct = Math.max(0, Math.round((roundTripLossPct - expectedImpact) * 10) / 10);

  let note = 'Sellable — a round-trip sell route back to SOL exists.';
  if (impliedTaxPct >= 15) note = `Sellable, but ~${impliedTaxPct}% is lost beyond slippage — likely a high transfer tax.`;
  else if (impliedTaxPct >= 5) note = `Sellable, with ~${impliedTaxPct}% implied tax/loss beyond slippage.`;

  return {
    sellable: true,
    impliedTaxPct,
    buyPriceImpactPct: buyImpact,
    sellPriceImpactPct: sellImpact,
    note,
  };
}
