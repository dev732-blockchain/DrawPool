'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ethers } from 'ethers';
import WalletConnect from './WalletConnect';

const ERC20_ABI = [
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)'
];

const DRAWPOOL_ABI = [
  'function enterDraw(uint256 quantity) external'
];

interface EntryInstructionsProps {
  entriesRemaining?: number;
  isLocked?: boolean;
  userAddress: string | null;
  onAddressChange: (address: string | null) => void;
}

export default function EntryInstructions({ entriesRemaining, isLocked, userAddress, onAddressChange }: EntryInstructionsProps) {
  const router = useRouter();
  const [quantity, setQuantity] = useState<number>(1);
  const [trackAddress, setTrackAddress] = useState('');
  
  // Checkout flow states
  const [step, setStep] = useState<'idle' | 'verifying_network' | 'checking_allowance' | 'approving' | 'entering' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const contractAddress = process.env.NEXT_PUBLIC_DRAWPOOL_CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000';
  const usdtAddress = process.env.NEXT_PUBLIC_USDT_ADDRESS || '0x0000000000000000000000000000000000000000';
  const isTestnet = process.env.NEXT_PUBLIC_IS_TESTNET === 'true';
  const explorerUrl = process.env.NEXT_PUBLIC_POLYGON_EXPLORER || 'https://amoy.polygonscan.com';

  const ticketPrice = BigInt(1000000); // $1 USDT (6 decimals)

  // Helper to resolve the correct injected provider, avoiding conflicts (e.g. Coinbase Wallet vs MetaMask)
  const getEthereumProvider = () => {
    if (typeof window === 'undefined') return null;
    let provider = (window as any).ethereum;
    if (provider && provider.providers) {
      provider = provider.providers.find((p: any) => p.isMetaMask) || provider;
    }
    return provider;
  };

  const handleTrackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (trackAddress.trim().startsWith('0x')) {
      router.push(`/my-entries?address=${trackAddress.trim().toLowerCase()}`);
    }
  };

  const handleWalletConnect = (addr: string | null) => {
    onAddressChange(addr);
    if (addr) {
      setTrackAddress(addr);
    }
  };

  const verifyNetwork = async () => {
    const provider = getEthereumProvider();
    if (!provider) return false;
    
    // Correct hex for Amoy is 0x13882 (80002 decimal)
    const targetChainIdHex = isTestnet 
      ? '0x13882' // Correct chain ID 80002 for Amoy
      : '0x89';    // 137 for Polygon Mainnet

    try {
      const currentChainId = await provider.request({ method: 'eth_chainId' });
      if (currentChainId.toLowerCase() !== targetChainIdHex.toLowerCase()) {
        // If isTestnet is true, do NOT automatically switch/add network.
        if (isTestnet) {
          console.log('[EntryInstructions] Testnet configured. Skipping automatic switch request per user preference.');
          return false;
        }

        try {
          await provider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: targetChainIdHex }],
          });
          return true;
        } catch (switchError: any) {
          if (switchError.code === 4902) {
            const addParams = {
              chainId: '0x89',
              chainName: 'Polygon Mainnet',
              nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
              rpcUrls: ['https://polygon-rpc.com'],
              blockExplorerUrls: ['https://polygonscan.com'],
            };

            await provider.request({
              method: 'wallet_addEthereumChain',
              params: [addParams],
            });
            return true;
          } else {
            throw switchError;
          }
        }
      }
      return true;
    } catch (err: any) {
      console.error('[Network Switch Failed]', err.message || err.code || err);
      return false;
    }
  };

  const handleAddPolygon = async () => {
    const provider = getEthereumProvider();
    if (typeof window === 'undefined' || !provider) return;
    
    const targetChainIdHex = isTestnet ? '0x13882' : '0x89';
    const addParams = isTestnet
      ? {
          chainId: '0x13882',
          chainName: 'Polygon Amoy Testnet',
          nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
          rpcUrls: ['https://rpc-amoy.polygon.technology'],
          blockExplorerUrls: ['https://amoy.polygonscan.com'],
        }
      : {
          chainId: '0x89',
          chainName: 'Polygon Mainnet',
          nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
          rpcUrls: ['https://polygon-rpc.com'],
          blockExplorerUrls: ['https://polygonscan.com'],
        };

    try {
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: targetChainIdHex }],
      });
      setStep('idle');
      setErrorMsg(null);
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        try {
          await provider.request({
            method: 'wallet_addEthereumChain',
            params: [addParams],
          });
          setStep('idle');
          setErrorMsg(null);
        } catch (addError: any) {
          console.error('[EntryInstructions] Failed to add network:', addError);
          setErrorMsg(addError.message || 'Failed to add network');
        }
      } else {
        console.error('[EntryInstructions] Failed to switch network:', switchError);
        setErrorMsg(switchError.message || 'Failed to switch network');
      }
    }
  };

  const handleBuy = async () => {
    if (!userAddress) {
      setErrorMsg('Please connect your MetaMask wallet first.');
      setStep('error');
      return;
    }

    if (isLocked) {
      setErrorMsg('The current round is locked for drawing. Please wait for the next round to start.');
      setStep('error');
      return;
    }

    if (quantity < 1 || quantity > 100) {
      setErrorMsg('Quantity must be between 1 and 100.');
      setStep('error');
      return;
    }

    if (entriesRemaining !== undefined && quantity > entriesRemaining) {
      setErrorMsg(`Not enough tickets remaining in this round. Only ${entriesRemaining} ticket${entriesRemaining !== 1 ? 's' : ''} left.`);
      setStep('error');
      return;
    }

    setStep('verifying_network');
    setErrorMsg(null);
    setTxHash(null);

    try {
      // 1. Verify correct network
      const networkOk = await verifyNetwork();
      if (!networkOk) {
        throw new Error('Please switch MetaMask to the correct network.');
      }

      const provider = getEthereumProvider();
      if (!provider) {
        throw new Error('Web3 provider not found.');
      }
      const browserProvider = new ethers.BrowserProvider(provider);
      const signer = await browserProvider.getSigner();
      const signerAddress = (await signer.getAddress()).toLowerCase();

      // Sync React connected address state if it has changed in MetaMask
      if (signerAddress !== userAddress.toLowerCase()) {
        handleWalletConnect(signerAddress);
      }

      // 2. Check Balance & Allowance
      setStep('checking_allowance');
      const usdtContract = new ethers.Contract(usdtAddress, ERC20_ABI, signer);
      const requiredAmount = BigInt(quantity) * ticketPrice;
      
      const balance = await usdtContract.balanceOf(signerAddress);
      if (balance < requiredAmount) {
        throw new Error(`Insufficient USDT balance. You need ${ethers.formatUnits(requiredAmount, 6)} USDT, but only have ${ethers.formatUnits(balance, 6)} USDT. ${isTestnet ? 'Please claim free Test USDT from the faucet at the top of the page.' : ''}`);
      }

      // Check native POL (gas) balance to prevent "insufficient funds for gas" failures
      const nativeBalance = await browserProvider.getBalance(signerAddress);
      const minGas = ethers.parseEther('0.005'); // 0.005 POL minimum for gas
      if (nativeBalance < minGas) {
        throw new Error(`Insufficient POL (gas) balance. You only have ${parseFloat(ethers.formatEther(nativeBalance)).toFixed(4)} POL, but need at least 0.005 POL to pay for network transaction fees. ${isTestnet ? 'Please request free Test POL from the official Polygon Amoy Faucet.' : ''}`);
      }

      const allowance = await usdtContract.allowance(signerAddress, contractAddress);
      
      const overrides = isTestnet ? {
        maxPriorityFeePerGas: ethers.parseUnits('30', 'gwei'),
        maxFeePerGas: ethers.parseUnits('35', 'gwei')
      } : {};

      // 3. Approve if needed
      if (allowance < requiredAmount) {
        setStep('approving');
        const approveTx = await usdtContract.approve(contractAddress, requiredAmount, overrides);
        console.log('[EntryInstructions] Approval Tx sent:', approveTx.hash);
        await approveTx.wait(1);
        console.log('[EntryInstructions] Approval Tx confirmed');
      }

      // 4. Enter Draw
      setStep('entering');
      const drawpoolContract = new ethers.Contract(contractAddress, DRAWPOOL_ABI, signer);
      const enterTx = await drawpoolContract.enterDraw(quantity, overrides);
      console.log('[EntryInstructions] Enter Draw Tx sent:', enterTx.hash);
      setTxHash(enterTx.hash);
      
      await enterTx.wait(1);
      console.log('[EntryInstructions] Enter Draw Tx confirmed');

      // Set achievements local storage triggers for gamification badges
      try {
        if (signerAddress) {
          if (quantity >= 10) {
            localStorage.setItem(`badge_supercharger_${signerAddress.toLowerCase()}`, 'true');
          }
          if (entriesRemaining !== undefined && entriesRemaining >= 180) {
            localStorage.setItem(`badge_earlybird_${signerAddress.toLowerCase()}`, 'true');
          }
        }
      } catch (storageErr) {
        console.warn('[EntryInstructions] Failed to set local badge data:', storageErr);
      }
      
      setStep('success');
    } catch (err: any) {
      console.error('[Buy Error]', err);
      setErrorMsg(err.reason || err.message || 'Transaction was rejected or failed.');
      setStep('error');
    }
  };

  // Render a visual stack of ticket stubs based on quantity
  const renderTicketStubs = () => {
    const maxVisibleTickets = 6;
    const ticketsToShow = Math.min(quantity, maxVisibleTickets);
    const hasMore = quantity > maxVisibleTickets;

    return (
      <div className="py-4 flex flex-col items-center justify-center space-y-3">
        <span className="text-[10px] text-[#8E9BB0] uppercase tracking-widest font-black block">TICKET DISPENSER</span>
        <div className="relative h-28 w-full flex items-center justify-center px-4 overflow-hidden">
          <div className="flex items-center justify-center -space-x-12 sm:-space-x-8 md:-space-x-10 transition-all duration-300">
            {[...Array(ticketsToShow)].map((_, i) => {
              // Add a slight rotate & translate skew to stack them dynamically
              const rotation = (i - (ticketsToShow - 1) / 2) * (ticketsToShow > 3 ? 4 : 8);
              const translateVal = Math.abs(i - (ticketsToShow - 1) / 2) * 5;
              return (
                <div
                  key={i}
                  className="relative w-40 h-24 rounded-xl border border-yellow-500/40 bg-gradient-to-br from-[#1b1b3d]/95 via-[#23234d] to-[#1b1b3d]/95 flex items-center justify-between p-3 overflow-hidden shadow-2xl hover:-translate-y-3 hover:scale-105 hover:border-yellow-400 transition-all duration-300 cursor-pointer shadow-neon-gold/20"
                  style={{
                    transform: `rotate(${rotation}deg) translateY(${translateVal}px)`,
                    zIndex: i + 1,
                  }}
                >
                  {/* Left Perforation Notch */}
                  <div className="absolute -left-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-[#12122b] border border-[#1f2042] z-10" />
                  
                  {/* Right Perforation Notch */}
                  <div className="absolute -right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-[#12122b] border border-[#1f2042] z-10" />

                  {/* Left Side: Ticket Core Details */}
                  <div className="flex flex-col justify-between h-full text-left space-y-1 z-0">
                    <span className="text-[9px] text-[#E6A817] font-black uppercase tracking-wider">DRAWPOOL TICKET</span>
                    <div className="space-y-0.5">
                      <span className="text-xs text-white/90 font-bold block leading-none">ROUND</span>
                      <span className="text-lg font-black text-white leading-none font-mono">#{activeRoundNum()}</span>
                    </div>
                    <span className="text-[8px] text-[#8E9BB0] font-mono leading-none">NO. {i + 1} OF {quantity}</span>
                  </div>

                  {/* Perforation Line (Dashed divider) */}
                  <div className="h-full border-r border-dashed border-[#1f2042]/80 mx-1 shrink-0" />

                  {/* Right Side: Ticket stub barcode and price */}
                  <div className="flex flex-col justify-between h-full items-end z-0 shrink-0">
                    <span className="text-[9px] font-black text-[#E6A817] font-mono leading-none">$1</span>
                    {/* Tiny Barcode Mock */}
                    <div className="flex gap-[1px] h-6 items-end pb-1.5 opacity-60">
                      <div className="w-[1px] h-full bg-[#8E9BB0]" />
                      <div className="w-[2px] h-full bg-[#8E9BB0]" />
                      <div className="w-[1px] h-full bg-[#8E9BB0]" />
                      <div className="w-[3px] h-full bg-[#8E9BB0]" />
                      <div className="w-[1px] h-full bg-[#8E9BB0]" />
                      <div className="w-[2px] h-full bg-[#8E9BB0]" />
                    </div>
                    <span className="text-[8px] text-[#8E9BB0] font-black uppercase leading-none">POLY</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Remaining overflow text label */}
        {hasMore && (
          <span className="text-xs font-black text-[#E6A817] bg-yellow-500/10 border border-yellow-500/20 px-3 py-1 rounded-full animate-pulse shadow-sm">
            ➕ And {quantity - maxVisibleTickets} more ticket{(quantity - maxVisibleTickets) !== 1 ? 's' : ''} in your stack!
          </span>
        )}
      </div>
    );
  };

  const activeRoundNum = () => {
    // Quick helper to read round number safely
    return isLocked ? 'DRAWING' : 'ACTIVE';
  };

  return (
    <div className="bg-[#12122b]/85 border border-[#1f2042] rounded-3xl p-6 md:p-8 shadow-2xl max-w-2xl mx-auto backdrop-blur-md relative overflow-hidden">
      
      {/* HUD decorative tech corners */}
      <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-[#1f2042]" />
      <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-[#1f2042]" />
      <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-[#1f2042]" />
      <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-[#1f2042]" />

      <h2 className="text-2xl font-black text-center text-[#E6A817] uppercase tracking-wider mb-6">🎟️ Purchase Tickets Center</h2>
      
      <div className="space-y-6">
        {/* Step 1: Connect Wallet */}
        <div className="flex flex-col md:flex-row gap-4 items-start border-b border-[#1f2042]/50 pb-6">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#E6A817] text-[#1A1A2E] font-black text-sm shrink-0 shadow-neon-gold/30">
            1
          </div>
          <div className="flex-1 space-y-2">
            <h3 className="font-bold text-lg text-white uppercase tracking-tight">Connect Your Wallet</h3>
            <p className="text-sm text-[#8E9BB0]">
              Establish secure connection to switch networks and sign transactions.
            </p>
            <div className="pt-2">
              <WalletConnect onAddressChange={handleWalletConnect} />
            </div>
          </div>
        </div>

        {/* Step 2: Buy Tickets */}
        <div className="flex flex-col md:flex-row gap-4 items-start border-b border-[#1f2042]/50 pb-6">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#E6A817] text-[#1A1A2E] font-black text-sm shrink-0 shadow-neon-gold/30">
            2
          </div>
          <div className="flex-1 space-y-4">
            <h3 className="font-bold text-lg text-white uppercase tracking-tight">Select Quantity & Enter</h3>
            <p className="text-sm text-[#8E9BB0]">
              $1 USDT per entry. Dynamic allowances approved seamlessly on-chain.
            </p>
            
            {entriesRemaining !== undefined && (
              <div className="text-xs font-black text-red-400 flex items-center gap-1.5 bg-red-950/20 border border-red-900/35 px-3 py-2 rounded-lg w-fit animate-pulse">
                <span>⚠️</span>
                <span>ONLY {entriesRemaining.toLocaleString()} SPOTS REMAINING IN THIS ROUND!</span>
              </div>
            )}

            {/* Quick Bundle selectors */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[
                { label: '🎟️ Single', val: 1 },
                { label: '🎭 Trio Stack', val: 3 },
                { label: '🔥 Deca Pack', val: 10 },
                { label: '👑 Super Stack', val: 20 },
              ].map((bundle) => (
                <button
                  key={bundle.val}
                  type="button"
                  onClick={() => setQuantity(bundle.val)}
                  className={`py-2 px-3 rounded-xl border text-xs font-black uppercase transition-all duration-200 cursor-pointer text-center ${
                    quantity === bundle.val
                      ? 'border-[#E6A817] bg-[#E6A817]/10 text-[#ffd043] shadow-neon-gold/20 scale-[1.03]'
                      : 'border-[#1f2042] bg-[#0A0A16]/50 text-[#8E9BB0] hover:border-[#E6A817]/30 hover:text-white'
                  }`}
                >
                  {bundle.label}
                </button>
              ))}
            </div>

            {/* Ticket Graphic Shelf Render */}
            {renderTicketStubs()}
            
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="flex items-center border border-[#1f2042] bg-[#0A0A16] rounded-xl overflow-hidden shadow-inner">
                <button
                  type="button"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="px-4 py-3 hover:bg-[#1f2042] text-[#8E9BB0] hover:text-white font-bold transition-all cursor-pointer select-none"
                >
                  -
                </button>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.min(100, Math.max(1, parseInt(e.target.value) || 1)))}
                  className="w-16 text-center bg-transparent border-none text-white focus:outline-none font-black font-mono text-base"
                />
                <button
                  type="button"
                  onClick={() => setQuantity(Math.min(100, quantity + 1))}
                  className="px-4 py-3 hover:bg-[#1f2042] text-[#8E9BB0] hover:text-white font-bold transition-all cursor-pointer select-none"
                >
                  +
                </button>
              </div>

              <button
                onClick={handleBuy}
                disabled={!userAddress || isLocked || step !== 'idle' && step !== 'success' && step !== 'error'}
                className="w-full sm:w-auto bg-[#E6A817] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#ffd043] text-[#1A1A2E] font-black px-8 py-3.5 rounded-xl transition-all duration-300 shadow-lg cursor-pointer text-center flex-1 btn-press uppercase tracking-wide shadow-neon-gold/20"
              >
                {!userAddress 
                  ? 'Connect Wallet to Play' 
                  : isLocked 
                    ? 'Round Locked (Drawing...)' 
                    : `Enter Draw: $${quantity} USDT`}
              </button>
            </div>

            {/* Interactive Checkout States */}
            {step !== 'idle' && (
              <div className="bg-[#0A0A16] border border-[#1f2042] p-4 rounded-2xl space-y-3 shadow-inner">
                {step === 'verifying_network' && (
                  <div className="flex items-center gap-3 text-sm text-[#E2E8F0] font-semibold">
                    <span className="animate-spin text-[#E6A817]">⏳</span>
                    <span>Synchronizing Polygon RPC configs...</span>
                  </div>
                )}
                {step === 'checking_allowance' && (
                  <div className="flex items-center gap-3 text-sm text-[#E2E8F0] font-semibold">
                    <span className="animate-spin text-[#E6A817]">⏳</span>
                    <span>Checking contract approval limits...</span>
                  </div>
                )}
                {step === 'approving' && (
                  <div className="flex items-center gap-3 text-sm text-[#E2E8F0] font-semibold">
                    <span className="animate-spin text-[#E6A817]">⏳</span>
                    <span>Sign the USDT allowance approval in MetaMask...</span>
                  </div>
                )}
                {step === 'entering' && (
                  <div className="flex items-center gap-3 text-sm text-[#E2E8F0] font-semibold">
                    <span className="animate-spin text-[#E6A817]">⏳</span>
                    <span>Entering draw on-chain... Please confirm in MetaMask.</span>
                  </div>
                )}
                {step === 'success' && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 text-sm text-green-400 font-extrabold">
                      <span>✅</span>
                      <span>SUCCESS! Your tickets have been minted successfully!</span>
                    </div>
                    {txHash && (
                      <a
                        href={`${explorerUrl}/tx/${txHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-[#E6A817] hover:underline hover:text-[#ffd043] block ml-7 font-semibold"
                      >
                        Verify on Explorer ↗
                      </a>
                    )}
                  </div>
                )}
                {step === 'error' && errorMsg && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 text-sm text-red-400 font-bold">
                      <span>❌</span>
                      <span>Transaction Aborted</span>
                    </div>
                    <p className="text-xs text-[#8E9BB0] ml-7 break-words font-medium">{errorMsg}</p>
                    {errorMsg.toLowerCase().includes('network') && (
                      <button
                        onClick={handleAddPolygon}
                        className="mt-2 bg-[#E6A817] hover:bg-[#ffd043] text-[#1A1A2E] font-bold px-4 py-2 rounded-lg text-xs shadow-md transition-all duration-200 cursor-pointer block ml-7 btn-press"
                      >
                        Add Polygon
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Step 3: Track entries */}
        <div className="flex flex-col md:flex-row gap-4 items-start">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#E6A817] text-[#1A1A2E] font-black text-sm shrink-0 shadow-neon-gold/30">
            3
          </div>
          <div className="flex-1 space-y-3">
            <h3 className="font-bold text-lg text-white uppercase tracking-tight">Track Your Wallet</h3>
            <p className="text-sm text-[#8E9BB0]">
              Pastes automatically on connect. Verify your active round tickets.
            </p>
            <form onSubmit={handleTrackSubmit} className="flex gap-2">
              <input
                type="text"
                value={trackAddress}
                onChange={(e) => setTrackAddress(e.target.value)}
                placeholder="0x..."
                className="flex-1 bg-[#0A0A16] border border-[#1f2042] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#E6A817] font-mono shadow-inner"
              />
              <button
                type="submit"
                disabled={!trackAddress.startsWith('0x')}
                className="bg-[#E6A817] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#ffd043] text-[#1A1A2E] font-bold px-5 py-2 rounded-xl text-sm transition-all cursor-pointer btn-press shadow-md"
              >
                Track
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Token Acquisition Guide Helper */}
      {!isTestnet && (
        <div className="mt-6 bg-[#0A0A16]/60 border border-[#1f2042]/50 p-5 rounded-2xl space-y-3">
          <h4 className="text-[#E6A817] font-extrabold text-xs uppercase tracking-widest flex items-center gap-1.5">
            💎 Need POL (Gas) or USDT?
          </h4>
          <p className="text-xs text-[#8E9BB0] leading-relaxed">
            You require a tiny amount of <strong className="text-white">POL</strong> to cover network fees (gas) and <strong className="text-white">USDT</strong> for tickets.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 pt-1">
            <a
              href="https://www.p2p.lol/en"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 bg-[#1f2042]/60 hover:bg-[#2c3a5f] text-center text-[#E2E8F0] font-extrabold text-xs px-3 py-2.5 rounded-xl border border-[#1f2042] transition-colors cursor-pointer"
            >
              1. Buy POL with Cash via P2P.lol ↗
            </a>
            <a
              href="https://quickswap.exchange"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 bg-[#1f2042]/60 hover:bg-[#2c3a5f] text-center text-[#E2E8F0] font-extrabold text-xs px-3 py-2.5 rounded-xl border border-[#1f2042] transition-colors cursor-pointer"
            >
              2. Swap POL to USDT on QuickSwap ↗
            </a>
          </div>
          <div className="text-center pt-1">
            <Link
              href="/how-it-works"
              className="text-xs text-[#E6A817] hover:underline font-bold"
            >
              Read full Step-by-Step Wallet & Token Setup Guide →
            </Link>
          </div>
        </div>
      )}

      {/* Warnings */}
      <div className="mt-8 bg-red-950/20 border border-red-900/30 p-5 rounded-2xl space-y-2.5">
        <h4 className="text-[#ef4444] font-black text-xs uppercase tracking-widest flex items-center gap-1.5">
          ⚠️ Security Protocols
        </h4>
        <ul className="list-disc list-inside text-xs text-red-200/80 space-y-1.5 leading-relaxed font-medium">
          <li>
            <span className="font-bold">{isTestnet ? 'POLYGON AMOY TESTNET' : 'POLYGON MAINNET'} ONLY</span>. Always match network in MetaMask.
          </li>
          <li>
            Do not send USDT directly to the contract address; you must execute entries via this Web3 dApp control panel to trigger drawing updates.
          </li>
          <li>
            Always keep at least 0.005 POL in your wallet for smart contract gas execution.
          </li>
        </ul>
      </div>
    </div>
  );
}
