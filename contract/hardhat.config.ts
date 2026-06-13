import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const privateKey = process.env.PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000000";
const amoyRpcUrl = process.env.AMOY_RPC_URL || "https://polygon-amoy.g.alchemy.com/v2/your-key";
const polygonRpcUrl = process.env.POLYGON_RPC_URL || "https://polygon.publicnode.com";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    hardhat: {
      // default local network for unit tests
    },
    amoy: {
      url: amoyRpcUrl,
      chainId: 80002,
      accounts: privateKey.startsWith("0x") ? [privateKey] : [`0x${privateKey}`],
      gasPrice: 30000000000 // 30 Gwei
    },
    polygon: {
      url: polygonRpcUrl,
      chainId: 137,
      accounts: privateKey.startsWith("0x") ? [privateKey] : [`0x${privateKey}`],
    }
  }
};

export default config;
