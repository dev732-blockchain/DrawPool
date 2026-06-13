'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import api from '../../lib/api';

interface RoundRecord {
  roundNumber: number;
  status: string;
  winnerAddress: string | null;
  winnerEntry: number | null;
  prizeHash: string | null;
  revenueHash: string | null;
  commitHash: string | null;
  seed: string | null;
  createdAt: string;
  completedAt: string | null;
}

export default function RoundsHistory() {
  const [rounds, setRounds] = useState<RoundRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRound, setExpandedRound] = useState<number | null>(null);
  const [entries, setEntries] = useState<any[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [entriesPage, setEntriesPage] = useState(1);
  const [entriesTotal, setEntriesTotal] = useState(0);

  const isTestnet = process.env.NEXT_PUBLIC_IS_TESTNET === 'true';
  const prizeUSD = isTestnet ? '5' : '100';
  const explorerUrl = process.env.NEXT_PUBLIC_POLYGON_EXPLORER || 'https://polygonscan.com';

  const fetchHistory = async () => {
    try {
      const data = await api.getRoundsHistory(1, 100); // Fetch up to 100 completed rounds
      if (data && Array.isArray(data.rounds)) {
        setRounds(data.rounds);
      }
    } catch (error) {
      console.error('[RoundsHistory] Error fetching rounds:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleRowClick = async (roundNumber: number) => {
    if (expandedRound === roundNumber) {
      setExpandedRound(null);
      setEntries([]);
      return;
    }

    setExpandedRound(roundNumber);
    setEntriesLoading(true);
    setEntriesPage(1);

    try {
      const data = await api.getRoundEntries(roundNumber, 1, 100);
      setEntries(data.entries || []);
      setEntriesTotal(data.total || 0);
    } catch (err) {
      console.error('[RoundsHistory] Error fetching round entries:', err);
    } finally {
      setEntriesLoading(false);
    }
  };

  const loadMoreEntries = async () => {
    if (!expandedRound) return;
    const nextPage = entriesPage + 1;
    setEntriesLoading(true);

    try {
      const data = await api.getRoundEntries(expandedRound, nextPage, 100);
      setEntries((prev) => [...prev, ...(data.entries || [])]);
      setEntriesPage(nextPage);
    } catch (err) {
      console.error('[RoundsHistory] Error fetching more entries:', err);
    } finally {
      setEntriesLoading(false);
    }
  };

  const shortenAddress = (addr: string) => {
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  return (
    <div className="space-y-6">
      <div className="text-center md:text-left">
        <h1 className="text-2xl font-black text-white uppercase tracking-tight">Rounds History</h1>
        <p className="text-sm text-[#8E9BB0]">Click on a completed round to view all its ticket entries.</p>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#E6A817] mx-auto mb-2"></div>
          <p className="text-sm text-[#8E9BB0]">Loading history...</p>
        </div>
      ) : rounds.length === 0 ? (
        <div className="bg-[#16213E] border border-[#2c3a5f] rounded-2xl p-8 text-center text-sm text-[#8E9BB0]">
          No rounds completed yet.
        </div>
      ) : (
        <div className="bg-[#16213E] border border-[#2c3a5f] rounded-2xl shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left divide-y divide-[#2c3a5f]/40">
              <thead>
                <tr className="text-xs text-[#8E9BB0] uppercase tracking-wider bg-[#1c294a]/30">
                  <th className="px-6 py-4">Round</th>
                  <th className="px-6 py-4">Completed Date</th>
                  <th className="px-6 py-4 text-center">Winning Ticket</th>
                  <th className="px-6 py-4">Winner Address</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2c3a5f]/25">
                {rounds.map((round) => {
                  const isExpanded = expandedRound === round.roundNumber;
                  return (
                    <div key={round.roundNumber} className="contents">
                      <tr
                        onClick={() => handleRowClick(round.roundNumber)}
                        className={`cursor-pointer transition-colors hover:bg-[#1a2542]/30 ${
                          isExpanded ? 'bg-[#1a2542]/30' : ''
                        }`}
                      >
                        <td className="px-6 py-4 font-bold text-white">#{round.roundNumber}</td>
                        <td className="px-6 py-4 text-xs">
                          {round.completedAt ? new Date(round.completedAt).toLocaleString() : 'N/A'}
                        </td>
                        <td className="px-6 py-4 text-center font-mono font-extrabold text-[#E6A817]">
                          #{round.winnerEntry}
                        </td>
                        <td className="px-6 py-4 font-mono font-semibold">
                          {round.winnerAddress ? shortenAddress(round.winnerAddress) : 'N/A'}
                        </td>
                        <td className="px-6 py-4 text-right space-x-3 text-xs" onClick={(e) => e.stopPropagation()}>
                          {round.prizeHash && (
                            <a
                              href={`${explorerUrl}/tx/${round.prizeHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#E6A817] hover:text-[#ffd043] font-semibold underline cursor-pointer"
                            >
                              Prize Tx ↗
                            </a>
                          )}
                          <Link
                            href={`/verify?round=${round.roundNumber}`}
                            className="text-white bg-[#2c3a5f] hover:bg-[#3d5180] px-2.5 py-1.5 rounded font-semibold inline-block cursor-pointer transition-all"
                          >
                            Verify
                          </Link>
                        </td>
                      </tr>

                      {/* Expanded Entries Drawer */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={5} className="bg-[#101930] px-8 py-6 space-y-4">
                            <div className="flex justify-between items-center border-b border-[#2c3a5f]/40 pb-2">
                              <h3 className="font-bold text-[#E6A817] text-sm">
                                Entry List — Round #{round.roundNumber} ({entriesTotal} total entries)
                              </h3>
                              <span className="text-xs text-[#8E9BB0] font-mono">
                                Formula: SHA256(seed + entries.join('')) % {entriesTotal}
                              </span>
                            </div>

                            {entriesLoading && entries.length === 0 ? (
                              <p className="text-xs text-[#8E9BB0] text-center py-4">Loading entries...</p>
                            ) : entries.length === 0 ? (
                              <p className="text-xs text-[#8E9BB0] text-center py-4">No entries recorded.</p>
                            ) : (
                              <div className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                  {entries.map((entry) => (
                                    <div
                                      key={entry.id}
                                      className={`flex justify-between items-center p-2 rounded-lg border text-xs font-mono ${
                                        round.winnerEntry === entry.entryNumber - 1
                                          ? 'bg-[#E6A817]/10 border-[#E6A817] text-[#E6A817]'
                                          : 'bg-[#16213E] border-[#2c3a5f]/40 text-[#E2E8F0]'
                                      }`}
                                    >
                                      <span>
                                        Ticket <span className="font-bold">#{entry.entryNumber - 1}</span>
                                      </span>
                                      <span className="truncate max-w-[120px]" title={entry.walletAddress}>
                                        {shortenAddress(entry.walletAddress)}
                                      </span>
                                    </div>
                                  ))}
                                </div>

                                {entries.length < entriesTotal && (
                                  <button
                                    onClick={loadMoreEntries}
                                    disabled={entriesLoading}
                                    className="block mx-auto text-xs text-[#E6A817] hover:text-[#ffd043] font-bold border border-[#2c3a5f] hover:border-[#E6A817] px-4 py-2 rounded-lg cursor-pointer transition-all"
                                  >
                                    {entriesLoading ? 'Loading...' : 'Load More'}
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </div>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
