/**
 * Instant skeleton shown during the RSC/JS transition into /tracker, so the
 * click feels immediate instead of dead while the client component mounts and
 * fetches history. Mirrors the page's title + scan box + wallet table shape.
 */
export default function TrackerLoading() {
  return (
    <div className="py-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-text-primary">Tracker</h1>
      </div>
      <div className="mb-2 flex items-center gap-2 font-mono text-xs text-text-muted">
        <span className="h-2 w-2 animate-pulse-glow rounded-full bg-solana-purple" />
        loading tracked wallets…
      </div>
      <div className="h-12 animate-pulse rounded-lg border border-border bg-panel/40" />
      <div className="mt-6 space-y-2">
        <div className="h-4 w-40 animate-pulse rounded bg-panel/40" />
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-12 animate-pulse rounded-lg border border-border bg-panel/40" />
        ))}
      </div>
    </div>
  );
}
