'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { shortenAddress, timeAgo } from '@apecheck/core';
import { getRecentScans, type RecentScan } from '@/lib/recent-scans';

const BAND_COLOR: Record<string, string> = {
  low: 'text-signal-green',
  medium: 'text-warning-amber',
  high: 'text-rug-red',
};

/** Recent scans list (reads local history for anonymous users). */
export function RecentScans() {
  const [scans, setScans] = useState<RecentScan[]>([]);
  const [now, setNow] = useState(0);

  useEffect(() => {
    setScans(getRecentScans());
    setNow(Date.now());
  }, []);

  if (scans.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-panel/40 p-6 text-center">
        <p className="font-mono text-xs text-text-muted">
          {'>'} no recent scans yet. paste an address above to start.
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border/60 overflow-hidden rounded-lg border border-border bg-panel/60">
      {scans.map((s) => (
        <li key={s.tokenAddress}>
          <Link
            href={`/token/${s.tokenAddress}`}
            className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-panel-2"
          >
            <div className="min-w-0">
              <div className="truncate font-display text-sm font-semibold text-text-primary">
                {s.name || 'Unknown'}{' '}
                {s.symbol && <span className="text-text-muted">${s.symbol}</span>}
              </div>
              <div className="font-mono text-[11px] text-text-muted">{shortenAddress(s.tokenAddress, 6, 6)}</div>
            </div>
            <div className="flex items-center gap-3 text-right">
              <div>
                <div className={`font-display text-lg font-bold ${BAND_COLOR[s.riskBand] || 'text-text-secondary'}`}>
                  {s.riskScore}
                </div>
                {now > 0 && <div className="font-mono text-[10px] text-text-muted">{timeAgo(s.scannedAt, now)}</div>}
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
