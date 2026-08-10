import type {
  ScanResult,
  WatchlistItem,
  AlertItem,
  ScanHistoryItem,
  WalletScan,
  WalletScanHistoryItem,
  Profile,
  ApiError,
} from '@apecheck/core';
import type { TelegramLinkStatus } from '@/app/api/telegram/link/route';

async function jsonOrThrow<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = data as ApiError;
    throw new ApiClientError(err.code || 'INTERNAL', err.error || `Request failed (${res.status})`, res.status);
  }
  return data as T;
}

export class ApiClientError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export const api = {
  async scan(tokenAddress: string, forceRefresh = false): Promise<ScanResult> {
    const res = await fetch('/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tokenAddress, forceRefresh }),
    });
    return jsonOrThrow<ScanResult>(res);
  },

  async getWatchlist(): Promise<WatchlistItem[]> {
    return jsonOrThrow<WatchlistItem[]>(await fetch('/api/watchlist'));
  },

  async addWatch(tokenAddress: string): Promise<WatchlistItem> {
    const res = await fetch('/api/watchlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tokenAddress }),
    });
    return jsonOrThrow<WatchlistItem>(res);
  },

  async removeWatch(id: string): Promise<void> {
    const res = await fetch(`/api/watchlist/${id}`, { method: 'DELETE' });
    if (!res.ok && res.status !== 204) await jsonOrThrow(res);
  },

  async toggleAlert(id: string, alertEnabled: boolean): Promise<void> {
    const res = await fetch(`/api/watchlist/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alertEnabled }),
    });
    await jsonOrThrow(res);
  },

  async getAlerts(): Promise<AlertItem[]> {
    return jsonOrThrow<AlertItem[]>(await fetch('/api/alerts'));
  },

  async getScanHistory(): Promise<ScanHistoryItem[]> {
    return jsonOrThrow<ScanHistoryItem[]>(await fetch('/api/scan-history'));
  },

  async scanWallet(walletAddress: string): Promise<WalletScan> {
    const res = await fetch('/api/wallet-scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress }),
    });
    return jsonOrThrow<WalletScan>(res);
  },

  async getWalletScanHistory(): Promise<WalletScanHistoryItem[]> {
    return jsonOrThrow<WalletScanHistoryItem[]>(await fetch('/api/wallet-scan-history'));
  },

  async getProfile(): Promise<Profile> {
    return jsonOrThrow<Profile>(await fetch('/api/profile'));
  },

  async registerPushToken(token: string, platform: 'web'): Promise<void> {
    const res = await fetch('/api/push-tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, platform }),
    });
    await jsonOrThrow(res);
  },

  async getTelegramStatus(): Promise<TelegramLinkStatus> {
    return jsonOrThrow<TelegramLinkStatus>(await fetch('/api/telegram/link'));
  },

  async createTelegramLink(): Promise<TelegramLinkStatus> {
    return jsonOrThrow<TelegramLinkStatus>(await fetch('/api/telegram/link', { method: 'POST' }));
  },
};
