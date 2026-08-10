'use client';

/**
 * Tracks the token the user is currently scanning on the /scan tab, so leaving
 * and returning resumes it. Stored locally (per-device); pairs with the
 * server/localStorage "recent scans" history for the full picture.
 */

const KEY = 'apecheck.activeScan';

export interface ActiveScan {
  address: string;
  name: string | null;
  symbol: string | null;
  updatedAt: string;
}

export function getActiveScan(): ActiveScan | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ActiveScan) : null;
  } catch {
    return null;
  }
}

export function setActiveScan(scan: ActiveScan): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(scan));
  } catch {
    /* ignore quota errors */
  }
}

export function clearActiveScan(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
