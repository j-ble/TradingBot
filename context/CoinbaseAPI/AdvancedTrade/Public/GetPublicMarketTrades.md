# Get Public Market Trades

Retrieve snapshot data about recent trades and current bid/ask spreads for a specific trading pair.

## Endpoint Details

**Path:** `/api/v3/brokerage/market/products/{product_id}/ticker`

**Method:** GET

**Base URL:** `https://api.coinbase.com`

## Authentication

Requires bearer token authentication using a JWT signed with your CDP API Key Secret (base64-encoded). See the Coinbase App Authentication documentation for token generation instructions.

## Request Parameters

### Path Parameters

- `product_id` (string, required): Trading pair identifier (e.g., 'BTC-USD')

### Query Parameters

- `limit` (integer, required): Number of trades to return
- `start` (string, optional): UNIX timestamp for interval start
- `end` (string, optional): UNIX timestamp for interval end

## Response Schema

### Success Response (200)

Returns object containing:

- **trades** (array): Historical market trades with properties:
  - `trade_id` (string): Unique trade identifier
  - `product_id` (string): Trading pair
  - `price` (string): Trade price in quote currency
  - `size` (string): Trade size in base currency
  - `time` (string): RFC3339 timestamp
  - `side` (enum): BUY or SELL
  - `exchange` (string): Exchange location

- **best_bid** (string): Highest current bid price
- **best_ask** (string): Lowest current ask price

### Example Response

```json
{
  "trades": [{
    "trade_id": "34b080bf-fcfd-445a-832b-46b5ddc65601",
    "product_id": "BTC-USD",
    "price": "140.91",
    "size": "4",
    "time": "2021-05-31T09:59:59.000Z",
    "side": "BUY"
  }],
  "best_bid": "291.13",
  "best_ask": "292.40"
}
```

### Error Response

Default error format includes:
- `error` (string): Error identifier
- `code` (integer): Error code
- `message` (string): Descriptive message
- `details` (array): Additional error information
