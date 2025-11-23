# List Public Products

> Retrieve available currency pairs for trading operations.

## Overview

**Endpoint:** `GET /api/v3/brokerage/market/products`

**Base URL:** `https://api.coinbase.com`

**Purpose:** Obtain a comprehensive list of tradable products including spot and futures contracts.

---

## Authentication

This endpoint requires bearer token authentication:

- **Scheme:** HTTP Bearer
- **Token Format:** JWT signed with CDP API Key Secret, encoded in base64
- **Header:** `Authorization: Bearer <token>`

Refer to Coinbase App Authentication documentation for API key generation procedures.

---

## Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `limit` | integer | No | Quantity of products to return |
| `offset` | integer | No | Number of products to skip |
| `product_type` | enum | No | Filter by type: `SPOT`, `FUTURE`, `UNKNOWN_PRODUCT_TYPE` |
| `product_ids` | array | No | Filter by trading pairs (e.g., 'BTC-USD') |
| `contract_expiry_type` | enum | No | Filter by expiry: `EXPIRING`, `PERPETUAL` |
| `expiring_contract_status` | enum | No | Status filter: `STATUS_UNEXPIRED`, `STATUS_EXPIRED`, `STATUS_ALL` |
| `get_all_products` | boolean | No | Return all products including expired futures |
| `products_sort_order` | enum | No | Sort by: `VOLUME_24H_DESCENDING`, `LIST_TIME_DESCENDING` |
| `cursor` | string | No | Base64-encoded pagination cursor |

---

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
      "product_type": "UNKNOWN_PRODUCT_TYPE",
      "quote_currency_id": "USD",
      "base_currency_id": "BTC",
      "mid_market_price": "140.22",
      "alias": "BTC-USD",
      "alias_to": ["BTC-USDC"],
      "base_display_symbol": "BTC",
      "quote_display_symbol": "USD",
      "view_only": true,
      "price_increment": "0.00000001",
      "display_name": "BTC PERP",
      "product_venue": "neptune",
      "approximate_quote_24h_volume": "1908432",
      "new_at": "2021-07-01T00:00:00.000Z",
      "market_cap": "1500000000000",
      "icon_color": "red",
      "icon_url": "https://metadata.cbhq.net/equity_icons/123456789.png",
      "display_name_overwrite": "Bitcoin Perpetual",
      "is_alpha_testing": false,
      "about_description": "nano Crude Oil Futures is a monthly cash-settled contract...",
      "future_product_details": {
        "venue": "string",
        "contract_code": "string",
        "contract_expiry": "2021-07-01T00:00:00.000Z",
        "contract_size": "string",
        "contract_root_unit": "string",
        "group_description": "string",
        "contract_expiry_timezone": "string",
        "group_short_description": "string",
        "risk_managed_by": "UNKNOWN_RISK_MANAGEMENT_TYPE",
        "contract_expiry_type": "UNKNOWN_CONTRACT_EXPIRY_TYPE",
        "perpetual_details": {
          "open_interest": "string",
          "funding_rate": "string",
          "funding_time": "2021-07-01T00:00:00.000Z",
          "max_leverage": "string",
          "base_asset_uuid": "string",
          "underlying_type": "string"
        },
        "contract_display_name": "string",
        "time_to_expiry_ms": "string",
        "non_crypto": true,
        "contract_expiry_name": "string",
        "twenty_four_by_seven": true,
        "funding_interval": "string",
        "open_interest": "string",
        "funding_rate": "string",
        "funding_time": "2021-07-01T00:00:00.000Z",
        "display_name": "string",
        "intraday_margin_rate": {
          "long_margin_rate": "0.5",
          "short_margin_rate": "0.5"
        },
        "overnight_margin_rate": {
          "long_margin_rate": "0.5",
          "short_margin_rate": "0.5"
        },
        "settlement_price": "string"
      },
      "fcm_trading_session_details": {
        "is_session_open": true,
        "open_time": "string",
        "close_time": "string",
        "session_state": "FCM_TRADING_SESSION_STATE_UNDEFINED",
        "after_hours_order_entry_disabled": true,
        "closed_reason": "FCM_TRADING_SESSION_CLOSED_REASON_UNDEFINED",
        "maintenance": {
          "start_time": "string",
          "end_time": "string"
        }
      }
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

### Error Response (Default)

```json
{
  "error": "string",
  "code": 123,
  "message": "string",
  "details": [
    {
      "type_url": "string",
      "value": "aSDinaTvuI8gbWludGxpZnk="
    }
  ]
}
```

---

## Product Object Properties

### Core Trading Information

- **product_id:** Trading pair identifier
- **price:** Current quote currency price
- **base_currency_id / quote_currency_id:** Currency symbols
- **base_name / quote_name:** Full currency names

### 24-Hour Metrics

- **price_percentage_change_24h:** Price movement percentage
- **volume_24h:** Trading volume
- **volume_percentage_change_24h:** Volume change percentage
- **mid_market_price:** Bid-ask spread midpoint

### Size and Increment Rules

- **base_increment / quote_increment:** Minimum adjustment amounts
- **base_min_size / base_max_size:** Base currency limits
- **quote_min_size / quote_max_size:** Quote currency limits
- **price_increment:** Minimum price adjustment

### Trading Status Flags

- **is_disabled:** Product unavailable for trading
- **trading_disabled:** Disabled for all participants
- **cancel_only:** Only cancellation operations permitted
- **limit_only:** Market orders prohibited
- **post_only:** Posting only allowed
- **auction_mode:** Product in auction state

### Product Classification

- **product_type:** `SPOT` or `FUTURE`
- **product_venue:** `CBE`, `FCM`, or `INTX`
- **status:** Current operational status
- **view_only:** FCM expiration indicator

### Display and Metadata

- **display_name:** User-friendly product identifier
- **display_name_overwrite:** Alternative display name
- **icon_url / icon_color:** Visual assets
- **new:** Newly listed indicator
- **new_at:** Listing timestamp
- **market_cap:** Base asset valuation
- **watched:** Watchlist membership

### Futures-Specific Fields

- **future_product_details:** Contract specifications
- **fcm_trading_session_details:** Session information
- **contract_expiry_type:** `EXPIRING` or `PERPETUAL`

---

## Enumerations

**ProductType:** `UNKNOWN_PRODUCT_TYPE`, `SPOT`, `FUTURE`

**ContractExpiryType:** `UNKNOWN_CONTRACT_EXPIRY_TYPE`, `EXPIRING`, `PERPETUAL`

**ProductVenue:** `UNKNOWN_VENUE_TYPE`, `CBE`, `FCM`, `INTX`

**RiskManagementType:** `UNKNOWN_RISK_MANAGEMENT_TYPE`, `MANAGED_BY_FCM`, `MANAGED_BY_VENUE`

**FcmTradingSessionState:** `FCM_TRADING_SESSION_STATE_UNDEFINED`, `FCM_TRADING_SESSION_STATE_PRE_OPEN`, `FCM_TRADING_SESSION_STATE_PRE_OPEN_NO_CANCEL`, `FCM_TRADING_SESSION_STATE_OPEN`, `FCM_TRADING_SESSION_STATE_CLOSE`

**FcmTradingSessionClosedReason:** `FCM_TRADING_SESSION_CLOSED_REASON_UNDEFINED`, `FCM_TRADING_SESSION_CLOSED_REASON_REGULAR_MARKET_CLOSE`, `FCM_TRADING_SESSION_CLOSED_REASON_EXCHANGE_MAINTENANCE`, `FCM_TRADING_SESSION_CLOSED_REASON_VENDOR_MAINTENANCE`

---

## Response Formats

The endpoint supports two content types:
- **application/json:** Standard JSON response
- **text/event-stream:** Server-sent events stream

---

## Pagination

Navigate results using cursor-based pagination:
- **next_cursor:** Token for subsequent page retrieval
- **prev_cursor:** Token for previous page access
- **has_next / has_prev:** Boolean indicators for pagination availability
