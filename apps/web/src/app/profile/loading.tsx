/**
 * Instant skeleton for the /profile transition — title + settings-card
 * placeholders — so the tab feels responsive before the session/profile loads.
 */
export default function ProfileLoading() {
  return (
    <div className="py-4">
      <h1 className="mb-4 font-display text-2xl font-bold text-text-primary">Profile settings</h1>
      <div className="mb-3 flex items-center gap-2 font-mono text-xs text-text-muted">
        <span className="h-2 w-2 animate-pulse-glow rounded-full bg-solana-purple" />
        loading profile…
      </div>
      <div className="space-y-3">
        <div className="h-24 animate-pulse rounded-xl border border-border bg-panel/40" />
        <div className="h-20 animate-pulse rounded-lg border border-border bg-panel/40" />
        <div className="h-20 animate-pulse rounded-lg border border-border bg-panel/40" />
      </div>
    </div>
  );
}
