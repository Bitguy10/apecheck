import type { Metadata } from 'next';
import { isValidSolanaAddress, normalizeAddress } from '@apecheck/core';
import { ScanResultView } from '@/components/ScanResultView';
import { getAdminSupabase } from '@/lib/supabase-server';
import { rowToScanResult } from '@/lib/scan-cache';
import { env } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface PageProps {
  params: { address: string };
}

/**
 * Build share metadata from the cached scan (if present). We never trigger a
 * fresh scan here — metadata generation stays fast and best-effort.
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const address = normalizeAddress(params.address);
  const base = env.appUrl();
  const fallback: Metadata = {
    title: 'Scan · ApeCheck',
    description: 'Rug-pull risk scan for a Solana token.',
  };
  if (!isValidSolanaAddress(address)) return fallback;

  try {
    const admin = getAdminSupabase();
    const { data } = await admin.from('scans').select('*').eq('token_address', address).maybeSingle();
    if (!data) {
      return {
        title: 'Scanning token · ApeCheck',
        description: 'Live rug-pull risk scan for a Solana token.',
        openGraph: {
          images: [`${base}/token/${address}/opengraph-image`],
        },
      };
    }
    const scan = rowToScanResult(data);
    const title = `${scan.meta.symbol ? '$' + scan.meta.symbol : 'Token'} · Risk ${scan.riskScore}/100 (${scan.riskBandLabel})`;
    const description = `Potential ${scan.potentialScore}/100 · ${scan.holders.count} holders · dev holds ${scan.devWallet.percentHeld.toFixed(1)}%. Signal strength only — not financial advice.`;
    const ogImage = `${base}/token/${address}/opengraph-image`;
    return {
      title,
      description,
      openGraph: { title, description, images: [ogImage], type: 'website' },
      twitter: { card: 'summary_large_image', title, description, images: [ogImage] },
    };
  } catch {
    return fallback;
  }
}

export default function TokenPage({ params }: PageProps) {
  const address = normalizeAddress(params.address);
  return <ScanResultView address={address} />;
}
