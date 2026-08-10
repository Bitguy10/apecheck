/**
 * Instant skeleton for the /alerts transition — title + alert-row placeholders —
 * so the tab feels responsive before the client component fetches alerts.
 */
export default function AlertsLoading() {
  return (
    <div className="py-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-text-primary">Alerts</h1>
      </div>
      <div className="mb-3 flex items-center gap-2 font-mono text-xs text-text-muted">
        <span className="h-2 w-2 animate-pulse-glow rounded-full bg-warning-amber" />
        loading alerts…
      </div>
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg border border-border bg-panel/40" />
        ))}
      </div>
    </div>
  );
}
