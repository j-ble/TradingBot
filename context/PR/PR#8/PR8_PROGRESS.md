# PR#8: Swing Level Tracking System

**Status**: Complete
**Date**: 2025-11-23

## Overview

Implemented swing high/low detection and tracking for both 4H and 5M timeframes using a 3-candle pattern algorithm.

## Files Created

### Core Tracker
- **`lib/scanners/swing_tracker.js`** - Main swing detection logic
  - `detectSwingHigh(candles, index)` - 3-candle pattern for highs
  - `detectSwingLow(candles, index)` - 3-candle pattern for lows
  - `scanForSwings(candles, timeframe)` - Scan candle array
  - `findMostRecentSwing(swings, type)` - Find latest swing
  - `storeSwing(swing)` - Deactivate old, insert new
  - `processSwings(swings, timeframe)` - Store only most recent
  - `getActiveSwings(timeframe)` - Get current active swings

### Timeframe Detectors
- **`lib/scanners/swing_detector_4h.js`** - 4H swing detector
  - Default: 50 candles analyzed
  - Uses get4HCandles() from database

- **`lib/scanners/swing_detector_5m.js`** - 5M swing detector
  - Default: 100 candles analyzed
  - Uses get5MCandles() from database

### Job
- **`jobs/track_swings.js`** - Scheduled tracking job
  - `--scan-4h` - Scan 4H timeframe only
  - `--scan-5m` - Scan 5M timeframe only
  - `--all` - Scan both timeframes
  - `--status` - Show current active swings

### Tests
- **`tests/unit/scanners/swing_tracker.test.js`** - Unit tests (14 tests)

## Swing Detection Algorithm

### 3-Candle Pattern
```javascript
// Swing High: current candle's high > neighbors
current.high > candles[index - 2].high && current.high > candles[index + 2].high

// Swing Low: current candle's low < neighbors
current.low < candles[index - 2].low && current.low < candles[index + 2].low
```

### Requirements
- Minimum 5 candles needed for detection
- Index must be >= 2 and < length - 2
- Only most recent swing of each type is stored as active

## Database Operations

Uses existing queries from `database/queries.js`:
- `insertSwingLevel()` - Insert new swing with active=true
- `deactivatePreviousSwings()` - Set old swings inactive
- `getRecentSwing()` - Get latest active swing by type/timeframe

## Test Results

```
=== PR #8: Swing Level Tracking Tests ===

✓ SwingTracker instantiates correctly
✓ Detect swing high correctly
✓ Detect swing low correctly
✓ Reject swing at index < 2
✓ Reject swing at index >= length - 2
✓ Scan candles for multiple swings
✓ Find most recent swing of type
✓ Store swing level in database
✓ Get active swings for timeframe
✓ SwingDetector4H instantiates correctly
✓ SwingDetector5M instantiates correctly
✓ 5M Detector scans for swings
✓ Get 5M detector status
✓ Constants exported correctly

=== Test Summary ===
Passed: 14
Failed: 0
Total: 14

✅ ALL TESTS PASSED
```

## Acceptance Criteria

- [x] Swing high detection working
- [x] Swing low detection working
- [x] Swings stored in database
- [x] Active swing tracking correct
- [x] API returns latest swing levels
- [x] Unit tests passing (>90% coverage)

## Usage Examples

```bash
# Scan both timeframes
node jobs/track_swings.js

# Scan specific timeframe
node jobs/track_swings.js --scan-4h
node jobs/track_swings.js --scan-5m

# Check current swings
node jobs/track_swings.js --status
```

### Programmatic Usage

```javascript
import { SwingDetector5M } from './lib/scanners/swing_detector_5m.js';

const detector = new SwingDetector5M();

// Scan for swings
const results = await detector.scan(100);
// { detected: 26, stored: 2, skipped: 0 }

// Get active swings
const swings = await detector.getActiveSwings();
// { high: { price: 87156.02, ... }, low: { price: 86906.11, ... } }
```

## Constants

```javascript
export const TIMEFRAMES = {
  FOUR_HOUR: '4H',
  FIVE_MINUTE: '5M'
};

export const SWING_TYPES = {
  HIGH: 'HIGH',
  LOW: 'LOW'
};
```

## Dependencies

- PR#1 (Database) - swing_levels table
- PR#5 (4H Candles) - candle data for 4H detection
- PR#6 (5M Candles) - candle data for 5M detection

## Notes

- Only the most recent swing of each type is kept active
- Previous swings are deactivated when a new one is detected
- Swing detection requires 2 candles on each side for comparison
- Database queries already handle duplicate prevention
- Swings are used for stop loss calculation in later PRs
