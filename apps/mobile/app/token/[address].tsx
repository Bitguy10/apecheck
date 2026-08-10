import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, Image, Share, ActivityIndicator, AppState } from 'react-native';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import type { ScanResult } from '@apecheck/core';
import { normalizeAddress, shortenAddress, timeAgo } from '@apecheck/core';
import { scanToken, ApiClientError } from '../../src/lib/api';
import { addRecentScan } from '../../src/lib/recent-scans';
import { config } from '../../src/lib/config';
import { RiskGauge } from '../../src/components/RiskGauge';
import { ScoreBadges } from '../../src/components/ScoreBadges';
import { MarketHeader } from '../../src/components/MarketHeader';
import { SafetyChecks } from '../../src/components/SafetyChecks';
import { TopHoldersTable } from '../../src/components/TopHoldersTable';
import { LiveEmbeds } from '../../src/components/LiveEmbeds';
import { StatsGrid } from '../../src/components/StatsGrid';
import { BreakdownLog } from '../../src/components/BreakdownLog';
import { SocialsPanel } from '../../src/components/SocialsPanel';
import { BuyPanel } from '../../src/components/BuyPanel';
import { WatchToggle } from '../../src/components/WatchToggle';
import { CopyChip } from '../../src/components/CopyChip';
import { AuthSheet } from '../../src/components/AuthSheet';
import { C } from '../../src/lib/theme';

const AUTO_REFRESH_MS = 30_000;

const SCAN_STEPS = [
  'connecting to solana rpc…',
  'reading mint & freeze authority…',
  'pulling rugcheck report…',
  'checking LP lock / burn…',
  'measuring dev wallet holdings…',
  'counting holders & concentration…',
  'verifying socials & domain age…',
  'routing DEX liquidity via jupiter…',
  'scoring risk + potential…',
];

export default function TokenScreen() {
  const params = useLocalSearchParams<{ address: string }>();
  const address = normalizeAddress(String(params.address ?? ''));
  const navigation = useNavigation();

  const [scan, setScan] = useState<ScanResult | null>(null);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [live, setLive] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const started = useRef(false);
  const scanRef = useRef<ScanResult | null>(null);

  const run = useCallback(
    async (forceRefresh = false, silent = false) => {
      if (!silent) {
        setLoading(true);
        setError(null);
      } else {
        setRefreshing(true);
      }
      try {
        const result = await scanToken(address, forceRefresh);
        scanRef.current = result;
        setScan(result);
        navigation.setOptions({ title: result.meta.symbol ? `$${result.meta.symbol}` : 'Scan' });
        addRecentScan({
          tokenAddress: result.tokenAddress,
          name: result.meta.name,
          symbol: result.meta.symbol,
          riskScore: result.riskScore,
          riskBand: result.riskBand,
          scannedAt: result.scannedAt,
        });
      } catch (e) {
        if (!silent) {
          setError(
            e instanceof ApiClientError
              ? { code: e.code, message: e.message }
              : { code: 'INTERNAL', message: 'Something went wrong.' },
          );
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [address, navigation],
  );

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    run();
  }, [run]);

  // Live auto-refresh: silently re-scan while the screen is active, only when
  // the user has flipped Live on. Pauses when the app goes to the background.
  useEffect(() => {
    if (!live) return;
    const refresh = () => run(true, true);
    const t = setInterval(refresh, AUTO_REFRESH_MS);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      clearInterval(t);
      sub.remove();
    };
  }, [live, run]);

  async function share() {
    if (!scan) return;
    const url = `${config.apiUrl}/token/${scan.tokenAddress}`;
    const text = `${scan.meta.symbol ? '$' + scan.meta.symbol : 'Token'} · ApeCheck risk ${scan.riskScore}/100 (${scan.riskBandLabel}) · potential ${scan.potentialScore}/100\n${url}`;
    try {
      await Share.share({ message: text, url });
    } catch {
      /* cancelled */
    }
  }

  if (loading) return <ScanningState address={address} />;
  if (error) return <ErrorState address={address} error={error} onRetry={() => run(true)} />;
  if (!scan) return null;

  return (
    <ScrollView className="flex-1 bg-jungle-black" contentContainerClassName="p-4 pb-20 gap-4">
      {/* Header */}
      <View className="flex-row items-center gap-3">
        {scan.meta.imageUrl ? (
          <Image source={{ uri: scan.meta.imageUrl }} className="h-12 w-12 rounded-full border border-border" />
        ) : (
          <View className="h-12 w-12 items-center justify-center rounded-full border border-border bg-panel-2">
            <Text className="text-xl">🪙</Text>
          </View>
        )}
        <View className="flex-1">
          <Text className="font-display text-xl font-bold text-text-primary" numberOfLines={1}>
            {scan.meta.name || 'Unknown token'} {scan.meta.symbol ? <Text className="text-text-muted">${scan.meta.symbol}</Text> : null}
          </Text>
          <View className="mt-1 flex-row items-center gap-2">
            <CopyChip value={scan.tokenAddress} display={shortenAddress(scan.tokenAddress, 6, 6)} />
            <Text className="font-mono text-[10px] text-text-muted">
              {scan.cached ? 'cached' : 'live'} · {timeAgo(scan.scannedAt, Date.now())}
            </Text>
          </View>
        </View>
        {refreshing ? (
          <ActivityIndicator size="small" color={C['signal-green']} />
        ) : (
          <Pressable onPress={() => run(true, true)} className="rounded-md border border-border px-2.5 py-1.5 active:opacity-70">
            <Text className="font-mono text-[11px] text-text-secondary">↻</Text>
          </Pressable>
        )}
      </View>

      {/* Market data: price / MC / FDV / 24h / volume */}
      <MarketHeader market={scan.market} />

      {/* Gauge */}
      <View className="items-center rounded-xl border border-border bg-panel/40 py-4">
        <RiskGauge score={scan.riskScore} band={scan.riskBand} />
      </View>

      {/* Badges */}
      <ScoreBadges
        riskScore={scan.riskScore}
        riskBand={scan.riskBand}
        riskBandLabel={scan.riskBandLabel}
        potentialScore={scan.potentialScore}
      />

      {/* Warnings */}
      {scan.warnings.length > 0 && (
        <View className="rounded-lg border border-warning-amber/30 bg-warning-amber/5 px-4 py-3">
          <Text className="mb-1 font-mono text-[10px] uppercase tracking-widest text-warning-amber">data notes</Text>
          {scan.warnings.map((w, i) => (
            <Text key={i} className="text-xs text-warning-amber/90">
              • {w}
            </Text>
          ))}
        </View>
      )}

      {/* Live toggle + watch + share */}
      <View className="flex-row items-center gap-2">
        <Pressable
          onPress={() => setLive((v) => !v)}
          className={`flex-row items-center gap-1.5 rounded-lg border px-3 py-3 ${
            live ? 'border-signal-green/60 bg-signal-green/10' : 'border-border bg-panel-2'
          }`}
        >
          <Text className={`h-1.5 w-1.5 rounded-full ${live ? 'bg-signal-green' : 'bg-text-muted'}`} />
          <Text className={`text-sm font-semibold ${live ? 'text-signal-green' : 'text-text-secondary'}`}>Live</Text>
        </Pressable>
        <View className="flex-1">
          <WatchToggle tokenAddress={scan.tokenAddress} onNeedAuth={() => setAuthOpen(true)} />
        </View>
        <Pressable onPress={share} className="rounded-lg border border-border bg-panel-2 px-4 py-3 active:opacity-70">
          <Text className="text-sm font-semibold text-text-secondary">↗ Share</Text>
        </Pressable>
      </View>

      {/* Live chart / trades / bubble map */}
      <LiveEmbeds scan={scan} />

      {/* Can I sell? + dev reputation */}
      <SafetyChecks sellCheck={scan.sellCheck} dev={scan.devReputation} />

      {/* Stats */}
      <StatsGrid scan={scan} />

      {/* Top holders */}
      <TopHoldersTable holders={scan.topHolders} launch={scan.launch} />

      {/* Breakdowns */}
      <BreakdownLog title="risk analysis" items={scan.riskBreakdown} accent="green" />
      <BreakdownLog title="potential signal" items={scan.potentialBreakdown} accent="purple" />
      <Text className="text-[11px] text-text-muted">{scan.potentialDisclaimer}</Text>

      {/* Socials */}
      <SocialsPanel socials={scan.socials} />

      {/* Buy */}
      <View>
        <Text className="mb-2 font-mono text-xs uppercase tracking-widest text-text-muted">where to buy</Text>
        <BuyPanel scan={scan} />
      </View>

      <AuthSheet visible={authOpen} onClose={() => setAuthOpen(false)} />
    </ScrollView>
  );
}

// ─────────────────────────────────────────────────────────────

function ScanningState({ address }: { address: string }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep((s) => Math.min(s + 1, SCAN_STEPS.length - 1)), 420);
    return () => clearInterval(t);
  }, []);

  return (
    <View className="flex-1 bg-jungle-black p-4">
      <View className="mb-4 flex-row items-center gap-2">
        <ActivityIndicator size="small" color={C['signal-green']} />
        <Text className="font-mono text-xs text-text-muted">scanning {shortenAddress(address, 6, 6)}</Text>
      </View>
      <View className="rounded-lg border border-border bg-panel/60 p-4">
        {SCAN_STEPS.slice(0, step + 1).map((s, i) => (
          <View key={i} className="flex-row items-center gap-2 py-0.5">
            <Text className="font-mono text-signal-green">{i < step ? '✓' : '›'}</Text>
            <Text className={`font-mono text-sm ${i < step ? 'text-text-secondary' : 'text-text-primary'}`}>{s}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function ErrorState({
  address,
  error,
  onRetry,
}: {
  address: string;
  error: { code: string; message: string };
  onRetry: () => void;
}) {
  const isNotFound = error.code === 'NOT_FOUND';
  const isInvalid = error.code === 'INVALID_ADDRESS';
  return (
    <View className="flex-1 items-center justify-center bg-jungle-black p-8">
      <Text className="text-4xl">{isNotFound ? '👻' : isInvalid ? '🤔' : '💥'}</Text>
      <Text className="mt-2 font-display text-lg font-bold text-rug-red">
        {isNotFound ? 'Token not found' : isInvalid ? 'Invalid address' : 'Scan failed'}
      </Text>
      <Text className="mt-1 text-center text-sm text-text-secondary">{error.message}</Text>
      <Text className="mt-2 font-mono text-[11px] text-text-muted">{shortenAddress(address, 8, 8)}</Text>
      {!isInvalid && (
        <Pressable onPress={onRetry} className="mt-4 rounded-md bg-signal-green px-4 py-2 active:opacity-90">
          <Text className="font-display text-sm font-bold text-jungle-black">↻ Try again</Text>
        </Pressable>
      )}
    </View>
  );
}
