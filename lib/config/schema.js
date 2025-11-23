/**
 * Environment Configuration Schema
 * Zod validation for all environment variables
 */

import { z } from 'zod';

// Custom coercion for boolean strings
const booleanString = z
  .string()
  .transform((val) => val.toLowerCase() === 'true')
  .pipe(z.boolean());

// Log level enum
const logLevelEnum = z.enum(['debug', 'info', 'warn', 'error']);

/**
 * Configuration Schema
 */
export const configSchema = z.object({
  // Database
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.coerce.number().int().positive().default(5432),
  DB_NAME: z.string().min(1, 'DB_NAME is required'),
  DB_USER: z.string().min(1, 'DB_USER is required'),
  DB_PASSWORD: z.string().min(1, 'DB_PASSWORD is required'),

  // Coinbase API
  COINBASE_API_KEY: z.string().min(1, 'COINBASE_API_KEY is required'),
  COINBASE_API_SECRET: z.string().min(1, 'COINBASE_API_SECRET is required'),

  // Trading
  PAPER_TRADING_MODE: booleanString.default('true'),
  ACCOUNT_BALANCE: z.coerce.number().positive().default(10000),
  LEVERAGE: z.coerce.number().int().min(2).max(5).default(3),
  RISK_PER_TRADE: z.coerce.number().min(0.001).max(0.1).default(0.01),

  // AI
  OLLAMA_HOST: z.string().url().default('http://localhost:11434'),
  OLLAMA_MODEL: z.string().default('gpt-oss:20b'),

  // System
  LOG_LEVEL: logLevelEnum.default('info'),
  EMERGENCY_STOP: booleanString.default('false'),

  // Optional - Telegram notifications
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHAT_ID: z.string().optional(),
});

/**
 * Type inference for config
 */
export const ConfigType = configSchema;
