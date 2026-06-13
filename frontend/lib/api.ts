const getBackendUrl = (): string => {
  let backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
  
  if (typeof window !== 'undefined') {
    const currentHostname = window.location.hostname;
    const currentProtocol = window.location.protocol; // 'http:' or 'https:'

    // 1. Resolve host if accessed via LAN IP or tunnel, and backend is configured to localhost
    if (currentHostname !== 'localhost' && currentHostname !== '127.0.0.1') {
      try {
        const urlObj = new URL(backendUrl);
        if (urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1') {
          urlObj.hostname = currentHostname;
          backendUrl = urlObj.toString().replace(/\/$/, '');
        }
      } catch (e) {
        if (backendUrl.includes('localhost')) {
          backendUrl = backendUrl.replace('localhost', currentHostname);
        } else if (backendUrl.includes('127.0.0.1')) {
          backendUrl = backendUrl.replace('127.0.0.1', currentHostname);
        }
      }
    }

    // 2. Upgrade protocol to HTTPS if the frontend is loaded over HTTPS to prevent Mixed Content blocking
    if (currentProtocol === 'https:') {
      try {
        const urlObj = new URL(backendUrl);
        if (urlObj.protocol === 'http:') {
          urlObj.protocol = 'https:';
          backendUrl = urlObj.toString().replace(/\/$/, '');
        }
      } catch (e) {
        if (backendUrl.startsWith('http:')) {
          backendUrl = backendUrl.replace('http:', 'https:');
        }
      }
    }
  }

  return backendUrl;
};

// Helper for general JSON fetches
async function fetchJson(endpoint: string, options?: RequestInit) {
  const url = `${getBackendUrl()}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

export const api = {
  // Public endpoints
  async getActiveRound() {
    return fetchJson('/api/rounds/active');
  },

  async getRoundsHistory(page = 1, limit = 20) {
    return fetchJson(`/api/rounds?page=${page}&limit=${limit}`);
  },

  async getRoundDetails(roundNumber: number) {
    return fetchJson(`/api/rounds/${roundNumber}`);
  },

  async getRoundEntries(roundNumber: number, page = 1, limit = 100) {
    return fetchJson(`/api/rounds/${roundNumber}/entries?page=${page}&limit=${limit}`);
  },

  async getWalletHistory(address: string) {
    return fetchJson(`/api/wallet/${address}`);
  },

  async getStats() {
    return fetchJson('/api/stats');
  },

  async getHealth() {
    return fetchJson('/api/health');
  },

  async mintTestUSDT(address: string) {
    return fetchJson(`/api/testnet/mint-usdt/${address}`);
  },

  // Admin endpoints (require auth headers)
  async stopPlatform(auth: { signature: string; address: string; timestamp: number }) {
    return fetchJson('/api/admin/kill', {
      method: 'POST',
      headers: {
        'x-admin-signature': auth.signature,
        'x-admin-address': auth.address,
        'x-admin-timestamp': auth.timestamp.toString(),
      },
    });
  },

  async syncRound(roundNumber: number, auth: { signature: string; address: string; timestamp: number }) {
    return fetchJson(`/api/admin/sync-round/${roundNumber}`, {
      method: 'POST',
      headers: {
        'x-admin-signature': auth.signature,
        'x-admin-address': auth.address,
        'x-admin-timestamp': auth.timestamp.toString(),
      },
    });
  },

  async getAdminStats(auth: { signature: string; address: string; timestamp: number }) {
    return fetchJson('/api/admin/stats', {
      method: 'GET',
      headers: {
        'x-admin-signature': auth.signature,
        'x-admin-address': auth.address,
        'x-admin-timestamp': auth.timestamp.toString(),
      },
    });
  },
};

export default api;
