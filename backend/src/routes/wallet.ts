import { FastifyInstance } from 'fastify';
import prisma from '../db/client';
import { config } from '../config';

export default async function walletRoutes(fastify: FastifyInstance) {
  fastify.get('/api/wallet/:address', async (request: any, reply) => {
    try {
      const address = (request.params.address || '').toLowerCase();
      if (!address || !address.startsWith('0x')) {
        return reply.status(400).send({ error: 'Invalid wallet address format' });
      }

      // Fetch all entries purchased by this wallet
      const entries = await prisma.entry.findMany({
        where: { walletAddress: address },
        include: {
          round: true
        },
        orderBy: { createdAt: 'desc' }
      });

      // Group entries by round number
      const roundsMap = new Map<number, { roundNumber: number; entriesHeld: number; entriesList: any[]; roundStatus: string; winnerAddress: string | null; prizeHash: string | null; completedAt: Date | null }>();

      for (const entry of entries) {
        const r = entry.round;
        if (!roundsMap.has(r.roundNumber)) {
          roundsMap.set(r.roundNumber, {
            roundNumber: r.roundNumber,
            entriesHeld: 0,
            entriesList: [],
            roundStatus: r.status,
            winnerAddress: r.winnerAddress,
            prizeHash: r.prizeHash,
            completedAt: r.completedAt
          });
        }

        const group = roundsMap.get(r.roundNumber)!;
        group.entriesHeld++;
        group.entriesList.push({
          id: entry.id,
          entryNumber: entry.entryNumber,
          txHash: entry.txHash,
          amountPaid: entry.amountPaid,
          createdAt: entry.createdAt
        });
      }

      // Format outcomes
      const result = Array.from(roundsMap.values()).map(r => {
        let outcome = 'Did not win';

        if (r.roundStatus === 'active' || r.roundStatus === 'drawing') {
          outcome = 'Pending';
        } else if (r.roundStatus === 'payout_failed') {
          outcome = 'Payout Failed';
        } else if (r.roundStatus === 'stopped') {
          outcome = 'Stopped';
        } else if (r.roundStatus === 'complete') {
          if (r.winnerAddress?.toLowerCase() === address) {
            const prizeUSD = Number(config.PRIZE_AMOUNT) / 1_000_000;
            outcome = `Won $${prizeUSD}`;
          }
        }

        return {
          roundNumber: r.roundNumber,
          roundStatus: r.roundStatus,
          entriesHeld: r.entriesHeld,
          outcome,
          completedAt: r.completedAt,
          prizeHash: r.prizeHash,
          entries: r.entriesList
        };
      });

      return result;
    } catch (error: any) {
      console.error('[WalletRoute] Error getting wallet history:', error);
      return reply.status(500).send({ error: error.message });
    }
  });
}
