import {
  getDexScreenerData,
  getRugCheckData,
  getBirdeyeData,
  getJupiterData,
  getSellCheck,
  getDomainAge,
  createSolanaRpc,
  extractDomain,
} from '@apecheck/api-clients';
import { computeRiskScore, computePotentialScore } from './scoring';
import { enrichDexListings } from './dex';
import { isValidSolanaAddress, normalizeAddress } from './formatters';
import { POTENTIAL_DISCLAIMER, dexKeyFromName, jupiterDeepLink } from './constants';
import type {
  ScanResult,
  ScanInput,
  SocialsInfo,
  DexListing,
  TokenMeta,
  MarketInfo,
  TopHolder,
  LaunchAnalysis,
  DevReputation,
} from './types';

// ─────────────────────────────────────────────────────────────
// Config + cache + error
// ─────────────────────────────────────────────────────────────

export interface ScanEngineConfig {
  rpcUrl: string;
  birdeyeApiKey?: string;
  rugcheckJwt?: string;
}

export interface ScanCache {
  /** Return a FRESH cached result, or null if missing/expired. */
  get(tokenAddress: string): Promise<ScanResult | null>;
  set(result: ScanResult): Promise<void>;
}

export interface RunScanOptions {
  config: ScanEngineConfig;
  cache?: ScanCache;
  forceRefresh?: boolean;
  /** Current time in ms — injected for determinism/testing. */
  nowMs?: number;
}

export type ScanErrorCode = 'INVALID_ADDRESS' | 'NOT_FOUND' | 'RATE_LIMITED' | 'UPSTREAM_ERROR';

export class ScanError extends Error {
  code: ScanErrorCode;
  constructor(code: ScanErrorCode, message: string) {
    super(message);
    this.name = 'ScanError';
    this.code = code;
  }
}

// ─────────────────────────────────────────────────────────────
// Main entry point
// ─────────────────────────────────────────────────────────────

export async function runScan(rawAddress: string, opts: RunScanOptions): Promise<ScanResult> {
  const tokenAddress = normalizeAddress(rawAddress || '');
  const nowMs = opts.nowMs ?? Date.now();

  if (!isValidSolanaAddress(tokenAddress)) {
    throw new ScanError('INVALID_ADDRESS', 'Not a valid Solana address.');
  }

  // 1. Cache check
  if (opts.cache && !opts.forceRefresh) {
    try {
      const cached = await opts.cache.get(tokenAddress);
      if (cached) return { ...cached, cached: true };
    } catch {
      // Cache read failure is non-fatal — fall through to live scan.
    }
  }

  const input = await gatherScanInput(tokenAddress, opts.config, nowMs);
  const result = buildResult(tokenAddress, input, nowMs);

  // 2. Write-through cache (non-fatal on failure)
  if (opts.cache) {
    try {
      await opts.cache.set(result);
    } catch {
      /* ignore cache write errors */
    }
  }

  return result;
}

// ─────────────────────────────────────────────────────────────
// Gather + normalize all sources into a ScanInput
// ─────────────────────────────────────────────────────────────

export async function gatherScanInput(
  tokenAddress: string,
  config: ScanEngineConfig,
  nowMs: number,
): Promise<ScanInput> {
  const rpc = createSolanaRpc(config.rpcUrl);
  const warnings: string[] = [];

  // Wave 1 — independent lookups in parallel.
  const [dex, rug, birdeye, jup, mint, sellCheck] = await Promise.all([
    getDexScreenerData(tokenAddress),
    getRugCheckData(tokenAddress, config.rugcheckJwt),
    getBirdeyeData(tokenAddress, config.birdeyeApiKey),
    getJupiterData(tokenAddress),
    rpc.getMintInfo(tokenAddress),
    getSellCheck(tokenAddress),
  ]);
  if (sellCheck.sellable === false) warnings.push('Honeypot pattern: buy route exists but no sell route.');
  else if (sellCheck.sellable === null) warnings.push('Could not verify sellability (no Jupiter route).');

  // Existence check — token must appear on-chain OR in at least one market source.
  const existsOnChain = !!mint?.exists;
  const hasMarketData = dex.available && dex.listings.length > 0;
  if (!existsOnChain && !hasMarketData && !rug.available && !jup.tradable) {
    throw new ScanError('NOT_FOUND', 'Token not found on-chain or in any market.');
  }

  // ── Metadata (prefer on-chain / rugcheck, fall back to dex / birdeye) ──
  const meta: TokenMeta = {
    address: tokenAddress,
    name: rug.name || dex.name || birdeye.name || null,
    symbol: rug.symbol || dex.symbol || birdeye.symbol || null,
    imageUrl: dex.imageUrl || rug.imageUrl || birdeye.imageUrl || null,
    decimals: mint?.decimals ?? birdeye.decimals ?? undefined,
    totalSupply: mint?.supplyRaw ?? undefined,
  };
  if (!meta.name && !meta.symbol) warnings.push('Token metadata (name/symbol) unavailable.');

  // ── Authorities (prefer on-chain RPC; fall back to RugCheck) ──
  let mintActive: boolean;
  let mintKnown = true;
  if (mint) {
    mintActive = mint.mintAuthority != null;
  } else if (rug.mintAuthorityActive != null) {
    mintActive = rug.mintAuthorityActive;
  } else {
    mintActive = true;
    mintKnown = false;
    warnings.push('Mint authority could not be verified.');
  }

  let freezeActive: boolean;
  let freezeKnown = true;
  if (mint) {
    freezeActive = mint.freezeAuthority != null;
  } else if (rug.freezeAuthorityActive != null) {
    freezeActive = rug.freezeAuthorityActive;
  } else {
    freezeActive = true;
    freezeKnown = false;
    warnings.push('Freeze authority could not be verified.');
  }

  // ── Liquidity + LP lock ──
  const liquidityUsd = dex.totalLiquidityUsd || rug.totalMarketLiquidity || birdeye.liquidityUsd || 0;
  let lockedFraction = rug.lpLockedFraction;
  let burned = rug.lpBurned ?? false;
  let lockKnown = lockedFraction != null;
  if (lockedFraction == null) {
    lockedFraction = 0;
    warnings.push('LP lock status unavailable.');
  }
  const liquidity = {
    usd: liquidityUsd,
    locked: lockedFraction >= 0.9 || burned,
    lockedFraction,
    burned,
    lockKnown,
  };

  // ── Supply (prefer on-chain) ──
  const supplyUi = mint?.supplyUi ?? birdeye.totalSupply ?? null;
  const creator = rug.creator || birdeye.creatorAddress || null;

  // Wave 2 — on-chain lookups that depend on supply/creator, run in parallel.
  const needHolderFallback = birdeye.holderCount == null && existsOnChain;
  const [devBalance, topHoldersRaw, holderFallback, devAgeDays, devPriorTokens] = await Promise.all([
    creator && supplyUi && supplyUi > 0 ? rpc.getOwnerTokenBalance(creator, tokenAddress) : Promise.resolve(null),
    supplyUi && supplyUi > 0 ? rpc.getTopHolders(tokenAddress, supplyUi, 20) : Promise.resolve([]),
    needHolderFallback ? rpc.getHolderCount(tokenAddress, 3) : Promise.resolve(null),
    creator ? rpc.getWalletAgeDays(creator, nowMs) : Promise.resolve(null),
    creator ? rpc.getCreatedTokenCount(creator) : Promise.resolve(null),
  ]);

  // ── Dev/deployer wallet ──
  let devPercent = 0;
  let devAddress: string | null = creator;
  let devRawBalance: string | undefined;
  if (creator && supplyUi && supplyUi > 0 && devBalance != null) {
    devPercent = Math.round((devBalance / supplyUi) * 1000) / 10;
    devRawBalance = String(devBalance);
  } else if (birdeye.creatorPercent != null) {
    devPercent = birdeye.creatorPercent;
    devAddress = creator ?? birdeye.creatorAddress ?? null;
  } else {
    devAddress = creator; // may be null
    if (!creator) warnings.push('Dev/deployer wallet not identified.');
    else warnings.push('Dev wallet balance could not be read on-chain.');
  }

  // ── Top holders table (on-chain balances + RugCheck insider tags + LP labels) ──
  const topHolders = buildTopHolders(topHoldersRaw, rug, warnings);

  // ── Holders + top-10 concentration ──
  let top10: number | null = birdeye.top10HolderPercent;
  if (top10 == null && rug.topHolders.length > 0) {
    top10 = Math.round(rug.topHolders.slice(0, 10).reduce((s, h) => s + h.pct, 0) * 10) / 10;
  }
  if (top10 == null && topHolders.length > 0) {
    top10 = Math.round(topHolders.slice(0, 10).reduce((s, h) => s + h.pct, 0) * 10) / 10;
  }
  const topHolderKnown = top10 != null;
  if (!topHolderKnown) warnings.push('Top-10 holder concentration unavailable.');

  const holderCount = birdeye.holderCount ?? holderFallback?.count ?? 0;
  const holders = {
    count: holderCount,
    topHolderPercent: top10 ?? 0,
    topHolderKnown,
    // Holder growth: not available on free tiers; left undefined → scored as unavailable.
    recentGrowth: undefined,
    growthWindowHours: 24,
  };
  if (birdeye.holderCount == null && holderFallback == null) warnings.push('Holder count unavailable.');
  else if (holderFallback?.capped) warnings.push(`Holder count is a lower bound (${holderCount}+).`);

  // ── Launch analysis (insider/sniper concentration) + dev reputation ──
  const launch = buildLaunchAnalysis(topHolders);
  const devReputation = buildDevReputation(devAddress, devAgeDays, devPriorTokens);
  if (devReputation.freshWallet) warnings.push('Dev wallet is freshly created.');
  if ((devReputation.priorTokenCount ?? 0) >= 5) warnings.push(`Dev has launched ${devReputation.priorTokenCount} tokens.`);

  // ── Token age ──
  let ageHours = 0;
  if (dex.earliestPairCreatedAt) {
    ageHours = Math.max(0, (nowMs - dex.earliestPairCreatedAt) / (1000 * 60 * 60));
  } else {
    warnings.push('Token launch time unknown — age credit reduced.');
  }

  // ── Socials + legitimacy ──
  const socials = await buildSocials(dex, rug, meta, nowMs, warnings, config);

  // ── DEX listings (DexScreener + Jupiter route labels) ──
  const dexListings = buildDexListings(dex, jup, tokenAddress);

  // ── Volume ──
  const volume24hUsd = dex.volume24hUsd || birdeye.volume24hUsd || 0;

  // ── Market (price / market cap / change) ──
  const market = buildMarket(dex, birdeye, supplyUi, volume24hUsd);

  // Surface RugCheck's own critical flags as warnings.
  for (const f of rug.riskFlags) {
    if (f.level === 'danger' || f.level === 'high') warnings.push(`RugCheck: ${f.name}`);
  }
  if (rug.rugged) warnings.push('RugCheck has flagged this token as RUGGED.');

  return {
    meta,
    market,
    authorities: { mintActive, freezeActive, mintKnown, freezeKnown },
    liquidity,
    devWallet: { address: devAddress, percentHeld: devPercent, rawBalance: devRawBalance },
    holders,
    topHolders,
    ageHours,
    socials,
    dexListings,
    sellCheck,
    launch,
    devReputation,
    volume24hUsd,
    warnings,
  };
}

// ─────────────────────────────────────────────────────────────
// Market / top-holders / launch / dev-reputation builders
// ─────────────────────────────────────────────────────────────

function buildMarket(
  dex: Awaited<ReturnType<typeof getDexScreenerData>>,
  birdeye: Awaited<ReturnType<typeof getBirdeyeData>>,
  supplyUi: number | null,
  volume24hUsd: number,
): MarketInfo {
  const priceUsd = dex.priceUsd ?? birdeye.priceUsd ?? null;
  const marketCapUsd =
    birdeye.marketCapUsd ?? dex.marketCap ?? (priceUsd != null && supplyUi ? priceUsd * supplyUi : null);
  return {
    priceUsd,
    marketCapUsd,
    fdvUsd: dex.fdv ?? null,
    priceChange24hPct: dex.priceChange24hPct ?? birdeye.priceChange24hPct ?? null,
    volume24hUsd,
    supply: supplyUi,
    primaryPair: dex.primaryPair,
  };
}

function buildTopHolders(
  raw: Awaited<ReturnType<ReturnType<typeof createSolanaRpc>['getTopHolders']>>,
  rug: Awaited<ReturnType<typeof getRugCheckData>>,
  warnings: string[],
): TopHolder[] {
  // Insider set + LP-vault set from RugCheck, matched by owner OR token-account address.
  const insiderSet = new Set<string>();
  for (const h of rug.topHolders) {
    if (h.insider) {
      insiderSet.add(h.address);
      if (h.owner) insiderSet.add(h.owner);
    }
  }
  const lpSet = new Set(rug.marketAccounts);

  if (raw.length === 0) {
    if (rug.topHolders.length === 0) warnings.push('Top holders unavailable.');
    // Fall back to RugCheck's own top-holder list (owner-resolved, with insider flags).
    return rug.topHolders.map((h, i) => {
      const isLp = lpSet.has(h.address) || (h.owner ? lpSet.has(h.owner) : false);
      return {
        rank: i + 1,
        address: h.owner || h.address,
        pct: Math.round(h.pct * 100) / 100,
        insider: h.insider,
        isLiquidityPool: isLp,
        tag: isLp ? 'LP' : h.insider ? 'Insider' : null,
      };
    });
  }

  return raw.map((h, i) => {
    const insider = insiderSet.has(h.address) || insiderSet.has(h.tokenAccount);
    const isLp = lpSet.has(h.tokenAccount) || lpSet.has(h.address);
    return {
      rank: i + 1,
      address: h.address,
      pct: Math.round(h.pct * 100) / 100,
      insider,
      isLiquidityPool: isLp,
      tag: isLp ? 'LP' : insider ? 'Insider' : null,
    };
  });
}

function buildLaunchAnalysis(topHolders: TopHolder[]): LaunchAnalysis {
  // Insider/sniper concentration excludes liquidity pools (not real holders).
  const insiders = topHolders.filter((h) => h.insider && !h.isLiquidityPool);
  const insiderCount = insiders.length;
  const insiderPercent =
    insiderCount > 0 ? Math.round(insiders.reduce((s, h) => s + h.pct, 0) * 10) / 10 : topHolders.length ? 0 : null;
  // Heuristic: several insider wallets holding a meaningful slice ≈ a bundled launch.
  const bundledSuspected = insiderCount >= 3 && (insiderPercent ?? 0) >= 15;

  let note: string;
  if (insiderCount === 0) {
    note = 'No insider/sniper wallets flagged among top holders.';
  } else if (bundledSuspected) {
    note = `${insiderCount} insider/sniper wallets hold ~${insiderPercent}% — consistent with a bundled launch. High risk.`;
  } else {
    note = `${insiderCount} insider/sniper wallet(s) hold ~${insiderPercent}% of supply.`;
  }
  return { insiderCount, insiderPercent, bundledSuspected, note };
}

function buildDevReputation(
  wallet: string | null,
  walletAgeDays: number | null,
  priorTokenCount: number | null,
): DevReputation {
  const freshWallet = walletAgeDays != null && walletAgeDays < 3;
  let note: string;
  if (!wallet) {
    note = 'Dev/deployer wallet could not be identified.';
  } else if (walletAgeDays == null && priorTokenCount == null) {
    note = 'Dev wallet history could not be bounded (very active or unavailable).';
  } else {
    const ageStr = walletAgeDays == null ? 'unknown age' : freshWallet ? `only ${walletAgeDays}d old` : `${walletAgeDays}d old`;
    const countStr =
      priorTokenCount == null ? 'prior launches unknown' : priorTokenCount <= 1 ? 'no notable prior launches' : `${priorTokenCount} tokens created`;
    if (freshWallet && (priorTokenCount ?? 0) >= 5) note = `Fresh wallet (${ageStr}) with ${countStr} — serial-launcher pattern. High risk.`;
    else if ((priorTokenCount ?? 0) >= 5) note = `Established wallet but ${countStr} — possible serial launcher.`;
    else if (freshWallet) note = `Dev wallet is fresh (${ageStr}), ${countStr}.`;
    else note = `Dev wallet ${ageStr}, ${countStr}.`;
  }
  return { wallet, walletAgeDays, priorTokenCount, freshWallet, note };
}

// ─────────────────────────────────────────────────────────────
// Socials builder (with domain-age + mismatch detection)
// ─────────────────────────────────────────────────────────────

async function buildSocials(
  dex: Awaited<ReturnType<typeof getDexScreenerData>>,
  rug: Awaited<ReturnType<typeof getRugCheckData>>,
  meta: TokenMeta,
  nowMs: number,
  warnings: string[],
  _config: ScanEngineConfig,
): Promise<SocialsInfo> {
  const websiteUrl = dex.socials.website;
  const xUrl = dex.socials.x;
  const tgUrl = dex.socials.telegram;

  // X handle extraction
  let xHandle: string | null = null;
  if (xUrl) {
    const m = xUrl.match(/(?:twitter\.com|x\.com)\/(@?[A-Za-z0-9_]+)/);
    if (m) xHandle = m[1].replace('@', '');
  }

  // Domain age via RDAP. Only warn on a genuine failure — an "unknown" (TLD not
  // covered by RDAP, or domain simply not found) is benign and shouldn't scare users.
  const domainAge = await getDomainAge(websiteUrl, nowMs);
  if (websiteUrl && domainAge.status === 'failed') warnings.push('Domain age lookup failed (RDAP) — try again later.');

  // Domain mismatch: compare linked-website domain to any domain in token metadata name.
  // (Heuristic: if the metadata "name/symbol" references a domain that differs from linked site.)
  const linkedDomain = extractDomain(websiteUrl);
  const domainMismatch = detectDomainMismatch(linkedDomain, meta);
  if (domainMismatch) warnings.push('Website domain does not match token metadata.');

  const allMissing = !websiteUrl && !xUrl && !tgUrl;
  if (allMissing) warnings.push('No socials found — legitimacy cannot be verified.');

  return {
    website: { url: websiteUrl, domainAgeDays: domainAge.ageDays },
    x: {
      handle: xHandle,
      url: xUrl,
      // X account age + followers require the X API (paid). Left null → scored as unavailable.
      accountAgeDays: null,
      followers: null,
    },
    telegram: {
      url: tgUrl,
      // TG member count requires the Telegram API + bot in-channel. Left null.
      memberCount: null,
      isPublic: tgUrl ? true : null,
    },
    domainMismatch,
    allMissing,
  };
}

function detectDomainMismatch(linkedDomain: string | null, meta: TokenMeta): boolean {
  if (!linkedDomain) return false;
  // Look for a domain-like string embedded in the token name.
  const nameStr = `${meta.name || ''}`.toLowerCase();
  const domainInName = nameStr.match(/([a-z0-9-]+\.(?:com|xyz|io|fun|app|org|net|gg|so))/);
  if (!domainInName) return false;
  const metaDomain = domainInName[1].replace(/^www\./, '');
  return metaDomain !== linkedDomain;
}

// ─────────────────────────────────────────────────────────────
// DEX listings builder
// ─────────────────────────────────────────────────────────────

function buildDexListings(
  dex: Awaited<ReturnType<typeof getDexScreenerData>>,
  jup: Awaited<ReturnType<typeof getJupiterData>>,
  tokenAddress: string,
): DexListing[] {
  const listings: DexListing[] = dex.listings.map((l) => ({
    dexName: prettyDexName(l.dexName),
    pairAddress: l.pairAddress,
    liquidityUsd: l.liquidityUsd,
    volume24hUsd: l.volume24hUsd,
    buyDeepLink: buildDeepLinkForDex(l.dexName, tokenAddress) || (l.url ?? jupiterDeepLink(tokenAddress)),
  }));

  // Add DEXs surfaced by Jupiter's route that DexScreener missed.
  for (const label of jup.routeLabels) {
    const key = dexKeyFromName(label);
    const already = listings.some((l) => dexKeyFromName(l.dexName) === key);
    if (!already && key) {
      listings.push({
        dexName: prettyDexName(label),
        pairAddress: '',
        liquidityUsd: 0,
        buyDeepLink: buildDeepLinkForDex(label, tokenAddress) || jupiterDeepLink(tokenAddress),
      });
    }
  }

  return enrichDexListings(listings, tokenAddress);
}

function buildDeepLinkForDex(name: string, tokenAddress: string): string | null {
  const key = dexKeyFromName(name);
  if (!key) return null;
  // Reuse the templates' deep-link builders via the shared constants.
  const links: Record<string, string> = {
    jupiter: `https://jup.ag/swap/SOL-${tokenAddress}`,
    raydium: `https://raydium.io/swap/?inputCurrency=sol&outputCurrency=${tokenAddress}`,
    orca: `https://www.orca.so/?tokenIn=SOL&tokenOut=${tokenAddress}`,
    meteora: `https://app.meteora.ag/?tokenOut=${tokenAddress}`,
    pumpfun: `https://pump.fun/${tokenAddress}`,
  };
  return links[key] ?? null;
}

function prettyDexName(id: string): string {
  const key = dexKeyFromName(id);
  const names: Record<string, string> = {
    jupiter: 'Jupiter',
    raydium: 'Raydium',
    orca: 'Orca',
    meteora: 'Meteora',
    pumpfun: 'Pump.fun',
  };
  if (key && names[key]) return names[key];
  // Title-case unknown DEX ids.
  return id.charAt(0).toUpperCase() + id.slice(1);
}

// ─────────────────────────────────────────────────────────────
// Assemble the final ScanResult
// ─────────────────────────────────────────────────────────────

export function buildResult(tokenAddress: string, input: ScanInput, nowMs: number): ScanResult {
  const risk = computeRiskScore(input);
  const potential = computePotentialScore(input);

  return {
    tokenAddress,
    meta: input.meta,
    market: input.market,
    riskScore: risk.score,
    potentialScore: potential.score,
    riskBand: risk.band,
    riskBandLabel: risk.bandLabel,
    riskBreakdown: risk.breakdown,
    potentialBreakdown: potential.breakdown,
    potentialDisclaimer: POTENTIAL_DISCLAIMER,
    devWallet: { address: input.devWallet.address, percentHeld: input.devWallet.percentHeld },
    holders: { count: input.holders.count, topHolderPercent: input.holders.topHolderPercent },
    topHolders: input.topHolders,
    liquidity: {
      usd: input.liquidity.usd,
      locked: input.liquidity.locked,
      lockedFraction: input.liquidity.lockedFraction,
      burned: input.liquidity.burned,
    },
    authorities: { mintActive: input.authorities.mintActive, freezeActive: input.authorities.freezeActive },
    ageHours: Math.round(input.ageHours * 10) / 10,
    socials: input.socials,
    dexListings: input.dexListings,
    sellCheck: input.sellCheck,
    launch: input.launch,
    devReputation: input.devReputation,
    warnings: input.warnings,
    cached: false,
    scannedAt: new Date(nowMs).toISOString(),
  };
}
