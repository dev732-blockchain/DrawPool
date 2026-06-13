import { ethers } from 'ethers';
import prisma from '../db/client';
import { config } from '../config';
import socketService from './socketService';

// Global flag to track if the platform is active
let platformActive = true;

export const roundService = {
  /**
   * Checks if the platform is currently active
   */
  isPlatformActive(): boolean {
    return platformActive;
  },

  /**
   * Stops the platform (Kill Switch)
   */
  async stopPlatform(): Promise<void> {
    platformActive = false;
    
    // Also mark the current active round as stopped in the DB
    try {
      const activeRound = await prisma.round.findFirst({
        where: { status: 'active' }
      });
      if (activeRound) {
        await prisma.round.update({
          where: { id: activeRound.id },
          data: { status: 'stopped' }
        });
      }
    } catch (error) {
      console.error('[RoundService] Error updating active round to stopped:', error);
    }
    
    socketService.broadcastPlatformStopped('DrawPool has been deactivated by the administrator.');
    console.log('[RoundService] Platform has been stopped.');
  },

  /**
   * Initializes the active round. Syncs state from the smart contract if possible,
   * or ensures there is an active round ready.
   */
  async initActiveRound(): Promise<any> {
    try {
      // Find any active round in DB
      let activeRound = await prisma.round.findFirst({
        where: {
          status: { in: ['active', 'drawing', 'stopped'] }
        }
      });

      let contractRoundNumber = 1;
      let contractEntriesSold = 0;
      let contractIsLocked = false;
      let contractIsDestroyed = false;

      if (config.DRAWPOOL_CONTRACT_ADDRESS && config.POLYGON_RPC_HTTP) {
        try {
          const provider = new ethers.JsonRpcProvider(config.POLYGON_RPC_HTTP);
          const DRAWPOOL_ABI = [
            "function getActiveRound() external view returns (uint256 roundId, uint256 entriesSold, bool isLocked, bool deactivated)"
          ];
          const contract = new ethers.Contract(config.DRAWPOOL_CONTRACT_ADDRESS, DRAWPOOL_ABI, provider);
          const [roundId, entriesSold, isLocked, deactivated] = await contract.getActiveRound();
          contractRoundNumber = Number(roundId);
          contractEntriesSold = Number(entriesSold);
          contractIsLocked = isLocked;
          contractIsDestroyed = deactivated;
          console.log(`[RoundService] Smart Contract active round state: #${contractRoundNumber}, entries sold: ${contractEntriesSold}, locked: ${contractIsLocked}, deactivated: ${contractIsDestroyed}`);
        } catch (err) {
          console.error('[RoundService Warning] Failed to query active round from smart contract:', err);
        }
      }

      const desiredStatus = contractIsDestroyed 
        ? 'stopped' 
        : (contractIsLocked ? 'drawing' : (platformActive ? 'active' : 'stopped'));

      if (!activeRound) {
        activeRound = await prisma.round.create({
          data: {
            roundNumber: contractRoundNumber,
            status: desiredStatus,
            entriesSold: contractEntriesSold,
            commitHash: 'Chainlink VRF v2.5'
          }
        });

        console.log(`[RoundService] Initialized new Round #${contractRoundNumber} from Contract state.`);
        if (platformActive && !contractIsDestroyed) {
          socketService.broadcastRoundNew(contractRoundNumber);
        }
      } else {
        // Update database active round to match contract state
        activeRound = await prisma.round.update({
          where: { id: activeRound.id },
          data: {
            roundNumber: contractRoundNumber,
            status: desiredStatus,
            entriesSold: contractEntriesSold
          }
        });
        console.log(`[RoundService] Synced existing active Round #${activeRound.roundNumber} (status: ${activeRound.status}, entries: ${activeRound.entriesSold})`);
      }

      return activeRound;
    } catch (error) {
      console.error('[RoundService] Error initializing active round:', error);
      throw error;
    }
  },

  /**
   * Checks the USDT balance of the smart contract address
   */
  async checkContractBalance(): Promise<bigint> {
    try {
      if (!config.POLYGON_RPC_HTTP || !config.DRAWPOOL_CONTRACT_ADDRESS) {
        return 0n;
      }
      const provider = new ethers.JsonRpcProvider(config.POLYGON_RPC_HTTP);
      const ERC20_ABI = ['function balanceOf(address account) view returns (uint256)'];
      const usdtContract = new ethers.Contract(config.USDT_ADDRESS, ERC20_ABI, provider);
      const balance = await usdtContract.balanceOf(config.DRAWPOOL_CONTRACT_ADDRESS);
      return BigInt(balance.toString());
    } catch (error) {
      console.error('[RoundService] Error checking contract balance:', error);
      return 0n;
    }
  },

  /**
   * Synchronizes a round's state from the blockchain.
   * This is used to resolve data gaps if the server was offline when contract events occurred.
   */
  async syncRoundStateFromContract(roundNumber: number): Promise<boolean> {
    console.log(`[RoundService] Syncing Round #${roundNumber} from contract...`);
    try {
      if (!config.DRAWPOOL_CONTRACT_ADDRESS || !config.POLYGON_RPC_HTTP) {
        throw new Error('Contract address or RPC endpoint not configured');
      }

      const provider = new ethers.JsonRpcProvider(config.POLYGON_RPC_HTTP);
      const DRAWPOOL_ABI = [
        "function getRound(uint256 roundId) external view returns (uint256 id, address winner, uint256 winnerIndex, bool isComplete, bool isLocked, uint256 startedAt, uint256 completedAt, uint256 vrfRequestId)",
        "function getRoundEntrants(uint256 roundId) external view returns (address[] memory)",
        "event WinnerSelected(uint256 indexed roundId, address indexed winner, uint256 winnerIndex)"
      ];
      const contract = new ethers.Contract(config.DRAWPOOL_CONTRACT_ADDRESS, DRAWPOOL_ABI, provider);

      // 1. Fetch round details from contract
      const [id, winner, winnerIndex, isComplete, isLocked, startedAt, completedAt, vrfRequestId] = await contract.getRound(roundNumber);
      const roundId = Number(id);

      if (roundId === 0) {
        throw new Error(`Round #${roundNumber} does not exist on-chain`);
      }

      // 2. Fetch round entrants
      const entrants: string[] = await contract.getRoundEntrants(roundNumber);
      const entriesSold = entrants.length;

      // 3. Find transaction hash of the WinnerSelected event
      let txHash = 'VRF-COMPLETED';
      if (isComplete) {
        try {
          const filter = contract.filters.WinnerSelected(roundNumber);
          // Query recent block range (e.g. last 10,000 blocks to find the event hash)
          const latestBlock = await provider.getBlockNumber();
          const fromBlock = Math.max(0, latestBlock - 20000);
          const events = await contract.queryFilter(filter, fromBlock, latestBlock);
          if (events.length > 0) {
            txHash = events[0].transactionHash;
          }
        } catch (eventErr) {
          console.warn('[RoundService] Failed to retrieve WinnerSelected event logs, using placeholder:', eventErr);
        }
      }

      const status = isComplete ? 'complete' : (isLocked ? 'drawing' : 'active');

      const roundData = {
        roundNumber,
        status,
        entriesSold,
        winnerAddress: isComplete ? winner.toLowerCase() : null,
        winnerEntry: isComplete ? Number(winnerIndex) : null,
        prizeHash: isComplete ? txHash : null,
        revenueHash: isComplete ? txHash : null,
        commitHash: 'Chainlink VRF v2.5',
        seed: isComplete ? 'VRF-ON-CHAIN' : null,
        completedAt: isComplete ? new Date(Number(completedAt) * 1000) : null
      };

      // 4. Update round in database
      const dbRound = await prisma.round.findUnique({
        where: { roundNumber }
      });

      if (!dbRound) {
        await prisma.round.create({
          data: roundData
        });
      } else {
        await prisma.round.update({
          where: { id: dbRound.id },
          data: roundData
        });
      }

      // 5. Sync entries in database (clean rewrite for that round)
      await prisma.entry.deleteMany({
        where: { roundNumber }
      });

      for (let i = 0; i < entrants.length; i++) {
        const entrantAddress = entrants[i].toLowerCase();
        await prisma.entry.create({
          data: {
            roundNumber,
            walletAddress: entrantAddress,
            entryNumber: i + 1,
            txHash: isComplete ? `${txHash}-sync-${i}` : `0x_sync_active_${roundNumber}_${i}`,
            amountPaid: config.TICKET_PRICE.toString()
          }
        });
      }

      console.log(`[RoundService] Successfully synced Round #${roundNumber} from contract. Status: ${status}, entries: ${entriesSold}`);
      
      if (isComplete) {
        socketService.broadcastRoundComplete(roundNumber, winner.toLowerCase(), Number(winnerIndex), 'VRF-ON-CHAIN', txHash);
      } else {
        socketService.broadcastEntrySold(roundNumber, entriesSold, 'sync');
      }

      // Automatically sync/resume active round if we synced the active round
      await this.initActiveRound().catch(console.error);

      return true;
    } catch (error: any) {
      console.error(`[RoundService Error] Failed to sync round #${roundNumber} from contract:`, error.message);
      return false;
    }
  }
};

export default roundService;
