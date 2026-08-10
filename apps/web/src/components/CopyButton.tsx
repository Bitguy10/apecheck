'use client';

import { useState } from 'react';
import { shortenAddress } from '@apecheck/core';

/**
 * Persistent copy-contract-address button — used everywhere the address appears.
 */
export function CopyButton({
  value,
  display,
  short = true,
  className = '',
}: {
  value: string;
  display?: string;
  short?: boolean;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard blocked */
    }
  }

  const label = display ?? (short ? shortenAddress(value, 5, 5) : value);

  return (
    <button
      type="button"
      onClick={copy}
      title="Copy contract address"
      className={`inline-flex items-center gap-1.5 rounded-md border border-border bg-panel px-2 py-1 font-mono text-xs text-text-secondary transition-colors hover:border-solana-purple/60 hover:text-text-primary ${className}`}
    >
      <span className="truncate">{label}</span>
      <span className={copied ? 'text-signal-green' : 'text-text-muted'}>
        {copied ? '✓ copied' : '⧉'}
      </span>
    </button>
  );
}
