import axios from 'axios';
import chalk from 'chalk';
import { sleep } from '../utils.js';

// ==================== HELIUS API CLIENT ====================

export class HeliusAPI {
  constructor() {
    this.apiKey = process.env.HELIUS_API_KEY;
    this.rpcURL = `https://mainnet.helius-rpc.com/?api-key=${this.apiKey}`;
  }

  async getWalletTransactions(walletAddress, limit = 10) {
    try {
      if (!this.apiKey) {
        console.log(chalk.yellow('⚠️  Helius API key required'));
        return [];
      }

      // Use Helius enhanced transactions API with 'confirmed' commitment for faster updates
      const response = await axios.post(this.rpcURL, {
        jsonrpc: '2.0',
        id: 'whale-tracker',
        method: 'getSignaturesForAddress',
        params: [
          walletAddress,
          {
            limit: limit,
            commitment: 'confirmed'  // Get confirmed transactions (faster than finalized)
          }
        ]
      });

      if (response.data && response.data.result) {
        return response.data.result;
      }

      return [];
    } catch (error) {
      if (error.response?.status === 429) {
        console.log(chalk.yellow('⚠️  Rate limited by Helius - waiting 60s...'));
        await sleep(60000);
        return [];
      }
      console.log(chalk.dim(`  Error fetching transactions: ${error.message}`));
      return [];
    }
  }

  async getTransactionDetails(signature) {
    try {
      if (!this.apiKey) {
        return null;
      }

      // Use Helius enhanced transaction API for parsed data with confirmed commitment
      const response = await axios.post(this.rpcURL, {
        jsonrpc: '2.0',
        id: 'whale-tracker',
        method: 'getTransaction',
        params: [
          signature,
          {
            encoding: 'jsonParsed',
            maxSupportedTransactionVersion: 0,
            commitment: 'confirmed'  // Match commitment level with getSignaturesForAddress
          }
        ]
      });

      if (response.data && response.data.result) {
        return response.data.result;
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  async getTokenAccountInfo(walletAddress) {
    try {
      if (!this.apiKey) {
        return [];
      }

      const response = await axios.post(this.rpcURL, {
        jsonrpc: '2.0',
        id: 'whale-tracker',
        method: 'getTokenAccountsByOwner',
        params: [
          walletAddress,
          {
            programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
          },
          {
            encoding: 'jsonParsed'
          }
        ]
      });

      if (response.data && response.data.result && response.data.result.value) {
        return response.data.result.value;
      }

      return [];
    } catch (error) {
      return [];
    }
  }
}
