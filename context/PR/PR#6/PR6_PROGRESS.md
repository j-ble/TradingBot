# PR#6: 5M Candle Collector

**Status**: Complete
**Date**: 2025-11-23

## Overview

Implemented 5-minute candle data collection with higher frequency updates, historical backfill, and 7-day data retention policy.

## Files Created

### Core Implementation
- **`lib/collectors/candle_collector_5m.js`** - Main collector class
  - `fetchCandles(start, end)` - Fetch from Coinbase API with retry
  - `transformCandles(apiCandles)` - Convert API response to DB format
  - `validateCandle(candle)` - Validate OHLC relationships
  - `storeCandles(candles)` - Insert with duplicate prevention
  - `backfill(count)` - Historical backfill (default: 500 candles)
  - `collectLatest()` - Get most recent closed candle
  - `detectGaps()` - Find missing timestamps
  - `fillGaps()` - Fetch and fill detected gaps
  - `pruneOldCandles()` - Delete candles >7 days old
  - `getStatus()` - Return collection metrics

### Job Entry Point
- **`jobs/collect_5m.js`** - Scheduled job with CLI support
  - `--backfill [count]` - Full historical backfill
  - `--fill-gaps` - Fill gaps only
  - `--status` - Show collection status
  - `--prune` - Manual pruning
  - Periodic auto-pruning every 6 hours

### Tests
- **`tests/test_5m_collector.js`** - Integration tests (11 tests)

## Bug Fix

Fixed `prune5MCandles()` in `database/queries.js`:
- Removed invalid `RETURNING COUNT(*)` clause (aggregate functions not allowed in RETURNING)
- Now correctly returns `result.rowCount`

## Configuration

| Setting | Value |
|---------|-------|
| Granularity | FIVE_MINUTE |
| Default backfill | 500 candles (~42 hours) |
| Schedule | Every 5 minutes |
| Cron expression | `*/5 * * * *` |
| Retention | 7 days |
| Retry attempts | 2 |
| Retry delay | 60 seconds |

## Test Results

```
=== PR #6: 5M Candle Collector Tests ===

✓ Collector initializes correctly
✓ Fetch candles from Coinbase API
✓ Candle validation works correctly
✓ Store candles in database
✓ Collect latest closed candle
✓ Retrieve candles from database
✓ Gap detection works
✓ Get collector status
✓ Backfill historical candles
✓ Prune old candles executes
✓ Fast retrieval queries (<100ms)

=== Test Summary ===
Passed: 11
Failed: 0
Total: 11

✅ ALL TESTS PASSED
```

## Acceptance Criteria

- [x] Historical backfill working (500 candles)
- [x] Collection every 5 minutes
- [x] Data pruning removes old candles (>7 days)
- [x] Maximum candles maintained via retention policy
- [x] Fast retrieval queries (<100ms) - achieved <10ms
- [x] Integration tests passing

## Usage Examples

```bash
# Run backfill with default 500 candles
node jobs/collect_5m.js --backfill

# Run backfill with custom count
node jobs/collect_5m.js --backfill 1000

# Check collection status
node jobs/collect_5m.js --status

# Fill any gaps in data
node jobs/collect_5m.js --fill-gaps

# Manually prune old candles
node jobs/collect_5m.js --prune

# Normal collection (for cron scheduling)
node jobs/collect_5m.js
```

## Database Queries Used

- `insert5MCandle(candle)` - Insert with `ON CONFLICT DO NOTHING`
- `get5MCandles(limit)` - Retrieve in chronological order
- `prune5MCandles()` - Delete candles older than 7 days

## Dependencies

- PR#1 (Database Schema) - Required for candles_5m table
- PR#2 (Coinbase API Client) - Required for API calls

## Notes

- Uses FIVE_MINUTE granularity from Coinbase API
- Filters out current incomplete candle using `getCandle5MTimestamp()`
- Auto-prunes every 6 hours during normal collection runs
- Gap detection compares timestamps with 5-minute intervals
