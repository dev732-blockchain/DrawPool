import dotenv from 'dotenv';
import path from 'path';

// Load env variables
dotenv.config();

const isTestnet = process.env.IS_TESTNET === 'true';

export const config = {
  IS_TESTNET: isTestnet,
  
  // Port
  PORT: parseInt(process.env.PORT || '3001', 10),

  // URLs
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',

  // RPC endpoints
  POLYGON_RPC_HTTP: process.env.POLYGON_RPC_HTTP || '',
  POLYGON_RPC_WS: process.env.POLYGON_RPC_WS || '',

  // Testnet Faucet wallet (Only used on testnet, never on mainnet)
  FAUCET_PRIVATE_KEY: process.env.FAUCET_PRIVATE_KEY || '',
  OWNER_ADDRESS: (process.env.OWNER_ADDRESS || '').toLowerCase(), // Cold wallet for admin auth

  // Token address
  USDT_ADDRESS: (process.env.USDT_ADDRESS || (isTestnet 
    ? '' // To be set via deploy or script on testnet
    : '0xc2132D05D31c914a87C6611C10748AEb04B58e8F'
  )).toLowerCase(),

  // Smart Contract Address
  DRAWPOOL_CONTRACT_ADDRESS: (process.env.DRAWPOOL_CONTRACT_ADDRESS || '').toLowerCase(),

  // Constants determined by IS_TESTNET
  MAX_ENTRIES: isTestnet ? 10 : 200,
  PRIZE_AMOUNT: isTestnet ? 5_000_000n : 100_000_000n, // $5 vs $100 in raw units (6 decimals)
  REVENUE_AMOUNT: isTestnet ? 5_000_000n : 100_000_000n, // platform revenue
  TICKET_PRICE: 1_000_000n, // $1 in raw units (6 decimals)
};

// Validate required env vars (skip validation during local test run if needed, but alert)
export function validateConfig() {
  const missing: string[] = [];

  if (!process.env.DATABASE_URL) missing.push('DATABASE_URL');
  if (!config.OWNER_ADDRESS) missing.push('OWNER_ADDRESS');
  if (!config.DRAWPOOL_CONTRACT_ADDRESS) missing.push('DRAWPOOL_CONTRACT_ADDRESS');

  // Skip RPC validation if we are just compiling or running tests, but log warnings
  if (!config.POLYGON_RPC_HTTP) missing.push('POLYGON_RPC_HTTP');

  if (missing.length > 0) {
    console.warn(`[Config Warning] Missing environment variables: ${missing.join(', ')}`);
  }
}
