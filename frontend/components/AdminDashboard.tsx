'use client';

import { useState, useEffect } from 'react';
import api from '../lib/api';
import KillSwitch from './KillSwitch';

interface AdminDashboardProps {
  address: string;
}

interface AdminStats {
  platformActive: boolean;
  totalCompletedRounds: number;
  totalRoundsCount: number;
  totalRevenueUSD: number;
  totalPrizePaidUSD: number;
  hotWalletBalanceUSDT: string;
  rounds: any[];
}

export default function AdminDashboard({ address }: AdminDashboardProps) {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const explorerUrl = process.env.NEXT_PUBLIC_POLYGON_EXPLORER || 'https://polygonscan.com';

  const getAuthHeaders = async () => {
    if (typeof window === 'undefined' || !(window as any).ethereum) {
      throw new Error('MetaMask is required for admin authorization.');
    }
    const timestamp = Date.now();
    const message = `DrawPool Admin Auth at ${timestamp}`;
    
    // Sign message using personal_sign
    const signature = await (window as any).ethereum.request({
      method: 'personal_sign',
      params: [message, address],
    });

    return { signature, address, timestamp };
  };

  const fetchAdminData = async () => {
    setError(null);
    try {
      const auth = await getAuthHeaders();
      const data = await api.getAdminStats(auth);
      setStats(data);
    } catch (err: any) {
      console.error('[AdminDashboard] Fetch error:', err);
      setError(err.message || 'Failed to authenticate and fetch admin data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, [address]);

  const handleStopPlatform = async () => {
    setActionLoading('stop');
    try {
      const auth = await getAuthHeaders();
      await api.stopPlatform(auth);
      await fetchAdminData();
    } catch (err: any) {
      alert(err.message || 'Failed to stop platform');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSyncRound = async (roundNumber: number) => {
    setActionLoading(`sync-${roundNumber}`);
    try {
      const auth = await getAuthHeaders();
      await api.syncRound(roundNumber, auth);
      alert(`Round #${roundNumber} state successfully synced from blockchain!`);
      await fetchAdminData();
    } catch (err: any) {
      alert(err.message || `Failed to sync round #${roundNumber}`);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#E6A817] mx-auto mb-4"></div>
        <p className="text-sm text-[#8E9BB0]">Please sign the authorization request in MetaMask to access the dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-950/20 border border-red-900/40 p-6 rounded-2xl text-center space-y-4 max-w-md mx-auto">
        <p className="text-sm text-[#ef4444] font-medium">{error}</p>
        <button
          onClick={fetchAdminData}
          className="bg-[#E6A817] hover:bg-[#ffd043] text-[#1A1A2E] px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer"
        >
          Sign & Retry
        </button>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Platform Status Hero */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#16213E] border border-[#2c3a5f] p-6 rounded-2xl shadow-lg">
        <div>
          <span className="text-xs text-[#8E9BB0] uppercase tracking-wider block mb-1">Platform Status</span>
          <div className="flex items-center gap-2">
            <span className={`w-3.5 h-3.5 rounded-full ${stats.platformActive ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
            <span className="text-lg font-bold text-[#E2E8F0]">
              {stats.platformActive ? 'PLATFORM ACTIVE' : 'PLATFORM DEACTIVATED'}
            </span>
          </div>
        </div>
        <button
          onClick={fetchAdminData}
          className="text-xs bg-[#2c3a5f] hover:bg-[#3d5180] text-[#E2E8F0] px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
        >
          🔄 Refresh Stats
        </button>
      </div>

      {/* Grid of Key Financials */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#16213E] border border-[#2c3a5f] p-5 rounded-2xl shadow-lg space-y-1">
          <span className="text-xs text-[#8E9BB0] uppercase tracking-wider">Smart Contract Balance</span>
          <span className="text-2xl font-extrabold text-[#E2E8F0] font-mono block">
            {stats.hotWalletBalanceUSDT} USDT
          </span>
        </div>

        <div className="bg-[#16213E] border border-[#2c3a5f] p-5 rounded-2xl shadow-lg space-y-1">
          <span className="text-xs text-[#8E9BB0] uppercase tracking-wider">Platform Revenue</span>
          <span className="text-2xl font-extrabold text-[#22c55e] font-mono block">
            ${stats.totalRevenueUSD.toLocaleString()} USDT
          </span>
        </div>

        <div className="bg-[#16213E] border border-[#2c3a5f] p-5 rounded-2xl shadow-lg space-y-1">
          <span className="text-xs text-[#8E9BB0] uppercase tracking-wider">Prizes Paid Out</span>
          <span className="text-2xl font-extrabold text-[#E6A817] font-mono block">
            ${stats.totalPrizePaidUSD.toLocaleString()} USDT
          </span>
        </div>
      </div>

      {/* Manage and Control split */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Controls (Kill Switch) */}
        <div className="md:col-span-1 space-y-6">
          <KillSwitch onStop={handleStopPlatform} platformActive={stats.platformActive} />
        </div>

        {/* Rounds Management */}
        <div className="md:col-span-2 bg-[#16213E] border border-[#2c3a5f] p-6 rounded-2xl shadow-lg space-y-4">
          <h3 className="text-lg font-bold text-[#E6A817] border-b border-[#2c3a5f]/40 pb-3">
            Rounds Monitor
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left divide-y divide-[#2c3a5f]/30">
              <thead>
                <tr className="text-xs text-[#8E9BB0] uppercase tracking-wider">
                  <th className="py-2.5">Round</th>
                  <th className="py-2.5 text-center">Entries</th>
                  <th className="py-2.5">Status</th>
                  <th className="py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2c3a5f]/20">
                {stats.rounds.map((round) => (
                  <tr key={round.roundNumber} className="hover:bg-[#1a2542]/20">
                    <td className="py-3 font-semibold text-[#E2E8F0]">#{round.roundNumber}</td>
                    <td className="py-3 text-center font-mono">{round.entriesSold}</td>
                    <td className="py-3">
                      <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded ${
                        round.status === 'complete' ? 'bg-emerald-950 text-[#22c55e]' :
                        round.status === 'active' ? 'bg-blue-950 text-blue-400' :
                        round.status === 'drawing' ? 'bg-yellow-950 text-[#E6A817] animate-pulse' :
                        round.status === 'payout_failed' ? 'bg-red-950 text-[#ef4444]' :
                        'bg-zinc-800 text-zinc-400'
                      }`}>
                        {round.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      {round.status !== 'complete' ? (
                        <button
                          onClick={() => handleSyncRound(round.roundNumber)}
                          disabled={actionLoading === `sync-${round.roundNumber}`}
                          className="bg-[#E6A817] hover:bg-[#ffd043] text-[#1A1A2E] text-xs font-bold px-2.5 py-1 rounded transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {actionLoading === `sync-${round.roundNumber}` ? 'Syncing...' : 'Sync with Contract'}
                        </button>
                      ) : round.prizeHash ? (
                        <a
                          href={`${explorerUrl}/tx/${round.prizeHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-[#8E9BB0] hover:text-white underline cursor-pointer"
                        >
                          View Tx ↗
                        </a>
                      ) : (
                        <span className="text-xs text-[#8E9BB0]">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
