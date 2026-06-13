'use client';

import Link from 'next/link';

export default function HowItWorks() {
  const isTestnet = process.env.NEXT_PUBLIC_IS_TESTNET === 'true';
  const maxEntries = isTestnet ? '10' : '200';
  const prizeUSD = isTestnet ? '5' : '100';

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      <div className="text-center">
        <h1 className="text-3xl font-black text-white uppercase tracking-tight mb-2">How It Works</h1>
        <p className="text-sm text-[#8E9BB0]">Learn how to participate in DrawPool and understand our decentralized fairness model.</p>
      </div>

      {/* Step-by-Step Ticket Purchase Guide */}
      <div className="bg-[#16213E] border border-[#2c3a5f] rounded-2xl p-6 md:p-8 shadow-xl space-y-6">
        <h2 className="text-xl font-bold text-[#E6A817] border-b border-[#2c3a5f]/40 pb-2">
          Step-by-Step Guide: How to Buy a Ticket
        </h2>

        <div className="space-y-8">
          {/* Step 1: Set up wallet */}
          <div className="flex gap-4">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-[#E6A817] text-[#1A1A2E] font-extrabold text-sm shrink-0">
              1
            </span>
            <div className="space-y-2">
              <h3 className="font-bold text-lg text-[#E2E8F0]">Set Up a Web3 Wallet</h3>
              <p className="text-sm text-[#8E9BB0] leading-relaxed">
                You need a Web3 wallet like <strong className="text-white">MetaMask</strong> or <strong className="text-white">Trust Wallet</strong> to interact with DrawPool. 
                Install MetaMask as a browser extension or mobile app, set up your wallet, and save your recovery phrase securely.
              </p>
            </div>
          </div>

          {/* Step 2: Get POL and USDT */}
          <div className="flex gap-4">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-[#E6A817] text-[#1A1A2E] font-extrabold text-sm shrink-0">
              2
            </span>
            <div className="space-y-3">
              <h3 className="font-bold text-lg text-[#E2E8F0]">Get POL (Gas) & USDT on Polygon</h3>
              <p className="text-sm text-[#8E9BB0] leading-relaxed">
                Because DrawPool is fully decentralized, transactions run on the Polygon blockchain. You will need:
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                {/* POL card */}
                <div className="bg-[#1a1a2e] border border-[#2c3a5f]/60 p-4 rounded-xl space-y-2">
                  <span className="text-xs font-extrabold text-[#E6A817] uppercase tracking-wider block">1. POL Token (For Gas Fees)</span>
                  <p className="text-xs text-[#8E9BB0] leading-relaxed">
                    A tiny amount of POL (usually less than $0.02) is required to pay the network fee (gas) to approve and submit your ticket purchase.
                  </p>
                  <div className="pt-2">
                    <span className="text-xs text-[#8E9BB0] block mb-1.5 font-semibold">💡 Recommendation:</span>
                    <a 
                      href="https://www.p2p.lol/en" 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="inline-flex items-center gap-1 bg-[#E6A817] hover:bg-[#ffd043] text-[#1A1A2E] font-bold text-xs px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                    >
                      Buy POL on P2P.lol ↗
                    </a>
                    <span className="text-[10px] text-[#8E9BB0] block mt-1">Easy, direct card payments & low fees.</span>
                  </div>
                </div>

                {/* USDT card */}
                <div className="bg-[#1a1a2e] border border-[#2c3a5f]/60 p-4 rounded-xl space-y-2">
                  <span className="text-xs font-extrabold text-[#E6A817] uppercase tracking-wider block">2. USDT Token (For Tickets)</span>
                  <p className="text-xs text-[#8E9BB0] leading-relaxed">
                    Each ticket entry costs exactly $1 USDT. You must hold USDT on the Polygon POS network to buy entries.
                  </p>
                  <div className="pt-2">
                    <span className="text-xs text-[#8E9BB0] block mb-1 font-semibold">How to get USDT on Polygon:</span>
                    <ul className="list-disc list-inside text-[11px] text-[#8E9BB0] space-y-1">
                      <li>Swap some of your POL for USDT on <a href="https://quickswap.exchange" target="_blank" rel="noopener noreferrer" className="text-[#E6A817] hover:underline">QuickSwap ↗</a>.</li>
                      <li>Withdraw USDT from exchanges (Binance, Coinbase, etc.) directly to your wallet using the <strong>Polygon network</strong>.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Step 3: Connect and buy */}
          <div className="flex gap-4">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-[#E6A817] text-[#1A1A2E] font-extrabold text-sm shrink-0">
              3
            </span>
            <div className="space-y-2">
              <h3 className="font-bold text-lg text-[#E2E8F0]">Connect Wallet & Buy Tickets</h3>
              <p className="text-sm text-[#8E9BB0] leading-relaxed">
                Go to the DrawPool homepage, click <strong className="text-white">Connect Wallet</strong>, and select your MetaMask wallet. 
                Select the number of entries you want to purchase (up to 100 per transaction).
              </p>
              <div className="bg-[#1a1a2e] border border-[#2c3a5f]/40 p-4 rounded-xl text-xs text-[#8E9BB0] leading-relaxed space-y-2">
                <p>
                  <strong>Approval Step:</strong> The very first time you buy, MetaMask will ask you to approve the DrawPool smart contract to access your USDT. This is a standard security step to grant permission.
                </p>
                <p>
                  <strong>Purchase Step:</strong> After approval, you will confirm the actual ticket entry transaction. Once confirmed, your entries are secured on the blockchain!
                </p>
              </div>
            </div>
          </div>

          {/* Step 4: Track progress */}
          <div className="flex gap-4">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-[#E6A817] text-[#1A1A2E] font-extrabold text-sm shrink-0">
              4
            </span>
            <div className="space-y-2">
              <h3 className="font-bold text-lg text-[#E2E8F0]">Track Progress & Automate Payouts</h3>
              <p className="text-sm text-[#8E9BB0] leading-relaxed">
                You can view your active entries in real-time under <strong className="text-white">My Entries</strong> or input your address on the home page.
                When the round reaches exactly {maxEntries} entries, the contract locks, triggers the draw, and automatically deposits the ${prizeUSD} USDT prize directly into the winner's wallet.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* On-Chain Fairness (Chainlink VRF) */}
      <div className="bg-[#16213E] border border-[#2c3a5f] rounded-2xl p-6 md:p-8 shadow-xl space-y-4">
        <h2 className="text-xl font-bold text-[#E6A817] border-b border-[#2c3a5f]/40 pb-2">
          Provably Fair: Chainlink VRF v2.5
        </h2>
        <p className="text-sm text-[#8E9BB0] leading-relaxed">
          Unlike traditional lotteries or centralized competition websites, DrawPool cannot manipulate the winner drawing. 
          The winner is chosen completely on-chain using **Chainlink VRF (Verifiable Random Function)**:
        </p>

        <div className="bg-[#1a1a2e] border border-[#2c3a5f]/50 p-4 rounded-xl space-y-4 text-xs font-mono text-[#8E9BB0]">
          <div>
            <span className="text-white font-bold block mb-1">1. Smart Contract Lock</span>
            <p>
              Once ticket {maxEntries} is sold, the smart contract blocks further entries and sends a request to Chainlink's decentralized oracle network for a secure random number.
            </p>
          </div>
          
          <div>
            <span className="text-white font-bold block mb-1">2. Cryptographic Randomness Callback</span>
            <p>
              Chainlink VRF generates a random number alongside a cryptographic proof of its authenticity. This number is returned directly to the smart contract via the `fulfillRandomWords` function.
            </p>
          </div>

          <div>
            <span className="text-white font-bold block mb-1">3. Deterministic Winner Calculation</span>
            <p>
              The contract uses the verified random number to select the winner index:
              <br />
              <code className="bg-[#16213E] px-1.5 py-0.5 rounded text-white inline-block mt-1">
                Winner Index = Random Number % {maxEntries}
              </code>
              <br />
              The winner instantly receives the ${prizeUSD} USDT payout, and the next round begins. Anyone can verify this transaction on PolygonScan.
            </p>
          </div>
        </div>

        <div className="text-center pt-2">
          <Link
            href="/verify"
            className="inline-block bg-[#E6A817] hover:bg-[#ffd043] text-[#1A1A2E] font-bold text-sm px-6 py-2.5 rounded-xl shadow-md transition-all cursor-pointer"
          >
            Verify a Draw Now
          </Link>
        </div>
      </div>
    </div>
  );
}
