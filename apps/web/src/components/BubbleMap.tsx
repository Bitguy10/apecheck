'use client';

import { useMemo, useState } from 'react';
import type { TopHolder } from '@apecheck/core';
import { shortenAddress } from '@apecheck/core';

/**
 * Native holder bubble map — a first-party replacement for the Bubblemaps
 * iframe, which can't be embedded (remote X-Frame-Options: DENY).
 *
 * Renders scan.topHolders as an SVG circle-pack: each bubble's area is
 * proportional to the holder's % of supply, colored by category. No network
 * call — the data is already on the scan object. Layout is deterministic
 * (Archimedean-spiral packing, no Math.random) so SSR and client agree.
 */

// Design-system hex (packages/ui/tailwind-preset.js) — SVG fills need literals.
const COLORS = {
  lp: '#9945FF', // solana-purple — liquidity pool / AMM vault
  insider: '#FF3B5C', // rug-red — flagged insider/sniper
  normal: '#14F195', // signal-green — ordinary holder
} as const;

type Category = keyof typeof COLORS;

function categoryOf(h: TopHolder): Category {
  if (h.isLiquidityPool) return 'lp';
  if (h.insider) return 'insider';
  return 'normal';
}

function labelOf(cat: Category): string {
  return cat === 'lp' ? 'liquidity pool' : cat === 'insider' ? 'insider' : 'holder';
}

interface Placed {
  h: TopHolder;
  cat: Category;
  x: number;
  y: number;
  r: number;
}

/**
 * Deterministic circle packing: place the largest bubble at the origin, then
 * spiral each subsequent bubble outward until it clears every placed bubble.
 * O(n²) but n ≤ ~20 holders, so it's instant.
 */
function pack(holders: TopHolder[]): Placed[] {
  const maxPct = Math.max(...holders.map((h) => h.pct), 0.0001);
  // Area ∝ pct → radius ∝ sqrt(pct). Scale so the biggest bubble ≈ 64 units.
  const rScale = 64 / Math.sqrt(maxPct);
  const sized = holders.map((h) => ({
    h,
    cat: categoryOf(h),
    r: Math.max(9, Math.sqrt(h.pct) * rScale),
  }));

  const placed: Placed[] = [];
  const GAP = 3;
  for (const s of sized) {
    if (placed.length === 0) {
      placed.push({ ...s, x: 0, y: 0 });
      continue;
    }
    let angle = 0;
    let radius = 0;
    let x = 0;
    let y = 0;
    for (let tries = 0; tries < 20000; tries++) {
      x = radius * Math.cos(angle);
      y = radius * Math.sin(angle);
      const clear = placed.every((p) => {
        const dx = p.x - x;
        const dy = p.y - y;
        return Math.hypot(dx, dy) >= p.r + s.r + GAP;
      });
      if (clear) break;
      angle += 0.35;
      radius += 0.55;
    }
    placed.push({ ...s, x, y });
  }
  return placed;
}

export function BubbleMap({ holders }: { holders: TopHolder[] }) {
  const [active, setActive] = useState<number | null>(null);

  const usable = useMemo(
    () =>
      holders
        .filter((h) => h.pct > 0)
        .slice(0, 20)
        .sort((a, b) => b.pct - a.pct),
    [holders],
  );

  const placed = useMemo(() => (usable.length ? pack(usable) : []), [usable]);

  const viewBox = useMemo(() => {
    if (!placed.length) return '0 0 100 100';
    const pad = 10;
    const minX = Math.min(...placed.map((p) => p.x - p.r)) - pad;
    const maxX = Math.max(...placed.map((p) => p.x + p.r)) + pad;
    const minY = Math.min(...placed.map((p) => p.y - p.r)) - pad;
    const maxY = Math.max(...placed.map((p) => p.y + p.r)) + pad;
    return `${minX} ${minY} ${maxX - minX} ${maxY - minY}`;
  }, [placed]);

  if (!usable.length) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-panel/40 px-4 py-8 text-center text-xs text-text-muted">
        {'>'} no holder distribution data available for this token.
      </div>
    );
  }

  const activeHolder = active != null ? placed[active] : null;

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-panel">
      <svg
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
        className="h-[380px] w-full"
        role="img"
        aria-label="Holder concentration bubble map"
      >
        {placed.map((p, i) => {
          const color = COLORS[p.cat];
          const showLabel = p.r >= 20;
          const dim = active != null && active !== i;
          return (
            <g
              key={p.h.address}
              transform={`translate(${p.x} ${p.y})`}
              opacity={dim ? 0.35 : 1}
              className="cursor-pointer transition-opacity"
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive((cur) => (cur === i ? null : cur))}
              onClick={() => setActive((cur) => (cur === i ? null : i))}
            >
              <title>{`#${p.h.rank} · ${labelOf(p.cat)} · ${p.h.pct.toFixed(2)}% · ${p.h.address}`}</title>
              <circle
                r={p.r}
                fill={color}
                fillOpacity={0.16}
                stroke={color}
                strokeWidth={active === i ? 2.5 : 1.5}
              />
              {showLabel && (
                <>
                  <text
                    textAnchor="middle"
                    dy="-0.1em"
                    fill={color}
                    className="font-mono"
                    style={{ fontSize: Math.min(p.r * 0.5, 15), fontWeight: 700 }}
                  >
                    #{p.h.rank}
                  </text>
                  <text
                    textAnchor="middle"
                    dy="1.1em"
                    fill="#E7ECE3"
                    className="font-mono"
                    style={{ fontSize: Math.min(p.r * 0.34, 11) }}
                  >
                    {p.h.pct.toFixed(1)}%
                  </text>
                </>
              )}
            </g>
          );
        })}
      </svg>

      {/* Legend + active-holder readout */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 border-t border-border/60 px-3 py-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] text-text-muted">
          <LegendDot color={COLORS.normal} label="holder" />
          <LegendDot color={COLORS.lp} label="liquidity pool" />
          <LegendDot color={COLORS.insider} label="insider" />
        </div>
        <div className="min-w-0 font-mono text-[10px]">
          {activeHolder ? (
            <span className="truncate text-text-secondary">
              #{activeHolder.h.rank} · {shortenAddress(activeHolder.h.address, 4, 4)} ·{' '}
              <span style={{ color: COLORS[activeHolder.cat] }}>{activeHolder.h.pct.toFixed(2)}%</span>
            </span>
          ) : (
            <span className="text-text-muted">bubble size = % of supply · tap a bubble</span>
          )}
        </div>
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
