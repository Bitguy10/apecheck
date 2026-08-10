/**
 * ApeCheck constants: legal copy, scoring thresholds, DEX templates.
 * Legal/safety copy here is NON-NEGOTIABLE and must be surfaced in the UI verbatim.
 */

// ─────────────────────────────────────────────────────────────
// Legal / safety copy (baked into UI, non-dismissible)
// ─────────────────────────────────────────────────────────────

export const POTENTIAL_DISCLAIMER =
  'Signal strength only — not financial advice, not a price prediction.';

export const BUY_SAFETY_DISCLAIMER =
  'Only buy what you can afford to lose. This score is a risk signal, not a guarantee.';

// ─────────────────────────────────────────────────────────────
// Scan cache TTL
// ─────────────────────────────────────────────────────────────

/** How long a cached scan stays fresh before re-fetching upstream APIs. */
export const SCAN_CACHE_TTL_SECONDS = 5 * 60; // 5 minutes

// ─────────────────────────────────────────────────────────────
// Dev-wallet dump detection
// ─────────────────────────────────────────────────────────────

/** Default % drop in dev wallet balance that triggers a dump alert. */
export const DEV_DUMP_THRESHOLD_PERCENT = 20;

// ─────────────────────────────────────────────────────────────
// Risk scoring weights (must sum to 100)
// ─────────────────────────────────────────────────────────────

export const RISK_WEIGHTS = {
  mintAuthority: 20,
  freezeAuthority: 15,
  lpLocked: 25,
  devHolding: 20,
  topHolders: 10,
  tokenAge: 10,
} as const;

// ─────────────────────────────────────────────────────────────
// Potential scoring weights (must sum to 100)
// ─────────────────────────────────────────────────────────────

export const POTENTIAL_WEIGHTS = {
  liquidityDepth: 25,
  holderGrowth: 25,
  socialCompleteness: 20,
  socialHealth: 15,
  volumeToLiquidity: 15,
} as const;

// ─────────────────────────────────────────────────────────────
// Scoring thresholds
// ─────────────────────────────────────────────────────────────

export const THRESHOLDS = {
  // Dev holding: full points below LOW, zero at/above HIGH.
  devHoldingLowPct: 5,
  devHoldingHighPct: 30,
  // Top-10 concentration: full below LOW, zero at/above HIGH.
  topHoldersLowPct: 20,
  topHoldersHighPct: 60,
  // Token age (hours): scaled toward full at STABLE.
  tokenAgeYoungHours: 24,
  tokenAgeStableHours: 7 * 24, // 7 days
  // Liquidity depth ($) that earns full potential points.
  liquidityFullUsd: 100_000,
  liquidityMinUsd: 1_000,
  // Holder growth (new holders/hr) that earns full points.
  holderGrowthFull: 50,
  // Social health thresholds.
  xFollowersSpam: 500,
  xAccountAgeSpamDays: 30,
  tgMembersSpam: 500,
  domainAgeSpamDays: 30,
  // Volume-to-liquidity ratio that earns full points (healthy churn).
  volLiqRatioFull: 2,
  volLiqRatioOverheated: 15, // too high = wash/dump risk, points taper
} as const;

// ─────────────────────────────────────────────────────────────
// Risk display bands
// ─────────────────────────────────────────────────────────────

export const RISK_BANDS = {
  low: { min: 80, max: 100, label: 'Low Risk', key: 'low' as const },
  medium: { min: 50, max: 79, label: 'Medium Risk', key: 'medium' as const },
  high: { min: 0, max: 49, label: 'High Risk / Likely Rug', key: 'high' as const },
} as const;

// ─────────────────────────────────────────────────────────────
// DEX "How to Buy" templates
// ─────────────────────────────────────────────────────────────

export interface DexTemplate {
  name: string;
  defaultSlippage: string;
  notes: string;
  /** Builds a buy deep-link from a token address. Null = no direct pattern. */
  buildDeepLink: ((tokenAddress: string) => string) | null;
  /** Whether this DEX uses a bonding curve (no slippage setting). */
  bondingCurve?: boolean;
}

export const GENERIC_BUY_STEPS = (dexName: string, slippage: string): string[] => [
  `Open ${dexName}`,
  'Connect your wallet (Phantom, Solflare, or Backpack)',
  'Paste the contract address into the token search field',
  'Verify the token matches (name, symbol, and address) before proceeding',
  ...(slippage === 'N/A' ? [] : [`Set slippage tolerance to ${slippage}`]),
  'Enter the amount of SOL you want to swap',
  'Review the transaction and confirm in your wallet',
];

export const PUMPFUN_BUY_STEPS = (): string[] => [
  'Open Pump.fun',
  'Connect your wallet (Phantom, Solflare, or Backpack)',
  'Paste the contract address into the token search field',
  'Verify the token matches (name, symbol, and address) before proceeding',
  'No slippage setting — this is a bonding curve. Enter the SOL amount directly',
  'Review the transaction and confirm in your wallet',
];

export const DEX_TEMPLATES: Record<string, DexTemplate> = {
  jupiter: {
    name: 'Jupiter',
    defaultSlippage: 'Auto-optimized',
    notes: 'Primary recommended "Buy Now" — routes across all DEXs for the best price.',
    buildDeepLink: (addr) => `https://jup.ag/swap/SOL-${addr}`,
  },
  raydium: {
    name: 'Raydium',
    defaultSlippage: '1–5%',
    notes: 'Standard AMM, common for new launches.',
    buildDeepLink: (addr) => `https://raydium.io/swap/?inputCurrency=sol&outputCurrency=${addr}`,
  },
  orca: {
    name: 'Orca',
    defaultSlippage: '0.5–2%',
    notes: 'Whirlpools may need higher slippage.',
    buildDeepLink: (addr) => `https://www.orca.so/?tokenIn=SOL&tokenOut=${addr}`,
  },
  meteora: {
    name: 'Meteora',
    defaultSlippage: '1–5%',
    notes: 'Common for fresh/dynamic pools.',
    buildDeepLink: (addr) => `https://app.meteora.ag/?tokenOut=${addr}`,
  },
  pumpfun: {
    name: 'Pump.fun',
    defaultSlippage: 'N/A',
    notes: 'Bonding curve — no slippage setting; enter SOL amount directly.',
    buildDeepLink: (addr) => `https://pump.fun/${addr}`,
    bondingCurve: true,
  },
};

/** Jupiter deep-link (aggregator). Always available as the primary Buy Now. */
export const jupiterDeepLink = (tokenAddress: string): string =>
  `https://jup.ag/swap/SOL-${tokenAddress}`;

/**
 * Normalize a DEX name from DexScreener/Jupiter into our template key.
 */
export function dexKeyFromName(name: string): keyof typeof DEX_TEMPLATES | null {
  const n = name.toLowerCase();
  if (n.includes('jupiter') || n === 'jup') return 'jupiter';
  if (n.includes('raydium') || n.includes('ray')) return 'raydium';
  if (n.includes('orca')) return 'orca';
  if (n.includes('meteora')) return 'meteora';
  if (n.includes('pump')) return 'pumpfun';
  return null;
}
