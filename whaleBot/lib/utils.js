// ==================== UTILITY FUNCTIONS ====================

export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function formatNumber(num, decimals = 2) {
  if (!num) return '0';
  if (num >= 1000000) return `${(num / 1000000).toFixed(decimals)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(decimals)}k`;
  return num.toFixed(decimals);
}

export function formatAddress(address, showFull = false) {
  if (showFull) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function getTimeAgo(timestamp) {
  const seconds = Math.floor((Date.now() / 1000) - timestamp);

  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function formatHoldingTime(seconds) {
  const hours = seconds / 3600;
  const days = hours / 24;

  if (days >= 1) return `${days.toFixed(1)} days`;
  if (hours >= 1) return `${hours.toFixed(1)} hours`;
  return `${Math.floor(seconds / 60)} minutes`;
}

export function calculateTokenAge(pairCreatedAt) {
  if (!pairCreatedAt) return null;

  const ageMs = Date.now() - pairCreatedAt;
  const ageMinutes = ageMs / (1000 * 60);
  const ageHours = ageMinutes / 60;

  return { ageMinutes, ageHours };
}
