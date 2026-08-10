import {
  formatUsd,
  formatTokenPrice,
  formatPercent,
  formatSignedPercent,
  formatNumber,
  shortenAddress,
  type ScanResult,
} from '@apecheck/core';
import { escapeHtml } from './telegram';

/**
 * Pure ScanResult → Telegram HTML formatters for the bot commands.
 * Mirrors the web results view + LiveEmbeds link scheme. No I/O here.
 */

const RISK_DOT: Record<string, string> = { low: '🟢', medium: '🟡', high: '🔴' };

/** Non-dismissible risk disclaimer, mandated near any buy/score surface. */
export const RISK_DISCLAIMER =
  '⚠️ <i>Risk signal, not a guarantee — not financial advice. Only ape what you can afford to lose.</i>';

// ── Link builders (match apps/web/src/components/LiveEmbeds.tsx) ──
export function chartUrl(scan: ScanResult): string | null {
  const pair = scan.market.primaryPair;
  return pair ? `https://www.geckoterminal.com/solana/pools/${pair.pairAddress}` : null;
}
export function tradesUrl(scan: ScanResult): string | null {
  const pair = scan.market.primaryPair;
  return pair ? `https://www.geckoterminal.com/solana/pools/${pair.pairAddress}?swaps=1` : null;
}
export function bubbleUrl(scan: ScanResult): string {
  return `https://app.bubblemaps.io/sol/token/${scan.tokenAddress}`;
}
export function appTokenUrl(appUrl: string, address: string): string {
  return `${appUrl.replace(/\/$/, '')}/token/${address}`;
}

// ── Header shared by /scan and every section command ──
export function fmtHeader(scan: ScanResult): string {
  const name = escapeHtml(scan.meta.name || 'Unknown token');
  const sym = scan.meta.symbol ? ` <b>$${escapeHtml(scan.meta.symbol)}</b>` : '';
  const dot = RISK_DOT[scan.riskBand] ?? '⚪';
  return (
    `🦍 <b>${name}</b>${sym}\n` +
    `<code>${scan.tokenAddress}</code>\n` +
    `${dot} Risk <b>${scan.riskScore}/100</b> · ${escapeHtml(scan.riskBandLabel)}` +
    ` · 📈 Potential <b>${scan.potentialScore}/100</b>`
  );
}

export function fmtAuthorities(scan: ScanResult): string {
  const mint = scan.authorities.mintActive ? '🔴 ACTIVE (can mint more)' : '🟢 revoked';
  const freeze = scan.authorities.freezeActive ? '🔴 ACTIVE (can freeze wallets)' : '🟢 revoked';
  return `🔑 <b>Authorities</b>\nMint: ${mint}\nFreeze: ${freeze}`;
}

export function fmtLiquidity(scan: ScanResult): string {
  const l = scan.liquidity;
  const state = l.burned ? '🔥 burned' : l.locked ? '🔒 locked' : '🔴 unlocked';
  const frac = l.lockedFraction > 0 && l.lockedFraction < 1 ? ` (${formatPercent(l.lockedFraction * 100, 0)})` : '';
  return `💧 <b>Liquidity</b>\n${formatUsd(l.usd)} · ${state}${frac}`;
}

export function fmtDev(scan: ScanResult): string {
  const d = scan.devReputation;
  const addr = scan.devWallet.address ? `\n<code>${shortenAddress(scan.devWallet.address, 6, 6)}</code>` : '';
  const rep = [
    d.walletAgeDays != null ? `age ${d.walletAgeDays}d` : null,
    d.priorTokenCount != null ? `${d.priorTokenCount} prior tokens` : null,
    d.freshWallet ? '🔴 fresh wallet' : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return `👤 <b>Dev wallet</b>\nHolds ${formatPercent(scan.devWallet.percentHeld)} of supply${addr}${rep ? `\n${rep}` : ''}`;
}

export function fmtHolders(scan: ScanResult): string {
  const top = scan.topHolders
    .filter((h) => !h.isLiquidityPool)
    .slice(0, 5)
    .map((h) => `  #${h.rank} ${formatPercent(h.pct)}${h.tag ? ` (${h.tag})` : ''}`)
    .join('\n');
  return (
    `👥 <b>Holders</b>\n${formatNumber(scan.holders.count)} holders · top 10 hold ` +
    `${formatPercent(scan.holders.topHolderPercent)}${top ? `\n${top}` : ''}`
  );
}

export function fmtHoneypot(scan: ScanResult): string {
  const s = scan.sellCheck;
  const verdict = s.sellable === true ? '🟢 Sellable' : s.sellable === false ? '🔴 Likely honeypot' : '⚪ Unknown';
  const tax = s.impliedTaxPct != null ? `\nImplied tax ~${formatPercent(s.impliedTaxPct)}` : '';
  return `🧪 <b>Can I sell?</b>\n${verdict}${tax}\n<i>${escapeHtml(s.note)}</i>`;
}

export function fmtMarket(scan: ScanResult): string {
  const m = scan.market;
  return (
    `💰 <b>Market</b>\n` +
    `Price ${formatTokenPrice(m.priceUsd)} · 24h ${formatSignedPercent(m.priceChange24hPct)}\n` +
    `MC ${formatUsd(m.marketCapUsd)} · FDV ${formatUsd(m.fdvUsd)}\n` +
    `Vol 24h ${formatUsd(m.volume24hUsd)}`
  );
}

export function fmtLinks(scan: ScanResult, appUrl: string): string {
  const parts: string[] = [];
  const chart = chartUrl(scan);
  if (chart) parts.push(`<a href="${chart}">📈 Chart</a>`);
  parts.push(`<a href="${bubbleUrl(scan)}">🫧 Bubble map</a>`);
  parts.push(`<a href="${appTokenUrl(appUrl, scan.tokenAddress)}">🦍 Open in ApeCheck</a>`);
  return parts.join(' · ');
}

/** Full one-message scan card. */
export function fmtScanCard(scan: ScanResult, appUrl: string): string {
  return [
    fmtHeader(scan),
    '',
    fmtLiquidity(scan),
    fmtAuthorities(scan),
    fmtHoneypot(scan),
    fmtMarket(scan),
    '',
    `<i>${escapeHtml(scan.potentialDisclaimer)}</i>`,
    fmtLinks(scan, appUrl),
    '',
    RISK_DISCLAIMER,
  ].join('\n');
}
