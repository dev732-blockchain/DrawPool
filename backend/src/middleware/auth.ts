import { FastifyRequest, FastifyReply } from 'fastify';
import { ethers } from 'ethers';
import { config } from '../config';

/**
 * Fastify preHandler hook to verify that the request is signed by the OWNER_ADDRESS.
 * Expects the following headers:
 * - x-admin-address: Cold wallet public address
 * - x-admin-signature: ECDSA signature of "DrawPool Admin Auth at <timestamp>"
 * - x-admin-timestamp: The millisecond timestamp matching the signed message
 */
export async function verifyAdminAuth(request: FastifyRequest, reply: FastifyReply) {
  const address = request.headers['x-admin-address'] as string;
  const signature = request.headers['x-admin-signature'] as string;
  const timestampStr = request.headers['x-admin-timestamp'] as string;

  if (!address || !signature || !timestampStr) {
    return reply.status(401).send({ error: 'Unauthorized: Missing admin authentication headers' });
  }

  if (address.toLowerCase() !== config.OWNER_ADDRESS.toLowerCase()) {
    return reply.status(403).send({ error: 'Forbidden: Wallet address is not authorized as owner' });
  }

  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp)) {
    return reply.status(400).send({ error: 'Bad Request: Invalid timestamp' });
  }

  // Prevent replay attacks (allow 5-minute clock drift window)
  const timeDiff = Math.abs(Date.now() - timestamp);
  if (timeDiff > 5 * 60 * 1000) {
    return reply.status(401).send({ error: 'Unauthorized: Authentication signature expired' });
  }

  try {
    const message = `DrawPool Admin Auth at ${timestamp}`;
    const recoveredAddress = ethers.verifyMessage(message, signature);
    
    if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
      return reply.status(401).send({ error: 'Unauthorized: Signature verification failed' });
    }
  } catch (error) {
    console.error('[AuthMiddleware] Verification error:', error);
    return reply.status(401).send({ error: 'Unauthorized: Invalid signature format' });
  }
}
