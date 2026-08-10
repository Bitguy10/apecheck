import Link from 'next/link';
import { SearchBar } from '@/components/SearchBar';
import { RecentScans } from '@/components/RecentScans';

export default function HomePage() {
  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col justify-center gap-10 py-8">
      {/* Hero */}
      <section className="text-center">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-panel px-3 py-1 font-mono text-[11px] text-text-secondary">
          <span className="h-1.5 w-1.5 animate-pulse-glow rounded-full bg-signal-green" />
          solana token scanner · scan before you ape
        </div>
        <h1 className="font-display text-4xl font-bold leading-tight text-text-primary sm:text-5xl">
          Don’t get <span className="text-rug-red">rugged</span>.
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-text-secondary">
          Paste a fresh token’s contract address. Get an instant rug-risk read: authorities, LP lock,
          dev holdings, holders, socials — and where to buy.
        </p>
      </section>

      {/* The single centered input — the hero element */}
      <section className="mx-auto w-full max-w-xl">
        <SearchBar />
        <div className="mt-3 flex items-center justify-center gap-4 font-mono text-[11px] text-text-muted">
          <Link href="/watchlist" className="hover:text-signal-green">
            → watchlist
          </Link>
          <Link href="/alerts" className="hover:text-signal-green">
            → alerts
          </Link>
        </div>
      </section>

      {/* Recent scans */}
      <section className="mx-auto w-full max-w-xl">
        <h2 className="mb-2 font-mono text-xs uppercase tracking-widest text-text-muted">recent scans</h2>
        <RecentScans />
      </section>
    </div>
  );
}
