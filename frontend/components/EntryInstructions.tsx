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
      
      setStep('success');
    } catch (err: any) {
      console.error('[Buy Error]', err);
      setErrorMsg(err.reason || err.message || 'Transaction was rejected or failed.');
      setStep('error');
    }
  };

  return (
    <div className="bg-[#16213E] border border-[#2c3a5f] rounded-2xl p-6 md:p-8 shadow-xl max-w-2xl mx-auto">
      <h2 className="text-xl font-bold text-center text-[#E6A817] mb-6">Enter the Prize Draw</h2>
      
      <div className="space-y-6">
        {/* Step 1: Connect Wallet */}
        <div className="flex flex-col md:flex-row gap-4 items-start border-b border-[#2c3a5f] pb-6">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#E6A817] text-[#1A1A2E] font-bold text-sm shrink-0">
            1
          </div>
          <div className="flex-1 space-y-2">
            <h3 className="font-semibold text-lg">Connect Your Wallet</h3>
            <p className="text-sm text-[#8E9BB0]">
              Connect your MetaMask wallet to switch to the correct network and sign the draw transaction.
            </p>
            <div className="pt-2">
              <WalletConnect onAddressChange={handleWalletConnect} />
            </div>
          </div>
        </div>

        {/* Step 2: Buy Tickets */}
        <div className="flex flex-col md:flex-row gap-4 items-start border-b border-[#2c3a5f] pb-6">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#E6A817] text-[#1A1A2E] font-bold text-sm shrink-0">
            2
          </div>
          <div className="flex-1 space-y-4">
            <h3 className="font-semibold text-lg">Select Quantity & Buy</h3>
            <p className="text-sm text-[#8E9BB0]">
              Choose how many entries you wish to purchase ($1 USDT per ticket). You will be prompted to approve USDT first if needed, then confirm the entry draw transaction.
            </p>
            
            {entriesRemaining !== undefined && (
              <div className="text-sm font-semibold text-[#E6A817] flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 px-3 py-2 rounded-lg w-fit">
                <span>⚠️</span>
                <span>Only {entriesRemaining.toLocaleString()} entries left in this round!</span>
              </div>
            )}
            
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="flex items-center border border-[#2c3a5f] bg-[#1a1a2e] rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="px-4 py-2 hover:bg-[#2c3a5f] text-white transition-colors cursor-pointer"
                >
                  -
                </button>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.min(100, Math.max(1, parseInt(e.target.value) || 1)))}
                  className="w-16 text-center bg-transparent border-none text-white focus:outline-none font-bold"
                />
                <button
                  type="button"
                  onClick={() => setQuantity(Math.min(100, quantity + 1))}
                  className="px-4 py-2 hover:bg-[#2c3a5f] text-white transition-colors cursor-pointer"
                >
                  +
                </button>
              </div>

              <button
                onClick={handleBuy}
                disabled={!userAddress || isLocked || step !== 'idle' && step !== 'success' && step !== 'error'}
                className="w-full sm:w-auto bg-[#E6A817] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#ffd043] text-[#1A1A2E] font-bold px-8 py-3 rounded-xl transition-all cursor-pointer text-center flex-1"
              >
                {!userAddress ? 'Connect Wallet to Buy' : isLocked ? 'Round Locked (Drawing...)' : `Buy ${quantity} Ticket${quantity > 1 ? 's' : ''} ($${quantity} USDT)`}
              </button>
            </div>

            {/* Interactive Checkout States */}
            {step !== 'idle' && (
              <div className="bg-[#1a1a2e] border border-[#2c3a5f] p-4 rounded-xl space-y-3">
                {step === 'verifying_network' && (
                  <div className="flex items-center gap-3 text-sm text-[#E2E8F0]">
                    <span className="animate-spin text-[#E6A817]">⏳</span>
                    <span>Verifying network settings in MetaMask...</span>
                  </div>
                )}
                {step === 'checking_allowance' && (
                  <div className="flex items-center gap-3 text-sm text-[#E2E8F0]">
                    <span className="animate-spin text-[#E6A817]">⏳</span>
                    <span>Checking your USDT token allowance...</span>
                  </div>
                )}
                {step === 'approving' && (
                  <div className="flex items-center gap-3 text-sm text-[#E2E8F0]">
                    <span className="animate-spin text-[#E6A817]">⏳</span>
                    <span>Please sign the USDT allowance approval in MetaMask...</span>
                  </div>
                )}
                {step === 'entering' && (
                  <div className="flex items-center gap-3 text-sm text-[#E2E8F0]">
                    <span className="animate-spin text-[#E6A817]">⏳</span>
                    <span>Entering draw on-chain... Please confirm in MetaMask.</span>
                  </div>
                )}
                {step === 'success' && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 text-sm text-green-400 font-bold">
                      <span>✅</span>
                      <span>Success! Your tickets have been purchased successfully!</span>
                    </div>
                    {txHash && (
                      <a
                        href={`${explorerUrl}/tx/${txHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-[#E6A817] hover:underline block ml-7"
                      >
                        View transaction on Explorer ↗
                      </a>
                    )}
                  </div>
                )}
                {step === 'error' && errorMsg && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 text-sm text-red-400 font-bold">
                      <span>❌</span>
                      <span>Transaction Failed</span>
                    </div>
                    <p className="text-xs text-[#8E9BB0] ml-7 break-words">{errorMsg}</p>
                    {errorMsg.toLowerCase().includes('network') && (
                      <button
                        onClick={handleAddPolygon}
                        className="mt-2 bg-[#E6A817] hover:bg-[#ffd043] text-[#1A1A2E] font-semibold px-4 py-2 rounded-lg text-xs shadow-md transition-all duration-200 cursor-pointer block ml-7"
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
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#E6A817] text-[#1A1A2E] font-bold text-sm shrink-0">
            3
          </div>
          <div className="flex-1 space-y-3">
            <h3 className="font-semibold text-lg">Track Your Entries</h3>
            <p className="text-sm text-[#8E9BB0]">
              Your entries will automatically appear within 30 seconds of transaction confirmation. Paste your wallet below to track:
            </p>
            <form onSubmit={handleTrackSubmit} className="flex gap-2">
              <input
                type="text"
                value={trackAddress}
                onChange={(e) => setTrackAddress(e.target.value)}
                placeholder="0x..."
                className="flex-1 bg-[#1a1a2e] border border-[#2c3a5f] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#E6A817] font-mono"
              />
              <button
                type="submit"
                disabled={!trackAddress.startsWith('0x')}
                className="bg-[#E6A817] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#ffd043] text-[#1A1A2E] font-semibold px-4 py-2 rounded-lg text-sm transition-all cursor-pointer"
              >
                Track
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Token Acquisition Guide Helper */}
      {!isTestnet && (
        <div className="mt-6 bg-[#1a1a2e] border border-[#2c3a5f]/80 p-4 rounded-xl space-y-3">
          <h4 className="text-[#E6A817] font-bold text-sm uppercase tracking-wide flex items-center gap-1.5">
            🔑 Need POL (Gas) or USDT?
          </h4>
          <p className="text-xs text-[#8E9BB0] leading-relaxed">
            To participate, you need <strong className="text-white">POL</strong> to cover network fees (gas) and <strong className="text-white">USDT</strong> for your entry tickets.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 pt-1">
            <a
              href="https://www.p2p.lol/en"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 bg-[#2c3a5f] hover:bg-[#3d5180] text-center text-[#E2E8F0] font-bold text-xs px-3 py-2.5 rounded-lg border border-[#3d5180] transition-colors cursor-pointer"
            >
              1. Buy POL (Gas) on P2P.lol ↗
            </a>
            <a
              href="https://quickswap.exchange"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 bg-[#2c3a5f] hover:bg-[#3d5180] text-center text-[#E2E8F0] font-bold text-xs px-3 py-2.5 rounded-lg border border-[#3d5180] transition-colors cursor-pointer"
            >
              2. Swap to USDT on QuickSwap ↗
            </a>
          </div>
          <div className="text-center pt-1">
            <Link
              href="/how-it-works"
              className="text-xs text-[#E6A817] hover:underline"
            >
              Read full Step-by-Step Wallet & Token Setup Guide →
            </Link>
          </div>
        </div>
      )}

      {/* Warnings */}
      <div className="mt-8 bg-red-950/40 border border-red-900/50 p-4 rounded-xl space-y-2">
        <h4 className="text-[#ef4444] font-bold text-sm uppercase tracking-wide flex items-center gap-1.5">
          ⚠️ Critical Warnings
        </h4>
        <ul className="list-disc list-inside text-xs text-red-200/90 space-y-1">
          <li>
            <span className="font-bold">{isTestnet ? 'POLYGON AMOY TESTNET' : 'POLYGON MAINNET'} ONLY</span>. MetaMask must be connected to the correct network.
          </li>
          <li>
            The smart contract is self-executing. Do not send USDT directly to the contract address; you must use the checkout flow above to call the contract functions.
          </li>
          <li>
            Ensure your wallet is funded with a small amount of POL to pay for blockchain gas fees.
          </li>
        </ul>
      </div>
    </div>
  );
}
