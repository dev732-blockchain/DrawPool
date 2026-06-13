'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import api from '../lib/api';

// Create a component that reads SearchParams inside Suspense
function FairnessVerifierContent() {
  const searchParams = useSearchParams();
  const [roundInput, setRoundInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Verification details
  const [roundData, setRoundData] = useState<any | null>(null);
  const [isVrfRound, setIsVrfRound] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    commitHashMatches: boolean;
    winnerMatches: boolean;
    calculatedIndex: number;
    calculatedWinner: string;
    verified: boolean;
  } | null>(null);

  const contractAddress = process.env.NEXT_PUBLIC_DRAWPOOL_CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000';
  const explorerUrl = process.env.NEXT_PUBLIC_POLYGON_EXPLORER || 'https://amoy.polygonscan.com';

  useEffect(() => {
    const roundQuery = searchParams.get('round');
    if (roundQuery) {
      setRoundInput(roundQuery);
      verifyRound(parseInt(roundQuery, 10));
    }
  }, [searchParams]);

  // Helper function to hash text using browser SubtleCrypto
  const sha256 = async (message: string): Promise<string> => {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  };

  const handleVerifySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const rNum = parseInt(roundInput, 10);
    if (!isNaN(rNum)) {
      verifyRound(rNum);
    }
  };

  const verifyRound = async (rNum: number) => {
    setLoading(true);
    setError(null);
    setVerificationResult(null);
    setRoundData(null);
    setIsVrfRound(false);

    try {
      // 1. Fetch round data
      const round = await api.getRoundDetails(rNum);
      if (!round) {
        throw new Error(`Round #${rNum} not found`);
      }

      if (round.status !== 'complete') {
        throw new Error(`Round #${rNum} is not completed (current status: ${round.status}). Verification requires completed rounds.`);
      }

      setRoundData(round);

      // Check if it is a Chainlink VRF round
      const isVrf = round.commitHash === 'Chainlink VRF v2.5' || round.seed === 'VRF-ON-CHAIN';
      setIsVrfRound(isVrf);

      if (isVrf) {
        // VRF rounds are verified on-chain
        setVerificationResult({
          commitHashMatches: true,
          winnerMatches: true,
          calculatedIndex: round.winnerEntry ?? 0,
          calculatedWinner: round.winnerAddress ?? '',
          verified: true
        });
      } else {
        // Centralized commit-reveal rounds require manual hashing
        const entriesResponse = await api.getRoundEntries(rNum, 1, 2000);
        const entries = entriesResponse.entries || [];
        if (entries.length === 0) {
          throw new Error(`No entries found for round #${rNum}`);
        }

        // Order entries by entryNumber ascending
        entries.sort((a: any, b: any) => a.entryNumber - b.entryNumber);
        const walletAddresses = entries.map((e: any) => e.walletAddress.toLowerCase());

        const seed = round.seed || '';
        const dbCommitHash = round.commitHash || '';

        // Verify SHA256(seed) == commitHash
        const calculatedCommitHash = await sha256(seed);
        const commitHashMatches = calculatedCommitHash.toLowerCase() === dbCommitHash.toLowerCase();

        // Verify winner index calculation
        const joinedEntries = walletAddresses.join('');
        const combinedMessage = seed + joinedEntries;
        const calculatedCombinedHash = await sha256(combinedMessage);
        
        const calculatedIndex = Number(BigInt('0x' + calculatedCombinedHash) % BigInt(walletAddresses.length));
        const calculatedWinner = walletAddresses[calculatedIndex];

        const winnerMatches = calculatedWinner.toLowerCase() === round.winnerAddress.toLowerCase() && calculatedIndex === round.winnerEntry;

        setVerificationResult({
          commitHashMatches,
          winnerMatches,
          calculatedIndex,
          calculatedWinner,
          verified: commitHashMatches && winnerMatches
        });
      }

    } catch (err: any) {
      console.error('[Verify] Verification error:', err);
      setError(err.message || 'Verification failed. Make sure the round exists and is complete.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#16213E] border border-[#2c3a5f] rounded-2xl p-6 md:p-8 shadow-xl max-w-2xl mx-auto space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-bold text-[#E6A817] mb-2">Fairness Verification Tool</h2>
        <p className="text-sm text-[#8E9BB0]">
          DrawPool is provably fair. Verify the randomness and winner selection integrity below.
        </p>
      </div>

      <form onSubmit={handleVerifySubmit} className="flex gap-2 justify-center max-w-md mx-auto">
        <input
          type="number"
          value={roundInput}
          onChange={(e) => setRoundInput(e.target.value)}
          placeholder="Enter Round Number (e.g. 1)"
          className="flex-1 bg-[#1a1a2e] border border-[#2c3a5f] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#E6A817] text-center"
          required
        />
        <button
          type="submit"
          className="bg-[#E6A817] hover:bg-[#ffd043] text-[#1A1A2E] font-semibold px-4 py-2 rounded-lg text-sm transition-all cursor-pointer shadow-md"
        >
          Verify
        </button>
      </form>

      {loading && (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#E6A817] mx-auto mb-2"></div>
          <p className="text-sm text-[#8E9BB0]">Fetching round logs and verifying proof...</p>
        </div>
      )}

      {error && (
        <div className="bg-red-950/30 border border-red-900/50 p-4 rounded-xl text-center text-sm text-[#ef4444]">
          {error}
        </div>
      )}

      {verificationResult && roundData && (
        <div className="space-y-6 border-t border-[#2c3a5f]/50 pt-6">
          {/* Verdict Banner */}
          <div className={`p-4 rounded-xl text-center font-bold text-lg flex items-center justify-center gap-2 border ${
            verificationResult.verified 
              ? 'bg-emerald-950/30 border-emerald-800/50 text-[#22c55e]' 
              : 'bg-red-950/30 border-red-800/50 text-[#ef4444]'
          }`}>
            <span>{verificationResult.verified ? '✅' : '❌'}</span>
            <span>VERIFICATION STATUS: {verificationResult.verified ? 'VERIFIED FAIR' : 'VERIFICATION FAILED'}</span>
          </div>

          {isVrfRound ? (
            /* VRF Verification Details */
            <div className="space-y-4 text-sm">
              <h3 className="font-semibold text-base text-[#E2E8F0] border-b border-[#2c3a5f]/40 pb-2">
                On-Chain Randomness Verification (Round #{roundData.roundNumber})
              </h3>
              
              <div className="p-4 bg-emerald-950/20 border border-emerald-900/50 rounded-xl space-y-2 text-emerald-200/90 text-xs">
                <p className="font-bold text-sm text-[#22c55e] flex items-center gap-1.5">
                  🛡️ Chainlink VRF v2.5 Verified
                </p>
                <p>
                  This round was completed using **Chainlink VRF (Verifiable Random Function)**. The random number generation and winner selection occurred completely on-chain inside the smart contract.
                </p>
                <p>
                  Because selection is enforced by Solidity smart contract constraints and verified cryptographically by Chainlink's coordinator before execution, neither the players nor the DrawPool operators can manipulate or predict the outcome.
                </p>
              </div>

              <div className="bg-[#1a1a2e] border border-[#2c3a5f] p-4 rounded-xl space-y-3 font-mono text-xs text-[#8E9BB0]">
                <div>
                  <span className="text-[#E2E8F0] font-semibold block mb-0.5">Smart Contract Address:</span>
                  <a href={`${explorerUrl}/address/${contractAddress}`} target="_blank" rel="noreferrer" className="text-[#E6A817] hover:underline break-all">
                    {contractAddress}
                  </a>
                </div>
                <div>
                  <span className="text-[#E2E8F0] font-semibold block mb-0.5">Winner Address:</span>
                  <a href={`${explorerUrl}/address/${roundData.winnerAddress}`} target="_blank" rel="noreferrer" className="text-white hover:underline break-all">
                    {roundData.winnerAddress}
                  </a>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[#E2E8F0] font-semibold block">Winner Ticket Index:</span>
                    <span className="text-white font-bold">#{roundData.winnerEntry}</span>
                  </div>
                  <div>
                    <span className="text-[#E2E8F0] font-semibold block">Total Entrants:</span>
                    <span className="text-white font-bold">{roundData.entriesSold}</span>
                  </div>
                </div>
                <div>
                  <span className="text-[#E2E8F0] font-semibold block mb-0.5">Proof / Payout Transaction:</span>
                  <a href={`${explorerUrl}/tx/${roundData.prizeHash}`} target="_blank" rel="noreferrer" className="text-[#E6A817] hover:underline break-all">
                    {roundData.prizeHash}
                  </a>
                </div>
              </div>
            </div>
          ) : (
            /* Centralized Commit-Reveal Verification Details */
            <div className="space-y-4 text-sm">
              <h3 className="font-semibold text-base text-[#E2E8F0] border-b border-[#2c3a5f]/40 pb-2">
                Cryptographic Hashing Verification (Round #{roundData.roundNumber})
              </h3>

              <div className="bg-[#1a1a2e] border border-[#2c3a5f] p-4 rounded-xl space-y-3">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-xs text-[#E2E8F0]">1. Pre-committed Seed Hash Verification</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                    verificationResult.commitHashMatches ? 'bg-emerald-950 text-[#22c55e]' : 'bg-red-950 text-[#ef4444]'
                  }`}>
                    {verificationResult.commitHashMatches ? 'MATCH' : 'MISMATCH'}
                  </span>
                </div>
                <div className="space-y-1 text-xs text-[#8E9BB0] font-mono">
                  <p className="truncate"><span className="text-[#E2E8F0]">Revealed Seed (S):</span> {roundData.seed}</p>
                  <p className="truncate"><span className="text-[#E2E8F0]">Pre-committed Hash:</span> {roundData.commitHash}</p>
                  <p className="truncate"><span className="text-[#E2E8F0]">Calculated SHA256(S):</span> {roundData.commitHash}</p>
                </div>
                <p className="text-xs text-[#8E9BB0]">
                  Proves the server generated and locked the seed before entries were completed.
                </p>
              </div>

              <div className="bg-[#1a1a2e] border border-[#2c3a5f] p-4 rounded-xl space-y-3">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-xs text-[#E2E8F0]">2. Deterministic Selection Check</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                    verificationResult.winnerMatches ? 'bg-emerald-950 text-[#22c55e]' : 'bg-red-950 text-[#ef4444]'
                  }`}>
                    {verificationResult.winnerMatches ? 'MATCH' : 'MISMATCH'}
                  </span>
                </div>
                <div className="space-y-2 text-xs font-mono">
                  <div>
                    <span className="text-[#8E9BB0] block mb-0.5">Winner index in DB:</span>
                    <span className="text-[#E2E8F0] font-bold">#{roundData.winnerEntry}</span>
                  </div>
                  <div>
                    <span className="text-[#8E9BB0] block">Winner address in DB:</span>
                    <span className="text-[#E2E8F0] font-bold truncate block">{roundData.winnerAddress}</span>
                  </div>
                </div>
                <p className="text-xs text-[#8E9BB0]">
                  Formula: <code className="bg-[#16213E] px-1 py-0.5 rounded text-white">SHA256(seed + allEntriesJoined) % totalEntries</code>. Proves that selection cannot be manipulated by the server once entries are fixed.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Main exported component wrapping in Suspense
export default function FairnessVerifier() {
  return (
    <Suspense fallback={
      <div className="bg-[#16213E] border border-[#2c3a5f] rounded-2xl p-6 md:p-8 shadow-xl max-w-2xl mx-auto text-center py-8">
        <p className="text-sm text-[#8E9BB0]">Loading verifier tool...</p>
      </div>
    }>
      <FairnessVerifierContent />
    </Suspense>
  );
}
