/**
 * Coinbase API Error Classes
 * Custom error types for better error handling and debugging
 */

/**
 * Base Coinbase API Error
 */
export class CoinbaseError extends Error {
  constructor(message, statusCode = null, response = null) {
    super(message);
    this.name = 'CoinbaseError';
    this.statusCode = statusCode;
    this.response = response;
    this.timestamp = new Date().toISOString();
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Authentication Error (401)
 */
export class AuthenticationError extends CoinbaseError {
  constructor(message = 'Authentication failed', response = null) {
    super(message, 401, response);
    this.name = 'AuthenticationError';
  }
}

/**
 * Rate Limit Error (429)
 */
export class RateLimitError extends CoinbaseError {
  constructor(message = 'Rate limit exceeded', retryAfter = null, response = null) {
    super(message, 429, response);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter; // Seconds until retry is allowed
  }
}

/**
 * Invalid Request Error (400)
 */
export class InvalidRequestError extends CoinbaseError {
  constructor(message = 'Invalid request parameters', response = null) {
    super(message, 400, response);
    this.name = 'InvalidRequestError';
  }
}

/**
 * Not Found Error (404)
 */
export class NotFoundError extends CoinbaseError {
  constructor(message = 'Resource not found', response = null) {
    super(message, 404, response);
    this.name = 'NotFoundError';
  }
}

/**
 * Server Error (500+)
 */
export class ServerError extends CoinbaseError {
  constructor(message = 'Coinbase server error', statusCode = 500, response = null) {
    super(message, statusCode, response);
    this.name = 'ServerError';
  }
}

/**
 * Network Error (connection issues)
 */
export class NetworkError extends CoinbaseError {
  constructor(message = 'Network connection failed', originalError = null) {
    super(message, null, null);
    this.name = 'NetworkError';
    this.originalError = originalError;
  }
}

/**
 * Timeout Error
 */
export class TimeoutError extends CoinbaseError {
  constructor(message = 'Request timeout', timeout = null) {
    super(message, null, null);
    this.name = 'TimeoutError';
    this.timeout = timeout;
  }
}

/**
 * Order Error (order-specific issues)
 */
export class OrderError extends CoinbaseError {
  constructor(message = 'Order operation failed', response = null) {
    super(message, null, response);
    this.name = 'OrderError';
  }
}

/**
 * Insufficient Funds Error
 */
export class InsufficientFundsError extends CoinbaseError {
  constructor(message = 'Insufficient funds for operation', response = null) {
    super(message, 400, response);
    this.name = 'InsufficientFundsError';
  }
}

/**
 * Parse error response from Coinbase API
 * @param {Error} error - Axios error object
 * @returns {CoinbaseError} - Appropriate error type
 */
export function parseError(error) {
  // Network/connection errors
  if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
    return new NetworkError(`Network error: ${error.message}`, error);
  }

  // Timeout errors
  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
    return new TimeoutError('Request timeout', error.timeout);
  }

  // No response (network issue)
  if (!error.response) {
    return new NetworkError('No response from Coinbase API', error);
  }

  const { status, data } = error.response;
  const message = data?.message || data?.error || error.message || 'Unknown error';

  // Map status codes to error types
  switch (status) {
    case 400:
      if (message.toLowerCase().includes('insufficient')) {
        return new InsufficientFundsError(message, data);
      }
      return new InvalidRequestError(message, data);

    case 401:
    case 403:
      return new AuthenticationError(message, data);

    case 404:
      return new NotFoundError(message, data);

    case 429:
      const retryAfter = error.response.headers['retry-after'] || 60;
      return new RateLimitError(message, retryAfter, data);

    case 500:
    case 502:
    case 503:
    case 504:
      return new ServerError(message, status, data);

    default:
      return new CoinbaseError(message, status, data);
  }
}

/**
 * Check if error is retryable
 * @param {Error} error - Error to check
 * @returns {boolean} - True if error should be retried
 */
export function isRetryable(error) {
  // Retry on network errors
  if (error instanceof NetworkError) {
    return true;
  }

  // Retry on timeout
  if (error instanceof TimeoutError) {
    return true;
  }

  // Retry on server errors (5xx)
  if (error instanceof ServerError) {
    return true;
  }

  // Retry on rate limit (after delay)
  if (error instanceof RateLimitError) {
    return true;
  }

  // Don't retry authentication, validation, or not found errors
  return false;
}

/**
 * Get retry delay for error
 * @param {Error} error - Error to check
 * @param {number} attempt - Current retry attempt number
 * @returns {number} - Delay in milliseconds
 */
export function getRetryDelay(error, attempt = 1) {
  // Rate limit: use retry-after header
  if (error instanceof RateLimitError && error.retryAfter) {
    return error.retryAfter * 1000; // Convert to ms
  }

  // Exponential backoff: 1s, 2s, 4s, 8s, 16s
  const baseDelay = 1000;
  const maxDelay = 30000; // 30 seconds max
  const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);

  // Add jitter (random 0-1000ms) to prevent thundering herd
  const jitter = Math.random() * 1000;

  return delay + jitter;
}

export default {
  CoinbaseError,
  AuthenticationError,
  RateLimitError,
  InvalidRequestError,
  NotFoundError,
  ServerError,
  NetworkError,
  TimeoutError,
  OrderError,
  InsufficientFundsError,
  parseError,
  isRetryable,
  getRetryDelay
};
