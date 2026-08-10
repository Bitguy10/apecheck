import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RiskBand } from '@apecheck/core';

export interface RecentScan {
  tokenAddress: string;
  name: string | null;
  symbol: string | null;
  riskScore: number;
  riskBand: RiskBand;
  scannedAt: string;
}

const KEY = 'apecheck.recent';
const MAX = 12;

export async function getRecentScans(): Promise<RecentScan[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as RecentScan[]) : [];
  } catch {
    return [];
  }
}

export async function addRecentScan(scan: RecentScan): Promise<void> {
  try {
    const existing = await getRecentScans();
    const deduped = existing.filter((s) => s.tokenAddress !== scan.tokenAddress);
    const next = [scan, ...deduped].slice(0, MAX);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* best-effort */
  }
}
