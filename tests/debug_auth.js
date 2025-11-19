/**
 * Debug Authentication
 * Test JWT generation and authentication flow
 */

import dotenv from 'dotenv';
import { generateJWT, validateCredentials } from '../lib/coinbase/auth.js';
import { createLogger } from '../lib/utils/logger.js';
import jwt from 'jsonwebtoken';

dotenv.config();

const logger = createLogger('auth-debug');

async function debugAuth() {
  logger.info('=== Debugging Coinbase Authentication ===\n');

  // Get credentials
  const apiKey = process.env.COINBASE_API_KEY;
  const apiSecret = process.env.COINBASE_API_SECRET;

  logger.info('1. Checking credentials format...');
  logger.info(`API Key: ${apiKey?.substring(0, 50)}...`);
  logger.info(`API Secret length: ${apiSecret?.length} characters`);
  logger.info(`API Secret starts with: ${apiSecret?.substring(0, 30)}...`);

  // Validate credentials
  try {
    validateCredentials(apiKey, apiSecret);
    logger.info('✓ Credentials format valid\n');
  } catch (error) {
    logger.error('✗ Credentials validation failed:', error.message);
    return;
  }

  // Generate JWT
  logger.info('2. Generating JWT token...');
  try {
    const requestMethod = 'GET';
    const requestPath = '/api/v3/brokerage/accounts';

    const token = generateJWT(apiKey, apiSecret, requestMethod, requestPath);
    logger.info('✓ JWT generated successfully');
    logger.info(`Token length: ${token.length} characters`);
    logger.info(`Token preview: ${token.substring(0, 100)}...\n`);

    // Decode JWT (without verification)
    logger.info('3. Decoding JWT token...');
    const decoded = jwt.decode(token, { complete: true });
    logger.info('JWT Header:', JSON.stringify(decoded.header, null, 2));
    logger.info('JWT Payload:', JSON.stringify(decoded.payload, null, 2));

  } catch (error) {
    logger.error('✗ JWT generation failed:', error.message);
    logger.error('Stack:', error.stack);
  }
}

debugAuth();
