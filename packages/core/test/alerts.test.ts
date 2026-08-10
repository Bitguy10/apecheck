import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectAlerts, snapshotBaseline, ALERT_THRESHOLDS } from '../src/alerts';
import type { WatchBaseline } from '../src/alerts';
import type { ScanResult, TopHolder } from '../src/types';

function holder(address: string, pct: number, isLiquidityPool = false): TopHolder {
  return { rank: 0, address, pct, insider: false, isLiquidityPool };
}

/** Minimal ScanResult fixture — only the fields detectAlerts/snapshotBaseline read matter. */
function baseScan(overrides: Partial<ScanResult> = {}): ScanResult {
  return {
    tokenAddress: 'Tok1111111111111111111111111111111111111111',
    meta: { address: 'Tok', name: 'Test', symbol: 'TST', imageUrl: null },
    market: {
      priceUsd: 0.01,
      marketCapUsd: 1_000_000,
      fdvUsd: 1_000_000,
      priceChange24hPct: 0,
      volume24hUsd: 100_000,
      supply: 100_000_000,
      primaryPair: { dexId: 'raydium', pairAddress: 'pair' },
    },
    riskScore: 80,
    potentialScore: 50,
    riskBand: 'low',
    riskBandLabel: 'Low Risk',
    riskBreakdown: [],
    potentialBreakdown: [],
    potentialDisclaimer: 'Signal strength only — not financial advice, not a price prediction.',
    devWallet: { address: 'dev', percentHeld: 2 },
    holders: { count: 1000, topHolderPercent: 10 },
    topHolders: [],
    liquidity: { usd: 100_000, locked: true, lockedFraction: 1, burned: true },
    authorities: { mintActive: false, freezeActive: false },
    ageHours: 240,
    socials: {
      website: { url: null, domainAgeDays: null },
      x: { handle: null, url: null, accountAgeDays: null, followers: null },
      telegram: { url: null, memberCount: null, isPublic: null },
      domainMismatch: false,
      allMissing: true,
    },
    dexListings: [],
    sellCheck: { sellable: true, impliedTaxPct: 0, buyPriceImpactPct: 1, sellPriceImpactPct: 1, note: 'ok' },
    launch: { insiderCount: 0, insiderPercent: 0, bundledSuspected: false, note: 'none' },
    devReputation: { wallet: 'dev', walletAgeDays: 100, priorTokenCount: 1, freshWallet: false, note: 'ok' },
    warnings: [],
    cached: false,
    scannedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function baseline(overrides: Partial<WatchBaseline> = {}): WatchBaseline {
  return {
    liquidityUsd: 100_000,
    mintActive: false,
    freezeActive: false,
    priceUsd: 0.01,
    devPercent: 2,
    topHolders: [],
    capturedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

test('quiet scan trips no alerts', () => {
  assert.equal(detectAlerts(baseline(), baseScan()).length, 0);
});

test('LP pull fires when liquidity collapses past the threshold', () => {
  const alerts = detectAlerts(baseline({ liquidityUsd: 100_000 }), baseScan({ liquidity: { usd: 40_000, locked: true, lockedFraction: 1, burned: true } }));
  const lp = alerts.find((a) => a.type === 'lp_pull');
  assert.ok(lp, 'expected lp_pull');
  assert.equal(lp!.dedupeMode, 'lower-is-worse');
  assert.equal(lp!.dedupeValue, 40_000);
});

test('LP pull ignored on dust pools below the min-liquidity floor', () => {
  const dust = ALERT_THRESHOLDS.lpPullMinLiquidityUsd - 1;
  const alerts = detectAlerts(baseline({ liquidityUsd: dust }), baseScan({ liquidity: { usd: 0, locked: false, lockedFraction: 0, burned: false } }));
  assert.equal(alerts.find((a) => a.type === 'lp_pull'), undefined);
});

test('authority re-enable fires once (off → on)', () => {
  const alerts = detectAlerts(baseline({ mintActive: false }), baseScan({ authorities: { mintActive: true, freezeActive: false } }));
  const a = alerts.find((x) => x.type === 'authority_reenabled');
  assert.ok(a);
  assert.equal(a!.dedupeMode, 'once');
  assert.equal(a!.dedupeValue, 1);
});

test('authority already-on at baseline does not re-fire', () => {
  const alerts = detectAlerts(baseline({ mintActive: true }), baseScan({ authorities: { mintActive: true, freezeActive: false } }));
  assert.equal(alerts.find((a) => a.type === 'authority_reenabled'), undefined);
});

test('price drop fires past the threshold with monotonic dedupe', () => {
  const alerts = detectAlerts(baseline({ priceUsd: 0.01 }), baseScan({ market: { ...baseScan().market, priceUsd: 0.004 } }));
  const p = alerts.find((a) => a.type === 'price_drop');
  assert.ok(p);
  assert.equal(p!.dedupeValue, Math.round(0.004 * 1e9));
});

test('big holder sell picks the worst tracked holder', () => {
  const base = baseline({ topHolders: [{ address: 'whaleA', pct: 10 }, { address: 'whaleB', pct: 5 }] });
  const scan = baseScan({ topHolders: [holder('whaleA', 3), holder('whaleB', 4.9)] });
  const alerts = detectAlerts(base, scan);
  const w = alerts.find((a) => a.type === 'big_holder_sell');
  assert.ok(w);
  assert.equal((w!.detail as { address: string }).address, 'whaleA');
});

test('snapshotBaseline drops LP holders and caps at 10', () => {
  const holders = [holder('lp', 50, true), ...Array.from({ length: 12 }, (_, i) => holder('h' + i, 3))];
  const snap = snapshotBaseline(baseScan({ topHolders: holders }), Date.parse('2026-01-01T00:00:00.000Z'));
  assert.equal(snap.topHolders.length, 10);
  assert.equal(snap.topHolders.find((h) => h.address === 'lp'), undefined);
});
