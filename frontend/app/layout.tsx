import type { Metadata } from 'next';
import Link from 'next/link';
import TestnetBanner from '../components/TestnetBanner';
import './globals.css';

export const metadata: Metadata = {
  title: 'DrawPool — Send $1 USDT. Win $1,000.',
  description: 'Anonymous online prize draw platform on Polygon. Enter with $1 USDT directly from your Web3 wallet. 100% provably fair, automatic USDT payouts.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-[#1A1A2E] text-[#E2E8F0] min-h-screen flex flex-col antialiased">
        <TestnetBanner />
        
        {/* Navigation Header */}
        <header className="border-b border-[#2c3a5f]/60 bg-[#16213E] sticky top-[38px] z-40">
          <div className="max-w-5xl mx-auto px-4 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
            <Link href="/" className="flex items-center gap-2 group">
              <span className="text-2xl">💰</span>
              <span className="text-xl font-extrabold text-white tracking-wider group-hover:text-[#E6A817] transition-colors">
                DRAW<span className="text-[#E6A817]">POOL</span>
              </span>
            </Link>

            <nav className="flex items-center flex-wrap justify-center gap-x-5 gap-y-2 text-sm font-semibold text-[#8E9BB0]">
              <Link href="/" className="hover:text-white transition-colors">
                Home
              </Link>
              <Link href="/rounds" className="hover:text-white transition-colors">
                History
              </Link>
              <Link href="/my-entries" className="hover:text-white transition-colors">
                My Entries
              </Link>
              <Link href="/how-it-works" className="hover:text-white transition-colors">
                How It Works
              </Link>
              <Link href="/verify" className="hover:text-white transition-colors">
                Verify Draw
              </Link>
            </nav>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8">
          {children}
        </main>

        {/* Footer */}
        <footer className="border-t border-[#2c3a5f]/40 py-8 bg-[#16213E]/20 text-center text-xs text-[#8E9BB0] space-y-2">
          <p>© 2026 DrawPool. Built on Polygon. Anonymous | Auto Payout.</p>
          <p>
            USDT Address:{' '}
            <code className="font-mono bg-[#16213E] border border-[#2c3a5f]/60 px-1 py-0.5 rounded text-gray-300">
              0xc2132D05D31c914a87C6611C10748AEb04B58e8F
            </code>
          </p>
        </footer>
      </body>
    </html>
  );
}
