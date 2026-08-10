'use client';

/** Local "recent scans" store for anonymous users (mirrors mobile behavior). */

const KEY = 'apecheck.recent';
const MAX = 12;

export interface RecentScan {
  tokenAddress: string;
  name: string | null;
  symbol: string | null;
  riskScore: number;
  riskBand: string;
  scannedAt: string;
}

export function getRecentScans(): RecentScan[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as RecentScan[]) : [];
  } catch {
    return [];
  }
}

export function addRecentScan(scan: RecentScan): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = getRecentScans().filter((s) => s.tokenAddress !== scan.tokenAddress);
    const next = [scan, ...existing].slice(0, MAX);
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore quota errors */
  }
}

export function clearRecentScans(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
