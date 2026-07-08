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

  // Live slot machine roller states
  const [rollerNumber, setRollerNumber] = useState<number>(1);
  const [isSpitfireRolling, setIsSpitfireRolling] = useState(false);

  // User Web3 status states
  const [polBalance, setPolBalance] = useState<string>('0.000');
  const [usdtBalance, setUsdtBalance] = useState<string>('0.00');
  const [unlockedBadges, setUnlockedBadges] = useState({
    firstBlood: false,
    superCharger: false,
    earlyBird: false,
    gasMaster: false,
    luckMaster: false,
  });

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

  // Fetch user Web3 details and achievements
  const fetchUserDetails = async () => {
    if (!userAddress || typeof window === 'undefined') return;
    try {
      let provider = (window as any).ethereum;
      if (provider && provider.providers) {
        provider = provider.providers.find((p: any) => p.isMetaMask) || provider;
      }
      if (!provider) return;

      const browserProvider = new ethers.BrowserProvider(provider);
      
      // POL Balance
      const rawPol = await browserProvider.getBalance(userAddress);
      const formattedPol = parseFloat(ethers.formatEther(rawPol)).toFixed(3);
      setPolBalance(formattedPol);

      // USDT Balance
      const usdtAddress = process.env.NEXT_PUBLIC_USDT_ADDRESS || '0x0000000000000000000000000000000000000000';
      const usdtContract = new ethers.Contract(
        usdtAddress,
        ['function balanceOf(address account) view returns (uint256)'],
        browserProvider
      );
      const rawUsdt = await usdtContract.balanceOf(userAddress);
      const formattedUsdt = parseFloat(ethers.formatUnits(rawUsdt, 6)).toFixed(2);
      setUsdtBalance(formattedUsdt);

      // Dynamically evaluate achievements
      const isGasMaster = parseFloat(formattedPol) > 0.1;
      
      let isFirstBlood = false;
      let isLuckMaster = false;

      // Check wallet history for active entries or past wins
      try {
        const walletHistory = await api.getWalletHistory(userAddress);
        if (walletHistory && Array.isArray(walletHistory.entries) && walletHistory.entries.length > 0) {
          isFirstBlood = true;
        }
      } catch (e) {}

      try {
        const roundsHistory = await api.getRoundsHistory(1, 50);
        if (roundsHistory && Array.isArray(roundsHistory.rounds)) {
          isLuckMaster = roundsHistory.rounds.some(
            (r: any) => r.winnerAddress.toLowerCase() === userAddress.toLowerCase()
          );
        }
      } catch (e) {}

      // Load presets saved to local storage on successful tickets buy
      const hasSuperCharger = localStorage.getItem(`badge_supercharger_${userAddress.toLowerCase()}`) === 'true';
      const hasEarlyBird = localStorage.getItem(`badge_earlybird_${userAddress.toLowerCase()}`) === 'true';

      setUnlockedBadges({
        firstBlood: isFirstBlood || isLuckMaster || hasSuperCharger || hasEarlyBird,
        superCharger: hasSuperCharger,
        earlyBird: hasEarlyBird,
        gasMaster: isGasMaster,
        luckMaster: isLuckMaster,
      });

    } catch (err) {
      console.warn('[Home] Failed to fetch live user details:', err);
    }
  };

  // Trigger detailed user details reload when address changes
  useEffect(() => {
    if (userAddress) {
      fetchUserDetails();
      const interval = setInterval(fetchUserDetails, 15000);
      return () => clearInterval(interval);
    } else {
      setPolBalance('0.000');
      setUsdtBalance('0.00');
      setUnlockedBadges({
        firstBlood: false,
        superCharger: false,
        earlyBird: false,
        gasMaster: false,
        luckMaster: false,
      });
    }
  }, [userAddress]);

  // Roller rapid spinning simulation
  useEffect(() => {
    let intervalId: any;
    if (isDrawing && !isSpitfireRolling) {
      intervalId = setInterval(() => {
        setRollerNumber(Math.floor(Math.random() * maxEntries) + 1);
      }, 50);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isDrawing, isSpitfireRolling, maxEntries]);

  // Setup sockets and initial loads
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
      console.log('[Socket] round:complete received', data);
      
      // Stop rapid roll and start deceleration
      setIsDrawing(false);
      setIsSpitfireRolling(true);

      // Deceleration algorithm (exponentially slow down steps)
      let currentSpeed = 50; // ms
      let step = 0;
      const totalSteps = 15;

      const runDecelerate = () => {
        if (step >= totalSteps) {
          // Finish and land on exact winner entry
          setRollerNumber(Number(data.winnerEntry));
          setIsSpitfireRolling(false);
          
          // Re-fetch details to see if our user address won
          fetchUserDetails();

          // After a short celebration wait, launch winner details modal
          setTimeout(() => {
            setWinnerData({
              roundNumber: data.roundNumber,
              winnerAddress: data.winner,
              winnerEntry: data.winnerEntry,
              seed: data.seed,
              prizeHash: data.prizeHash,
            });
            setShowWinnerModal(true);
          }, 1500);
          return;
        }

        setRollerNumber(Math.floor(Math.random() * maxEntries) + 1);
        step++;
        currentSpeed += 30; // increase delay for wheel clicks
        setTimeout(runDecelerate, currentSpeed);
      };

      runDecelerate();
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
      // Reload balance details
      fetchUserDetails();
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

  const shortenAddress = (addr: string) => {
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  // Toggle this constant to deploy the full "Under Maintenance" page view
  const UNDER_MAINTENANCE = true;

  if (UNDER_MAINTENANCE) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center space-y-8 relative">
        <div className="bg-[#12122b]/85 border-2 border-red-500/40 rounded-3xl p-8 md:p-12 shadow-2xl backdrop-blur-md relative overflow-hidden neon-pulse-red">
          
          {/* Tech accents */}
          <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-red-500/30" />
          <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-red-500/30" />
          <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-red-500/30" />
          <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-red-500/30" />

          {/* Alert Header Icon */}
          <div className="flex flex-col items-center justify-center space-y-4">
            <span className="text-5xl animate-bounce">⚠️</span>
            <div className="px-3 py-1 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-black uppercase tracking-widest animate-pulse">
              Protocol Offline
            </div>
          </div>

          {/* Under Maintenance details */}
          <h1 className="text-3xl md:text-4xl font-black text-white tracking-wider mt-6 uppercase leading-tight">
            System Maintenance <br />
            <span className="text-[#E6A817]">In Progress</span>
          </h1>

          <p className="text-sm text-[#8E9BB0] mt-4 leading-relaxed font-medium max-w-lg mx-auto">
            DrawPool smart contracts are temporarily deactivated for optimization, gas tuning, and planned infrastructure updates. 
          </p>

          <div className="bg-[#0A0A16] border border-[#1f2042] p-5 rounded-2xl text-left space-y-3 max-w-md mx-auto my-8">
            <div className="flex items-center gap-3">
              <span className="text-lg">🛡️</span>
              <span className="text-xs font-extrabold text-white uppercase tracking-wider">Funds Security Protocols</span>
            </div>
            <p className="text-xs text-[#8E9BB0] leading-relaxed">
              All active round ticket entries have been **automatically refunded** on-chain via the emergency batch refund system. Check your MetaMask transactions history or run the verifier below.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            <a
              href={`${isTestnet ? 'https://amoy.polygonscan.com' : 'https://polygonscan.com'}/address/0xe742fE499c493bF143fe22D51956335548B16884`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto bg-[#1f2042] hover:bg-[#2c3a5f] text-white font-bold text-xs py-3.5 px-6 rounded-xl border border-[#2c3a5f] transition-all duration-200 cursor-pointer"
            >
              Verify Contract on Polygonscan ↗
            </a>
            
            <a
              href="/verify"
              className="w-full sm:w-auto bg-[#E6A817] hover:bg-[#ffd043] text-[#1A1A2E] font-black text-xs py-3.5 px-6 rounded-xl transition-all duration-200 cursor-pointer btn-press uppercase tracking-wider"
            >
              Run Cryptographic Verifier
            </a>
          </div>
        </div>

        <div className="text-[#8E9BB0] text-xs font-bold uppercase tracking-wider">
          🛰️ DrawPool Operations will resume shortly. Thank you for your patience!
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10 relative">
      {/* Platform Stopped Banner */}
      {isStopped && (
        <div className="bg-red-950/20 border-2 border-red-900/40 p-4 rounded-3xl text-center text-red-200 font-extrabold text-sm animate-pulse shadow-neon-red/35">
          🚨 DrawPool is currently paused by the administrator. No payments are being accepted.
        </div>
      )}

      {/* Hero section */}
      <div className="text-center space-y-4 max-w-xl mx-auto py-4">
        <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight leading-tight">
          Send <span className="text-[#E6A817] animate-pulse">${ticketUSD} USDT</span>.<br className="sm:hidden" /> Win <span className="text-[#E6A817] glow-text">${isTestnet ? '5' : '100'}</span>.
        </h1>
        <p className="text-[#8E9BB0] text-sm md:text-base leading-relaxed font-medium">
          The completely anonymous online prize draw. Simply send USDT directly from MetaMask to enter. No logins, no emails, no personal data.
        </p>

        {/* Testnet Faucet Trigger */}
        {isTestnet && (
          <div className="bg-[#12122b]/80 border border-[#1f2042] p-4 rounded-2xl flex flex-col gap-4 max-w-md mx-auto mt-4 text-left backdrop-blur-sm shadow-xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[#1f2042]/50 pb-3">
              <div>
                <span className="text-[10px] text-[#8E9BB0] uppercase tracking-wider block font-black">TESTNET FAUCET</span>
                <span className="text-xs text-[#E2E8F0] font-semibold">Get free Test USDT to enter:</span>
              </div>
              {userAddress ? (
                <button
                  onClick={handleClaimFaucet}
                  disabled={minting}
                  className="bg-[#E6A817] hover:bg-[#ffd043] disabled:opacity-50 text-[#1A1A2E] text-xs font-black px-4 py-2.5 rounded-xl cursor-pointer transition-all btn-press shadow-neon-gold/20"
                >
                  {minting ? 'Minting...' : 'Get Test USDT'}
                </button>
              ) : (
                <span className="text-xs text-[#8E9BB0] italic font-semibold">Connect wallet below first</span>
              )}
            </div>
            {userAddress && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
                <div>
                  <span className="text-[10px] text-[#8E9BB0] uppercase tracking-wider block font-black">IMPORT ASSET</span>
                  <span className="text-xs text-[#E2E8F0] font-semibold">Add mUSDT to MetaMask:</span>
                </div>
                <button
                  onClick={handleAddToken}
                  className="bg-[#1f2042] hover:bg-[#2c3a5f] text-[#E2E8F0] text-xs font-black px-4 py-2.5 rounded-xl cursor-pointer transition-all border border-[#2c3a5f] btn-press"
                >
                  Add mUSDT to Wallet
                </button>
              </div>
            )}
          </div>
        )}
        
        {/* Faucet message toast */}
        {mintMessage && (
          <p className="text-xs font-extrabold text-[#ffd043] text-center mt-2 animate-bounce">{mintMessage}</p>
        )}
      </div>

      {/* Progress & Entry split */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Left 2/3 for progress and guide */}
        <div className="md:col-span-2 space-y-8">
          
          {/* Live drawing slot machine roller */}
          {(isDrawing || isSpitfireRolling) && (
            <div className="bg-gradient-to-br from-[#12122b]/95 via-[#1b1b3d] to-[#12122b]/95 border-2 border-[#E6A817]/60 rounded-3xl p-6 text-center space-y-5 flex flex-col justify-center items-center shadow-2xl relative overflow-hidden backdrop-blur-md animate-scale-up neon-pulse-gold">
              
              <div className="absolute top-3.5 left-4 text-[9px] font-black text-[#E6A817] tracking-widest uppercase flex items-center gap-1.5 bg-yellow-500/10 border border-yellow-500/20 px-2 py-1 rounded">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
                Chainlink VRF Randomness Fulfill
              </div>
              
              {/* Huge Slot Machine Window */}
              <div className="bg-[#0A0A16] border border-[#1f2042] px-14 py-8 rounded-2xl flex flex-col items-center justify-center space-y-1 relative shadow-inner min-w-[200px] mt-3">
                <span className="text-[10px] text-[#8E9BB0] uppercase tracking-widest font-black block">SELECTING TICKET</span>
                <div 
                  className={`text-6xl font-black font-mono text-[#ffd043] tracking-tighter select-none transition-all duration-75`}
                  style={{ filter: isSpitfireRolling || (isDrawing && !isSpitfireRolling) ? 'blur(1.5px)' : 'none' }}
                >
                  #{rollerNumber.toString().padStart(3, '0')}
                </div>
              </div>
              
              <div className="space-y-1.5">
                <h3 className="text-[#E6A817] font-black text-lg uppercase tracking-wider">DRAWING IN PROGRESS</h3>
                <p className="text-xs text-[#8E9BB0] max-w-sm font-medium leading-relaxed">
                  A secure, verifiable random number is being fetched from Chainlink VRF nodes. Decelerating to resolve winning ticket number.
                </p>
              </div>
            </div>
          )}

          {/* Active Round Progress Card */}
          {activeRound && !isDrawing && !isSpitfireRolling && (
            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <span className="text-[#E6A817] font-black tracking-wider text-xs uppercase">
                  ⚡ Active Round #{activeRound.roundNumber}
                </span>
                <span className="text-[10px] text-[#8E9BB0] font-bold uppercase tracking-wider">
                  Network: {isTestnet ? 'Polygon Amoy' : 'Polygon Mainnet'}
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
          
          {/* Player Hub & Achievements Dashboard */}
          <div className="bg-[#12122b]/85 border border-[#1f2042] p-6 rounded-3xl shadow-2xl backdrop-blur-md space-y-5">
            <div className="border-b border-[#1f2042]/50 pb-2.5">
              <span className="text-[10px] text-[#8E9BB0] uppercase tracking-widest font-black block">STATION</span>
              <h3 className="text-[#E6A817] font-black text-base uppercase tracking-tight">
                Player Control Center
              </h3>
            </div>

            {userAddress ? (
              <div className="space-y-5">
                {/* Account shortened & Balances */}
                <div className="space-y-2.5">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-[#8E9BB0]">Connected Player:</span>
                    <span className="text-white font-mono">{shortenAddress(userAddress)}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 text-center">
                    <div className="bg-[#0A0A16] border border-[#1f2042] p-2 rounded-xl">
                      <span className="text-[8px] text-[#8E9BB0] uppercase tracking-wider block font-bold">POL GAS</span>
                      <span className="text-sm font-black font-mono text-cyan-400">{polBalance} POL</span>
                    </div>
                    <div className="bg-[#0A0A16] border border-[#1f2042] p-2 rounded-xl">
                      <span className="text-[8px] text-[#8E9BB0] uppercase tracking-wider block font-bold">USDT CASH</span>
                      <span className="text-sm font-black font-mono text-yellow-500">${usdtBalance}</span>
                    </div>
                  </div>
                </div>

                {/* Achievements List */}
                <div className="space-y-3">
                  <span className="text-[9px] text-[#8E9BB0] uppercase tracking-widest font-black block border-b border-[#1f2042]/20 pb-1">ACHIEVEMENTS</span>
                  <div className="space-y-2">
                    {[
                      { key: 'firstBlood', name: '🪙 First Blood', desc: 'Own any draw pool tickets' },
                      { key: 'superCharger', name: '👑 Super Charger', desc: 'Buy 10+ tickets in a single stack' },
                      { key: 'earlyBird', name: '⚡ Speed Runner', desc: 'Enter early with spots > 180' },
                      { key: 'gasMaster', name: '🛡️ Gas Master', desc: 'Hold > 0.1 POL gas balance' },
                      { key: 'luckMaster', name: '🍀 Luck Master', desc: 'Win any completed round' },
                    ].map((badge) => {
                      const isUnlocked = (unlockedBadges as any)[badge.key];
                      return (
                        <div 
                          key={badge.key} 
                          className={`flex items-center gap-3 p-2 rounded-xl border transition-all duration-300 ${
                            isUnlocked 
                              ? 'bg-gradient-to-r from-amber-500/5 to-yellow-500/10 border-yellow-500/35 text-white shadow-neon-gold/10' 
                              : 'bg-[#0A0A16]/30 border-[#1f2042]/30 text-gray-500 opacity-60'
                          }`}
                        >
                          <span className="text-lg leading-none">{isUnlocked ? '🌟' : '🔒'}</span>
                          <div className="text-left leading-tight">
                            <span className={`text-xs font-black block ${isUnlocked ? 'text-[#ffd043]' : 'text-gray-500'}`}>
                              {badge.name}
                            </span>
                            <span className="text-[9px] text-[#8E9BB0] block font-medium">
                              {badge.desc}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 space-y-3 bg-[#0A0A16]/50 border border-dashed border-[#1f2042]/80 p-4 rounded-2xl">
                <span className="text-3xl block">📡</span>
                <p className="text-xs text-[#8E9BB0] leading-relaxed font-semibold">
                  STATION DATA OFFLINE<br />
                  Connect MetaMask wallet to activate player badges, dynamic checkouts, and live balances.
                </p>
              </div>
            )}
          </div>

          <RecentWinners />

          {/* Simple Statistics Card */}
          {stats && (
            <div className="bg-[#12122b]/85 border border-[#1f2042] p-6 rounded-3xl shadow-2xl backdrop-blur-md space-y-4">
              <h3 className="text-[#E6A817] font-black text-base border-b border-[#1f2042]/50 pb-2 uppercase tracking-wide">
                Platform Statistics
              </h3>
              
              <div className="space-y-3 font-mono text-xs font-bold uppercase tracking-tight">
                <div className="flex justify-between">
                  <span className="text-[#8E9BB0]">Completed Draws:</span>
                  <span className="text-white">{stats.totalRounds}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8E9BB0]">Total Entries Sold:</span>
                  <span className="text-white">{stats.totalEntriesEver.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8E9BB0]">Total Prizes Paid:</span>
                  <span className="text-[#22c55e]">${stats.totalPrizePaid.toLocaleString()} USDT</span>
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
