import { FastifyInstance } from 'fastify';
import { verifyAdminAuth } from '../middleware/auth';
import roundService from '../services/roundService';
import prisma from '../db/client';
import { config } from '../config';

export default async function adminRoutes(fastify: FastifyInstance) {
  
  // Apply preHandler signature verification to all admin routes
  fastify.addHook('preHandler', verifyAdminAuth);

  // 1. POST /api/admin/kill
  fastify.post('/api/admin/kill', async (request, reply) => {
    try {
      await roundService.stopPlatform();
      return { message: 'Platform stopped. No new entries accepted.' };
    } catch (error: any) {
      console.error('[AdminRoute] Error executing kill switch:', error);
      return reply.status(500).send({ error: error.message });
    }
  });

  // 2. POST /api/admin/sync-round/:roundNumber
  fastify.post('/api/admin/sync-round/:roundNumber', async (request: any, reply) => {
    try {
      const roundNumber = parseInt(request.params.roundNumber, 10);
      if (isNaN(roundNumber)) {
        return reply.status(400).send({ error: 'Invalid round number' });
      }

      const success = await roundService.syncRoundStateFromContract(roundNumber);
      if (success) {
        return { success: true, message: `Round #${roundNumber} state successfully synchronized from smart contract.` };
      } else {
        return reply.status(500).send({ success: false, error: 'Round synchronization failed. Check server logs.' });
      }
    } catch (error: any) {
      console.error('[AdminRoute] Error syncing round:', error);
      return reply.status(500).send({ error: error.message });
    }
  });

  // 3. GET /api/admin/stats
  fastify.get('/api/admin/stats', async (request, reply) => {
    try {
      const completedCount = await prisma.round.count({
        where: { status: 'complete' }
      });

      const totalRounds = await prisma.round.count();
      
      // Calculate revenue and prize values
      const revenueUSD = (Number(config.REVENUE_AMOUNT) / 1_000_000) * completedCount;
      const prizeUSD = (Number(config.PRIZE_AMOUNT) / 1_000_000) * completedCount;

      let contractBalanceUSDT = '0.00';
      try {
        const rawBalance = await roundService.checkContractBalance();
        contractBalanceUSDT = (Number(rawBalance) / 1_000_000).toFixed(2);
      } catch (err) {
        console.error('[AdminRoute] Error getting contract balance for admin stats:', err);
        contractBalanceUSDT = 'Error checking balance';
      }

      const allRounds = await prisma.round.findMany({
        orderBy: { roundNumber: 'desc' }
      });

      return {
        platformActive: roundService.isPlatformActive(),
        totalCompletedRounds: completedCount,
        totalRoundsCount: totalRounds,
        totalRevenueUSD: revenueUSD,
        totalPrizePaidUSD: prizeUSD,
        hotWalletBalanceUSDT: contractBalanceUSDT, // Mapped for frontend compatibility
        rounds: allRounds
      };
    } catch (error: any) {
      console.error('[AdminRoute] Error getting admin stats:', error);
      return reply.status(500).send({ error: error.message });
    }
  });
}
