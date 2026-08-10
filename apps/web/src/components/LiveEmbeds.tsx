'use client';

import { useState } from 'react';
import type { ScanResult } from '@apecheck/core';
import { BubbleMap } from './BubbleMap';

type Tab = 'chart' | 'trades' | 'bubbles';

/**
 * Live embeds using free official iframes:
 *  - Chart & Trades: GeckoTerminal pool embed (swaps=1 shows the live buy/sell feed).
 *  - Bubble Map:     Bubblemaps token map (holder connectivity + concentration).
 * Iframes are only mounted once their tab is opened (heavy third-party frames).
 */
export function LiveEmbeds({ scan }: { scan: ScanResult }) {
  const [tab, setTab] = useState<Tab | null>(null);
  const pair = scan.market.primaryPair;
  const address = scan.tokenAddress;

  const geckoBase = pair
    ? `https://www.geckoterminal.com/solana/pools/${pair.pairAddress}?embed=1&info=0&grayscale=0&light_chart=0`
    : null;
  const chartUrl = geckoBase ? `${geckoBase}&swaps=0` : null;
  const tradesUrl = geckoBase ? `${geckoBase}&swaps=1` : null;
  const bubbleUrl = `https://app.bubblemaps.io/sol/token/${address}`;

  const tabs: { key: Tab; label: string; available: boolean }[] = [
    { key: 'chart', label: '📈 Chart', available: !!chartUrl },
    { key: 'trades', label: '💱 Trades', available: !!tradesUrl },
    { key: 'bubbles', label: '🫧 Bubble map', available: true },
  ];

  return (
    <div>
      <h2 className="mb-2 font-mono text-xs uppercase tracking-widest text-text-muted">live markets</h2>

      <div className="mb-2 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            disabled={!t.available}
            onClick={() => setTab((cur) => (cur === t.key ? null : t.key))}
            className={`rounded-md border px-3 py-1.5 font-mono text-[11px] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              tab === t.key
                ? 'border-signal-green/60 bg-signal-green/10 text-signal-green'
                : 'border-border text-text-secondary hover:border-signal-green/40 hover:text-text-primary'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === null && (
        <div className="rounded-lg border border-dashed border-border bg-panel/40 px-4 py-8 text-center text-xs text-text-muted">
          Select a view above to load the live chart, trade feed, or holder bubble map.
        </div>
      )}

      {tab === 'chart' && chartUrl && <Frame src={chartUrl} title="Price chart" />}
      {tab === 'trades' && tradesUrl && <Frame src={tradesUrl} title="Live trades" />}
      {tab === 'bubbles' && (
        <div>
          <BubbleMap holders={scan.topHolders} />
          <p className="mt-1 text-center font-mono text-[10px] text-text-muted">
            Holder concentration from this scan.{' '}
            <a
              href={bubbleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-solana-purple hover:underline"
            >
              open full transfer graph in Bubblemaps ↗
            </a>
          </p>
        </div>
      )}

      {(tab === 'chart' || tab === 'trades') && pair && (
        <p className="mt-1 text-center font-mono text-[10px] text-text-muted">
          via GeckoTerminal · {pair.dexId}
        </p>
      )}
    </div>
  );
}

function Frame({ src, title }: { src: string; title: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-panel">
      <iframe
        src={src}
        title={title}
        className="h-[420px] w-full"
        loading="lazy"
        allow="clipboard-write"
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
      />
    </div>
  );
}
