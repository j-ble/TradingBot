
import fs from 'fs';
import path from 'path';
import CoinbaseClient from '../lib/coinbase/client.js';

async function main() {
    const client = new CoinbaseClient();
    const productId = 'BTC-USDC';
    // Coinbase doesn't natively support 4H, so we fetch 1H and aggregate
    const granularity = '1H';

    // Fetch last 180 days
    const now = new Date();
    const daysToFetch = 180;
    const startDate = new Date(now.getTime() - daysToFetch * 24 * 60 * 60 * 1000);

    console.log(`Starting data fetch for ${productId}`);
    console.log(`Time range: ${startDate.toISOString()} to ${now.toISOString()}`);
    console.log(`Strategy: Fetch 1H candles and aggregate to 4H`);

    // Container for all 1H candles
    let allCandles = [];

    // Coinbase allows max 300 candles per request. 
    // 300 hours is ~12.5 days.
    const CHUNK_HOURS = 300;
    let currentEnd = now;

    while (currentEnd > startDate) {
        // Calculate start of this chunk
        let currentStart = new Date(currentEnd.getTime() - CHUNK_HOURS * 60 * 60 * 1000);

        // Don't go past the global start date
        if (currentStart < startDate) {
            currentStart = startDate;
        }

        console.log(`Fetching chunk: ${currentStart.toISOString()} -> ${currentEnd.toISOString()}`);

        try {
            const candles = await client.getCandles(productId, granularity, currentStart, currentEnd);

            if (candles && candles.length > 0) {
                console.log(`  Received ${candles.length} candles`);
                allCandles = allCandles.concat(candles);
            } else {
                console.log(`  No candles in this range`);
            }

            // Move window back
            currentEnd = currentStart;

            // Respect rate limits (public endpoint)
            await new Promise(resolve => setTimeout(resolve, 250));

        } catch (error) {
            console.error(`  Error fetching chunk: ${error.message}`);
            // If error is rate limit, wait longer
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }

    console.log(`\nTotal 1H candles fetched: ${allCandles.length}`);

    if (allCandles.length === 0) {
        console.log("No data fetched. Exiting.");
        return;
    }

    // 1. Sort by timestamp ascending
    allCandles.sort((a, b) => a.timestamp - b.timestamp);

    // 2. Remove duplicates
    const uniqueCandles = [];
    const visited = new Set();
    for (const c of allCandles) {
        const ts = c.timestamp.getTime();
        if (!visited.has(ts)) {
            visited.add(ts);
            uniqueCandles.push(c);
        }
    }
    console.log(`Unique 1H candles: ${uniqueCandles.length}`);

    // 3. Aggregate to 4H
    console.log("Aggregating to 4H candles...");
    const aggregated = aggregateToFourHour(uniqueCandles);
    console.log(`Generated ${aggregated.length} 4H candles`);

    // 4. Save to CSV
    const outputDir = path.join(process.cwd(), 'historyBot', 'data');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const csvPath = path.join(outputDir, 'btc_usdc_4h.csv');

    // CSV Header
    let csvContent = 'timestamp,open,high,low,close,volume\n';

    // CSV Rows
    for (const c of aggregated) {
        csvContent += `${c.timestamp.toISOString()},${c.open},${c.high},${c.low},${c.close},${c.volume}\n`;
    }

    fs.writeFileSync(csvPath, csvContent);
    console.log(`\nData saved successfully to: ${csvPath}`);
}

/**
 * Aggregates 1H candles into 4H candles
 * @param {Array} candles - Sorted array of 1H candles
 */
function aggregateToFourHour(candles) {
    const result = [];
    let buffer = [];

    // Helper to get 4H bucket timestamp for a candle
    const getBucket = (date) => {
        const ts = date.getTime() / 1000; // seconds
        // Round down to nearest 4H block (4 * 3600 = 14400)
        const bucketTs = Math.floor(ts / 14400) * 14400;
        return bucketTs;
    };

    let currentBucket = null;

    for (const candle of candles) {
        const bucket = getBucket(candle.timestamp);

        if (currentBucket === null) {
            currentBucket = bucket;
        }

        if (bucket !== currentBucket) {
            // Flush buffer if we have data and moved to a new bucket
            if (buffer.length > 0) {
                result.push(buildCandle(buffer, currentBucket));
            }

            // Start new bucket
            buffer = [candle];
            currentBucket = bucket;
        } else {
            // Add to current bucket
            buffer.push(candle);
        }
    }

    // Flush final buffer
    if (buffer.length > 0) {
        result.push(buildCandle(buffer, currentBucket));
    }

    return result;
}

function buildCandle(buffer, bucketTimestamp) {
    // Sort buffer just in case
    buffer.sort((a, b) => a.timestamp - b.timestamp);

    const open = buffer[0].open;
    const close = buffer[buffer.length - 1].close;

    let high = buffer[0].high;
    let low = buffer[0].low;
    let volume = 0;

    for (const c of buffer) {
        if (c.high > high) high = c.high;
        if (c.low < low) low = c.low;
        volume += c.volume;
    }

    return {
        timestamp: new Date(bucketTimestamp * 1000),
        open,
        high,
        low,
        close,
        volume
    };
}

main().catch(console.error);
