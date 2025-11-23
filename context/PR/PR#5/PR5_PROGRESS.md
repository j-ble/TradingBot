# PR #5: 4H Candle Collector - COMPLETE

## Status: COMPLETE

## Files Created
- [x] `lib/collectors/candle_collector_4h.js` - Main collection logic
- [x] `jobs/collect_4h.js` - Scheduled collection job
- [x] `tests/test_4h_collector.js` - Integration tests (9 tests)

## Dependencies Used
- `lib/coinbase/client.js` (PR#2) - API calls
- `database/queries.js` (PR#1) - Database operations
- `lib/utils/time.js` (PR#4) - Time utilities
- `lib/utils/async.js` (PR#4) - Retry logic

## Features Implemented

### CandleCollector4H Class
```javascript
const collector = new CandleCollector4H();

// Fetch from API
await collector.fetchCandles(start, end);

// Store in database
await collector.storeCandles(candles);

// Historical backfill (200 candles = ~50 days of 6H)
await collector.backfill(200);

// Collect latest closed candle
await collector.collectLatest();

// Gap detection and filling
await collector.detectGaps();
await collector.fillGaps();

// Get status
await collector.getStatus();
```

### Job Runner Commands
```bash
# Normal collection (latest candle)
node jobs/collect_4h.js

# Full historical backfill
node jobs/collect_4h.js --backfill
node jobs/collect_4h.js --backfill 300  # Custom count

# Fill gaps only
node jobs/collect_4h.js --fill-gaps

# Check status
node jobs/collect_4h.js --status
```

### Cron Schedule
```
0 0,4,8,12,16,20 * * *
```
Every 6 hours at minute 0 (Coinbase uses 6H granularity, not 4H)

## Key Implementation Details

### Granularity Note
Coinbase Advanced Trade API doesn't offer 4H candles. Using `SIX_HOUR` granularity as the closest available option per PRD guidance.

### Candle Data Flow
1. Fetch from Coinbase API with retry logic
2. Validate OHLCV relationships
3. Insert into database (ON CONFLICT DO NOTHING for duplicates)
4. Log results

### Gap Detection
- Queries existing timestamps from database
- Calculates expected sequence (6H intervals)
- Identifies missing candles
- Fetches and fills automatically

### Validation Rules
- All OHLC prices must be positive
- High >= Open, Close, Low
- Low <= Open, Close
- Duplicate timestamps are skipped (not errors)

## Test Results
```
=== PR #5: 4H Candle Collector Tests ===

✓ Collector initializes correctly
✓ Fetch candles from Coinbase API
    Retrieved 4 candles
✓ Candle validation works correctly
✓ Store candles in database
    Inserted: 2, Skipped: 0
✓ Collect latest closed candle
    Latest collection: 0 inserted
✓ Retrieve candles from database
    Retrieved 3 candles from database
✓ Gap detection works
    Detected 0 gaps
✓ Get collector status
    Total candles: 3
    Latest: 2025-11-23T12:00:00.000Z
✓ Backfill historical candles
    Backfill: 10 inserted, 0 skipped

=== Test Summary ===
Passed: 9
Failed: 0
Total: 9

ALL TESTS PASSED
```

## Usage Examples

### One-time Backfill
```bash
# Initial setup - backfill 200 candles (~50 days)
node jobs/collect_4h.js --backfill 200
```

### Scheduled Collection
Add to crontab:
```bash
0 0,6,12,18 * * * cd /path/to/TradingBot && node jobs/collect_4h.js
```

### Programmatic Usage
```javascript
import { CandleCollector4H } from './lib/collectors/candle_collector_4h.js';

const collector = new CandleCollector4H();

// Run collection
const results = await collector.collectLatest();
console.log(`Inserted: ${results.inserted}`);

// Check for gaps
const gaps = await collector.detectGaps();
if (gaps.length > 0) {
  await collector.fillGaps();
}
```

## Acceptance Criteria
- [x] Historical backfill working (configurable count)
- [x] Scheduled collection every 6 hours
- [x] No duplicate candles stored (ON CONFLICT DO NOTHING)
- [x] Data validation prevents bad data
- [x] Gaps automatically detected and filled
- [x] Integration tests passing (9/9)

## Testing Commands
```bash
# Run tests
node tests/test_4h_collector.js

# Manual collection test
node jobs/collect_4h.js --status
```

## Dependencies for Next PRs
- PR#8 (Swing Tracker): Uses `get4HCandles()` for swing detection
- PR#9 (Sweep Detector): Uses 4H candle data for liquidity sweeps

## Notes
- Using 6H granularity (Coinbase doesn't have 4H)
- Retry logic: 3 attempts with 2s initial delay, exponential backoff
- Database pool closes after job completion
- Logs all operations with timestamps

## Completed: November 23, 2025
