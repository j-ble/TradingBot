# Get Best Bid/Ask

Retrieve the most competitive bid and ask prices across all or selected trading products.

## Endpoint

**GET** `/api/v3/brokerage/best_bid_ask`

**Base URL:** `https://api.coinbase.com`

## Authentication

Requires Bearer token authentication using a JWT signed with your CDP API Key Secret, encoded in base64. See the Coinbase App Authentication documentation for token generation details.

## Query Parameters

- `product_ids` (optional, array of strings): Filter results by specific trading pairs (e.g., 'BTC-USD'). When omitted, all products are returned.

## Response Schema

### Success Response (200)

Returns an object containing a `pricebooks` array:

```json
{
  "pricebooks": [
    {
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
      "time": "<string (RFC3339 Timestamp)>"
    }
  ]
}
```

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

## Response Content Types

- `application/json`
- `text/event-stream` (streaming responses)

## Schema Definitions

**L2Level:** Contains `price` and `size` as string values representing individual bid/ask levels.

**PriceBook:** Required fields include `product_id`, `bids` array, `asks` array, and optional `time` timestamp.
