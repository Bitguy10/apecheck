'use client';

import { useState } from 'react';
import type { ScanResult } from '@apecheck/core';

/** Copy a shareable link (or use the native share sheet) for TG/X posting. */
export function ShareButton({ scan }: { scan: ScanResult }) {
  const [copied, setCopied] = useState(false);

  const url = typeof window !== 'undefined' ? `${window.location.origin}/token/${scan.tokenAddress}` : '';
  const text = `${scan.meta.symbol ? '$' + scan.meta.symbol : 'Token'} · ApeCheck risk ${scan.riskScore}/100 (${scan.riskBandLabel}) · potential ${scan.potentialScore}/100`;

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'ApeCheck scan', text, url });
        return;
      } catch {
        /* fell through to copy */
      }
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  }

  return (
    <button
      onClick={share}
      className="rounded-lg border border-border bg-panel-2 px-4 py-2.5 text-sm font-semibold text-text-secondary transition-colors hover:border-solana-purple/60 hover:text-text-primary"
    >
      {copied ? '✓ link copied' : '↗ Share scan'}
    </button>
  );
}
