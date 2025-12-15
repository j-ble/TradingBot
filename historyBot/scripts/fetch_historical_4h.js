/**
 * Fetch Historical 4H BTC-USD Candles
 * Date range: Feb 20, 2021 - Feb 20, 2023
 * Saves to data/btc_usd_4h_2021_2023.csv
 */

import { CoinbaseClient } from '../../lib/coinbase/client.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const START_DATE = new Date('2021-02-20T00:00:00Z');
const END_DATE = new Date('2023-02-20T23:59:59Z');
const PRODUCT_ID = 'BTC-USD';
const GRANULARITY = '4H';
const MAX_CANDLES_PER_REQUEST = 300;
const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

// Output file
const OUTPUT_FILE = path.join(__dirname, '../data/btc_usd_4h_2021_2023.csv');

async function fetchAllCandles() {
  console.log('='.repeat(60));
  console.log('Fetching 4H BTC-USD Historical Data');
  console.log('='.repeat(60));
  console.log(`Start: ${START_DATE.toISOString()}`);
  console.log(`End: ${END_DATE.toISOString()}`);
  console.log(`Output: ${OUTPUT_FILE}`);
  console.log('='.repeat(60));

  // Initialize client
  const client = new CoinbaseClient({ logRequests: false });

  // Calculate total time span
  const totalMs = END_DATE.getTime() - START_DATE.getTime();
  const totalCandles = Math.ceil(totalMs / FOUR_HOURS_MS);
  const totalRequests = Math.ceil(totalCandles / MAX_CANDLES_PER_REQUEST);

  console.log(`\nEstimated candles: ~${totalCandles}`);
  console.log(`Estimated requests: ~${totalRequests}`);
  console.log('');

  // Collect all candles
  const allCandles = [];
  let currentStart = START_DATE.getTime();
  let requestCount = 0;

  while (currentStart < END_DATE.getTime()) {
    // Calculate end of this batch (300 candles * 4 hours)
    const batchEndMs = currentStart + (MAX_CANDLES_PER_REQUEST * FOUR_HOURS_MS);
    const currentEnd = Math.min(batchEndMs, END_DATE.getTime());

    requestCount++;
    const progress = ((currentStart - START_DATE.getTime()) / totalMs * 100).toFixed(1);

    console.log(`[${requestCount}/${totalRequests}] Fetching ${new Date(currentStart).toISOString().slice(0,10)} to ${new Date(currentEnd).toISOString().slice(0,10)} (${progress}%)`);

    try {
      const candles = await client.getCandles(
        PRODUCT_ID,
        GRANULARITY,
        Math.floor(currentStart / 1000),
        Math.floor(currentEnd / 1000)
      );

      if (candles && candles.length > 0) {
        allCandles.push(...candles);
        console.log(`   -> Got ${candles.length} candles`);
      } else {
        console.log(`   -> No candles returned`);
      }

      // Move to next batch
      currentStart = currentEnd;

      // Rate limit: wait 150ms between requests (stay well under 10/sec limit)
      await sleep(150);

    } catch (error) {
      console.error(`   -> Error: ${error.message}`);

      // If rate limited, wait longer and retry
      if (error.message.includes('rate') || error.message.includes('429')) {
        console.log('   -> Rate limited, waiting 5 seconds...');
        await sleep(5000);
      } else {
        // Skip this batch on other errors
        currentStart = currentEnd;
        await sleep(1000);
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`Total candles fetched: ${allCandles.length}`);

  // Sort by timestamp (oldest first)
  allCandles.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  // Remove duplicates based on timestamp
  const uniqueCandles = [];
  const seen = new Set();
  for (const candle of allCandles) {
    const key = candle.timestamp.getTime();
    if (!seen.has(key)) {
      seen.add(key);
      uniqueCandles.push(candle);
    }
  }

  console.log(`Unique candles: ${uniqueCandles.length}`);

  // Save to CSV
  await saveToCSV(uniqueCandles, OUTPUT_FILE);

  console.log('='.repeat(60));
  console.log('Done!');
}

async function saveToCSV(candles, filePath) {
  // Ensure directory exists
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Build CSV content
  const header = 'timestamp,open,high,low,close,volume';
  const rows = candles.map(c => {
    return [
      c.timestamp.toISOString(),
      c.open,
      c.high,
      c.low,
      c.close,
      c.volume
    ].join(',');
  });

  const csvContent = [header, ...rows].join('\n');

  // Write file
  fs.writeFileSync(filePath, csvContent);
  console.log(`\nSaved to: ${filePath}`);
  console.log(`File size: ${(csvContent.length / 1024).toFixed(2)} KB`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run
fetchAllCandles().catch(console.error);
