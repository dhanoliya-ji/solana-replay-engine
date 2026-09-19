import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Copy Trading Simulation Dashboard',
  description: 'Replay token trade history, simulate copy-trading behavior, and compare results against tracked wallets.'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
