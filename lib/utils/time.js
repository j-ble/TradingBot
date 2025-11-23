/**
 * Time/Date Utilities
 * All times in UTC for trading consistency
 */

/**
 * Get current Unix timestamp in seconds
 * @returns {number} Unix timestamp
 */
export function getUnixTimestamp() {
  return Math.floor(Date.now() / 1000);
}

/**
 * Get current Unix timestamp in milliseconds
 * @returns {number} Unix timestamp in ms
 */
export function getUnixTimestampMs() {
  return Date.now();
}

/**
 * Format timestamp to ISO string (UTC)
 * @param {number|string|Date} timestamp - Timestamp to format
 * @returns {string} ISO formatted string
 */
export function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) {
    throw new Error('Invalid timestamp');
  }
  return date.toISOString();
}

/**
 * Format timestamp to readable string (UTC)
 * @param {number|string|Date} timestamp - Timestamp to format
 * @returns {string} Formatted string (YYYY-MM-DD HH:mm:ss UTC)
 */
export function formatTimestampReadable(timestamp) {
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) {
    throw new Error('Invalid timestamp');
  }
  return date.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC');
}

/**
 * Check if timestamp is within a time range
 * @param {number|string|Date} timestamp - Timestamp to check
 * @param {number|string|Date} start - Range start
 * @param {number|string|Date} end - Range end
 * @returns {boolean} True if within range
 */
export function isWithinTimeRange(timestamp, start, end) {
  const ts = new Date(timestamp).getTime();
  const startTs = new Date(start).getTime();
  const endTs = new Date(end).getTime();

  return ts >= startTs && ts <= endTs;
}

/**
 * Align timestamp to 4H candle boundary (UTC)
 * 4H candles: 00:00, 04:00, 08:00, 12:00, 16:00, 20:00
 * @param {number|string|Date} timestamp - Timestamp to align
 * @returns {Date} Aligned date
 */
export function getCandle4HTimestamp(timestamp) {
  const date = new Date(timestamp);
  const hours = date.getUTCHours();
  const alignedHours = Math.floor(hours / 4) * 4;

  date.setUTCHours(alignedHours, 0, 0, 0);
  return date;
}

/**
 * Align timestamp to 5M candle boundary
 * @param {number|string|Date} timestamp - Timestamp to align
 * @returns {Date} Aligned date
 */
export function getCandle5MTimestamp(timestamp) {
  const date = new Date(timestamp);
  const minutes = date.getUTCMinutes();
  const alignedMinutes = Math.floor(minutes / 5) * 5;

  date.setUTCMinutes(alignedMinutes, 0, 0);
  return date;
}

/**
 * Get next 4H candle close time
 * @param {number|string|Date} [timestamp] - Reference timestamp (default: now)
 * @returns {Date} Next 4H candle close time
 */
export function getNext4HCandleClose(timestamp = Date.now()) {
  const current = getCandle4HTimestamp(timestamp);
  current.setUTCHours(current.getUTCHours() + 4);
  return current;
}

/**
 * Get next 5M candle close time
 * @param {number|string|Date} [timestamp] - Reference timestamp (default: now)
 * @returns {Date} Next 5M candle close time
 */
export function getNext5MCandleClose(timestamp = Date.now()) {
  const current = getCandle5MTimestamp(timestamp);
  current.setUTCMinutes(current.getUTCMinutes() + 5);
  return current;
}

/**
 * Calculate time difference in milliseconds
 * @param {number|string|Date} start - Start time
 * @param {number|string|Date} end - End time
 * @returns {number} Difference in milliseconds
 */
export function getTimeDifferenceMs(start, end) {
  const startTs = new Date(start).getTime();
  const endTs = new Date(end).getTime();
  return endTs - startTs;
}

/**
 * Format duration in human readable format
 * @param {number} ms - Duration in milliseconds
 * @returns {string} Formatted duration (e.g., "2h 30m 15s")
 */
export function formatDuration(ms) {
  if (ms < 0) ms = Math.abs(ms);

  const seconds = Math.floor(ms / 1000) % 60;
  const minutes = Math.floor(ms / (1000 * 60)) % 60;
  const hours = Math.floor(ms / (1000 * 60 * 60)) % 24;
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);

  return parts.join(' ');
}

/**
 * Check if timestamp is older than specified hours
 * @param {number|string|Date} timestamp - Timestamp to check
 * @param {number} hours - Hours threshold
 * @returns {boolean} True if older than threshold
 */
export function isOlderThan(timestamp, hours) {
  const ts = new Date(timestamp).getTime();
  const threshold = Date.now() - (hours * 60 * 60 * 1000);
  return ts < threshold;
}

/**
 * Check if timestamp is within the last N hours
 * @param {number|string|Date} timestamp - Timestamp to check
 * @param {number} hours - Hours to check
 * @returns {boolean} True if within last N hours
 */
export function isWithinLastHours(timestamp, hours) {
  return !isOlderThan(timestamp, hours);
}

/**
 * Get start of day (UTC)
 * @param {number|string|Date} [timestamp] - Reference timestamp (default: now)
 * @returns {Date} Start of day
 */
export function getStartOfDay(timestamp = Date.now()) {
  const date = new Date(timestamp);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

/**
 * Get end of day (UTC)
 * @param {number|string|Date} [timestamp] - Reference timestamp (default: now)
 * @returns {Date} End of day
 */
export function getEndOfDay(timestamp = Date.now()) {
  const date = new Date(timestamp);
  date.setUTCHours(23, 59, 59, 999);
  return date;
}

/**
 * Convert seconds to milliseconds
 * @param {number} seconds - Seconds
 * @returns {number} Milliseconds
 */
export function secondsToMs(seconds) {
  return seconds * 1000;
}

/**
 * Convert minutes to milliseconds
 * @param {number} minutes - Minutes
 * @returns {number} Milliseconds
 */
export function minutesToMs(minutes) {
  return minutes * 60 * 1000;
}

/**
 * Convert hours to milliseconds
 * @param {number} hours - Hours
 * @returns {number} Milliseconds
 */
export function hoursToMs(hours) {
  return hours * 60 * 60 * 1000;
}
