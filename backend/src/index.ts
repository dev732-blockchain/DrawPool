import fastify from 'fastify';
import cors from '@fastify/cors';
import { config, validateConfig } from './config';
import socketService from './services/socketService';
import roundService from './services/roundService';
import contractListener from './services/contractListener';

// Import routes
import healthRoutes from './routes/health';
import roundRoutes from './routes/rounds';
import walletRoutes from './routes/wallet';
import adminRoutes from './routes/admin';
import testnetRoutes from './routes/testnet';

const app = fastify({ logger: true });

// 1. Capture raw body for Alchemy webhook HMAC signature verification
app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
  try {
    (req as any).rawBody = body; // Attach raw string body to request object
    const json = JSON.parse(body as string);
    done(null, json);
  } catch (err: any) {
    err.statusCode = 400;
    done(err, null);
  }
});

// 2. Setup CORS (supports local network testing, ngrok, and FRONTEND_URL)
app.register(cors, {
  origin: (origin, cb) => {
    // Allow if no origin (e.g. server-to-server or backend health checks)
    if (!origin) {
      cb(null, true);
      return;
    }

    // Normalize and strip trailing slashes for robust matching
    const cleanOrigin = origin.replace(/\/$/, '');
    const cleanFrontendUrl = config.FRONTEND_URL.replace(/\/$/, '');

    // Always allow the configured FRONTEND_URL or wildcard
    if (cleanFrontendUrl === '*' || cleanOrigin === cleanFrontendUrl) {
      cb(null, true);
      return;
    }

    try {
      const url = new URL(origin);
      const hostname = url.hostname;

      // Allow localhost and loopback
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        cb(null, true);
        return;
      }

      // Allow private local network IP ranges:
      // - 192.168.x.x
      // - 10.x.x.x
      // - 172.16.x.x to 172.31.x.x
      const isLocalIp = 
        /^192\.168\./.test(hostname) ||
        /^10\./.test(hostname) ||
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname);

      if (isLocalIp) {
        cb(null, true);
        return;
      }

      // Allow ngrok tunnels for testing
      if (hostname.endsWith('.ngrok-free.app') || hostname.endsWith('.ngrok.io')) {
        cb(null, true);
        return;
      }

      // Allow Vercel deployments automatically to prevent configuration mismatch errors
      if (hostname.endsWith('.vercel.app')) {
        cb(null, true);
        return;
      }
    } catch (err) {
      console.error('[CORS] Origin parsing error:', err);
    }

    // In testnet/dev mode, allow fallback for easier debugging, otherwise reject
    if (config.IS_TESTNET) {
      cb(null, true);
    } else {
      cb(new Error('Not allowed by CORS'), false);
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-signature', 'x-admin-address', 'x-admin-timestamp'],
  credentials: true
});

// 3. Simple In-Memory Rate Limiter (100 req/min per IP on public endpoints)
const ipRequests = new Map<string, { count: number; resetTime: number }>();
app.addHook('onRequest', async (request, reply) => {
  // Skip rate limiting for admin and webhooks (signature verification handles security)
  if (request.url.startsWith('/api/admin') || request.url.startsWith('/webhook')) {
    return;
  }

  const ip = request.ip;
  const now = Date.now();
  const limit = 100;
  const windowMs = 60 * 1000; // 1 minute

  let ipData = ipRequests.get(ip);
  if (!ipData || now > ipData.resetTime) {
    ipData = { count: 0, resetTime: now + windowMs };
  }

  ipData.count++;
  ipRequests.set(ip, ipData);

  if (ipData.count > limit) {
    return reply.status(429).send({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Max 100 requests per minute.'
    });
  }
});

// Register routes
app.register(healthRoutes);
app.register(roundRoutes);
app.register(walletRoutes);
app.register(adminRoutes);
app.register(testnetRoutes);

// Server startup
async function start() {
  try {
    validateConfig();

    // Start Fastify server listening on all network interfaces
    const address = await app.listen({
      port: config.PORT,
      host: '0.0.0.0'
    });
    console.log(`[Fastify] Server listening on ${address}`);

    // Initialize Socket.io using Fastify's raw http server
    socketService.init(app.server);

    // Initialize/resume active round
    await roundService.initActiveRound();

    // Start listening to smart contract events
    contractListener.startListening();

    if (config.IS_TESTNET) {
      console.warn('=== TESTNET MODE === Connected to Polygon Amoy. DO NOT use real funds.');
    }
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
