/**
 * Async Utilities
 * Helpers for async operations, retries, and timeouts
 */

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {number} [maxRetries=3] - Maximum retry attempts
 * @param {number} [initialDelayMs=1000] - Initial delay in ms
 * @param {number} [maxDelayMs=30000] - Maximum delay in ms
 * @returns {Promise<any>} Result of successful execution
 */
export async function retry(fn, maxRetries = 3, initialDelayMs = 1000, maxDelayMs = 30000) {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries) {
        break;
      }

      // Exponential backoff with jitter
      const delay = Math.min(
        initialDelayMs * Math.pow(2, attempt) + Math.random() * 1000,
        maxDelayMs
      );

      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Wrap a promise with a timeout
 * @param {Promise} promise - Promise to wrap
 * @param {number} ms - Timeout in milliseconds
 * @param {string} [message='Operation timed out'] - Timeout error message
 * @returns {Promise<any>} Result or timeout error
 */
export function timeout(promise, ms, message = 'Operation timed out') {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(message));
    }, ms);

    promise
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

/**
 * Execute function with timeout
 * @param {Function} fn - Async function to execute
 * @param {number} ms - Timeout in milliseconds
 * @param {string} [message='Operation timed out'] - Timeout error message
 * @returns {Promise<any>} Result or timeout error
 */
export function withTimeout(fn, ms, message = 'Operation timed out') {
  return timeout(fn(), ms, message);
}

/**
 * Run multiple promises with concurrency limit
 * @param {Array<Function>} tasks - Array of async functions
 * @param {number} [concurrency=5] - Max concurrent executions
 * @returns {Promise<Array>} Results in order
 */
export async function parallelLimit(tasks, concurrency = 5) {
  const results = [];
  const executing = [];

  for (const [index, task] of tasks.entries()) {
    const promise = Promise.resolve().then(() => task()).then((result) => {
      results[index] = result;
    });

    executing.push(promise);

    if (executing.length >= concurrency) {
      await Promise.race(executing);
      // Remove completed promises
      for (let i = executing.length - 1; i >= 0; i--) {
        if (executing[i].settled) {
          executing.splice(i, 1);
        }
      }
    }
  }

  await Promise.all(executing);
  return results;
}

/**
 * Debounce function execution
 * @param {Function} fn - Function to debounce
 * @param {number} ms - Debounce delay in ms
 * @returns {Function} Debounced function
 */
export function debounce(fn, ms) {
  let timeoutId;

  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), ms);
  };
}

/**
 * Throttle function execution
 * @param {Function} fn - Function to throttle
 * @param {number} ms - Throttle interval in ms
 * @returns {Function} Throttled function
 */
export function throttle(fn, ms) {
  let lastCall = 0;

  return function (...args) {
    const now = Date.now();
    if (now - lastCall >= ms) {
      lastCall = now;
      return fn.apply(this, args);
    }
  };
}

/**
 * Wait for condition to be true
 * @param {Function} condition - Function that returns boolean
 * @param {number} [intervalMs=100] - Check interval
 * @param {number} [timeoutMs=30000] - Maximum wait time
 * @returns {Promise<void>} Resolves when condition is true
 */
export async function waitFor(condition, intervalMs = 100, timeoutMs = 30000) {
  const startTime = Date.now();

  while (true) {
    if (await condition()) {
      return;
    }

    if (Date.now() - startTime > timeoutMs) {
      throw new Error('Wait condition timed out');
    }

    await sleep(intervalMs);
  }
}

/**
 * Create a deferred promise
 * @returns {object} Object with promise, resolve, and reject
 */
export function createDeferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/**
 * Execute with retry and timeout combined
 * @param {Function} fn - Async function to execute
 * @param {object} options - Options
 * @param {number} [options.retries=3] - Max retries
 * @param {number} [options.timeout=30000] - Timeout per attempt in ms
 * @param {number} [options.delay=1000] - Initial delay between retries
 * @returns {Promise<any>} Result
 */
export async function retryWithTimeout(fn, options = {}) {
  const { retries = 3, timeout: timeoutMs = 30000, delay = 1000 } = options;

  return retry(
    () => withTimeout(fn, timeoutMs),
    retries,
    delay
  );
}
