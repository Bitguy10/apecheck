import { fetchJson } from './http';

interface RdapEvent {
  eventAction: string;
  eventDate: string;
}
interface RdapResponse {
  events?: RdapEvent[];
  ldhName?: string;
  handle?: string;
}

export interface DomainAgeData {
  available: boolean;
  domain: string | null;
  registrationDate: string | null;
  ageDays: number | null;
  /**
   * ok      — got a registration date (ageDays is set).
   * unknown — no domain, TLD not covered by RDAP, or domain not found (404/400):
   *           benign, NOT a signal the site is sketchy.
   * failed  — genuine lookup failure (timeout / 5xx / network): retryable.
   */
  status: 'ok' | 'unknown' | 'failed';
  error?: string;
}

/** Extract a bare registrable domain from a URL string. */
export function extractDomain(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const withProto = url.startsWith('http') ? url : `https://${url}`;
    const host = new URL(withProto).hostname.toLowerCase();
    return host.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/**
 * Look up domain registration date via RDAP (rdap.org bootstrap, free, no key).
 * Returns age in days for the socials/legitimacy scoring.
 *
 * @param nowMs current time in ms (passed in so this stays deterministic/testable)
 */
export async function getDomainAge(
  websiteUrl: string | null | undefined,
  nowMs: number,
): Promise<DomainAgeData> {
  const domain = extractDomain(websiteUrl);
  if (!domain) return { available: false, status: 'unknown', domain: null, registrationDate: null, ageDays: null };

  // rdap.org is a bootstrap/redirector: it 302s to the authoritative RDAP server
  // for the TLD (global fetch follows the redirect). timeoutMs bumped so the extra
  // hop doesn't race the reader; a couple of retries smooths transient bootstrap 5xx.
  const res = await fetchJson<RdapResponse>(`https://rdap.org/domain/${domain}`, {
    source: 'RDAP',
    timeoutMs: 10000,
    retries: 2,
    headers: { Accept: 'application/rdap+json' },
  });

  if (!res.ok) {
    // 404/400 = TLD not covered by RDAP or domain not found → benign "unknown".
    // 429/5xx/timeout/network = genuine, retryable failure.
    const status: DomainAgeData['status'] = res.status === 404 || res.status === 400 ? 'unknown' : 'failed';
    return { available: false, status, domain, registrationDate: null, ageDays: null, error: res.error };
  }

  const events = res.data.events || [];
  const reg =
    events.find((e) => e.eventAction === 'registration') ||
    events.find((e) => e.eventAction === 'last changed');

  if (!reg) return { available: true, status: 'unknown', domain, registrationDate: null, ageDays: null };

  const regDate = new Date(reg.eventDate).getTime();
  if (Number.isNaN(regDate)) {
    return { available: true, status: 'unknown', domain, registrationDate: reg.eventDate, ageDays: null };
  }

  const ageDays = Math.max(0, Math.floor((nowMs - regDate) / (1000 * 60 * 60 * 24)));
  return { available: true, status: 'ok', domain, registrationDate: reg.eventDate, ageDays };
}
