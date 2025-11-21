# Get Market Trades

## Overview

Retrieves snapshot data by product ID covering recent trades and current bid/ask prices.

## Endpoint

```
GET /api/v3/brokerage/products/{product_id}/ticker
```

**Base URL:** `https://api.coinbase.com`

## Authentication

Requires bearer token authentication using a JWT signed with your CDP API Key Secret, encoded in base64. See Coinbase App Authentication docs for token generation details.

## Request Parameters

### Path Parameters

- **product_id** (string, required): Trading pair identifier (e.g., 'BTC-USD')

### Query Parameters

- **limit** (integer, required): Number of trades to return
- **start** (string, optional): UNIX timestamp for interval start
- **end** (string, optional): UNIX timestamp for interval end

## Response

### Success Response (200)

```json
{
  "trades": [
    {
      "trade_id": "34b080bf-fcfd-445a-832b-46b5ddc65601",
      "product_id": "BTC-USD",
      "price": "140.91",
      "size": "4",
      "time": "2021-05-31T09:59:59.000Z",
      "side": "BUY",
      "exchange": "<string>"
    }
  ],
  "best_bid": "291.13",
  "best_ask": "292.40"
}
```

### Response Schema

**trades** (array): Historical market trade objects containing:
- trade_id: Unique trade identifier
- product_id: Trading pair
- price: Trade price in quote currency
- size: Trade size in base currency
- time: RFC3339 timestamp
- side: BUY or SELL
- exchange: Exchange identifier

**best_bid** (string): Best bid price in quote currency

**best_ask** (string): Best ask price in quote currency

### Error Response

Default error structure includes:
- error: Error identifier
- code: Integer error code
- message: Error description
- details: Array of error details
