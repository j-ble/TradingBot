/**
 * Coinbase Advanced Trade API Authentication
 * Handles JWT token generation for API requests using Ed25519 keys
 */

import { generateJwt } from '@coinbase/cdp-sdk/auth';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('coinbase-auth');

/**
 * Generate JWT token for Coinbase Advanced Trade API
 * Uses Ed25519 signing via CDP SDK
 * @param {string} apiKey - Coinbase API key (organizations/.../apiKeys/...)
 * @param {string} apiSecret - Ed25519 private key
 * @param {string} requestMethod - HTTP method (GET, POST, etc.)
 * @param {string} requestPath - API path (e.g., /api/v3/brokerage/accounts)
 * @returns {Promise<string>} - JWT token for Authorization header
 */
export async function generateJWT(apiKey, apiSecret, requestMethod, requestPath) {
  try {
    // Clean up the private key (handle escaped newlines from .env)
    let privateKey = apiSecret;
    if (privateKey.includes('\\n')) {
      privateKey = privateKey.replace(/\\n/g, '\n');
    }

    // Generate JWT using CDP SDK (supports Ed25519)
    const token = await generateJwt({
      apiKeyId: apiKey,
      apiKeySecret: privateKey,
      requestMethod: requestMethod,
      requestHost: 'api.coinbase.com',
      requestPath: requestPath,
      expiresIn: 120 // 2 minutes
    });

    logger.debug('JWT generated', {
      method: requestMethod,
      path: requestPath
    });

    return token;
  } catch (error) {
    logger.error('Failed to generate JWT', {
      error: error.message,
      method: requestMethod,
      path: requestPath
    });
    throw new Error(`JWT generation failed: ${error.message}`);
  }
}

/**
 * Build authorization headers for Coinbase API request
 * @param {string} apiKey - Coinbase API key
 * @param {string} apiSecret - Ed25519 private key
 * @param {string} method - HTTP method
 * @param {string} path - API path
 * @returns {Promise<Object>} - Headers object
 */
export async function buildAuthHeaders(apiKey, apiSecret, method, path) {
  const jwt = await generateJWT(apiKey, apiSecret, method, path);

  return {
    'Authorization': `Bearer ${jwt}`,
    'Content-Type': 'application/json'
  };
}

/**
 * Validate API credentials format
 * @param {string} apiKey - Coinbase API key
 * @param {string} apiSecret - Ed25519 private key (base64 encoded)
 * @throws {Error} - If credentials are invalid
 */
export function validateCredentials(apiKey, apiSecret) {
  if (!apiKey || typeof apiKey !== 'string') {
    throw new Error('Invalid API key: must be a non-empty string');
  }

  // Check API key format: organizations/{org_id}/apiKeys/{key_id} or UUID format
  const isOrgFormat = apiKey.startsWith('organizations/') && apiKey.includes('/apiKeys/');
  const isUUIDFormat = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(apiKey);

  if (!isOrgFormat && !isUUIDFormat) {
    throw new Error('Invalid API key format: expected organizations/{org_id}/apiKeys/{key_id} or UUID format');
  }

  if (!apiSecret || typeof apiSecret !== 'string') {
    throw new Error('Invalid API secret: must be a non-empty string');
  }

  // Check if private key looks valid
  // Ed25519 keys are base64 encoded (no PEM header) or PEM format
  const secretCheck = apiSecret.replace(/\\n/g, '\n').trim();
  const isBase64 = /^[A-Za-z0-9+/=\s]+$/.test(secretCheck);
  const isPEM = secretCheck.includes('BEGIN') && secretCheck.includes('PRIVATE KEY');

  if (!isBase64 && !isPEM) {
    throw new Error('Invalid API secret: expected base64-encoded Ed25519 key or PEM format');
  }

  logger.info('API credentials validated successfully');
}

/**
 * Extract key ID from API key
 * @param {string} apiKey - Full API key path
 * @returns {string} - Key ID
 */
export function extractKeyId(apiKey) {
  // Format: organizations/{org_id}/apiKeys/{key_id}
  const parts = apiKey.split('/');
  if (parts.length !== 4) {
    throw new Error('Invalid API key format');
  }
  return parts[3];
}

/**
 * Extract organization ID from API key
 * @param {string} apiKey - Full API key path
 * @returns {string} - Organization ID
 */
export function extractOrgId(apiKey) {
  // Format: organizations/{org_id}/apiKeys/{key_id}
  const parts = apiKey.split('/');
  if (parts.length !== 4) {
    throw new Error('Invalid API key format');
  }
  return parts[1];
}

export default {
  generateJWT,
  buildAuthHeaders,
  validateCredentials,
  extractKeyId,
  extractOrgId
};
