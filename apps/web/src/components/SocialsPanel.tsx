import type { SocialsInfo } from '@apecheck/core';
import { formatNumber, formatAge } from '@apecheck/core';

function TrustBadge({ ok, label }: { ok: boolean | null; label: string }) {
  if (ok === null) return <span className="rounded bg-panel px-1.5 py-0.5 font-mono text-[10px] text-text-muted">{label}?</span>;
  return (
    <span
      className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${
        ok ? 'bg-signal-green/10 text-signal-green' : 'bg-rug-red/10 text-rug-red'
      }`}
    >
      {ok ? '✓' : '✗'} {label}
    </span>
  );
}

function Row({
  icon,
  title,
  href,
  children,
}: {
  icon: string;
  title: string;
  href: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="flex min-w-0 items-center gap-2">
        <span aria-hidden>{icon}</span>
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="truncate text-sm text-solana-purple underline-offset-2 hover:underline"
          >
            {title}
          </a>
        ) : (
          <span className="truncate text-sm text-text-muted">{title}</span>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">{children}</div>
    </div>
  );
}

/** Socials & legitimacy panel with trust badges and missing-social flags. */
export function SocialsPanel({ socials }: { socials: SocialsInfo }) {
  const { website, x, telegram, domainMismatch, allMissing } = socials;

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-panel/60">
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-2">
        <span className="font-mono text-[11px] uppercase tracking-widest text-signal-green">{'>'} socials & legitimacy</span>
        {domainMismatch && (
          <span className="rounded bg-rug-red/10 px-1.5 py-0.5 font-mono text-[10px] text-rug-red">
            ⚠ domain mismatch
          </span>
        )}
      </div>

      {allMissing ? (
        <div className="px-4 py-6 text-center">
          <p className="text-sm font-semibold text-rug-red">🚩 No socials found at all</p>
          <p className="mt-1 text-xs text-text-secondary">
            Legit projects almost always have a site, X, or Telegram. Treat this as a major red flag.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border/40">
          <Row icon="🌐" title={website.url || 'No website'} href={website.url}>
            {website.url && (
              <TrustBadge
                ok={website.domainAgeDays == null ? null : website.domainAgeDays > 30}
                label={website.domainAgeDays != null ? `domain ${formatAge(website.domainAgeDays * 24)}` : 'age'}
              />
            )}
          </Row>
          <Row icon="𝕏" title={x.handle ? `@${x.handle}` : x.url || 'No X account'} href={x.url}>
            {x.followers != null && <TrustBadge ok={x.followers > 500} label={`${formatNumber(x.followers)} followers`} />}
            {x.accountAgeDays != null && <TrustBadge ok={x.accountAgeDays > 30} label={`${formatAge(x.accountAgeDays * 24)} old`} />}
            {x.url && x.followers == null && (
              <span className="rounded bg-panel px-1.5 py-0.5 font-mono text-[10px] text-text-muted">metrics n/a</span>
            )}
          </Row>
          <Row icon="✈️" title={telegram.url ? 'Telegram group' : 'No Telegram'} href={telegram.url}>
            {telegram.memberCount != null && <TrustBadge ok={telegram.memberCount > 500} label={`${formatNumber(telegram.memberCount)} members`} />}
            {telegram.url && telegram.memberCount == null && (
              <TrustBadge ok={telegram.isPublic} label={telegram.isPublic ? 'public' : 'private'} />
            )}
          </Row>
        </div>
      )}
    </div>
  );
}
