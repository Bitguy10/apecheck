import {
  RISK_WEIGHTS,
  POTENTIAL_WEIGHTS,
  THRESHOLDS,
  RISK_BANDS,
  POTENTIAL_DISCLAIMER,
} from './constants';
import type {
  ScanInput,
  RiskScore,
  PotentialScore,
  RiskBand,
  ScoreBreakdownItem,
} from './types';

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const clamp = (n: number, min = 0, max = 100): number => Math.min(max, Math.max(min, n));

/** Linear interpolation of points as a value moves from `good` (full) to `bad` (zero). */
function scaleDown(value: number, good: number, bad: number, maxPoints: number): number {
  if (bad === good) return value <= good ? maxPoints : 0;
  if (good < bad) {
    // Lower is better (e.g. dev holding %): full below `good`, zero above `bad`.
    if (value <= good) return maxPoints;
    if (value >= bad) return 0;
    return maxPoints * (1 - (value - good) / (bad - good));
  }
  // Higher is better (e.g. token age): full above `good`, zero below `bad`.
  if (value >= good) return maxPoints;
  if (value <= bad) return 0;
  return maxPoints * ((value - bad) / (good - bad));
}

/** Scale points upward as a value climbs from 0 → `full`. */
function scaleUp(value: number, full: number, maxPoints: number): number {
  if (full <= 0) return maxPoints;
  return clamp((value / full) * maxPoints, 0, maxPoints);
}

const round = (n: number): number => Math.round(n * 10) / 10;

function statusFor(points: number, maxPoints: number): ScoreBreakdownItem['status'] {
  const ratio = maxPoints === 0 ? 0 : points / maxPoints;
  if (ratio >= 0.85) return 'pass';
  if (ratio >= 0.4) return 'warn';
  return 'fail';
}

// ─────────────────────────────────────────────────────────────
// Risk Score (0–100, higher = safer)
// ─────────────────────────────────────────────────────────────

export function computeRiskScore(input: ScanInput): RiskScore {
  const breakdown: ScoreBreakdownItem[] = [];

  // 1. Mint authority renounced (20)
  {
    const known = input.authorities.mintKnown !== false;
    const points = !known ? 0 : input.authorities.mintActive ? 0 : RISK_WEIGHTS.mintAuthority;
    breakdown.push({
      key: 'mint_authority',
      label: 'Mint authority renounced',
      points,
      maxPoints: RISK_WEIGHTS.mintAuthority,
      detail: !known
        ? 'Could not verify mint authority — treated as a risk.'
        : input.authorities.mintActive
          ? 'ACTIVE — dev can mint unlimited new tokens. Major rug vector.'
          : 'Renounced — no new tokens can be minted.',
      status: !known ? 'unknown' : input.authorities.mintActive ? 'fail' : 'pass',
    });
  }

  // 2. Freeze authority renounced (15)
  {
    const known = input.authorities.freezeKnown !== false;
    const points = !known ? 0 : input.authorities.freezeActive ? 0 : RISK_WEIGHTS.freezeAuthority;
    breakdown.push({
      key: 'freeze_authority',
      label: 'Freeze authority renounced',
      points,
      maxPoints: RISK_WEIGHTS.freezeAuthority,
      detail: !known
        ? 'Could not verify freeze authority — treated as a risk.'
        : input.authorities.freezeActive
          ? 'ACTIVE — dev can freeze your wallet and block sells.'
          : 'Renounced — wallets cannot be frozen.',
      status: !known ? 'unknown' : input.authorities.freezeActive ? 'fail' : 'pass',
    });
  }

  // 3. LP locked/burned (25) — scaled by lockedFraction
  {
    const known = input.liquidity.lockKnown !== false;
    const frac = clamp(input.liquidity.lockedFraction, 0, 1);
    const points = !known ? 0 : round(frac * RISK_WEIGHTS.lpLocked);
    const detail = !known
      ? 'LP lock status unavailable — treated as a risk.'
      : input.liquidity.burned
        ? 'LP burned — liquidity permanently removed from dev control.'
        : input.liquidity.locked
          ? `LP locked (${Math.round(frac * 100)}% of pool).`
          : 'LP UNLOCKED — dev can pull liquidity at any time. Rug risk.';
    breakdown.push({
      key: 'lp_locked',
      label: 'LP locked / burned',
      points,
      maxPoints: RISK_WEIGHTS.lpLocked,
      detail,
      status: !known ? 'unknown' : statusFor(points, RISK_WEIGHTS.lpLocked),
    });
  }

  // 4. Dev wallet holding % (20) — full <5%, zero at >30%
  {
    const pct = input.devWallet.percentHeld;
    const known = input.devWallet.address != null;
    const points = !known
      ? round(RISK_WEIGHTS.devHolding * 0.5)
      : round(scaleDown(pct, THRESHOLDS.devHoldingLowPct, THRESHOLDS.devHoldingHighPct, RISK_WEIGHTS.devHolding));
    breakdown.push({
      key: 'dev_holding',
      label: 'Dev wallet holding',
      points,
      maxPoints: RISK_WEIGHTS.devHolding,
      detail: !known
        ? 'Dev wallet not identified — partial credit, treat with caution.'
        : `Dev holds ${pct.toFixed(1)}% of supply${pct > THRESHOLDS.devHoldingHighPct ? ' — heavy concentration, dump risk.' : pct < THRESHOLDS.devHoldingLowPct ? ' — low concentration.' : '.'}`,
      status: !known ? 'unknown' : statusFor(points, RISK_WEIGHTS.devHolding),
    });
  }

  // 5. Top-10 holder concentration (10) — full <20%, zero at >60%
  {
    const pct = input.holders.topHolderPercent;
    const known = input.holders.topHolderKnown !== false;
    const points = !known
      ? round(RISK_WEIGHTS.topHolders * 0.5)
      : round(scaleDown(pct, THRESHOLDS.topHoldersLowPct, THRESHOLDS.topHoldersHighPct, RISK_WEIGHTS.topHolders));
    breakdown.push({
      key: 'top_holders',
      label: 'Top-10 holder concentration',
      points,
      maxPoints: RISK_WEIGHTS.topHolders,
      detail: !known
        ? 'Holder concentration unavailable — partial credit.'
        : `Top 10 wallets hold ${pct.toFixed(1)}% combined${pct > THRESHOLDS.topHoldersHighPct ? ' — whales control supply.' : '.'}`,
      status: !known ? 'unknown' : statusFor(points, RISK_WEIGHTS.topHolders),
    });
  }

  // 6. Token age (10) — full >7d with stable liquidity, scaled down <24h
  {
    let points = round(
      scaleDown(
        input.ageHours,
        THRESHOLDS.tokenAgeStableHours,
        THRESHOLDS.tokenAgeYoungHours,
        RISK_WEIGHTS.tokenAge,
      ),
    );
    // Require stable liquidity for full marks: if liquidity is thin, cap age points.
    const thinLiquidity = input.liquidity.usd < THRESHOLDS.liquidityMinUsd;
    if (thinLiquidity) points = Math.min(points, RISK_WEIGHTS.tokenAge * 0.5);
    points = round(points);
    breakdown.push({
      key: 'token_age',
      label: 'Token age',
      points,
      maxPoints: RISK_WEIGHTS.tokenAge,
      detail: formatAgeDetail(input.ageHours, thinLiquidity),
      status: statusFor(points, RISK_WEIGHTS.tokenAge),
    });
  }

  // Base additive score from the six weighted factors above.
  let score = clamp(Math.round(breakdown.reduce((sum, b) => sum + b.points, 0)));

  // ── Critical override signals (post-model flags) ──
  // These are red-flag checks rendered as 0/0 "flag" lines: they cap or penalize
  // the score rather than contributing points, so a single fatal issue (honeypot)
  // can override an otherwise-clean six-factor score.
  const flag = (key: string, label: string, detail: string, status: ScoreBreakdownItem['status']): void => {
    breakdown.push({ key, label, points: 0, maxPoints: 0, detail, status });
  };

  // 7. Can I sell? (honeypot) — dominant. No sell route ⇒ force High band.
  const sc = input.sellCheck;
  if (sc.sellable === false) {
    score = Math.min(score, 15);
    flag('honeypot', 'Can I sell? (honeypot check)', sc.note, 'fail');
  } else if (sc.sellable === true) {
    const tax = sc.impliedTaxPct ?? 0;
    if (tax >= 15) {
      score = clamp(score - 15);
      flag('sell_tax', 'Can I sell? (transfer tax)', sc.note, 'fail');
    } else if (tax >= 5) {
      score = clamp(score - 6);
      flag('sell_tax', 'Can I sell? (transfer tax)', sc.note, 'warn');
    } else {
      flag('honeypot', 'Can I sell? (honeypot check)', sc.note, 'pass');
    }
  } else {
    flag('honeypot', 'Can I sell? (honeypot check)', sc.note, 'unknown');
  }

  // 8. Bundled launch / sniper concentration.
  if (input.launch.bundledSuspected) {
    score = clamp(score - 12);
    flag('bundled_launch', 'Bundled launch / snipers', input.launch.note, 'fail');
  } else if (input.launch.insiderCount > 0) {
    flag('bundled_launch', 'Bundled launch / snipers', input.launch.note, 'warn');
  }

  // 9. Dev/deployer reputation (fresh wallet + serial launches).
  const dr = input.devReputation;
  const priorTokens = dr.priorTokenCount ?? 0;
  if (dr.freshWallet && priorTokens >= 5) {
    score = clamp(score - 12);
    flag('dev_reputation', 'Dev wallet reputation', dr.note, 'fail');
  } else if (priorTokens >= 5) {
    score = clamp(score - 6);
    flag('dev_reputation', 'Dev wallet reputation', dr.note, 'warn');
  } else if (dr.freshWallet) {
    score = clamp(score - 4);
    flag('dev_reputation', 'Dev wallet reputation', dr.note, 'warn');
  } else if (dr.wallet) {
    flag('dev_reputation', 'Dev wallet reputation', dr.note, 'pass');
  }

  score = clamp(Math.round(score));
  const band = bandForScore(score);

  return {
    score,
    band,
    bandLabel: RISK_BANDS[band].label,
    breakdown,
  };
}

function formatAgeDetail(ageHours: number, thinLiquidity: boolean): string {
  const base =
    ageHours < 1
      ? 'Launched < 1 hour ago — brand new, highest volatility.'
      : ageHours < THRESHOLDS.tokenAgeYoungHours
        ? `~${Math.round(ageHours)}h old — very young launch.`
        : ageHours < THRESHOLDS.tokenAgeStableHours
          ? `~${Math.round(ageHours / 24)}d old.`
          : `${Math.round(ageHours / 24)}d old — survived the early rug window.`;
  return thinLiquidity ? `${base} Liquidity is thin, so age credit is reduced.` : base;
}

export function bandForScore(score: number): RiskBand {
  if (score >= RISK_BANDS.low.min) return 'low';
  if (score >= RISK_BANDS.medium.min) return 'medium';
  return 'high';
}

// ─────────────────────────────────────────────────────────────
// Potential Score (0–100, higher = more upside SIGNAL, not a prediction)
// ─────────────────────────────────────────────────────────────

export function computePotentialScore(input: ScanInput): PotentialScore {
  const breakdown: ScoreBreakdownItem[] = [];

  // 1. Liquidity depth (25)
  {
    const points = round(
      scaleUp(input.liquidity.usd, THRESHOLDS.liquidityFullUsd, POTENTIAL_WEIGHTS.liquidityDepth),
    );
    breakdown.push({
      key: 'liquidity_depth',
      label: 'Liquidity depth',
      points,
      maxPoints: POTENTIAL_WEIGHTS.liquidityDepth,
      detail: `$${formatUsdShort(input.liquidity.usd)} in the pool.`,
      status: statusFor(points, POTENTIAL_WEIGHTS.liquidityDepth),
    });
  }

  // 2. Holder growth rate (25)
  {
    const windowH = input.holders.growthWindowHours || 24;
    const perHour = (input.holders.recentGrowth || 0) / Math.max(1, windowH);
    const points = round(scaleUp(perHour, THRESHOLDS.holderGrowthFull, POTENTIAL_WEIGHTS.holderGrowth));
    breakdown.push({
      key: 'holder_growth',
      label: 'Holder growth rate',
      points,
      maxPoints: POTENTIAL_WEIGHTS.holderGrowth,
      detail:
        input.holders.recentGrowth == null
          ? 'Growth data unavailable.'
          : `~${perHour.toFixed(1)} new holders/hr over ${windowH}h.`,
      status: statusFor(points, POTENTIAL_WEIGHTS.holderGrowth),
    });
  }

  // 3. Social presence completeness (20) — website + X + TG all present AND unflagged
  {
    const s = input.socials;
    const hasWebsite = !!s.website.url;
    const hasX = !!s.x.url || !!s.x.handle;
    const hasTg = !!s.telegram.url;
    const presentCount = [hasWebsite, hasX, hasTg].filter(Boolean).length;
    let points = (presentCount / 3) * POTENTIAL_WEIGHTS.socialCompleteness;
    // Domain mismatch zeroes the completeness bonus for trust.
    if (s.domainMismatch) points = Math.min(points, POTENTIAL_WEIGHTS.socialCompleteness * 0.25);
    points = round(points);
    breakdown.push({
      key: 'social_completeness',
      label: 'Social presence completeness',
      points,
      maxPoints: POTENTIAL_WEIGHTS.socialCompleteness,
      detail: s.allMissing
        ? 'No socials found at all — major red flag for legitimacy.'
        : `${presentCount}/3 socials present (site ${hasWebsite ? 'yes' : 'no'}, X ${hasX ? 'yes' : 'no'}, TG ${hasTg ? 'yes' : 'no'})${s.domainMismatch ? ' — domain mismatch flagged.' : '.'}`,
      status: statusFor(points, POTENTIAL_WEIGHTS.socialCompleteness),
    });
  }

  // 4. Social account health (15) — age + follower/member counts above spam thresholds
  {
    const s = input.socials;
    let health = 0;
    let signals = 0;
    // X followers + account age
    if (s.x.followers != null) {
      signals++;
      health += clamp(s.x.followers / THRESHOLDS.xFollowersSpam, 0, 1);
    }
    if (s.x.accountAgeDays != null) {
      signals++;
      health += clamp(s.x.accountAgeDays / THRESHOLDS.xAccountAgeSpamDays, 0, 1);
    }
    // TG members
    if (s.telegram.memberCount != null) {
      signals++;
      health += clamp(s.telegram.memberCount / THRESHOLDS.tgMembersSpam, 0, 1);
    }
    // Domain age
    if (s.website.domainAgeDays != null) {
      signals++;
      health += clamp(s.website.domainAgeDays / THRESHOLDS.domainAgeSpamDays, 0, 1);
    }
    const points = signals === 0 ? 0 : round((health / signals) * POTENTIAL_WEIGHTS.socialHealth);
    breakdown.push({
      key: 'social_health',
      label: 'Social account health',
      points,
      maxPoints: POTENTIAL_WEIGHTS.socialHealth,
      detail:
        signals === 0
          ? 'No verifiable account-age/follower data.'
          : `Account age & audience checked across ${signals} signal${signals > 1 ? 's' : ''}.`,
      status: statusFor(points, POTENTIAL_WEIGHTS.socialHealth),
    });
  }

  // 5. Volume-to-liquidity ratio (15) — healthy churn; taper if overheated
  {
    const liq = Math.max(1, input.liquidity.usd);
    const ratio = input.volume24hUsd / liq;
    let points: number;
    if (ratio <= THRESHOLDS.volLiqRatioFull) {
      points = scaleUp(ratio, THRESHOLDS.volLiqRatioFull, POTENTIAL_WEIGHTS.volumeToLiquidity);
    } else if (ratio >= THRESHOLDS.volLiqRatioOverheated) {
      points = POTENTIAL_WEIGHTS.volumeToLiquidity * 0.3; // suspicious wash/dump churn
    } else {
      // Between full and overheated: full marks (healthy active trading).
      points = POTENTIAL_WEIGHTS.volumeToLiquidity;
    }
    points = round(points);
    breakdown.push({
      key: 'vol_liq_ratio',
      label: 'Volume-to-liquidity ratio',
      points,
      maxPoints: POTENTIAL_WEIGHTS.volumeToLiquidity,
      detail: `24h volume is ${ratio.toFixed(2)}× the pool size${ratio >= THRESHOLDS.volLiqRatioOverheated ? ' — unusually high, possible wash trading.' : ratio < 0.1 ? ' — very quiet.' : '.'}`,
      status: statusFor(points, POTENTIAL_WEIGHTS.volumeToLiquidity),
    });
  }

  const score = clamp(Math.round(breakdown.reduce((sum, b) => sum + b.points, 0)));

  return {
    score,
    breakdown,
    disclaimer: POTENTIAL_DISCLAIMER,
  };
}

// ─────────────────────────────────────────────────────────────
// Small formatter used inside breakdown details
// ─────────────────────────────────────────────────────────────

function formatUsdShort(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
}
