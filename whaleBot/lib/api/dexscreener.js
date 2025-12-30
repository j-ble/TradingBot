import axios from 'axios';
import chalk from 'chalk';
import { sleep } from '../utils.js';

// ==================== DEXSCREENER API CLIENT ====================

export class DexScreenerAPI {
  constructor() {
    this.baseURL = 'https://api.dexscreener.com/latest';
  }

  async getTokenPairs(chainId, tokenAddress) {
    try {
      const response = await axios.get(
        `${this.baseURL}/dex/tokens/${chainId}/${tokenAddress}`
      );
      return response.data;
    } catch (error) {
      if (error.response?.status === 429) {
        console.log(chalk.yellow('⚠️  Rate limited by DexScreener - waiting 20s...'));
        await sleep(20000);
        return null;
      }
      return null;
    }
  }

  async searchToken(query) {
    try {
      const response = await axios.get(
        `${this.baseURL}/dex/search`,
        { params: { q: query } }
      );
      return response.data;
    } catch (error) {
      return null;
    }
  }
}
