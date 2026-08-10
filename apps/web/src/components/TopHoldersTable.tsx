'use client';

import { shortenAddress, formatPercent } from '@apecheck/core';
import type { TopHolder, LaunchAnalysis } from '@apecheck/core';
import { CopyButton } from './CopyButton';

function TagPill({ tag }: { tag: string }) {
  const isLp = tag === 'LP';
  return (
    <span
      className={`rounded px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider ${
        isLp
          ? 'border border-solana-purple/40 bg-solana-purple/10 text-solana-purple'
          : 'border border-rug-red/40 bg-rug-red/10 text-rug-red'
      }`}
    >
      {tag}
    </span>
  );
}

/** Top holder concentration table. Each wallet links out to Solscan for tracking. */
export function TopHoldersTable({
  holders,
  launch,
}: {
  holders: TopHolder[];
  launch: LaunchAnalysis;
}) {
  if (!holders || holders.length === 0) {
    return (
      <div>
        <h2 className="mb-2 font-mono text-xs uppercase tracking-widest text-text-muted">top holders</h2>
        <div className="rounded-lg border border-border bg-panel/60 px-4 py-6 text-center text-xs text-text-muted">
          Holder distribution unavailable for this token.
        </div>
      </div>
    );
  }

  const maxPct = Math.max(...holders.map((h) => h.pct), 1);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-mono text-xs uppercase tracking-widest text-text-muted">top holders</h2>
        <span className="font-mono text-[10px] text-text-muted">tap a wallet to track on solscan</span>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-panel/60">
        {holders.map((h) => (
          <div
            key={h.rank + h.address}
            className="flex items-center gap-3 border-b border-border/40 px-3 py-2 last:border-b-0"
          >
            <span className="w-5 shrink-0 text-right font-mono text-[11px] text-text-muted">{h.rank}</span>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <a
                  href={`https://solscan.io/account/${h.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate font-mono text-xs text-text-secondary hover:text-signal-green hover:underline"
                  title="View wallet on Solscan"
                >
                  {shortenAddress(h.address, 5, 5)}
                </a>
                {h.tag && <TagPill tag={h.tag} />}
                <CopyButton value={h.address} display="" className="opacity-60 hover:opacity-100" />
              </div>
              {/* concentration bar */}
              <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-panel-2">
                <div
                  className={`h-full rounded-full ${
                    h.isLiquidityPool ? 'bg-solana-purple/50' : h.insider ? 'bg-rug-red/60' : 'bg-signal-green/50'
                  }`}
                  style={{ width: `${Math.max(3, (h.pct / maxPct) * 100)}%` }}
                />
              </div>
            </div>

            <span className="w-14 shrink-0 text-right font-display text-sm font-bold text-text-primary">
              {formatPercent(h.pct)}
            </span>
          </div>
        ))}
      </div>

      {/* Launch / insider analysis note */}
      <div
        className={`mt-2 rounded-lg border px-3 py-2 text-[11px] ${
          launch.bundledSuspected
            ? 'border-rug-red/40 bg-rug-red/5 text-rug-red/90'
            : launch.insiderCount > 0
              ? 'border-warning-amber/30 bg-warning-amber/5 text-warning-amber/90'
              : 'border-border bg-panel-2 text-text-secondary'
        }`}
      >
        <span className="font-mono uppercase tracking-wider">launch: </span>
        {launch.note}
      </div>
    </div>
  );
}
