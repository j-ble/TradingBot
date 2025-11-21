# List Products API Documentation

## Overview

This endpoint retrieves available currency pairs for trading from the Coinbase API.

**Endpoint:** `GET /api/v3/brokerage/products`

**Base URL:** `https://api.coinbase.com`

## Authentication

The API requires bearer token authentication using a JWT signed with your CDP API Key Secret. The token should be encoded in base64 and provided in the Authorization header as: `Authorization: Bearer <token>`

## Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `limit` | integer | No | Number of products to return |
| `offset` | integer | No | Number of products to skip |
| `product_type` | enum | No | Filter by type: SPOT, FUTURE (default: UNKNOWN_PRODUCT_TYPE) |
| `product_ids` | array | No | Specific trading pairs like 'BTC-USD' |
| `contract_expiry_type` | enum | No | EXPIRING or PERPETUAL (futures only) |
| `expiring_contract_status` | enum | No | STATUS_UNEXPIRED, STATUS_EXPIRED, or STATUS_ALL |
| `get_tradability_status` | boolean | No | Include tradability status (SPOT only) |
| `get_all_products` | boolean | No | Return all products including expired futures |
| `products_sort_order` | enum | No | Sort by volume (24h descending) or list time |
| `cursor` | string | No | Base64-encoded pagination cursor |

## Response Schema

### Success Response (200)

```json
{
  "products": [
    {
      "product_id": "BTC-USD",
      "price": "140.21",
      "price_percentage_change_24h": "9.43%",
      "volume_24h": "1908432",
      "volume_percentage_change_24h": "9.43%",
      "base_increment": "0.00000001",
      "quote_increment": "0.00000001",
      "quote_min_size": "0.00000001",
      "quote_max_size": "1000",
      "base_min_size": "0.00000001",
      "base_max_size": "1000",
      "base_name": "Bitcoin",
      "quote_name": "US Dollar",
      "watched": true,
      "is_disabled": false,
      "new": true,
      "status": "string",
      "cancel_only": true,
      "limit_only": true,
      "post_only": true,
      "trading_disabled": false,
      "auction_mode": true,
      "product_type": "SPOT",
      "quote_currency_id": "USD",
      "base_currency_id": "BTC",
      "mid_market_price": "140.22",
      "alias": "BTC-USD",
      "alias_to": ["BTC-USDC"],
      "base_display_symbol": "BTC",
      "quote_display_symbol": "USD",
      "view_only": false,
      "price_increment": "0.00000001",
      "display_name": "BTC PERP",
      "product_venue": "neptune",
      "approximate_quote_24h_volume": "1908432",
      "market_cap": "1500000000000",
      "icon_color": "red",
      "icon_url": "https://metadata.cbhq.net/equity_icons/123456789.png"
    }
  ],
  "num_products": 100,
  "pagination": {
    "prev_cursor": "string",
    "next_cursor": "string",
    "has_next": true,
    "has_prev": true
  }
}
```

### Product Object - Key Fields

- **product_id:** Trading pair identifier (e.g., 'BTC-USD')
- **price:** Current price in quote currency
- **volume_24h:** Trading volume over 24 hours
- **base_increment/quote_increment:** Minimum precision for orders
- **base_min_size/base_max_size:** Tradeable range for base currency
- **quote_min_size/quote_max_size:** Tradeable range for quote currency
- **trading_disabled:** Indicates if product is unavailable market-wide
- **cancel_only:** Only cancellation orders accepted
- **limit_only:** No market orders allowed
- **post_only:** Cannot cancel existing orders

### Futures-Specific Fields

Products with `product_type: FUTURE` include:

```json
{
  "future_product_details": {
    "contract_code": "string",
    "contract_expiry": "2024-12-20T00:00:00Z",
    "contract_size": "string",
    "contract_expiry_type": "PERPETUAL",
    "perpetual_details": {
      "open_interest": "string",
      "funding_rate": "string",
      "max_leverage": "string"
    },
    "funding_interval": "string",
    "settlement_price": "string",
    "intraday_margin_rate": {
      "long_margin_rate": "0.5",
      "short_margin_rate": "0.5"
    },
    "overnight_margin_rate": {
      "long_margin_rate": "0.5",
      "short_margin_rate": "0.5"
    }
  }
}
```

## Error Response

```json
{
  "error": "string",
  "code": 123,
  "message": "string",
  "details": [
    {
      "type_url": "string",
      "value": "base64-encoded-data"
    }
  ]
}
```

## Product Types

- **UNKNOWN_PRODUCT_TYPE** - Default/unspecified
- **SPOT** - Immediate trading pairs
- **FUTURE** - Futures contracts

## Contract Expiry Types

- **UNKNOWN_CONTRACT_EXPIRY_TYPE** - Default
- **EXPIRING** - Time-bound contracts
- **PERPETUAL** - No expiration date

## Product Venues

- **CBE** - Coinbase Exchange
- **FCM** - Futures Commission Merchant
- **INTX** - Institutional exchange
