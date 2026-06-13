import { FastifyInstance } from 'fastify';
import { ethers } from 'ethers';
import { config } from '../config';

const MINT_ABI = [
  'function mint(address to, uint256 amount) returns (bool)'
];

export default async function testnetRoutes(fastify: FastifyInstance) {
  fastify.get('/api/testnet/mint-usdt/:address', async (request: any, reply) => {
    // 1. Ensure we are in testnet mode
    if (!config.IS_TESTNET) {
      return reply.status(403).send({ error: 'Forbidden: Testnet endpoints are disabled on mainnet.' });
    }

    const address = (request.params.address || '').toLowerCase();
    if (!address || !address.startsWith('0x')) {
      return reply.status(400).send({ error: 'Invalid wallet address format' });
    }

    console.log(`[Testnet Faucet] Request to mint 100 MockUSDT to ${address}`);

    // 2. If mock payout is enabled, simulate success
    if (process.env.MOCK_PAYOUT === 'true') {
      console.log(`[MOCK FAUCET] Simulated minting 100 MockUSDT to ${address}`);
      return { success: true, message: `Mocked 100 USDT successfully minted to ${address}`, txHash: '0xmockminthash' };
    }

    // 3. Otherwise, execute on-chain mint transaction
    try {
      if (!config.POLYGON_RPC_HTTP || !config.FAUCET_PRIVATE_KEY || !config.USDT_ADDRESS) {
        throw new Error('RPC, private key, or USDT address configuration is missing.');
      }

      const provider = new ethers.JsonRpcProvider(config.POLYGON_RPC_HTTP);
      const signer = new ethers.Wallet(config.FAUCET_PRIVATE_KEY, provider);
      const contract = new ethers.Contract(config.USDT_ADDRESS, MINT_ABI, signer);

      // Mint 100 USDT = 100 * 1,000,000 micro-units
      const amountToMint = 100_000_000n;
      console.log(`[Testnet Faucet] Sending mint tx for 100 USDT to ${address}...`);
      const tx = await contract.mint(address, amountToMint);
      
      console.log(`[Testnet Faucet] Tx submitted: ${tx.hash}. Waiting for confirmation...`);
      await tx.wait(1);

      console.log(`[Testnet Faucet] 100 MockUSDT successfully minted to ${address}`);
      return {
        success: true,
        message: '100 Test USDT minted successfully to your wallet.',
        txHash: tx.hash
      };
    } catch (error: any) {
      console.error('[Testnet Faucet Error] Failed to mint USDT:', error);
      return reply.status(500).send({ error: error.message });
    }
  });
}
