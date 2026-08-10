// Types
export * from './types';

// Constants + legal copy
export * from './constants';

// Scoring
export { computeRiskScore, computePotentialScore, bandForScore } from './scoring';

// Scan engine
export {
  runScan,
  gatherScanInput,
  buildResult,
  ScanError,
} from './scan-engine';
export type {
  ScanEngineConfig,
  ScanCache,
  RunScanOptions,
  ScanErrorCode,
} from './scan-engine';

// DEX helpers
export { getBuyInstructions, getPrimaryBuy, enrichDexListings } from './dex';
export type { BuyInstructions } from './dex';

// Alerts (extended detection: LP pull / authority re-enable / price drop / whale sell)
export {
  detectAlerts,
  snapshotBaseline,
  ALERT_THRESHOLDS,
} from './alerts';
export type { AlertType, WatchBaseline, DetectedAlert } from './alerts';

// Formatters + validation
export {
  isValidSolanaAddress,
  normalizeAddress,
  shortenAddress,
  formatUsd,
  formatNumber,
  formatPercent,
  formatSignedPercent,
  formatTokenPrice,
  formatAge,
  timeAgo,
} from './formatters';
