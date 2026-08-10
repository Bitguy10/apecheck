import { fetchJson } from './http';

interface RpcResponse<T> {
  jsonrpc: string;
  id: string | number;
  result?: T;
  error?: { code: number; message: string };
}

interface ParsedMintAccount {
  value: {
    data: {
      parsed: {
        info: {
          decimals: number;
          supply: string;
          mintAuthority: string | null;
          freezeAuthority: string | null;
          isInitialized: boolean;
        };
        type: string;
      };
      program: string;
    } | null;
    owner: string;
  } | null;
}

interface LargestAccountsResult {
  value: { address: string; amount: string; decimals: number; uiAmount: number | null }[];
}

interface TokenAmountResult {
  value: { amount: string; decimals: number; uiAmount: number | null; uiAmountString: string };
}

interface TokenAccountsByOwnerResult {
  value: {
    pubkey: string;
    account: {
      data: { parsed: { info: { tokenAmount: { amount: string; uiAmount: number | null; decimals: number } } } };
    };
  }[];
}

/** Full parsed token-account listing for a wallet (all mints it holds). */
interface AllTokenAccountsResult {
  value: {
    pubkey: string;
    account: {
      data: {
        parsed: {
          info: {
            mint: string;
            tokenAmount: { amount: string; uiAmount: number | null; decimals: number };
          };
        };
      };
    };
  }[];
}

interface MultipleAccountsResult {
  value: ({
    data: { parsed: { info: { owner: string; tokenAmount: { uiAmount: number | null } } } } | null;
  } | null)[];
}

interface SignatureInfo {
  signature: string;
  blockTime: number | null;
  slot: number;
}

/** A resolved top holder (owner wallet, not the token account). */
export interface TopHolderRaw {
  /** Owner wallet address (falls back to token-account address if unresolved). */
  address: string;
  tokenAccount: string;
  uiAmount: number;
  pct: number;
}

export interface MintInfo {
  decimals: number;
  supplyRaw: string;
  supplyUi: number;
  mintAuthority: string | null;
  freezeAuthority: string | null;
  exists: boolean;
}

/** One SPL position held by a wallet (raw on-chain, no pricing). */
export interface WalletTokenBalance {
  mint: string;
  amount: number;
  decimals: number;
}

export interface SolanaRpcClient {
  getMintInfo(mint: string): Promise<MintInfo | null>;
  getTopHolderPercent(mint: string, supplyUi: number): Promise<number | null>;
  /** Top holders resolved to owner wallets, sorted desc by balance. */
  getTopHolders(mint: string, supplyUi: number, limit?: number): Promise<TopHolderRaw[]>;
  /** Bounded on-chain holder count (fallback when Birdeye omits it). */
  getHolderCount(mint: string, maxPages?: number): Promise<{ count: number; capped: boolean } | null>;
  getOwnerTokenBalance(owner: string, mint: string): Promise<number | null>;
  /** All non-zero SPL positions held by a wallet (both Token + Token-2022 programs). */
  getAllTokenAccounts(owner: string): Promise<WalletTokenBalance[] | null>;
  /** Native SOL balance in UI units (lamports ÷ 1e9). */
  getBalance(owner: string): Promise<number | null>;
  getAssetMetadata(mint: string): Promise<{ name: string | null; symbol: string | null; image: string | null } | null>;
  /** Age of a wallet in days from its earliest visible signature; null if too busy to bound. */
  getWalletAgeDays(wallet: string, nowMs: number): Promise<number | null>;
  /** Count of tokens/assets created by a wallet (Helius DAS getAssetsByCreator). */
  getCreatedTokenCount(wallet: string): Promise<number | null>;
}

/**
 * Factory over a Helius (or any) Solana RPC URL. Used by the scan engine and the
 * cron dump-detector (which repeatedly reads dev-wallet balances).
 */
export function createSolanaRpc(rpcUrl: string): SolanaRpcClient {
  async function rpc<T>(method: string, params: unknown[]): Promise<T | null> {
    const res = await fetchJson<RpcResponse<T>>(rpcUrl, {
      method: 'POST',
      source: `RPC ${method}`,
      timeoutMs: 9000,
      body: { jsonrpc: '2.0', id: method, method, params },
    });
    if (!res.ok) return null;
    if (res.data.error) return null;
    return res.data.result ?? null;
  }

  // Helius DAS methods (getAsset, getAssetsByCreator, …) take `params` as a bare
  // object, NOT the array form standard Solana JSON-RPC uses. Passing an array
  // fails with "invalid type: map, expected a string" (-32602).
  async function rpcDas<T>(method: string, params: Record<string, unknown>): Promise<T | null> {
    const res = await fetchJson<RpcResponse<T>>(rpcUrl, {
      method: 'POST',
      source: `RPC ${method}`,
      timeoutMs: 9000,
      body: { jsonrpc: '2.0', id: method, method, params },
    });
    if (!res.ok) return null;
    if (res.data.error) return null;
    return res.data.result ?? null;
  }

  return {
    async getMintInfo(mint) {
      const result = await rpc<ParsedMintAccount>('getAccountInfo', [
        mint,
        { encoding: 'jsonParsed', commitment: 'confirmed' },
      ]);
      if (!result || !result.value || !result.value.data?.parsed) return null;
      const info = result.value.data.parsed.info;
      const decimals = info.decimals ?? 0;
      const supplyRaw = info.supply ?? '0';
      const supplyUi = Number(supplyRaw) / 10 ** decimals;
      return {
        decimals,
        supplyRaw,
        supplyUi,
        mintAuthority: info.mintAuthority ?? null,
        freezeAuthority: info.freezeAuthority ?? null,
        exists: true,
      };
    },

    async getTopHolderPercent(mint, supplyUi) {
      if (!supplyUi || supplyUi <= 0) return null;
      const result = await rpc<LargestAccountsResult>('getTokenLargestAccounts', [
        mint,
        { commitment: 'confirmed' },
      ]);
      if (!result || !result.value?.length) return null;
      const top10 = result.value
        .slice(0, 10)
        .reduce((sum, a) => sum + (a.uiAmount || 0), 0);
      return Math.round((top10 / supplyUi) * 1000) / 10;
    },

    async getTopHolders(mint, supplyUi, limit = 20) {
      if (!supplyUi || supplyUi <= 0) return [];
      const largest = await rpc<LargestAccountsResult>('getTokenLargestAccounts', [
        mint,
        { commitment: 'confirmed' },
      ]);
      if (!largest || !largest.value?.length) return [];
      const accounts = largest.value.slice(0, limit);

      // Resolve each token account → owner wallet via getMultipleAccounts (one call).
      const owners = new Map<string, string>();
      const infos = await rpc<MultipleAccountsResult>('getMultipleAccounts', [
        accounts.map((a) => a.address),
        { encoding: 'jsonParsed', commitment: 'confirmed' },
      ]);
      if (infos?.value) {
        infos.value.forEach((acc, i) => {
          const owner = acc?.data?.parsed?.info?.owner;
          if (owner) owners.set(accounts[i].address, owner);
        });
      }

      return accounts.map((a) => {
        const ui = a.uiAmount || 0;
        return {
          address: owners.get(a.address) ?? a.address,
          tokenAccount: a.address,
          uiAmount: ui,
          pct: Math.round((ui / supplyUi) * 1000) / 10,
        };
      });
    },

    async getHolderCount(mint, maxPages = 5) {
      // Helius DAS getTokenAccounts, paginated. Bounded so we never hammer the RPC:
      // maxPages * 1000 accounts. If we hit the cap we report capped:true.
      const PAGE = 1000;
      let page = 1;
      let count = 0;
      let capped = false;
      while (page <= maxPages) {
        const res = await rpc<{ total?: number; token_accounts?: { amount?: number | string }[] }>(
          'getTokenAccounts',
          [{ mint, page, limit: PAGE, options: { showZeroBalance: false } }],
        );
        if (!res) return page === 1 ? null : { count, capped };
        const accts = res.token_accounts || [];
        // Count only non-zero balances (real holders).
        for (const a of accts) {
          const amt = typeof a.amount === 'string' ? Number(a.amount) : a.amount || 0;
          if (amt > 0) count++;
        }
        if (accts.length < PAGE) return { count, capped };
        if (page === maxPages) capped = true;
        page++;
      }
      return { count, capped };
    },

    async getOwnerTokenBalance(owner, mint) {
      const result = await rpc<TokenAccountsByOwnerResult>('getTokenAccountsByOwner', [
        owner,
        { mint },
        { encoding: 'jsonParsed', commitment: 'confirmed' },
      ]);
      if (!result) return null;
      if (!result.value?.length) return 0;
      let total = 0;
      for (const acct of result.value) {
        total += acct.account.data.parsed.info.tokenAmount.uiAmount || 0;
      }
      return total;
    },

    async getAllTokenAccounts(owner) {
      // SPL Token + Token-2022 program IDs. One getTokenAccountsByOwner call each.
      const PROGRAMS = [
        'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
        'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb',
      ];
      const results = await Promise.all(
        PROGRAMS.map((programId) =>
          rpc<AllTokenAccountsResult>('getTokenAccountsByOwner', [
            owner,
            { programId },
            { encoding: 'jsonParsed', commitment: 'confirmed' },
          ]),
        ),
      );
      if (results.every((r) => r == null)) return null;

      // Merge across programs, summing any duplicate mints, keeping non-zero balances.
      const byMint = new Map<string, WalletTokenBalance>();
      for (const res of results) {
        for (const acct of res?.value || []) {
          const info = acct.account.data.parsed.info;
          const amount = info.tokenAmount.uiAmount || 0;
          if (amount <= 0) continue;
          const existing = byMint.get(info.mint);
          if (existing) existing.amount += amount;
          else byMint.set(info.mint, { mint: info.mint, amount, decimals: info.tokenAmount.decimals });
        }
      }
      return [...byMint.values()];
    },

    async getBalance(owner) {
      const result = await rpc<{ value: number }>('getBalance', [owner, { commitment: 'confirmed' }]);
      if (!result || typeof result.value !== 'number') return null;
      return result.value / 1e9;
    },

    async getAssetMetadata(mint) {
      // Helius DAS getAsset — returns metadata for fungible tokens.
      const result = await rpcDas<{
        content?: {
          metadata?: { name?: string; symbol?: string };
          links?: { image?: string };
          files?: { uri?: string }[];
        };
      }>('getAsset', { id: mint });
      if (!result?.content) return null;
      return {
        name: result.content.metadata?.name ?? null,
        symbol: result.content.metadata?.symbol ?? null,
        image: result.content.links?.image ?? result.content.files?.[0]?.uri ?? null,
      };
    },

    async getWalletAgeDays(wallet, nowMs) {
      // Walk back to the earliest signature. We page in batches of 1000 up to a
      // bound; very active wallets (thousands of txs) return null rather than
      // spending many calls — "unknown", scored cautiously by the engine.
      const LIMIT = 1000;
      const MAX_PAGES = 3;
      let before: string | undefined;
      let earliest: number | null = null;
      for (let p = 0; p < MAX_PAGES; p++) {
        const params: [string, Record<string, unknown>] = [
          wallet,
          { limit: LIMIT, ...(before ? { before } : {}) },
        ];
        const sigs = await rpc<SignatureInfo[]>('getSignaturesForAddress', params);
        if (!sigs || sigs.length === 0) break;
        const last = sigs[sigs.length - 1];
        if (last.blockTime) earliest = last.blockTime;
        if (sigs.length < LIMIT) break; // reached the beginning
        before = last.signature;
        if (p === MAX_PAGES - 1) return null; // too active to bound cheaply
      }
      if (earliest == null) return null;
      return Math.max(0, Math.floor((nowMs - earliest * 1000) / (1000 * 60 * 60 * 24)));
    },

    async getCreatedTokenCount(wallet) {
      // Helius DAS: assets created by this wallet. One page is enough to know if
      // this is a serial launcher; we report total when the API provides it.
      const res = await rpcDas<{ total?: number; items?: unknown[] }>('getAssetsByCreator', {
        creatorAddress: wallet,
        onlyVerified: false,
        page: 1,
        limit: 1000,
      });
      if (!res) return null;
      if (typeof res.total === 'number') return res.total;
      return Array.isArray(res.items) ? res.items.length : null;
    },
  };
}
