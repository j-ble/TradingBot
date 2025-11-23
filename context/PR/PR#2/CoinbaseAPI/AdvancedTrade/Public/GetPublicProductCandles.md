# Get Public Product Candles

## Overview

Retrieve candlestick data for a specific product, organized into time-based buckets.

## Endpoint

```
GET /api/v3/brokerage/market/products/{product_id}/candles
```

**Base URL:** `https://api.coinbase.com`

## Authentication

Bearer token authentication required using a JWT signed with your CDP API Key Secret (base64 encoded). See Coinbase App Authentication documentation for token generation details.

## Path Parameters

- **product_id** (string, required): The trading pair identifier (e.g., 'BTC-USD')

## Query Parameters

- **start** (string, required): UNIX timestamp for interval start
- **end** (string, required): UNIX timestamp for interval end
- **granularity** (enum, required): Timeframe per candle
  - Options: UNKNOWN_GRANULARITY, ONE_MINUTE, FIVE_MINUTE, FIFTEEN_MINUTE, THIRTY_MINUTE, ONE_HOUR, TWO_HOUR, FOUR_HOUR, SIX_HOUR, ONE_DAY
  - Default: UNKNOWN_GRANULARITY
- **limit** (integer, optional): Number of candle buckets returned (default 350, max 350)

## Response Schema

### Success (200)

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

### Candle Object Properties

- **start**: UNIX timestamp indicating bucket start
- **low**: Lowest price during interval
- **high**: Highest price during interval
- **open**: Opening price (first trade)
- **close**: Closing price (last trade)
- **volume**: Trading activity volume

### Error Response (Default)

```json
{
  "error": "<string>",
  "code": 123,
  "message": "<string>",
  "details": [
    {
      "type_url": "<string>",
      "value": "<byte>"
    }
  ]
}
```

## Content Types

Supports both `application/json` and `text/event-stream` responses.
