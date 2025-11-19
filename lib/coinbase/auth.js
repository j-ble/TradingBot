/**
 * Coinbase Advanced Trade API Authentication
 * Handles JWT token generation for API requests
 */

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('coinbase-auth');

/**
 * Generate JWT token for Coinbase Advanced Trade API
 * @param {string} apiKey - Coinbase API key (organizations/.../apiKeys/...)
 * @param {string} apiSecret - EC private key (PEM format)
 * @param {string} requestMethod - HTTP method (GET, POST, etc.)
 * @param {string} requestPath - API path (e.g., /api/v3/brokerage/accounts)
 * @returns {string} - JWT token for Authorization header
 */
export function generateJWT(apiKey, apiSecret, requestMethod, requestPath) {
  try {
    // Extract key name from API key path
    // Format: organizations/{org_id}/apiKeys/{key_id}
    const keyName = apiKey;

    // Generate a unique request ID (nonce)
    const nonce = crypto.randomBytes(16).toString('hex');

    // Current timestamp
    const timestamp = Math.floor(Date.now() / 1000);

    // JWT payload
    const payload = {
      iss: 'coinbase-cloud',
      nbf: timestamp,
      exp: timestamp + 120, // Token valid for 2 minutes
      sub: keyName,
      uri: requestMethod + ' ' + requestPath
    };

    // Clean up the private key (handle escaped newlines from .env)
    let privateKey = apiSecret;
    if (privateKey.includes('\\n')) {
      privateKey = privateKey.replace(/\\n/g, '\n');
    }

    // Sign JWT with EC private key using ES256 algorithm
    const token = jwt.sign(payload, privateKey, {
      algorithm: 'ES256',
      header: {
        kid: keyName,
        nonce: nonce
      }
    });

    logger.debug('JWT generated', {
      method: requestMethod,
      path: requestPath,
      exp: new Date(payload.exp * 1000).toISOString()
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
 * @param {string} apiSecret - EC private key
 * @param {string} method - HTTP method
 * @param {string} path - API path
 * @returns {Object} - Headers object
 */
export function buildAuthHeaders(apiKey, apiSecret, method, path) {
  const jwt = generateJWT(apiKey, apiSecret, method, path);

  return {
    'Authorization': `Bearer ${jwt}`,
    'Content-Type': 'application/json'
  };
}

/**
 * Validate API credentials format
 * @param {string} apiKey - Coinbase API key
 * @param {string} apiSecret - EC private key
 * @throws {Error} - If credentials are invalid
 */
export function validateCredentials(apiKey, apiSecret) {
  if (!apiKey || typeof apiKey !== 'string') {
    throw new Error('Invalid API key: must be a non-empty string');
  }

  // Check API key format: organizations/{org_id}/apiKeys/{key_id}
  if (!apiKey.startsWith('organizations/') || !apiKey.includes('/apiKeys/')) {
    throw new Error('Invalid API key format: expected organizations/{org_id}/apiKeys/{key_id}');
  }

  if (!apiSecret || typeof apiSecret !== 'string') {
    throw new Error('Invalid API secret: must be a non-empty string');
  }

  // Check if private key looks valid (contains BEGIN EC PRIVATE KEY)
  const secretCheck = apiSecret.replace(/\\n/g, '\n');
  if (!secretCheck.includes('BEGIN EC PRIVATE KEY')) {
    throw new Error('Invalid API secret: expected EC PRIVATE KEY in PEM format');
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
