import { getPrimaryBuy, getBuyInstructions, formatUsd } from '@apecheck/core';
import type { ScanResult } from '@apecheck/core';
import { SafetyDisclaimer } from './SafetyDisclaimer';
import { CopyButton } from './CopyButton';

function Steps({ steps }: { steps: string[] }) {
  return (
    <ol className="mt-2 space-y-1.5">
      {steps.map((step, i) => (
        <li key={i} className="flex gap-2 text-xs text-text-secondary">
          <span className="font-mono text-signal-green">{i + 1}.</span>
          <span>{step}</span>
        </li>
      ))}
    </ol>
  );
}

/** Buy flow: Jupiter primary + per-DEX cards with instructions. */
export function BuyPanel({ scan }: { scan: ScanResult }) {
  const address = scan.tokenAddress;
  const primary = getPrimaryBuy(address);

  // Only DEXs that actually have a listing/liquidity (plus Jupiter as aggregator).
  const dexCards = scan.dexListings.filter((l) => l.dexName.toLowerCase() !== 'jupiter');

  return (
    <div className="space-y-3">
      {/* Primary: Jupiter aggregator */}
      <div className="rounded-lg border border-solana-purple/50 bg-gradient-to-b from-solana-purple/10 to-transparent p-4 shadow-glow-purple">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-solana-purple">recommended</div>
            <div className="font-display text-lg font-bold text-text-primary">Buy with Jupiter</div>
            <div className="text-xs text-text-secondary">{primary.notes}</div>
          </div>
          <span className="text-2xl">🪐</span>
        </div>
        <a
          href={primary.deepLink || '#'}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 block w-full rounded-lg bg-solana-purple py-3 text-center font-display text-base font-bold text-white transition-transform hover:scale-[1.02] active:scale-95"
        >
          Buy Now — best aggregated price →
        </a>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="font-mono text-[10px] text-text-muted">slippage: {primary.slippage}</span>
          <CopyButton value={address} />
        </div>
        <SafetyDisclaimer className="mt-3" />
      </div>

      {/* Individual DEXs */}
      {dexCards.length > 0 && (
        <div>
          <h3 className="mb-2 font-mono text-xs uppercase tracking-widest text-text-muted">or buy directly on a DEX</h3>
          <div className="space-y-2">
            {dexCards.map((listing) => {
              const instr = getBuyInstructions(listing.dexName, address);
              return (
                <details key={listing.dexName + listing.pairAddress} className="group rounded-lg border border-border bg-panel/60">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
                    <div>
                      <div className="font-display text-sm font-bold text-text-primary">{instr.dexName}</div>
                      <div className="font-mono text-[11px] text-text-muted">
                        {listing.liquidityUsd > 0 ? `${formatUsd(listing.liquidityUsd)} liq` : 'via aggregator'} · slippage {instr.slippage}
                      </div>
                    </div>
                    <span className="font-mono text-xs text-signal-green transition-transform group-open:rotate-90">▸</span>
                  </summary>
                  <div className="border-t border-border/50 px-4 py-3">
                    <p className="text-[11px] text-text-secondary">{instr.notes}</p>
                    <Steps steps={instr.steps} />
                    {instr.deepLink && (
                      <a
                        href={instr.deepLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-block rounded-md border border-signal-green/50 bg-signal-green/10 px-3 py-1.5 text-xs font-semibold text-signal-green hover:bg-signal-green/20"
                      >
                        Open {instr.dexName} →
                      </a>
                    )}
                  </div>
                </details>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
