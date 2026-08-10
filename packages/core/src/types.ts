/**
 * ApeCheck shared domain types. These define the contract between the scan engine,
 * the API routes, and both web + mobile clients. Everything flows through ScanResult.
 */

// ─────────────────────────────────────────────────────────────
// Risk / potential scoring
// ─────────────────────────────────────────────────────────────

export type RiskBand = 'low' | 'medium' | 'high';

export interface ScoreBreakdownItem {
  /** Stable key for the check, e.g. "mint_authority". */
  key: string;
  /** Human label shown in the terminal-log results view. */
  label: string;
  /** Points awarded for this check. */
  points: number;
  /** Max possible points for this check. */
  maxPoints: number;
  /** Short explanation shown under the check. */
  detail: string;
  /** Pass / warn / fail — drives the color of the log line. */
  status: 'pass' | 'warn' | 'fail' | 'unknown';
}

export interface RiskScore {
  score: number; // 0–100, higher = safer
  band: RiskBand;
  bandLabel: string;
  breakdown: ScoreBreakdownItem[];
}

export interface PotentialScore {
  score: number; // 0–100, higher = more upside signal (NOT a price prediction)
  breakdown: ScoreBreakdownItem[];
  /** Always attached; the legal-mandated disclaimer. */
  disclaimer: string;
}

// ─────────────────────────────────────────────────────────────
// Raw normalized inputs to the scoring engine
// ─────────────────────────────────────────────────────────────

export interface AuthorityInfo {
  mintActive: boolean;
  freezeActive: boolean;
  /** false when we could not determine authority state (treated cautiously). */
  mintKnown?: boolean;
  freezeKnown?: boolean;
}

export interface LiquidityInfo {
  usd: number;
  /** true if LP is locked OR burned. */
  locked: boolean;
  /** 0–1: fraction of LP locked/burned, for partial-lock scaling. */
  lockedFraction: number;
  burned: boolean;
  /** false when lock status could not be determined. */
  lockKnown?: boolean;
}

export interface DevWalletInfo {
  address: string | null;
  /** % of total supply held by dev/deployer wallet (0–100). */
  percentHeld: number;
  /** Raw token balance held by dev wallet (base units, as string to avoid precision loss). */
  rawBalance?: string;
}

export interface HolderInfo {
  count: number;
  /** Combined % held by top 10 holders (0–100). */
  topHolderPercent: number;
  /** false when concentration could not be determined. */
  topHolderKnown?: boolean;
  /** New unique holders observed over the recent window (for growth rate). */
  recentGrowth?: number;
  /** Window in hours over which recentGrowth was measured. */
  growthWindowHours?: number;
}

export interface SocialLinkWebsite {
  url: string | null;
  domainAgeDays: number | null;
}

export interface SocialLinkX {
  handle: string | null;
  url: string | null;
  accountAgeDays: number | null;
  followers: number | null;
}

export interface SocialLinkTelegram {
  url: string | null;
  memberCount: number | null;
  isPublic: boolean | null;
}

export interface SocialsInfo {
  website: SocialLinkWebsite;
  x: SocialLinkX;
  telegram: SocialLinkTelegram;
  /** true if metadata site ≠ actual linked site. */
  domainMismatch: boolean;
  /** true if NO socials present at all. */
  allMissing: boolean;
}

export interface DexListing {
  dexName: string;
  pairAddress: string;
  liquidityUsd: number;
  volume24hUsd?: number;
  buyDeepLink: string;
  /** Recommended slippage range for the how-to-buy template. */
  slippage?: string;
}

export interface TokenMeta {
  address: string;
  name: string | null;
  symbol: string | null;
  imageUrl: string | null;
  totalSupply?: string;
  decimals?: number;
}

// ─────────────────────────────────────────────────────────────
// Market data (price, market cap) — shown as its own header row
// ─────────────────────────────────────────────────────────────

export interface MarketInfo {
  priceUsd: number | null;
  marketCapUsd: number | null;
  fdvUsd: number | null;
  priceChange24hPct: number | null;
  volume24hUsd: number;
  /** Total/circulating supply in UI units, for MC display. */
  supply: number | null;
  /** Deepest pair, used to embed the live chart / trades. */
  primaryPair: { dexId: string; pairAddress: string } | null;
}

// ─────────────────────────────────────────────────────────────
// Top holders (wallet-level, for the concentration table + bubble map)
// ─────────────────────────────────────────────────────────────

export interface TopHolder {
  rank: number;
  /** Owner wallet when known, else the token account address. */
  address: string;
  /** % of total supply (0–100). */
  pct: number;
  /** Flagged by RugCheck as an insider/sniper wallet. */
  insider: boolean;
  /** This holder is a liquidity pool / AMM vault (not a real holder). */
  isLiquidityPool: boolean;
  /** Display tag: 'LP' | 'Insider' | null. */
  tag: string | null;
}

// ─────────────────────────────────────────────────────────────
// Can-I-sell? (honeypot) simulation via Jupiter buy vs sell quote
// ─────────────────────────────────────────────────────────────

export interface SellCheck {
  /** true = a sell route back to SOL exists; false = likely honeypot; null = unknown. */
  sellable: boolean | null;
  /** Round-trip loss beyond expected slippage → implied transfer tax (0–100). */
  impliedTaxPct: number | null;
  buyPriceImpactPct: number | null;
  sellPriceImpactPct: number | null;
  note: string;
}

// ─────────────────────────────────────────────────────────────
// Launch analysis — insider/sniper concentration at/near launch
// ─────────────────────────────────────────────────────────────

export interface LaunchAnalysis {
  /** # of top holders flagged as insiders/snipers. */
  insiderCount: number;
  /** % of supply held by insider/sniper wallets (0–100), null if unknown. */
  insiderPercent: number | null;
  /** Heuristic: concentrated insider ownership consistent with a bundled launch. */
  bundledSuspected: boolean;
  note: string;
}

// ─────────────────────────────────────────────────────────────
// Dev/deployer wallet reputation — age + prior token launches
// ─────────────────────────────────────────────────────────────

export interface DevReputation {
  wallet: string | null;
  /** Age of the dev wallet in days (first on-chain activity), null if unknown. */
  walletAgeDays: number | null;
  /** # of other tokens created by this wallet (DAS getAssetsByCreator). */
  priorTokenCount: number | null;
  /** Freshly-created wallet (age below threshold) — higher risk. */
  freshWallet: boolean;
  note: string;
}

// ─────────────────────────────────────────────────────────────
// The full normalized scan input (produced by api-clients + scan engine)
// ─────────────────────────────────────────────────────────────

export interface ScanInput {
  meta: TokenMeta;
  market: MarketInfo;
  authorities: AuthorityInfo;
  liquidity: LiquidityInfo;
  devWallet: DevWalletInfo;
  holders: HolderInfo;
  topHolders: TopHolder[];
  ageHours: number;
  socials: SocialsInfo;
  dexListings: DexListing[];
  sellCheck: SellCheck;
  launch: LaunchAnalysis;
  devReputation: DevReputation;
  /** 24h volume across all pairs, for volume-to-liquidity ratio. */
  volume24hUsd: number;
  /** Any partial-data flags surfaced to the UI. */
  warnings: string[];
}

// ─────────────────────────────────────────────────────────────
// The full scan result (API response shape)
// ─────────────────────────────────────────────────────────────

export interface ScanResult {
  tokenAddress: string;
  meta: TokenMeta;
  market: MarketInfo;
  riskScore: number;
  potentialScore: number;
  riskBand: RiskBand;
  riskBandLabel: string;
  riskBreakdown: ScoreBreakdownItem[];
  potentialBreakdown: ScoreBreakdownItem[];
  potentialDisclaimer: string;
  devWallet: { address: string | null; percentHeld: number };
  holders: { count: number; topHolderPercent: number };
  topHolders: TopHolder[];
  liquidity: { usd: number; locked: boolean; lockedFraction: number; burned: boolean };
  authorities: { mintActive: boolean; freezeActive: boolean };
  ageHours: number;
  socials: SocialsInfo;
  dexListings: DexListing[];
  sellCheck: SellCheck;
  launch: LaunchAnalysis;
  devReputation: DevReputation;
  warnings: string[];
  cached: boolean;
  scannedAt: string; // ISO
}

// ─────────────────────────────────────────────────────────────
// API contract types (watchlist, alerts, push)
// ─────────────────────────────────────────────────────────────

export interface WatchlistItem {
  id: string;
  tokenAddress: string;
  devWalletAddress: string | null;
  initialDevBalance: number | null;
  alertEnabled: boolean;
  createdAt: string;
  /** Optional joined meta for display. */
  meta?: Partial<TokenMeta> & { riskScore?: number; potentialScore?: number };
}

export interface AlertItem {
  id: string;
  watchlistId: string;
  tokenAddress: string;
  /** 'dev_dump' | 'lp_pull' | 'authority_reenabled' | 'price_drop' | 'big_holder_sell' */
  alertType: string;
  title: string | null;
  body: string | null;
  detail: Record<string, unknown> | null;
  triggeredAt: string;
  notified: boolean;
  /** Legacy dev-dump columns (present only for dev_dump alerts). */
  devWalletAddress: string | null;
  balanceBefore: number | null;
  balanceAfter: number | null;
  percentDropped: number | null;
}

export type PushPlatform = 'ios' | 'android' | 'web';

export interface PushTokenRegistration {
  token: string;
  platform: PushPlatform;
}

export interface ScanHistoryItem {
  id: string;
  tokenAddress: string;
  scannedAt: string;
  meta?: Partial<TokenMeta> & { riskScore?: number };
}

// ─────────────────────────────────────────────────────────────
// Wallet tracker — holdings + trade-history metrics (PnL / win rate / volume)
// ─────────────────────────────────────────────────────────────

/** A single SPL token position held by a wallet. */
export interface Holding {
  mint: string;
  name: string | null;
  symbol: string | null;
  imageUrl: string | null;
  /** UI-unit balance (already divided by decimals). */
  amount: number;
  /** Current price per token in USD, null if unknown. */
  priceUsd: number | null;
  /** Current position value in USD (amount × priceUsd), null if unknown. */
  valueUsd: number | null;
}

/**
 * Trade-history-derived performance for a wallet (source: Solana Tracker).
 * All monetary values in USD. null = the source could not provide the field.
 */
export interface WalletPnl {
  /** Realized + unrealized PnL in USD. */
  totalUsd: number | null;
  realizedUsd: number | null;
  unrealizedUsd: number | null;
  /** Total invested / buy volume (cost basis) in USD. */
  investedUsd: number | null;
  /** PnL as a percentage of invested (can be negative). */
  roiPct: number | null;
  /** Fraction of closed positions that were profitable (0–100). */
  winRatePct: number | null;
  wins: number | null;
  losses: number | null;
}

/** A window of metrics (e.g. all-time performance). */
export interface WalletMetrics {
  pnl: WalletPnl;
  /** Total buy+sell volume in USD over the window. */
  volumeUsd: number | null;
  /** Number of trades over the window. */
  trades: number | null;
}

export interface WalletScan {
  walletAddress: string;
  /** Native SOL balance (UI units). */
  solBalance: number | null;
  /** USD price of SOL used for valuation. */
  solPriceUsd: number | null;
  /** Total portfolio value in USD (token holdings + SOL). */
  totalValueUsd: number | null;
  /** All SPL token positions, sorted by USD value desc. */
  holdings: Holding[];
  /** # of distinct tokens held. */
  holdingsCount: number;
  /** All-time performance. */
  allTime: WalletMetrics;
  /** Wallet age in days from earliest signature; null if too active to bound. */
  walletAgeDays: number | null;
  /** # of tokens created/deployed by this wallet (dev-wallet signal). */
  createdTokenCount: number | null;
  /** true if the metrics source (Solana Tracker) was reachable and returned data. */
  metricsAvailable: boolean;
  /** Human notes: partial data, source unavailable, etc. */
  warnings: string[];
  cached: boolean;
  scannedAt: string; // ISO
}

export interface WalletScanHistoryItem {
  id: string;
  walletAddress: string;
  scannedAt: string;
  /** Snapshot of headline metrics for the history table. */
  summary?: {
    totalValueUsd: number | null;
    allTimePnlUsd: number | null;
    volumeUsd: number | null;
    winRatePct: number | null;
    holdingsCount: number | null;
  };
}

// ─────────────────────────────────────────────────────────────
// Profile / account
// ─────────────────────────────────────────────────────────────

export type AccountType = 'REGULAR' | 'PRO';

export interface Profile {
  id: string;
  email: string | null;
  accountType: AccountType;
  /** true if the user has a password identity (vs OAuth-only). */
  hasPassword: boolean;
  /** true if the email is confirmed/verified. */
  emailVerified: boolean;
  createdAt: string | null;
}

// ─────────────────────────────────────────────────────────────
// Error shape
// ─────────────────────────────────────────────────────────────

export interface ApiError {
  error: string;
  code:
    | 'INVALID_ADDRESS'
    | 'NOT_FOUND'
    | 'RATE_LIMITED'
    | 'UPSTREAM_ERROR'
    | 'INTERNAL'
    | 'UNAUTHORIZED'
    | 'CONFLICT'
    | 'BAD_REQUEST';
}
