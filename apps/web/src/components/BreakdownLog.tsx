import type { ScoreBreakdownItem } from '@apecheck/core';

const STATUS: Record<ScoreBreakdownItem['status'], { icon: string; color: string }> = {
  pass: { icon: '✓', color: 'text-signal-green' },
  warn: { icon: '!', color: 'text-warning-amber' },
  fail: { icon: '✗', color: 'text-rug-red' },
  unknown: { icon: '?', color: 'text-text-muted' },
};

/**
 * Terminal-log rendering of a score breakdown. Reads top-to-bottom like findings
 * printing out in sequence.
 */
export function BreakdownLog({
  title,
  items,
  accent = 'green',
}: {
  title: string;
  items: ScoreBreakdownItem[];
  accent?: 'green' | 'purple';
}) {
  const accentColor = accent === 'purple' ? 'text-solana-purple' : 'text-signal-green';
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-panel/60">
      <div className={`border-b border-border/60 px-4 py-2 font-mono text-[11px] uppercase tracking-widest ${accentColor}`}>
        {'>'} {title}
      </div>
      <ul className="divide-y divide-border/40">
        {items.map((item, i) => {
          const s = STATUS[item.status];
          return (
            <li
              key={item.key}
              className="log-print flex items-start gap-3 px-4 py-3"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <span className={`mt-0.5 font-mono text-sm font-bold ${s.color}`} aria-hidden>
                [{s.icon}]
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-display text-sm font-semibold text-text-primary">{item.label}</span>
                  <span className="shrink-0 font-mono text-xs text-text-muted">
                    <span className={s.color}>{item.points}</span>/{item.maxPoints}
                  </span>
                </div>
                <p className="mt-0.5 text-xs leading-snug text-text-secondary">{item.detail}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
