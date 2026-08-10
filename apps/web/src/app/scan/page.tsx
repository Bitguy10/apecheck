'use client';

import { useEffect, useState } from 'react';
import { shortenAddress } from '@apecheck/core';
import { SearchBar } from '@/components/SearchBar';
import { ScanResultView } from '@/components/ScanResultView';
import { RecentScans } from '@/components/RecentScans';
import { getActiveScan, setActiveScan, clearActiveScan } from '@/lib/active-scan';

/**
 * Scan tab — a persistent scanning workspace. Whatever token you last scanned is
 * remembered locally, so leaving the tab and coming back resumes it. Start a new
 * scan from the search box; recent scans sit below for quick re-entry.
 */
export default function ScanPage() {
  const [address, setAddress] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // Resume the active scan (if any) on mount.
  useEffect(() => {
    const active = getActiveScan();
    if (active?.address) setAddress(active.address);
    setReady(true);
  }, []);

  function startScan(addr: string) {
    setActiveScan({ address: addr, name: null, symbol: null, updatedAt: new Date().toISOString() });
    setAddress(addr);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function scanAnother() {
    clearActiveScan();
    setAddress(null);
  }

  if (!ready) return null;

  return (
    <div className="py-6">
      <div className="mb-4 flex items-baseline justify-between">
        <h1 className="font-display text-2xl font-bold text-text-primary">Scan</h1>
        {address && (
          <button
            onClick={scanAnother}
            className="font-mono text-[11px] text-text-muted transition-colors hover:text-signal-green"
          >
            + scan another token
          </button>
        )}
      </div>

      {!address && (
        <>
          <p className="mb-3 max-w-lg text-sm text-text-secondary">
            Paste a Solana contract address to scan it for rug risk. Your scan stays here — leave the tab and
            come back to pick up right where you left off.
          </p>
          <SearchBar autoFocus onSubmit={startScan} />
        </>
      )}

      {address && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 rounded-lg border border-signal-green/30 bg-signal-green/5 px-4 py-2.5">
            <div className="min-w-0 font-mono text-[11px] text-text-secondary">
              <span className="text-signal-green">▸ resuming</span> {shortenAddress(address, 6, 6)}
            </div>
            <span className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-text-muted">saved locally</span>
          </div>

          {/* key forces a fresh scan lifecycle when the active address changes */}
          <ScanResultView key={address} address={address} />
        </div>
      )}

      <section className="mt-8">
        <h2 className="mb-2 font-mono text-xs uppercase tracking-widest text-text-muted">recent scans</h2>
        <RecentScans />
      </section>
    </div>
  );
}
