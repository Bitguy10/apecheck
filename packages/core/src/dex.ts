import {
  DEX_TEMPLATES,
  GENERIC_BUY_STEPS,
  PUMPFUN_BUY_STEPS,
  dexKeyFromName,
  jupiterDeepLink,
} from './constants';
import type { DexListing } from './types';

export interface BuyInstructions {
  dexName: string;
  slippage: string;
  notes: string;
  steps: string[];
  deepLink: string | null;
  isAggregator: boolean;
  bondingCurve: boolean;
}

/**
 * Produce full step-by-step buy instructions for a given DEX + token.
 * Falls back to the generic template for unknown DEXs.
 */
export function getBuyInstructions(dexName: string, tokenAddress: string): BuyInstructions {
  const key = dexKeyFromName(dexName);
  const tpl = key ? DEX_TEMPLATES[key] : null;

  if (key === 'pumpfun') {
    return {
      dexName: 'Pump.fun',
      slippage: 'N/A — bonding curve',
      notes: DEX_TEMPLATES.pumpfun.notes,
      steps: PUMPFUN_BUY_STEPS(),
      deepLink: DEX_TEMPLATES.pumpfun.buildDeepLink?.(tokenAddress) ?? null,
      isAggregator: false,
      bondingCurve: true,
    };
  }

  if (key === 'jupiter') {
    return {
      dexName: 'Jupiter',
      slippage: 'Auto-optimized',
      notes: DEX_TEMPLATES.jupiter.notes,
      steps: GENERIC_BUY_STEPS('Jupiter', 'Auto (leave default)'),
      deepLink: jupiterDeepLink(tokenAddress),
      isAggregator: true,
      bondingCurve: false,
    };
  }

  const name = tpl?.name ?? dexName;
  const slippage = tpl?.defaultSlippage ?? '1–5%';
  return {
    dexName: name,
    slippage,
    notes: tpl?.notes ?? 'Standard AMM swap.',
    steps: GENERIC_BUY_STEPS(name, slippage),
    deepLink: tpl?.buildDeepLink?.(tokenAddress) ?? null,
    isAggregator: false,
    bondingCurve: false,
  };
}

/** The always-available primary "Buy Now" (Jupiter aggregator). */
export function getPrimaryBuy(tokenAddress: string): BuyInstructions {
  return getBuyInstructions('jupiter', tokenAddress);
}

/**
 * Attach a slippage hint + deep-link to each raw listing, sorted by liquidity desc.
 */
export function enrichDexListings(listings: DexListing[], tokenAddress: string): DexListing[] {
  return [...listings]
    .map((l) => {
      const instr = getBuyInstructions(l.dexName, tokenAddress);
      return {
        ...l,
        slippage: instr.slippage,
        buyDeepLink: l.buyDeepLink || instr.deepLink || jupiterDeepLink(tokenAddress),
      };
    })
    .sort((a, b) => b.liquidityUsd - a.liquidityUsd);
}
