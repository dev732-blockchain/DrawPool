import { FastifyInstance } from 'fastify';
import prisma from '../db/client';
import { config } from '../config';

export default async function roundRoutes(fastify: FastifyInstance) {
  
  // 1. GET /api/rounds/active
  fastify.get('/api/rounds/active', async (request, reply) => {
    try {
      const activeRound = await prisma.round.findFirst({
        where: {
          status: { in: ['active', 'drawing', 'payout_failed', 'stopped'] }
        }
      });

      if (!activeRound) {
        return reply.status(404).send({ error: 'No active round found' });
      }

      const entriesRemaining = Math.max(0, config.MAX_ENTRIES - activeRound.entriesSold);

      return {
        roundNumber: activeRound.roundNumber,
        entriesSold: activeRound.entriesSold,
        entriesRemaining,
        status: activeRound.status
      };
    } catch (error: any) {
      console.error('[RoundsRoute] Error getting active round:', error);
      return reply.status(500).send({ error: error.message });
    }
  });

  // 2. GET /api/rounds
  fastify.get('/api/rounds', async (request: any, reply) => {
    try {
      const page = parseInt(request.query.page || '1', 10);
      const limit = parseInt(request.query.limit || '20', 10);
      const skip = (page - 1) * limit;

      const [rounds, total] = await prisma.$transaction([
        prisma.round.findMany({
          where: { status: 'complete' },
          orderBy: { roundNumber: 'desc' },
          skip,
          take: limit
        }),
        prisma.round.count({
          where: { status: 'complete' }
        })
      ]);

      return {
        rounds,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error: any) {
      console.error('[RoundsRoute] Error getting rounds list:', error);
      return reply.status(500).send({ error: error.message });
    }
  });

  // 3. GET /api/rounds/:number
  fastify.get('/api/rounds/:number', async (request: any, reply) => {
    try {
      const roundNumber = parseInt(request.params.number, 10);
      if (isNaN(roundNumber)) {
        return reply.status(400).send({ error: 'Invalid round number parameter' });
      }

      const round = await prisma.round.findUnique({
        where: { roundNumber }
      });

      if (!round) {
        return reply.status(404).send({ error: `Round #${roundNumber} not found` });
      }

      // SECURITY: Mask the seed unless the round is complete
      if (round.status !== 'complete') {
        round.seed = null;
      }

      return round;
    } catch (error: any) {
      console.error(`[RoundsRoute] Error getting round #${request.params.number}:`, error);
      return reply.status(500).send({ error: error.message });
    }
  });

  // 4. GET /api/rounds/:number/entries
  fastify.get('/api/rounds/:number/entries', async (request: any, reply) => {
    try {
      const roundNumber = parseInt(request.params.number, 10);
      if (isNaN(roundNumber)) {
        return reply.status(400).send({ error: 'Invalid round number parameter' });
      }

      const page = parseInt(request.query.page || '1', 10);
      const limit = parseInt(request.query.limit || '100', 10);
      const skip = (page - 1) * limit;

      const [entries, total] = await prisma.$transaction([
        prisma.entry.findMany({
          where: { roundNumber },
          orderBy: { entryNumber: 'asc' },
          skip,
          take: limit
        }),
        prisma.entry.count({
          where: { roundNumber }
        })
      ]);

      return {
        entries,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error: any) {
      console.error(`[RoundsRoute] Error getting entries for round #${request.params.number}:`, error);
      return reply.status(500).send({ error: error.message });
    }
  });

  // 5. GET /api/stats
  fastify.get('/api/stats', async (request, reply) => {
    try {
      const totalRounds = await prisma.round.count({
        where: { status: 'complete' }
      });

      const totalEntriesEver = await prisma.entry.count();

      const activeRound = await prisma.round.findFirst({
        where: { status: { in: ['active', 'drawing', 'payout_failed', 'stopped'] } },
        select: { roundNumber: true }
      });

      const prizeMultiplier = Number(config.PRIZE_AMOUNT) / 1_000_000;
      const totalPrizePaid = totalRounds * prizeMultiplier;

      return {
        totalRounds,
        totalEntriesEver,
        totalPrizePaid,
        currentRound: activeRound ? activeRound.roundNumber : null
      };
    } catch (error: any) {
      console.error('[RoundsRoute] Error calculating stats:', error);
      return reply.status(500).send({ error: error.message });
    }
  });
}
