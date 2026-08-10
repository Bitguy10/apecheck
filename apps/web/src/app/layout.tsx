import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Nav } from '@/components/Nav';
import { MobileTabBar } from '@/components/MobileTabBar';

export const metadata: Metadata = {
  title: 'ApeCheck — Scan before you ape',
  description:
    'Paste a Solana token address and get an instant rug-pull risk check: authorities, LP lock, dev holdings, holders, socials, and where to buy.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  openGraph: {
    title: 'ApeCheck — Scan before you ape',
    description: 'Instant Solana token rug-pull risk check.',
    type: 'website',
  },
  twitter: { card: 'summary_large_image' },
};

export const viewport: Viewport = {
  themeColor: '#0D0F0C',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <Nav />
        <main className="content-layer mx-auto w-full max-w-3xl px-4 pb-24 pt-4">{children}</main>
        <MobileTabBar />
      </body>
    </html>
  );
}
