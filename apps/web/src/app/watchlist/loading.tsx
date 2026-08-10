/**
 * Instant skeleton for the /watchlist transition — title + a few tracked-token
 * card placeholders — so navigation feels immediate before the fetch resolves.
 */
export default function WatchlistLoading() {
  return (
    <div className="py-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-text-primary">Watchlist</h1>
      </div>
      <div className="mb-3 flex items-center gap-2 font-mono text-xs text-text-muted">
        <span className="h-2 w-2 animate-pulse-glow rounded-full bg-signal-green" />
        loading watchlist…
      </div>
      <div className="space-y-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg border border-border bg-panel/40" />
        ))}
      </div>
    </div>
  );
}
