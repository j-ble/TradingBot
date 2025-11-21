# Get Product Candles

## Overview

Retrieves pricing data for a single product organized into time-based buckets, identified by product ID.

## Endpoint Details

**URL:** `GET /api/v3/brokerage/products/{product_id}/candles`

**Base Server:** `https://api.coinbase.com`

## Authentication

Requires bearer token authentication via JWT signed with your CDP API Key Secret (base64-encoded). See Coinbase App Authentication documentation for token generation.

## Request Parameters

### Path Parameter

- **product_id** (string, required): The trading pair identifier (e.g., 'BTC-USD')

### Query Parameters

- **start** (string, required): UNIX timestamp marking interval start
- **end** (string, required): UNIX timestamp marking interval end
- **granularity** (enum, required): Timeframe per candle
  - Options: ONE_MINUTE, FIVE_MINUTE, FIFTEEN_MINUTE, THIRTY_MINUTE, ONE_HOUR, TWO_HOUR, FOUR_HOUR, SIX_HOUR, ONE_DAY
  - Default: UNKNOWN_GRANULARITY
- **limit** (integer, optional): Number of candle buckets returned (default: 350, max: 350)

## Response Schema

### Success (200)

Returns a candles array with objects containing:
- **start**: UNIX timestamp of interval start
- **low**: Minimum price during interval
- **high**: Maximum price during interval
- **open**: Opening price (first trade)
- **close**: Closing price (last trade)
- **volume**: Trading activity volume

### Example Response

```json
{
  "candles": [
    {
      "start": "1639508050",
      "low": "140.21",
      "high": "140.21",
      "open": "140.21",
      "close": "140.21",
      "volume": "56437345"
    }
  ]
}
```

### Error Response

Returns error object with code, message, and details array on failure.
