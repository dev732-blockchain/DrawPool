import { FastifyInstance } from 'fastify';
import prisma from '../db/client';
import roundService from '../services/roundService';

export default async function healthRoutes(fastify: FastifyInstance) {
  fastify.get('/api/health', async (request, reply) => {
    try {
      // Get contract balance
      let hotWalletBalance = '0.00 USDT';
      try {
        const rawBalance = await roundService.checkContractBalance();
        hotWalletBalance = `${(Number(rawBalance) / 1_000_000).toFixed(2)} USDT`;
      } catch (err) {
        console.error('[HealthRoute] Error getting contract balance:', err);
        hotWalletBalance = 'Error checking balance';
      }

      // Get current active round
      const activeRound = await prisma.round.findFirst({
        where: { status: { in: ['active', 'drawing', 'payout_failed'] } },
        select: { roundNumber: true }
      });

      return {
        status: 'ok',
        hotWalletBalance,
        currentRound: activeRound ? activeRound.roundNumber : null,
        timestamp: new Date().toISOString()
      };
    } catch (error: any) {
      console.error('[HealthRoute] Error executing health check:', error);
      return reply.status(500).send({ status: 'error', message: error.message });
    }
  });
}
