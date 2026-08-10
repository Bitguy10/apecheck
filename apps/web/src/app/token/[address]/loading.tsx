export default function TokenLoading() {
  return (
    <div className="py-10">
      <div className="mb-4 flex items-center gap-2 font-mono text-xs text-text-muted">
        <span className="h-2 w-2 animate-pulse-glow rounded-full bg-signal-green" />
        booting scanner…
      </div>
      <div className="space-y-2">
        <div className="h-32 animate-pulse rounded-xl border border-border bg-panel/40" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-28 animate-pulse rounded-lg border border-border bg-panel/40" />
          <div className="h-28 animate-pulse rounded-lg border border-border bg-panel/40" />
        </div>
        <div className="h-40 animate-pulse rounded-lg border border-border bg-panel/40" />
      </div>
    </div>
  );
}
