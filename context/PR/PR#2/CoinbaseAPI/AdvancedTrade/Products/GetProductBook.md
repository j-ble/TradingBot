# Get Product Book

## Overview

Retrieve a list of bids and asks for a single product, with customizable detail levels via the limit parameter.

## Endpoint Details

**Method:** GET
**Path:** `/api/v3/brokerage/product_book`
**Base URL:** `https://api.coinbase.com`

## Authentication

Requires bearer token authentication using JWT signed with CDP API Key Secret (base64 encoded). Generate credentials through Coinbase App Authentication documentation.

## Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `product_id` | string | Yes | Trading pair identifier (e.g., 'BTC-USD') |
| `limit` | integer | No | Number of bid/ask entries to return |
| `aggregation_price_increment` | string | No | Minimum price intervals at which buy and sell orders are grouped |

## Response Schema

**200 Success Response:**

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

**Error Response (Default):**

```json
{
  "error": "<string>",
  "code": 123,
  "message": "<string>",
  "details": [
    {
      "type_url": "<string>",
      "value": "<base64>"
    }
  ]
}
```

## Response Content Types

- `application/json`
- `text/event-stream`

## Required Response Fields

- `pricebook` (contains product_id, bids, asks)
