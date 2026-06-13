import { ethers } from 'ethers';
import prisma from '../db/client';
import { config } from '../config';
import socketService from './socketService';
import roundService from './roundService';

const DRAWPOOL_ABI = [
  "event EntryPurchased(uint256 indexed roundId, address indexed buyer, uint256 quantity)",
  "event DrawRequested(uint256 indexed roundId, uint256 indexed requestId)",
  "event WinnerSelected(uint256 indexed roundId, address indexed winner, uint256 winnerIndex)",
  "event PrizePaid(uint256 indexed roundId, address indexed winner, uint256 amount)",
  "event RoundStarted(uint256 indexed roundId)",
  "event EntryRefunded(uint256 indexed roundId, address indexed user, uint256 amount)",
  "event ContractDestroyed()",
  "function getActiveRound() external view returns (uint256 roundId, uint256 entriesSold, bool isLocked, bool deactivated)",
  "function getRound(uint256 roundId) external view returns (uint256 id, address winner, uint256 winnerIndex, bool isComplete, bool isLocked, uint256 startedAt, uint256 completedAt, uint256 vrfRequestId)"
];

async function handleEntryPurchased(roundId: bigint, buyer: string, quantity: bigint, event: any) {
  const roundNumber = Number(roundId);
  const qty = Number(quantity);
  const txHash = event.log.transactionHash;
  const buyerAddress = buyer.toLowerCase();

  console.log(`[ContractListener] EntryPurchased event: round=${roundNumber}, buyer=${buyerAddress}, quantity=${qty}, tx=${txHash}`);

  // Idempotency: Check if transaction has already been processed
  const alreadyProcessed = await prisma.processedTx.findUnique({
    where: { txHash }
  });
  if (alreadyProcessed) {
    console.log(`[ContractListener] Ignored: Transaction ${txHash} already processed.`);
    return;
  }

  // Record transaction as processed
  await prisma.processedTx.create({
    data: { txHash }
  });

  try {
    await prisma.$transaction(async (tx) => {
      // Find or create the round in database
      let dbRound = await tx.round.findUnique({
        where: { roundNumber }
      });

      if (!dbRound) {
        dbRound = await tx.round.create({
          data: {
            roundNumber,
            status: 'active',
            entriesSold: 0,
            commitHash: 'Chainlink VRF v2.5'
          }
        });
      }

      // Add entries to database
      const entryBaseNumber = dbRound.entriesSold;
      for (let i = 0; i < qty; i++) {
        const entryNum = entryBaseNumber + i + 1;
        const entryTxHash = qty > 1 ? `${txHash}-${i}` : txHash;

        await tx.entry.create({
          data: {
            roundNumber,
            walletAddress: buyerAddress,
            entryNumber: entryNum,
            txHash: entryTxHash,
            amountPaid: config.TICKET_PRICE.toString()
          }
        });
      }

      // Update round entries count
      const updatedRound = await tx.round.update({
        where: { id: dbRound.id },
        data: {
          entriesSold: {
            increment: qty
          }
        }
      });

      console.log(`[ContractListener] Recorded ${qty} entries for ${buyerAddress} in Round #${roundNumber}. Total: ${updatedRound.entriesSold}`);

      // Broadcast progress live to frontend
      socketService.broadcastEntrySold(roundNumber, updatedRound.entriesSold, buyerAddress);
    });
  } catch (error) {
    console.error(`[ContractListener Error] Failed to process EntryPurchased for tx ${txHash}:`, error);
    // Remove transaction from processed list so it can be retried
    await prisma.processedTx.delete({ where: { txHash } }).catch(() => {});
  }
}

async function handleDrawRequested(roundId: bigint, requestId: bigint, event: any) {
  const roundNumber = Number(roundId);
  const reqId = requestId.toString();
  console.log(`[ContractListener] DrawRequested event: round=${roundNumber}, requestId=${reqId}`);

  try {
    const dbRound = await prisma.round.findUnique({
      where: { roundNumber }
    });

    if (dbRound) {
      await prisma.round.update({
        where: { id: dbRound.id },
        data: {
          status: 'drawing'
        }
      });
      console.log(`[ContractListener] Updated Round #${roundNumber} status to drawing`);
      socketService.broadcastRoundDrawing(roundNumber);
    }
  } catch (error) {
    console.error(`[ContractListener Error] Failed to process DrawRequested:`, error);
  }
}

async function handleWinnerSelected(roundId: bigint, winner: string, winnerIndex: bigint, event: any) {
  const roundNumber = Number(roundId);
  const winnerAddress = winner.toLowerCase();
  const index = Number(winnerIndex);
  const txHash = event.log.transactionHash;

  console.log(`[ContractListener] WinnerSelected event: round=${roundNumber}, winner=${winnerAddress}, index=${index}, tx=${txHash}`);

  try {
    const dbRound = await prisma.round.findUnique({
      where: { roundNumber }
    });

    if (dbRound) {
      await prisma.round.update({
        where: { id: dbRound.id },
        data: {
          winnerAddress,
          winnerEntry: index,
          status: 'complete',
          completedAt: new Date(),
          prizeHash: txHash,
          revenueHash: txHash,
          seed: 'VRF-ON-CHAIN'
        }
      });

      console.log(`[ContractListener] Updated Round #${roundNumber} complete: Winner=${winnerAddress}, index=${index}`);
      
      socketService.broadcastRoundComplete(roundNumber, winnerAddress, index, 'VRF-ON-CHAIN', txHash);
    }
  } catch (error) {
    console.error(`[ContractListener Error] Failed to process WinnerSelected:`, error);
  }
}

async function handleRoundStarted(roundId: bigint, event: any) {
  const roundNumber = Number(roundId);
  console.log(`[ContractListener] RoundStarted event: round=${roundNumber}`);

  try {
    const dbRound = await prisma.round.findUnique({
      where: { roundNumber }
    });

    if (!dbRound) {
      await prisma.round.create({
        data: {
          roundNumber,
          status: 'active',
          entriesSold: 0,
          commitHash: 'Chainlink VRF v2.5'
        }
      });
      console.log(`[ContractListener] Initialized new Round #${roundNumber} in DB`);
      socketService.broadcastRoundNew(roundNumber);
    }
  } catch (error) {
    console.error(`[ContractListener Error] Failed to process RoundStarted:`, error);
  }
}

async function handleContractDestroyed(event: any) {
  console.log(`[ContractListener] ContractDestroyed event received.`);
  try {
    // Stop the platform on backend
    await roundService.stopPlatform();
  } catch (error) {
    console.error(`[ContractListener Error] Failed to process ContractDestroyed:`, error);
  }
}

export const contractListener = {
  startListening() {
    if (!config.DRAWPOOL_CONTRACT_ADDRESS) {
      console.warn('[ContractListener] DRAWPOOL_CONTRACT_ADDRESS not set. Listener disabled.');
      return;
    }

    const provider = new ethers.JsonRpcProvider(config.POLYGON_RPC_HTTP);
    const contract = new ethers.Contract(config.DRAWPOOL_CONTRACT_ADDRESS, DRAWPOOL_ABI, provider);

    console.log(`[ContractListener] Starting listener for DrawPool at ${config.DRAWPOOL_CONTRACT_ADDRESS} on ${config.POLYGON_RPC_HTTP}`);

    contract.on("EntryPurchased", (roundId, buyer, quantity, event) => {
      handleEntryPurchased(roundId, buyer, quantity, event).catch(console.error);
    });

    contract.on("DrawRequested", (roundId, requestId, event) => {
      handleDrawRequested(roundId, requestId, event).catch(console.error);
    });

    contract.on("WinnerSelected", (roundId, winner, winnerIndex, event) => {
      handleWinnerSelected(roundId, winner, winnerIndex, event).catch(console.error);
    });

    contract.on("RoundStarted", (roundId, event) => {
      handleRoundStarted(roundId, event).catch(console.error);
    });

    contract.on("ContractDestroyed", (event) => {
      handleContractDestroyed(event).catch(console.error);
    });
  }
};

export default contractListener;
