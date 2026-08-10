import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeRiskScore, computePotentialScore } from '../src/scoring';
import { bandForScore } from '../src/scoring';
import type { ScanInput } from '../src/types';

function baseInput(overrides: Partial<ScanInput> = {}): ScanInput {
  return {
    meta: { address: 'x', name: 'Test', symbol: 'TST', imageUrl: null },
    authorities: { mintActive: false, freezeActive: false, mintKnown: true, freezeKnown: true },
    liquidity: { usd: 100_000, locked: true, lockedFraction: 1, burned: true, lockKnown: true },
    devWallet: { address: 'dev', percentHeld: 2 },
    holders: { count: 5000, topHolderPercent: 15, topHolderKnown: true, recentGrowth: 1200, growthWindowHours: 24 },
    ageHours: 10 * 24,
    socials: {
      website: { url: 'https://a.com', domainAgeDays: 400 },
      x: { handle: 'a', url: 'https://x.com/a', accountAgeDays: 300, followers: 20000 },
      telegram: { url: 'https://t.me/a', memberCount: 5000, isPublic: true },
      domainMismatch: false,
      allMissing: false,
    },
    dexListings: [],
    volume24hUsd: 150_000,
    market: {
      priceUsd: 0.01,
      marketCapUsd: 1_000_000,
      fdvUsd: 1_000_000,
      priceChange24hPct: 5,
      volume24hUsd: 150_000,
      supply: 100_000_000,
      primaryPair: { dexId: 'raydium', pairAddress: 'pair' },
    },
    topHolders: [],
    sellCheck: {
      sellable: true,
      impliedTaxPct: 0,
      buyPriceImpactPct: 1,
      sellPriceImpactPct: 1,
      note: 'Sellable — a round-trip sell route back to SOL exists.',
    },
    launch: { insiderCount: 0, insiderPercent: 0, bundledSuspected: false, note: 'No insiders.' },
    devReputation: { wallet: 'dev', walletAgeDays: 120, priorTokenCount: 1, freshWallet: false, note: 'Established.' },
    warnings: [],
    ...overrides,
  };
}

test('perfect-safe token scores in Low Risk band', () => {
  const r = computeRiskScore(baseInput());
  assert.equal(r.score, 100);
  assert.equal(r.band, 'low');
});

test('active mint + freeze authority and unlocked LP tanks the score', () => {
  const r = computeRiskScore(
    baseInput({
      authorities: { mintActive: true, freezeActive: true, mintKnown: true, freezeKnown: true },
      liquidity: { usd: 100_000, locked: false, lockedFraction: 0, burned: false, lockKnown: true },
    }),
  );
  // Loses 20 (mint) + 15 (freeze) + 25 (LP) = 60 → 40
  assert.equal(r.score, 40);
  assert.equal(r.band, 'high');
});

test('high dev holding scales dev points toward zero', () => {
  const r = computeRiskScore(baseInput({ devWallet: { address: 'dev', percentHeld: 30 } }));
  const dev = r.breakdown.find((b) => b.key === 'dev_holding');
  assert.equal(dev?.points, 0);
});

test('unknown authorities are treated as risk, not safe', () => {
  const r = computeRiskScore(
    baseInput({
      authorities: { mintActive: true, freezeActive: true, mintKnown: false, freezeKnown: false },
    }),
  );
  const mint = r.breakdown.find((b) => b.key === 'mint_authority');
  assert.equal(mint?.status, 'unknown');
  assert.equal(mint?.points, 0);
});

test('band boundaries', () => {
  assert.equal(bandForScore(80), 'low');
  assert.equal(bandForScore(79), 'medium');
  assert.equal(bandForScore(50), 'medium');
  assert.equal(bandForScore(49), 'high');
});

test('potential score rewards liquidity + growth + complete socials', () => {
  const p = computePotentialScore(baseInput());
  assert.ok(p.score >= 80, `expected high potential, got ${p.score}`);
  assert.ok(p.disclaimer.includes('not financial advice'));
});

test('missing socials sink the potential completeness sub-score', () => {
  const p = computePotentialScore(
    baseInput({
      socials: {
        website: { url: null, domainAgeDays: null },
        x: { handle: null, url: null, accountAgeDays: null, followers: null },
        telegram: { url: null, memberCount: null, isPublic: null },
        domainMismatch: false,
        allMissing: true,
      },
    }),
  );
  const completeness = p.breakdown.find((b) => b.key === 'social_completeness');
  assert.equal(completeness?.points, 0);
});

test('honeypot (no sell route) forces the score into the High band', () => {
  const r = computeRiskScore(
    baseInput({
      sellCheck: {
        sellable: false,
        impliedTaxPct: null,
        buyPriceImpactPct: 2,
        sellPriceImpactPct: null,
        note: 'Buy route exists but NO sell route — classic honeypot pattern. High risk.',
      },
    }),
  );
  // Otherwise-perfect token capped to ≤15 by the honeypot override.
  assert.ok(r.score <= 15, `expected honeypot cap, got ${r.score}`);
  assert.equal(r.band, 'high');
  const flag = r.breakdown.find((b) => b.key === 'honeypot');
  assert.equal(flag?.status, 'fail');
});

test('high transfer tax penalizes but does not zero the score', () => {
  const r = computeRiskScore(
    baseInput({
      sellCheck: {
        sellable: true,
        impliedTaxPct: 20,
        buyPriceImpactPct: 1,
        sellPriceImpactPct: 1,
        note: 'Sellable, but ~20% is lost beyond slippage — likely a high transfer tax.',
      },
    }),
  );
  // 100 base − 15 tax penalty = 85.
  assert.equal(r.score, 85);
  const flag = r.breakdown.find((b) => b.key === 'sell_tax');
  assert.equal(flag?.status, 'fail');
});

test('bundled launch applies a concentration penalty', () => {
  const r = computeRiskScore(
    baseInput({
      launch: { insiderCount: 4, insiderPercent: 22, bundledSuspected: true, note: 'Bundled.' },
    }),
  );
  // 100 base − 12 bundled penalty = 88.
  assert.equal(r.score, 88);
  const flag = r.breakdown.find((b) => b.key === 'bundled_launch');
  assert.equal(flag?.status, 'fail');
});

test('fresh serial-launcher dev wallet penalizes the score', () => {
  const r = computeRiskScore(
    baseInput({
      devReputation: { wallet: 'dev', walletAgeDays: 1, priorTokenCount: 12, freshWallet: true, note: 'Serial.' },
    }),
  );
  // 100 base − 12 dev-rep penalty = 88.
  assert.equal(r.score, 88);
  const flag = r.breakdown.find((b) => b.key === 'dev_reputation');
  assert.equal(flag?.status, 'fail');
});
