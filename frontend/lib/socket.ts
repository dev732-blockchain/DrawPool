import { io, Socket } from 'socket.io-client';

const getBackendWsUrl = (): string => {
  let wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';

  if (typeof window !== 'undefined') {
    const currentHostname = window.location.hostname;
    const currentProtocol = window.location.protocol;

    // 1. Resolve host
    if (currentHostname !== 'localhost' && currentHostname !== '127.0.0.1') {
      try {
        const urlObj = new URL(wsUrl);
        if (urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1') {
          urlObj.hostname = currentHostname;
          wsUrl = urlObj.toString().replace(/\/$/, '');
        }
      } catch (e) {
        if (wsUrl.includes('localhost')) {
          wsUrl = wsUrl.replace('localhost', currentHostname);
        } else if (wsUrl.includes('127.0.0.1')) {
          wsUrl = wsUrl.replace('127.0.0.1', currentHostname);
        }
      }
    }

    // 2. Upgrade protocol to wss if frontend is https
    if (currentProtocol === 'https:') {
      try {
        const urlObj = new URL(wsUrl);
        if (urlObj.protocol === 'ws:' || urlObj.protocol === 'http:') {
          urlObj.protocol = 'wss:';
          wsUrl = urlObj.toString().replace(/\/$/, '');
        }
      } catch (e) {
        if (wsUrl.startsWith('ws:')) {
          wsUrl = wsUrl.replace('ws:', 'wss:');
        } else if (wsUrl.startsWith('http:')) {
          wsUrl = wsUrl.replace('http:', 'wss:');
        }
      }
    }
  }

  return wsUrl;
};

export const getSocket = (): Socket => {
  const wsUrl = getBackendWsUrl();
  console.log('[Socket] Connecting to:', wsUrl);
  return io(wsUrl, {
    transports: ['websocket', 'polling'],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
  });
};

export default getSocket;
