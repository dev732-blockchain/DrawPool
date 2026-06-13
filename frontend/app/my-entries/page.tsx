'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import api from '../../lib/api';
import WalletConnect from '../../components/WalletConnect';

interface RoundEntryGroup {
  roundNumber: number;
  roundStatus: string;
  entriesHeld: number;
  outcome: string;
  completedAt: string | null;
  prizeHash: string | null;
  entries: Array<{
    id: number;
    entryNumber: number;
    txHash: string;
    amountPaid: string;
    createdAt: string;
  }>;
}

function MyEntriesContent() {
  const searchParams = useSearchParams();
  const [address, setAddress] = useState<string | null>(null);
  const [history, setHistory] = useState<RoundEntryGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addressInput, setAddressInput] = useState('');

  const isTestnet = process.env.NEXT_PUBLIC_IS_TESTNET === 'true';
  const prizeUSD = isTestnet ? 5 : 100;
  const explorerUrl = process.env.NEXT_PUBLIC_POLYGON_EXPLORER || 'https://polygonscan.com';

  const fetchWalletHistory = async (walletAddr: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getWalletHistory(walletAddr);
      setHistory(data || []);
    } catch (err: any) {
      console.error('[MyEntries] Fetch history error:', err);
      setError(err.message || 'Failed to fetch transaction history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const addrQuery = searchParams.get('address');
    if (addrQuery && addrQuery.startsWith('0x')) {
      const addr = addrQuery.toLowerCase();
      setAddress(addr);
      setAddressInput(addr);
      fetchWalletHistory(addr);
    }
  }, [searchParams]);

  const handleWalletChange = (newAddr: string | null) => {
    setAddress(newAddr);
    if (newAddr) {
      setAddressInput(newAddr);
      fetchWalletHistory(newAddr);
    } else {
      setHistory([]);
    }
  };

  const handleAddressSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (addressInput.startsWith('0x')) {
      const addr = addressInput.trim().toLowerCase();
      setAddress(addr);
      fetchWalletHistory(addr);
    }
  };

  // Calculate totals
  const totalEntries = history.reduce((sum, item) => sum + item.entriesHeld, 0);
  const totalUSDTSpent = totalEntries; // $1 per entry
  const totalWon = history.filter((item) => item.outcome.startsWith('Won')).length * prizeUSD;

  const shortenTx = (tx: string) => {
    // Suffix checks: transaction hashes might contain -0, -1, etc. from multi-entry txs
    const cleanTx = tx.split('-')[0];
    return `${cleanTx.substring(0, 10)}...${cleanTx.substring(cleanTx.length - 8)}`;
  };

  return (
    <div className="space-y-8">
      <div className="text-center md:text-left">
        <h1 className="text-2xl font-black text-white uppercase tracking-tight">My Entries</h1>
        <p className="text-sm text-[#8E9BB0]">Track all your purchases and see if your tickets won.</p>
      </div>

      {/* Connection status card */}
      <div className="bg-[#16213E] border border-[#2c3a5f] p-6 rounded-2xl shadow-xl flex flex-col md:flex-row items-center justify-between gap-6 max-w-2xl mx-auto">
        <div className="text-center md:text-left space-y-1">
          <span className="text-xs text-[#8E9BB0] uppercase tracking-wider block font-semibold">Wallet connection</span>
          {address ? (
            <p className="text-sm text-[#E2E8F0] font-mono">{address}</p>
          ) : (
            <p className="text-sm text-[#8E9BB0] italic">No wallet connected. Paste address or connect below:</p>
          )}
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto shrink-0 justify-end">
          <form onSubmit={handleAddressSubmit} className="flex gap-2 w-full sm:w-auto">
            <input
              type="text"
              value={addressInput}
              onChange={(e) => setAddressInput(e.target.value)}
              placeholder="Paste wallet address 0x..."
              className="bg-[#1a1a2e] border border-[#2c3a5f] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#E6A817] font-mono w-full sm:w-[200px]"
            />
            <button
              type="submit"
              disabled={!addressInput.startsWith('0x')}
              className="bg-[#2c3a5f] disabled:opacity-50 hover:bg-[#3d5180] text-white px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
            >
              Go
            </button>
          </form>
          <WalletConnect onAddressChange={handleWalletChange} />
        </div>
      </div>

      {/* Main content display */}
      {!address ? (
        <div className="bg-[#16213E]/50 border border-[#2c3a5f]/40 p-12 rounded-2xl text-center text-sm text-[#8E9BB0] max-w-xl mx-auto">
          🔒 Please connect your MetaMask wallet or paste your wallet address above to load your ticket history.
        </div>
      ) : loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#E6A817] mx-auto mb-2"></div>
          <p className="text-sm text-[#8E9BB0]">Loading your entry history...</p>
        </div>
      ) : history.length === 0 ? (
        <div className="bg-[#16213E]/50 border border-[#2c3a5f]/40 p-12 rounded-2xl text-center text-sm text-[#8E9BB0] max-w-xl mx-auto space-y-2">
          <span className="text-2xl">🎟️</span>
          <p className="font-semibold text-white">No entries found for this address.</p>
          <p>Once you send USDT to the draw address, your tickets will show up here within 30 seconds.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Stats Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-2xl mx-auto">
            <div className="bg-[#16213E] border border-[#2c3a5f] p-4 rounded-xl text-center">
              <span className="text-xs text-[#8E9BB0] block uppercase tracking-wider mb-1">Entries Purchased</span>
              <span className="text-2xl font-extrabold text-[#E2E8F0] font-mono">{totalEntries}</span>
            </div>

            <div className="bg-[#16213E] border border-[#2c3a5f] p-4 rounded-xl text-center">
              <span className="text-xs text-[#8E9BB0] block uppercase tracking-wider mb-1">USDT Contributed</span>
              <span className="text-2xl font-extrabold text-[#8E9BB0] font-mono">${totalUSDTSpent}</span>
            </div>

            <div className="bg-[#16213E] border border-[#2c3a5f] p-4 rounded-xl text-center">
              <span className="text-xs text-[#8E9BB0] block uppercase tracking-wider mb-1">Total Won</span>
              <span className="text-2xl font-extrabold text-[#22c55e] font-mono">${totalWon} USDT</span>
            </div>
          </div>

          {/* Grouped rounds accordion list */}
          <div className="space-y-6 max-w-3xl mx-auto">
            <h2 className="text-lg font-bold text-white border-b border-[#2c3a5f]/40 pb-2">Rounds Activity</h2>
            
            {history.map((item) => (
              <div
                key={item.roundNumber}
                className="bg-[#16213E] border border-[#2c3a5f] rounded-2xl p-5 shadow-lg space-y-4"
              >
                {/* Header */}
                <div className="flex justify-between items-center border-b border-[#2c3a5f]/40 pb-3">
                  <div>
                    <span className="text-base font-bold text-white">Round #{item.roundNumber}</span>
                    <span className="text-xs text-[#8E9BB0] block">
                      {item.completedAt ? new Date(item.completedAt).toLocaleDateString() : 'Active Round'}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className={`inline-block text-xs font-bold px-2.5 py-1 rounded-full ${
                      item.outcome.startsWith('Won') ? 'bg-emerald-950 text-[#22c55e]' :
                      item.outcome === 'Pending' ? 'bg-blue-950 text-blue-400' :
                      'bg-zinc-800 text-zinc-400'
                    }`}>
                      {item.outcome.toUpperCase()}
                    </span>
                  </div>
                </div>

                {/* Sub headers and tx items */}
                <div className="space-y-3">
                  <span className="text-xs text-[#8E9BB0] font-semibold uppercase block">
                    Tickets Owned: {item.entriesHeld}
                  </span>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                    {item.entries.map((entry) => (
                      <div
                        key={entry.id}
                        className="bg-[#1a1a2e] border border-[#2c3a5f]/40 p-3 rounded-lg flex justify-between items-center"
                      >
                        <span className="font-bold text-[#E6A817]">
                          Ticket #{entry.entryNumber - 1}
                        </span>
                        
                        <a
                          href={`${explorerUrl}/tx/${entry.txHash.split('-')[0]}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#8E9BB0] hover:text-white underline cursor-pointer truncate max-w-[120px]"
                          title="Verify payment on Polygonscan"
                        >
                          {shortenTx(entry.txHash)} ↗
                        </a>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Winner Modal Payout verification */}
                {item.prizeHash && (
                  <div className="text-right pt-2 border-t border-[#2c3a5f]/20">
                    <a
                      href={`${explorerUrl}/tx/${item.prizeHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[#E6A817] hover:text-[#ffd043] font-bold underline cursor-pointer"
                    >
                      Verify Prize Payout Transaction ↗
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Main page component wrapped in Suspense
export default function MyEntries() {
  return (
    <Suspense fallback={
      <div className="bg-[#16213E] border border-[#2c3a5f] rounded-2xl p-6 md:p-8 shadow-xl max-w-2xl mx-auto text-center py-8">
        <p className="text-sm text-[#8E9BB0]">Loading entry logs...</p>
      </div>
    }>
      <MyEntriesContent />
    </Suspense>
  );
}
