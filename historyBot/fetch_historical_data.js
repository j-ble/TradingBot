
import fs from 'fs';
import path from 'path';
import CoinbaseClient from '../lib/coinbase/client.js';

async function main() {
    const client = new CoinbaseClient();
    const productId = 'BTC-USD';
    // Fetch 4H candles directly
    const granularity = '4H';

    // Fetch last 730 days (24 months)
    const now = new Date();
    const daysToFetch = 730;
    const startDate = new Date(now.getTime() - daysToFetch * 24 * 60 * 60 * 1000);

    console.log(`Starting data fetch for ${productId}`);
    console.log(`Time range: ${startDate.toISOString()} to ${now.toISOString()}`);
    console.log(`Strategy: Fetch 4H candles`);

    // Container for all candles
    let allCandles = [];

    // Coinbase allows max 300 candles per request. 
    // 300 * 4 hours = 1200 hours.
    const CHUNK_HOURS = 1000;
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

    console.log(`\nTotal 4H candles fetched: ${allCandles.length}`);

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
    console.log(`Unique 4H candles: ${uniqueCandles.length}`);

    // 3. Save to CSV
    const outputDir = path.join(process.cwd(), 'historyBot', 'data');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const csvPath = path.join(outputDir, 'btc_usd_4h.csv');

    // CSV Header
    let csvContent = 'timestamp,open,high,low,close,volume\n';

    // CSV Rows
    for (const c of uniqueCandles) {
        csvContent += `${c.timestamp.toISOString()},${c.open},${c.high},${c.low},${c.close},${c.volume}\n`;
    }

    fs.writeFileSync(csvPath, csvContent);
    console.log(`\nData saved successfully to: ${csvPath}`);
}

main().catch(console.error);
