'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import api from '../lib/api';
import socketService from '../lib/socket';
import RoundProgress from '../components/RoundProgress';
import EntryInstructions from '../components/EntryInstructions';
import RecentWinners from '../components/RecentWinners';
import WinnerModal from '../components/WinnerModal';

export default function Home() {
  const [activeRound, setActiveRound] = useState<any | null>(null);
  const [stats, setStats] = useState<any | null>(null);
  const [userAddress, setUserAddress] = useState<string | null>(null);
  
  // UI states
  const [isDrawing, setIsDrawing] = useState(false);
  const [isStopped, setIsStopped] = useState(false);
  const [minting, setMinting] = useState(false);
  const [mintMessage, setMintMessage] = useState<string | null>(null);
  
  // Winner modal state
  const [showWinnerModal, setShowWinnerModal] = useState(false);
  const [winnerData, setWinnerData] = useState<any | null>(null);

  const isTestnet = process.env.NEXT_PUBLIC_IS_TESTNET === 'true';
  const maxEntries = isTestnet ? 10 : 200;
  const ticketUSD = '1';

  // Fetch initial active round data and stats
  const fetchData = async () => {
    try {
      const active = await api.getActiveRound();
      setActiveRound(active);
      setIsStopped(active.status === 'stopped');
      if (active.status === 'drawing') {
        setIsDrawing(true);
      }
    } catch (err) {
      console.error('[Home] Error fetching active round:', err);
    }

    try {
      const statsData = await api.getStats();
      setStats(statsData);
    } catch (err) {
      console.error('[Home] Error fetching stats:', err);
    }
  };

  useEffect(() => {
    fetchData();

    // Setup Socket.io listeners
    const socket = socketService();

    socket.on('connect', () => {
      console.log('[Socket] Connected to backend');
    });

    socket.on('entry:sold', (data: any) => {
      console.log('[Socket] entry:sold', data);
      setActiveRound((prev: any) => {
        if (!prev || prev.roundNumber !== data.roundNumber) return prev;
        return {
          ...prev,
          entriesSold: data.entriesSold,
          entriesRemaining: Math.max(0, maxEntries - data.entriesSold),
        };
      });
      // Refresh stats on new sales
      api.getStats().then(setStats).catch(console.error);
    });

    socket.on('round:drawing', (data: any) => {
      console.log('[Socket] round:drawing', data);
      setIsDrawing(true);
      setActiveRound((prev: any) => {
        if (!prev) return prev;
        return { ...prev, status: 'drawing' };
      });
    });

    socket.on('round:complete', (data: any) => {
      console.log('[Socket] round:complete', data);
      setIsDrawing(false);
      
      // Open winner modal
      setWinnerData({
        roundNumber: data.roundNumber,
        winnerAddress: data.winner,
        winnerEntry: data.winnerEntry,
        seed: data.seed,
        prizeHash: data.prizeHash,
      });
      setShowWinnerModal(true);
    });

    socket.on('round:new', (data: any) => {
      console.log('[Socket] round:new', data);
      setIsDrawing(false);
      setActiveRound({
        roundNumber: data.roundNumber,
        entriesSold: 0,
        entriesRemaining: maxEntries,
        status: 'active',
      });
      fetchData(); // Reload stats and round info
    });

    socket.on('platform:stopped', (data: any) => {
      console.log('[Socket] platform:stopped', data);
      setIsStopped(true);
      setActiveRound((prev: any) => {
        if (!prev) return prev;
        return { ...prev, status: 'stopped' };
      });
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Faucet claim handler
  const handleClaimFaucet = async () => {
    if (!userAddress) return;
    setMinting(true);
    setMintMessage(null);

    try {
      const usdtAddress = process.env.NEXT_PUBLIC_USDT_ADDRESS || '0x0000000000000000000000000000000000000000';
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      
      const usdtContract = new ethers.Contract(
        usdtAddress,
        ['function mint(address to, uint256 amount) public'],
        signer
      );

      const overrides = isTestnet ? {
        maxPriorityFeePerGas: ethers.parseUnits('30', 'gwei'),
        maxFeePerGas: ethers.parseUnits('35', 'gwei')
      } : {};

      const mintAmount = ethers.parseUnits('100', 6); // Mint 100 USDT
      const tx = await usdtContract.mint(userAddress, mintAmount, overrides);
      setMintMessage('⏳ Minting transaction submitted...');
      await tx.wait(1);
      
      setMintMessage('🎉 100 Test USDT added to your wallet!');
    } catch (err: any) {
      setMintMessage(`❌ Error: ${err.reason || err.message || 'Minting failed'}`);
    } finally {
      setMinting(false);
    }
  };

  // Add Mock USDT custom token to wallet
  const handleAddToken = async () => {
    if (typeof window === 'undefined' || !(window as any).ethereum) return;
    try {
      const usdtAddress = process.env.NEXT_PUBLIC_USDT_ADDRESS || '0x0000000000000000000000000000000000000000';
      await (window as any).ethereum.request({
        method: 'wallet_watchAsset',
        params: {
          type: 'ERC20',
          options: {
            address: usdtAddress,
            symbol: 'mUSDT',
            decimals: 6,
            image: 'https://cryptologos.cc/logos/tether-usdt-logo.png',
          },
        },
      });
    } catch (err: any) {
      console.error('[Add Token Failed]', err);
    }
  };

  return (
    <div className="space-y-10 relative">
      {/* Platform Stopped Banner */}
      {isStopped && (
        <div className="bg-red-950/40 border-2 border-red-900/60 p-4 rounded-2xl text-center text-red-200 font-semibold text-sm animate-pulse">
          🚨 DrawPool is currently paused by the administrator. No payments are being accepted.
        </div>
      )}

      {/* Hero section */}
      <div className="text-center space-y-4 max-w-xl mx-auto py-4">
        <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight leading-tight">
          Send <span className="text-[#E6A817]">${ticketUSD} USDT</span>.<br className="sm:hidden" /> Win <span className="text-[#E6A817]">${isTestnet ? '5' : '1,000'}</span>.
        </h1>
        <p className="text-[#8E9BB0] text-sm md:text-base leading-relaxed">
          The completely anonymous online prize draw. Simply send USDT directly from MetaMask to enter. No logins, no emails, no personal data.
        </p>

        {/* Testnet Faucet Trigger */}
        {isTestnet && (
          <div className="bg-[#16213E] border border-[#2c3a5f] p-4 rounded-2xl flex flex-col gap-4 max-w-md mx-auto mt-4 text-left">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[#2c3a5f]/40 pb-3">
              <div>
                <span className="text-[10px] text-[#8E9BB0] uppercase tracking-wide block font-semibold">Testnet Faucet</span>
                <span className="text-xs text-[#E2E8F0] font-medium">Get free Test USDT to enter:</span>
              </div>
              {userAddress ? (
                <button
                  onClick={handleClaimFaucet}
                  disabled={minting}
                  className="bg-[#E6A817] hover:bg-[#ffd043] disabled:opacity-50 text-[#1A1A2E] text-xs font-bold px-3 py-2 rounded-lg cursor-pointer transition-all shrink-0"
                >
                  {minting ? 'Minting...' : 'Get Test USDT'}
                </button>
              ) : (
                <span className="text-xs text-[#8E9BB0] italic">Connect wallet below first</span>
              )}
            </div>
            {userAddress && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
                <div>
                  <span className="text-[10px] text-[#8E9BB0] uppercase tracking-wide block font-semibold">Import Asset</span>
                  <span className="text-xs text-[#E2E8F0] font-medium">Add mUSDT to MetaMask:</span>
                </div>
                <button
                  onClick={handleAddToken}
                  className="bg-[#2c3a5f] hover:bg-[#3d5180] text-[#E2E8F0] text-xs font-bold px-3 py-2 rounded-lg cursor-pointer transition-all border border-[#3d5180] shrink-0"
                >
                  Add mUSDT to Wallet
                </button>
              </div>
            )}
          </div>
        )}
        
        {/* Faucet message toast */}
        {mintMessage && (
          <p className="text-xs font-semibold text-center mt-2 animate-bounce">{mintMessage}</p>
        )}
      </div>

      {/* Progress & Entry split */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Left 2/3 for progress and guide */}
        <div className="md:col-span-2 space-y-8">
          
          {/* Live drawing overlay */}
          {isDrawing && (
            <div className="bg-gradient-to-r from-amber-950/30 to-yellow-950/30 border border-[#E6A817]/40 rounded-2xl p-6 text-center space-y-4 flex flex-col justify-center items-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#E6A817]"></div>
              <div>
                <h3 className="text-[#E6A817] font-bold text-lg">Drawing Winner...</h3>
                <p className="text-xs text-[#8E9BB0]">Selecting a ticket deterministically using the pre-committed seed.</p>
              </div>
            </div>
          )}

          {/* Active Round Progress Card */}
          {activeRound && (
            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <span className="text-[#E6A817] font-extrabold tracking-wider text-sm uppercase">
                  Active Round #{activeRound.roundNumber}
                </span>
                <span className="text-xs text-[#8E9BB0]">
                  Chain: {isTestnet ? 'Amoy (80002)' : 'Polygon (137)'}
                </span>
              </div>
              <RoundProgress
                entriesSold={activeRound.entriesSold}
                maxEntries={maxEntries}
              />
            </div>
          )}

          {/* Core Entry Box */}
          <EntryInstructions 
            entriesRemaining={activeRound ? activeRound.entriesRemaining : maxEntries} 
            isLocked={activeRound ? activeRound.isLocked : false}
            userAddress={userAddress}
            onAddressChange={setUserAddress}
          />
        </div>

        {/* Right 1/3 for ticker and stats */}
        <div className="space-y-8">
          <RecentWinners />

          {/* Simple Statistics Card */}
          {stats && (
            <div className="bg-[#16213E] border border-[#2c3a5f] p-6 rounded-2xl shadow-xl space-y-4">
              <h3 className="text-[#E6A817] font-bold text-base border-b border-[#2c3a5f]/40 pb-2">
                Platform Statistics
              </h3>
              
              <div className="space-y-3 font-mono text-sm">
                <div className="flex justify-between">
                  <span className="text-[#8E9BB0]">Completed Draws:</span>
                  <span className="text-white font-bold">{stats.totalRounds}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8E9BB0]">Total Entries Sold:</span>
                  <span className="text-white font-bold">{stats.totalEntriesEver.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8E9BB0]">Total Prizes Paid:</span>
                  <span className="text-[#22c55e] font-bold">${stats.totalPrizePaid.toLocaleString()} USDT</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>



      {/* Winner Celebration Modal */}
      {winnerData && (
        <WinnerModal
          isOpen={showWinnerModal}
          onClose={() => setShowWinnerModal(false)}
          roundNumber={winnerData.roundNumber}
          winnerAddress={winnerData.winnerAddress}
          winnerEntry={winnerData.winnerEntry}
          seed={winnerData.seed}
          prizeHash={winnerData.prizeHash}
          userAddress={userAddress}
        />
      )}
    </div>
  );
}
