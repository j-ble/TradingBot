# Get Public Product Book

## Overview

This endpoint retrieves a list of bids and asks for a single product, with customizable detail levels via the limit parameter.

## Endpoint Details

**Method:** GET
**URL:** `https://api.coinbase.com/api/v3/brokerage/market/product_book`

## Authentication

The endpoint requires bearer token authentication. The token must be a JWT signed using your CDP API Key Secret, encoded in base64.

## Request Parameters

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `product_id` | string | Yes | The trading pair (e.g., 'BTC-USD') |
| `limit` | integer | No | Number of bid/ask entries to return |
| `aggregation_price_increment` | string | No | Minimum price intervals for grouping orders in the order book |

## Response Schema

### Success Response (200)

The response returns a `GetProductBookResponse` object containing:

```json
{
  "pricebook": {
    "product_id": "BTC-USD",
    "bids": [
      {
        "price": "<string>",
        "size": "<string>"
      }
    ],
    "asks": [
      {
        "price": "<string>",
        "size": "<string>"
      }
    ],
    "time": "<string>"
  },
  "last": "<string>",
  "mid_market": "<string>",
  "spread_bps": "<string>",
  "spread_absolute": "<string>"
}
```

### Response Fields

- **pricebook:** Core order book data containing product ID, bids, asks, and timestamp
- **last:** Last traded price
- **mid_market:** Midpoint between bid and ask
- **spread_bps:** Spread in basis points
- **spread_absolute:** Absolute spread value

### Error Response

Default error responses return a gRPC error format with error, code, message, and details fields.

## Content Types

The endpoint supports both `application/json` and `text/event-stream` response formats.
