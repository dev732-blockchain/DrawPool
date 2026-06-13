'use client';

import { useEffect, useState } from 'react';
import api from '../lib/api';

interface WinnerRecord {
  roundNumber: number;
  winnerAddress: string;
  winnerEntry: number;
  completedAt: string;
  prizeHash: string;
}

export default function RecentWinners() {
  const [winners, setWinners] = useState<WinnerRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const isTestnet = process.env.NEXT_PUBLIC_IS_TESTNET === 'true';
  const prizeUSD = isTestnet ? '5' : '100';
  const explorerUrl = process.env.NEXT_PUBLIC_POLYGON_EXPLORER || 'https://polygonscan.com';

  const fetchWinners = async () => {
    try {
      const data = await api.getRoundsHistory(1, 5);
      if (data && Array.isArray(data.rounds)) {
        setWinners(data.rounds);
      }
    } catch (error) {
      console.error('[RecentWinners] Failed to fetch winners:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWinners();

    // Refresh winners list when a refresh is triggered by socket events
    const interval = setInterval(fetchWinners, 30000);
    return () => clearInterval(interval);
  }, []);

  const shortenAddress = (addr: string) => {
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  if (loading) {
    return (
      <div className="bg-[#16213E] border border-[#2c3a5f] rounded-2xl p-6 shadow-xl animate-pulse flex flex-col justify-center items-center h-[180px]">
        <div className="h-4 bg-[#2c3a5f] w-1/3 rounded mb-4"></div>
        <div className="h-2 bg-[#2c3a5f] w-2/3 rounded mb-2"></div>
        <div className="h-2 bg-[#2c3a5f] w-1/2 rounded"></div>
      </div>
    );
  }

  return (
    <div className="bg-[#16213E] border border-[#2c3a5f] rounded-2xl p-6 shadow-xl space-y-4">
      <h2 className="text-lg font-bold text-[#E6A817] border-b border-[#2c3a5f] pb-3">
        Recent Winners
      </h2>

      {winners.length === 0 ? (
        <p className="text-sm text-[#8E9BB0] text-center py-6">
          No rounds completed yet. Be the first to enter!
        </p>
      ) : (
        <div className="divide-y divide-[#2c3a5f]/40 max-h-[250px] overflow-y-auto pr-1">
          {winners.map((winner) => (
            <div
              key={winner.roundNumber}
              className="py-3 flex items-center justify-between gap-4 text-sm hover:bg-[#1a2542]/30 px-2 rounded-lg transition-colors"
            >
              <div className="space-y-1">
                <span className="font-bold text-[#E2E8F0] block">
                  Round #{winner.roundNumber}
                </span>
                <span className="text-xs text-[#8E9BB0] font-mono">
                  Winner: {shortenAddress(winner.winnerAddress)}
                </span>
              </div>
              
              <div className="text-right space-y-1">
                <span className="font-extrabold text-[#E6A817] block font-mono">
                  +${prizeUSD} USDT
                </span>
                {winner.prizeHash ? (
                  <a
                    href={`${explorerUrl}/tx/${winner.prizeHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[#8E9BB0] hover:text-white underline inline-block cursor-pointer"
                  >
                    Tx Hash ↗
                  </a>
                ) : (
                  <span className="text-xs text-[#8E9BB0]">Pending Payout</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
