# PR #9: 4H Liquidity Sweep Detector

## Summary
Implemented the 4H liquidity sweep detection system that identifies when price sweeps above/below 4H swing levels and establishes market bias for trading direction.

## Files Created

### Core Scanner Files
- **`lib/scanners/sweep_detector.js`** - Core sweep detection functions
  - `detectHighSweep()` - Detects when price exceeds swing high by 0.1%
  - `detectLowSweep()` - Detects when price drops below swing low by 0.1%
  - `getBias()` - Returns BEARISH for HIGH sweep, BULLISH for LOW sweep
  - `getDirection()` - Returns LONG/SHORT based on bias
  - `getSweepThreshold()` - Calculates threshold price
  - `isSweepValid()` - Validates sweep age (24h max)
  - `createSweepObject()` - Creates formatted sweep for storage
  - Constants: `SWEEP_TYPES`, `BIAS_TYPES`, `SWEEP_THRESHOLD` (0.1%)

- **`lib/scanners/4h_scanner.js`** - Main Scanner4H class
  - `checkForSweeps(currentPrice)` - Check price against 4H swings
  - `storeSweep()` - Store new sweep in database with confluence state
  - `deactivateExpiredSweeps()` - Cleanup sweeps older than 24h
  - `getActiveSweep()` - Get current active sweep
  - `startMonitoring()` - Real-time price monitoring via WebSocket
  - `stopMonitoring()` - Stop monitoring
  - `getStatus()` - Get scanner status with swing levels

### Job Entry Point
- **`jobs/scan_4h.js`** - Scheduled scanning job
  - `--check` - Single sweep check with current price
  - `--status` - Show current scanner status
  - `--monitor` - Start real-time monitoring
  - `--deactivate` - Deactivate expired sweeps
  - Schedule: `0 0,4,8,12,16,20 * * *` (every 4 hours)

### Unit Tests
- **`tests/unit/scanners/4h_scanner.test.js`** - 16 unit tests
  - Constants validation
  - High/low sweep detection with threshold
  - Edge cases for invalid inputs
  - Bias and direction mapping
  - Sweep validity checking
  - Scanner instantiation and methods

## Key Implementation Details

### Sweep Detection Logic
```javascript
const SWEEP_THRESHOLD = 0.001; // 0.1%

// HIGH swept when price > swingHigh * 1.001
// LOW swept when price < swingLow * 0.999
```

### Bias Assignment
- **HIGH swept** → `BEARISH` bias → Look for SHORT
- **LOW swept** → `BULLISH` bias → Look for LONG

### Sweep Lifecycle
1. Detect sweep when price crosses threshold
2. Deactivate any existing active sweep
3. Store new sweep with bias
4. Create confluence state for 5M pattern detection
5. Auto-expire after 24 hours

### Integration Points
- Uses `getRecentSwing()` from queries.js for 4H swing levels
- Uses `insertLiquiditySweep()` for storage
- Uses `createConfluenceState()` to initialize 5M pattern tracking
- Connects to `PriceFeed` for real-time monitoring

## Test Results
```
=== PR #9: 4H Liquidity Sweep Scanner Tests ===

✓ Constants exported correctly
✓ detectHighSweep returns true when price exceeds threshold
✓ detectHighSweep returns false when price below threshold
✓ detectLowSweep returns true when price below threshold
✓ detectLowSweep returns false when price above threshold
✓ Sweep detection handles invalid inputs
✓ getBias returns correct bias for sweep type
✓ getBias throws on invalid sweep type
✓ getDirection returns correct trading direction
✓ getSweepThreshold calculates correct thresholds
✓ isSweepValid checks sweep age correctly
✓ createSweepObject creates correct sweep object
✓ Scanner4H instantiates correctly
✓ Scanner rejects invalid price for sweep check
✓ Scanner getStatus returns correct structure
✓ Scanner deactivateExpiredSweeps runs without error

Passed: 16
Failed: 0
Total: 16

✅ ALL TESTS PASSED
```

## Usage Examples

```bash
# Check for sweep with current price
node jobs/scan_4h.js --check

# Show scanner status
node jobs/scan_4h.js --status

# Start real-time monitoring
node jobs/scan_4h.js --monitor

# Cleanup expired sweeps
node jobs/scan_4h.js --deactivate
```

## Dependencies
- `lib/coinbase/price_feed.js` (PR #7)
- `lib/scanners/swing_tracker.js` (PR #8)
- `database/queries.js` - Database operations

## Next Steps
- PR #10: 5M Confluence Detector - Implement CHoCH → FVG → BOS state machine
