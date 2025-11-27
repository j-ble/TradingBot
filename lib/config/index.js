/**
 * Configuration Loader
 * Loads and validates environment variables on startup
 */

import dotenv from 'dotenv';
import { configSchema } from './schema.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('config');

// Load .env file
dotenv.config();

/**
 * Load and validate configuration
 * Fails fast if validation fails
 */
function loadConfig() {
  const result = configSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.issues.map((issue) => {
      return `  - ${issue.path.join('.')}: ${issue.message}`;
    });

    console.error('\n=== CONFIGURATION ERROR ===');
    console.error('Invalid environment variables:\n');
    console.error(errors.join('\n'));
    console.error('\nPlease check your .env file and fix the above errors.');
    console.error('===========================\n');

    process.exit(1);
  }

  logger.info('Configuration loaded successfully');
  return result.data;
}

// Load config on module import
const config = loadConfig();

/**
 * Get database connection config
 */
export function getDatabaseConfig() {
  return {
    host: config.DB_HOST,
    port: config.DB_PORT,
    database: config.DB_NAME,
    user: config.DB_USER,
    password: config.DB_PASSWORD,
  };
}

/**
 * Get Coinbase API credentials
 */
export function getCoinbaseConfig() {
  return {
    apiKey: config.COINBASE_API_KEY,
    apiSecret: config.COINBASE_API_SECRET,
  };
}

/**
 * Get trading configuration
 */
export function getTradingConfig() {
  return {
    paperMode: config.PAPER_TRADING_MODE,
    accountBalance: config.ACCOUNT_BALANCE,
    leverage: config.LEVERAGE,
    riskPerTrade: config.RISK_PER_TRADE,
    emergencyStop: config.EMERGENCY_STOP,
  };
}

/**
 * Get AI configuration
 */
export function getAIConfig() {
  return {
    host: config.OLLAMA_HOST,
    model: config.OLLAMA_MODEL,
  };
}

/**
 * Get system configuration
 */
export function getSystemConfig() {
  return {
    logLevel: config.LOG_LEVEL,
  };
}

/**
 * Get Telegram configuration (optional)
 */
export function getTelegramConfig() {
  if (!config.TELEGRAM_ENABLED || !config.TELEGRAM_BOT_TOKEN || !config.TELEGRAM_CHAT_ID) {
    return null;
  }
  return {
    enabled: config.TELEGRAM_ENABLED,
    botToken: config.TELEGRAM_BOT_TOKEN,
    chatId: config.TELEGRAM_CHAT_ID,
  };
}

/**
 * Check if paper trading mode is enabled
 */
export function isPaperTrading() {
  return config.PAPER_TRADING_MODE;
}

/**
 * Check if emergency stop is active
 */
export function isEmergencyStop() {
  return config.EMERGENCY_STOP;
}

// Export full config for direct access
export default config;
