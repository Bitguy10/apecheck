'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isValidSolanaAddress, normalizeAddress } from '@apecheck/core';

/**
 * The hero element: a single centered input with a blinking terminal cursor.
 * By default it routes to /token/[address] (which runs the scan). Pass
 * `onSubmit` to handle a valid address in place instead (used by the Scan tab).
 */
export function SearchBar({
  autoFocus = true,
  onSubmit,
  initialValue = '',
  cta = 'SCAN',
}: {
  autoFocus?: boolean;
  onSubmit?: (address: string) => void;
  initialValue?: string;
  cta?: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const addr = normalizeAddress(value);
    if (!isValidSolanaAddress(addr)) {
      setError('That doesn’t look like a valid Solana address.');
      return;
    }
    setError(null);
    if (onSubmit) onSubmit(addr);
    else router.push(`/token/${addr}`);
  }

  async function paste() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setValue(text.trim());
      inputRef.current?.focus();
    } catch {
      inputRef.current?.focus();
    }
  }

  const showCursor = !focused && value.length === 0;

  return (
    <form onSubmit={submit} className="w-full">
      <div
        className={`group relative flex items-center gap-2 rounded-xl border bg-panel-2/80 px-4 py-4 transition-all ${
          focused ? 'border-signal-green/70 shadow-glow-green' : 'border-border'
        }`}
      >
        <span className="select-none font-mono text-signal-green">$</span>
        <div className="relative flex-1">
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              if (error) setError(null);
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            spellCheck={false}
            autoComplete="off"
            className="w-full bg-transparent font-mono text-sm text-text-primary outline-none placeholder:text-text-muted sm:text-base"
            placeholder=""
            aria-label="Solana contract address"
          />
          {showCursor && (
            <span className="pointer-events-none absolute left-0 top-0 font-mono text-sm text-text-muted sm:text-base">
              paste token contract address<span className="terminal-cursor" />
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={paste}
          className="hidden rounded-md border border-border px-2 py-1 font-mono text-[11px] text-text-secondary hover:border-solana-purple/60 hover:text-text-primary sm:inline-block"
        >
          paste
        </button>
        <button
          type="submit"
          className="rounded-md bg-signal-green px-3 py-1.5 font-display text-sm font-bold text-jungle-black transition-transform hover:scale-105 active:scale-95"
        >
          {cta}
        </button>
      </div>
      {error && <p className="mt-2 font-mono text-xs text-rug-red">{error}</p>}
    </form>
  );
}
