'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface WinnerModalProps {
  isOpen: boolean;
  onClose: () => void;
  roundNumber: number;
  winnerAddress: string;
  winnerEntry: number;
  seed: string;
  prizeHash: string;
  userAddress: string | null;
}

export default function WinnerModal({
  isOpen,
  onClose,
  roundNumber,
  winnerAddress,
  winnerEntry,
  seed,
  prizeHash,
  userAddress,
}: WinnerModalProps) {
  const [isCelebration, setIsCelebration] = useState(false);

  const isTestnet = process.env.NEXT_PUBLIC_IS_TESTNET === 'true';
  const prizeUSD = isTestnet ? '5' : '1,000';
  const explorerUrl = process.env.NEXT_PUBLIC_POLYGON_EXPLORER || 'https://polygonscan.com';
  
  const isUserWinner = userAddress?.toLowerCase() === winnerAddress.toLowerCase();

  useEffect(() => {
    if (isOpen && isUserWinner) {
      setIsCelebration(true);
    } else {
      setIsCelebration(false);
    }
  }, [isOpen, isUserWinner]);

  if (!isOpen) return null;

  const shortenAddress = (addr: string) => {
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm transition-all duration-300 animate-fade-in">
      <div className="bg-[#16213E] border-2 border-[#E6A817] rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl relative text-center overflow-hidden animate-scale-up">
        
        {/* Celebration Particles for Winner */}
        {isCelebration && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden flex flex-wrap justify-center items-start">
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                className="w-2 h-2 bg-yellow-400 rounded-full mx-1 animate-bounce"
                style={{
                  animationDelay: `${i * 0.1}s`,
                  animationDuration: `${1 + Math.random()}s`,
                  transform: `translateY(${Math.random() * 20}px)`
                }}
              />
            ))}
          </div>
        )}

        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#8E9BB0] hover:text-white transition-colors cursor-pointer text-lg font-bold"
        >
          ✕
        </button>

        {isUserWinner ? (
          <div className="mb-6 space-y-2">
            <span className="text-4xl">🏆 🎉</span>
            <h2 className="text-3xl font-extrabold text-[#E6A817] tracking-wide animate-pulse">
              YOU WON!
            </h2>
            <p className="text-[#E2E8F0] font-medium">
              Congratulations! Your address was selected as the winner.
            </p>
          </div>
        ) : (
          <div className="mb-6 space-y-2">
            <span className="text-4xl">🎉</span>
            <h2 className="text-2xl font-bold text-[#E6A817] tracking-wide">
              Round #{roundNumber} Draw Completed!
            </h2>
            <p className="text-[#8E9BB0] text-sm">
              A winner has been drawn and paid automatically.
            </p>
          </div>
        )}

        {/* Winner Card */}
        <div className="bg-[#1a1a2e] border border-[#2c3a5f] p-6 rounded-2xl space-y-4 my-6">
          <div>
            <span className="text-xs text-[#8E9BB0] block uppercase tracking-wider mb-1">WINNER ADDRESS</span>
            <span className="font-mono text-lg font-bold text-[#E2E8F0] bg-[#16213E] border border-[#2c3a5f] px-3 py-1.5 rounded-lg select-all">
              {shortenAddress(winnerAddress)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="border-r border-[#2c3a5f] pr-2">
              <span className="text-xs text-[#8E9BB0] block uppercase tracking-wider mb-1">TICKET NUMBER</span>
              <span className="text-xl font-mono font-extrabold text-[#E6A817]">#{winnerEntry}</span>
            </div>
            <div className="pl-2">
              <span className="text-xs text-[#8E9BB0] block uppercase tracking-wider mb-1">PRIZE AMOUNT</span>
              <span className="text-xl font-mono font-extrabold text-white">${prizeUSD} USDT</span>
            </div>
          </div>
        </div>

        {/* Links & Fairness Check */}
        <div className="space-y-4 text-sm">
          {prizeHash && (
            <a
              href={`${explorerUrl}/tx/${prizeHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#E6A817] hover:text-[#ffd043] font-semibold underline block transition-colors cursor-pointer"
            >
              Verify Payout on Polygonscan ↗
            </a>
          )}

          <div className="border-t border-[#2c3a5f] pt-4 text-left space-y-2">
            <span className="text-xs font-bold text-[#8E9BB0] block uppercase tracking-wider">
              FAIRNESS PROOF (COMMIT-REVEAL)
            </span>
            <div className="text-xs space-y-1">
              <p className="text-[#8E9BB0] truncate">
                <span className="font-semibold text-[#E2E8F0]">Revealed Seed:</span>{' '}
                <code className="font-mono bg-[#1a1a2e] px-1 py-0.5 rounded">{seed}</code>
              </p>
            </div>
            <Link
              href={`/verify?round=${roundNumber}`}
              onClick={onClose}
              className="bg-[#2c3a5f] hover:bg-[#3d5180] text-[#E2E8F0] font-medium text-xs py-2 px-3 rounded-lg block text-center transition-all mt-2 cursor-pointer"
            >
              Run Cryptographic Verification Tool
            </Link>
          </div>
        </div>

        <button
          onClick={onClose}
          className="mt-6 w-full bg-[#E6A817] hover:bg-[#ffd043] text-[#1A1A2E] font-bold py-2.5 rounded-xl shadow-lg transition-all cursor-pointer"
        >
          Awesome
        </button>
      </div>
    </div>
  );
}
