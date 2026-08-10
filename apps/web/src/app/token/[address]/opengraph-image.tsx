import { ImageResponse } from 'next/og';
import { isValidSolanaAddress, normalizeAddress } from '@apecheck/core';
import { getAdminSupabase } from '@/lib/supabase-server';
import { rowToScanResult } from '@/lib/scan-cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const BAND_COLOR: Record<string, string> = {
  low: '#14F195',
  medium: '#FFB020',
  high: '#FF3B5C',
};

export default async function OgImage({ params }: { params: { address: string } }) {
  const address = normalizeAddress(params.address);

  let symbol = 'TOKEN';
  let name = 'Unknown token';
  let risk = 0;
  let band = 'high';
  let bandLabel = 'Unknown Risk';
  let potential = 0;
  let holders = 0;
  let devPct = 0;
  let found = false;

  if (isValidSolanaAddress(address)) {
    try {
      const admin = getAdminSupabase();
      const { data } = await admin.from('scans').select('*').eq('token_address', address).maybeSingle();
      if (data?.raw_data) {
        const scan = rowToScanResult(data);
        symbol = scan.meta.symbol || 'TOKEN';
        name = scan.meta.name || 'Unknown token';
        risk = scan.riskScore;
        band = scan.riskBand;
        bandLabel = scan.riskBandLabel;
        potential = scan.potentialScore;
        holders = scan.holders.count;
        devPct = scan.devWallet.percentHeld;
        found = true;
      }
    } catch {
      /* fall through to placeholder card */
    }
  }

  const riskColor = BAND_COLOR[band] ?? '#FF3B5C';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#0D0F0C',
          backgroundImage:
            'radial-gradient(circle at 20% 10%, rgba(153,69,255,0.18), transparent 45%), radial-gradient(circle at 85% 90%, rgba(20,241,149,0.14), transparent 40%)',
          padding: '64px',
          fontFamily: 'monospace',
          color: '#EAF2E3',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ fontSize: 52 }}>🦍</div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 34, fontWeight: 700, color: '#F5D547' }}>ApeCheck</div>
              <div style={{ fontSize: 20, color: '#5F6B58' }}>solana rug scanner</div>
            </div>
          </div>
          <div style={{ display: 'flex', fontSize: 22, color: '#5F6B58' }}>
            {found ? 'scan complete' : 'scanning…'}
          </div>
        </div>

        {/* Token identity */}
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 48 }}>
          <div style={{ display: 'flex', fontSize: 64, fontWeight: 700 }}>
            ${symbol}
          </div>
          <div style={{ display: 'flex', fontSize: 28, color: '#9AA694', marginTop: 4 }}>{name}</div>
        </div>

        {/* Scores */}
        <div style={{ display: 'flex', gap: '28px', marginTop: 44 }}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              border: `2px solid ${riskColor}55`,
              borderRadius: 20,
              padding: '28px 32px',
              backgroundColor: 'rgba(255,255,255,0.02)',
            }}
          >
            <div style={{ display: 'flex', fontSize: 22, color: '#9AA694', letterSpacing: 2 }}>RISK SCORE</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginTop: 8 }}>
              <div style={{ display: 'flex', fontSize: 96, fontWeight: 700, color: riskColor, lineHeight: 1 }}>{risk}</div>
              <div style={{ display: 'flex', fontSize: 30, color: '#5F6B58', marginBottom: 12 }}>/100</div>
            </div>
            <div style={{ display: 'flex', fontSize: 28, color: riskColor, marginTop: 8 }}>{bandLabel}</div>
            <div style={{ display: 'flex', fontSize: 18, color: '#5F6B58', marginTop: 4 }}>higher = safer</div>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              border: '2px solid #9945FF55',
              borderRadius: 20,
              padding: '28px 32px',
              backgroundColor: 'rgba(255,255,255,0.02)',
            }}
          >
            <div style={{ display: 'flex', fontSize: 22, color: '#9AA694', letterSpacing: 2 }}>POTENTIAL</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginTop: 8 }}>
              <div style={{ display: 'flex', fontSize: 96, fontWeight: 700, color: '#9945FF', lineHeight: 1 }}>{potential}</div>
              <div style={{ display: 'flex', fontSize: 30, color: '#5F6B58', marginBottom: 12 }}>/100</div>
            </div>
            <div style={{ display: 'flex', fontSize: 28, color: '#9945FF', marginTop: 8 }}>Upside Signal</div>
            <div style={{ display: 'flex', fontSize: 18, color: '#5F6B58', marginTop: 4 }}>signal only, not advice</div>
          </div>
        </div>

        {/* Footer stats */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
          <div style={{ display: 'flex', gap: 36 }}>
            <div style={{ display: 'flex', fontSize: 22, color: '#9AA694' }}>{holders.toLocaleString()} holders</div>
            <div style={{ display: 'flex', fontSize: 22, color: '#9AA694' }}>dev holds {devPct.toFixed(1)}%</div>
          </div>
          <div style={{ display: 'flex', fontSize: 20, color: '#5F6B58' }}>not financial advice</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
