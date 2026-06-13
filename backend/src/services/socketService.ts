import { Server as SocketIOServer } from 'socket.io';
import { config } from '../config';

let io: SocketIOServer | null = null;

export const socketService = {
  /**
   * Initializes Socket.io using the HTTP server underlying the Fastify instance.
   */
  init(httpServer: any) {
    io = new SocketIOServer(httpServer, {
      cors: {
        origin: (origin, cb) => {
          if (!origin) {
            cb(null, true);
            return;
          }

          if (config.FRONTEND_URL === '*' || origin === config.FRONTEND_URL) {
            cb(null, true);
            return;
          }

          try {
            const url = new URL(origin);
            const hostname = url.hostname;

            if (hostname === 'localhost' || hostname === '127.0.0.1') {
              cb(null, true);
              return;
            }

            const isLocalIp = 
              /^192\.168\./.test(hostname) ||
              /^10\./.test(hostname) ||
              /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname);

            if (isLocalIp) {
              cb(null, true);
              return;
            }

            if (hostname.endsWith('.ngrok-free.app') || hostname.endsWith('.ngrok.io')) {
              cb(null, true);
              return;
            }
          } catch (err) {
            console.error('[Socket CORS] Origin parsing error:', err);
          }

          if (config.IS_TESTNET) {
            cb(null, true);
          } else {
            cb(new Error('Not allowed by CORS'), false);
          }
        },
        methods: ['GET', 'POST'],
        credentials: true
      }
    });

    io.on('connection', (socket) => {
      console.log(`[Socket] Client connected: ${socket.id}`);
      
      socket.on('disconnect', () => {
        console.log(`[Socket] Client disconnected: ${socket.id}`);
      });
    });

    console.log(`[Socket] Socket.io server initialized with dynamic CORS rules`);
  },

  /**
   * General broadcast helper
   */
  broadcast(event: string, payload: any) {
    if (!io) {
      console.warn(`[Socket Warning] Attempted to broadcast "${event}" but Socket.io is not initialized`);
      return;
    }
    io.emit(event, payload);
    console.log(`[Socket Broadcast] Event: ${event}`, payload);
  },

  /**
   * Broadcast when entries are sold
   */
  broadcastEntrySold(roundNumber: number, entriesSold: number, buyer: string) {
    this.broadcast('entry:sold', { roundNumber, entriesSold, buyer });
  },

  /**
   * Broadcast when round is in drawing state
   */
  broadcastRoundDrawing(roundNumber: number) {
    this.broadcast('round:drawing', { roundNumber });
  },

  /**
   * Broadcast when round completes
   */
  broadcastRoundComplete(roundNumber: number, winner: string, winnerEntry: number, seed: string, prizeHash: string) {
    this.broadcast('round:complete', { roundNumber, winner, winnerEntry, seed, prizeHash });
  },

  /**
   * Broadcast when a new round is spawned
   */
  broadcastRoundNew(roundNumber: number) {
    this.broadcast('round:new', { roundNumber });
  },

  /**
   * Broadcast when the platform is killed/stopped
   */
  broadcastPlatformStopped(message: string) {
    this.broadcast('platform:stopped', { message });
  }
};

export default socketService;
