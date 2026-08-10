import { POTENTIAL_DISCLAIMER } from '@apecheck/core';
import type { RiskBand } from '@apecheck/core';
import { riskBands } from '@apecheck/ui/tokens';

const BAND_STYLE: Record<RiskBand, { color: string; glow: string; ring: string }> = {
  low: { color: riskBands.low.color, glow: 'shadow-glow-green', ring: 'border-signal-green/40' },
  medium: { color: riskBands.medium.color, glow: 'shadow-glow-amber', ring: 'border-warning-amber/40' },
  high: { color: riskBands.high.color, glow: 'shadow-glow-red', ring: 'border-rug-red/40' },
};

/**
 * Risk + Potential shown as two SEPARATE badges, side by side. They are never
 * merged into one number — that separation is a product requirement.
 */
export function ScoreBadges({
  riskScore,
  riskBand,
  riskBandLabel,
  potentialScore,
}: {
  riskScore: number;
  riskBand: RiskBand;
  riskBandLabel: string;
  potentialScore: number;
}) {
  const rb = BAND_STYLE[riskBand];
  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Risk badge */}
      <div className={`rounded-lg border ${rb.ring} bg-panel-2 p-4 ${rb.glow}`}>
        <div className="font-mono text-[10px] uppercase tracking-widest text-text-muted">Risk Score</div>
        <div className="mt-1 flex items-baseline gap-1">
          <span className="font-display text-4xl font-bold" style={{ color: rb.color }}>
            {riskScore}
          </span>
          <span className="font-mono text-xs text-text-muted">/100</span>
        </div>
        <div className="mt-1 text-sm font-semibold" style={{ color: rb.color }}>
          {riskBandLabel}
        </div>
        <div className="mt-1 text-[11px] text-text-secondary">higher = safer</div>
      </div>

      {/* Potential badge */}
      <div className="rounded-lg border border-solana-purple/40 bg-panel-2 p-4 shadow-glow-purple">
        <div className="font-mono text-[10px] uppercase tracking-widest text-text-muted">Potential</div>
        <div className="mt-1 flex items-baseline gap-1">
          <span className="font-display text-4xl font-bold text-solana-purple text-glow-purple">
            {potentialScore}
          </span>
          <span className="font-mono text-xs text-text-muted">/100</span>
        </div>
        <div className="mt-1 text-sm font-semibold text-solana-purple">Upside Signal</div>
        <div className="mt-1 text-[11px] leading-tight text-text-secondary">{POTENTIAL_DISCLAIMER}</div>
      </div>
    </div>
  );
}
