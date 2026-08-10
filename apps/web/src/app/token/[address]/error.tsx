'use client';

export default function TokenError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="py-16 text-center">
      <div className="mx-auto max-w-md rounded-lg border border-rug-red/40 bg-rug-red/5 p-6">
        <div className="text-3xl">💥</div>
        <h2 className="mt-2 font-display text-lg font-bold text-rug-red">Scanner crashed</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Something broke while rendering this scan. This one&apos;s on us, not the token.
        </p>
        <button
          onClick={reset}
          className="mt-4 rounded-md bg-signal-green px-4 py-2 font-display text-sm font-bold text-jungle-black hover:scale-105"
        >
          ↻ Try again
        </button>
      </div>
    </div>
  );
}
