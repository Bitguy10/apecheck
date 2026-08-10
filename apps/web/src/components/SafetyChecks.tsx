import { formatPercent, shortenAddress, formatAge } from '@apecheck/core';
import type { SellCheck, DevReputation } from '@apecheck/core';

// Full class strings (Tailwind JIT can't see interpolated names).
const VERDICT = {
  bad: { box: 'border-rug-red/40 bg-rug-red/5', text: 'text-rug-red', icon: '🚫', label: 'HONEYPOT RISK' },
  good: { box: 'border-signal-green/40 bg-signal-green/5', text: 'text-signal-green', icon: '✅', label: 'SELLABLE' },
  unknown: { box: 'border-warning-amber/40 bg-warning-amber/5', text: 'text-warning-amber', icon: '❓', label: 'UNKNOWN' },
} as const;

function verdictKey(sellable: boolean | null): keyof typeof VERDICT {
  if (sellable === false) return 'bad';
  if (sellable === true) return 'good';
  return 'unknown';
}

/** "Can I sell?" honeypot simulation + dev-wallet reputation. */
export function SafetyChecks({ sellCheck, dev }: { sellCheck: SellCheck; dev: DevReputation }) {
  const v = VERDICT[verdictKey(sellCheck.sellable)];

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {/* Can I sell? */}
      <div className={`rounded-lg border p-3 ${v.box}`}>
        <div className="flex items-center gap-2">
          <span className="text-lg">{v.icon}</span>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-text-muted">can i sell?</div>
            <div className={`font-display text-sm font-bold ${v.text}`}>{v.label}</div>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-text-secondary">{sellCheck.note}</p>
        {sellCheck.impliedTaxPct != null && sellCheck.impliedTaxPct > 0 && (
          <div className="mt-1 font-mono text-[11px] text-warning-amber">
            implied tax/loss: {formatPercent(sellCheck.impliedTaxPct)}
          </div>
        )}
      </div>

      {/* Dev reputation */}
      <div
        className={`rounded-lg border p-3 ${
          dev.freshWallet ? 'border-warning-amber/40 bg-warning-amber/5' : 'border-border bg-panel-2'
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">{dev.freshWallet ? '🆕' : '👤'}</span>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-text-muted">dev wallet</div>
            <div className="font-display text-sm font-bold text-text-primary">
              {dev.walletAgeDays != null ? `${formatAge(dev.walletAgeDays * 24)} old` : 'age unknown'}
            </div>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-text-secondary">{dev.note}</p>
        <div className="mt-1 flex items-center gap-3 font-mono text-[11px] text-text-muted">
          {dev.priorTokenCount != null && <span>prior tokens: {dev.priorTokenCount}</span>}
          {dev.wallet && (
            <a
              href={`https://solscan.io/account/${dev.wallet}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-secondary hover:text-signal-green hover:underline"
            >
              {shortenAddress(dev.wallet, 4, 4)} ↗
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
