# Get Public Product

## Overview

Retrieve detailed information for a single trading product using its product ID.

## Endpoint

**GET** `/api/v3/brokerage/market/products/{product_id}`

**Base URL:** `https://api.coinbase.com`

## Authentication

Requires bearer token authentication via JWT signed with your CDP API Key Secret (base64 encoded). Refer to the Coinbase App Authentication documentation for API key generation details.

## Request Parameters

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `product_id` | string | Yes | Trading pair identifier (e.g., 'BTC-USD') |

## Response Schema

### Success Response (200)

Returns a product object with the following properties:

**Core Product Information**
- `product_id` (string): Trading pair identifier
- `price` (string): Current price in quote currency
- `base_name` (string): Base currency name
- `quote_name` (string): Quote currency name
- `base_currency_id` (string): Base currency symbol
- `quote_currency_id` (string): Quote currency symbol

**Market Data (24h)**
- `price_percentage_change_24h` (string): Percentage change in last 24 hours
- `volume_24h` (string): Trading volume in last 24 hours
- `volume_percentage_change_24h` (string): Volume change percentage
- `approximate_quote_24h_volume` (string): Approximate volume in quote currency
- `mid_market_price` (string): Current bid-ask midpoint

**Pricing Increments**
- `base_increment` (string): Minimum base value adjustment
- `quote_increment` (string): Minimum quote value adjustment
- `price_increment` (string): Minimum price adjustment

**Size Constraints**
- `base_min_size`, `base_max_size` (string): Base currency size limits
- `quote_min_size`, `quote_max_size` (string): Quote currency size limits

**Trading Status**
- `is_disabled` (boolean): Product disabled for trading
- `trading_disabled` (boolean): Globally disabled for all participants
- `cancel_only` (boolean): Orders can only be cancelled
- `limit_only` (boolean): Only limit orders allowed
- `post_only` (boolean): Orders can only be posted
- `status` (string): Product status
- `auction_mode` (boolean): In auction mode

**Product Metadata**
- `new` (boolean): Newly listed product
- `new_at` (string): RFC3339 timestamp of listing
- `watched` (boolean): On user's watchlist
- `display_name` (string): Display name (e.g., "BTC PERP")
- `display_name_overwrite` (string): Alternative display name
- `market_cap` (string): Base asset market capitalization
- `icon_url` (string): Icon image URL
- `icon_color` (string): Icon color designation
- `about_description` (string): Asset description
- `is_alpha_testing` (boolean): Alpha testing flag
- `view_only` (boolean): FCM product expiration indicator

**Product Type & Venue**
- `product_type` (enum): SPOT, FUTURE, or UNKNOWN_PRODUCT_TYPE
- `product_venue` (enum): CBE, FCM, INTX, or UNKNOWN_VENUE_TYPE
- `alias` (string): Unified book product ID
- `alias_to` (array): Product IDs using this as alias
- `base_display_symbol`, `quote_display_symbol` (string): Display symbols

**FCM (Futures Commission Merchant) Details**
- `fcm_trading_session_details` (object): Session state, hours, maintenance info
- `future_product_details` (object): Futures-specific contract specifications

### Example Response

```json
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
  "status": "open",
  "cancel_only": false,
  "limit_only": false,
  "post_only": false,
  "trading_disabled": false,
  "auction_mode": false,
  "base_display_symbol": "BTC",
  "quote_display_symbol": "USD",
  "mid_market_price": "140.22"
}
```

### Error Response (Default)

```json
{
  "error": "error_code",
  "code": 123,
  "message": "Error description",
  "details": []
}
```

## Response Content Types

- `application/json`: Standard JSON response
- `text/event-stream`: Server-sent events stream format

## Key Enumerations

**ProductType**
- UNKNOWN_PRODUCT_TYPE
- SPOT
- FUTURE

**ProductVenue**
- UNKNOWN_VENUE_TYPE
- CBE
- FCM
- INTX

**FcmTradingSessionState**
- FCM_TRADING_SESSION_STATE_UNDEFINED
- FCM_TRADING_SESSION_STATE_PRE_OPEN
- FCM_TRADING_SESSION_STATE_PRE_OPEN_NO_CANCEL
- FCM_TRADING_SESSION_STATE_OPEN
- FCM_TRADING_SESSION_STATE_CLOSE

**ContractExpiryType**
- UNKNOWN_CONTRACT_EXPIRY_TYPE
- EXPIRING
- PERPETUAL

## Required Response Fields

- product_id
- price
- volume_24h
- price_percentage_change_24h
- volume_percentage_change_24h
- base_increment through base_max_size
- base_name, quote_name
- watched, is_disabled, new, status
- cancel_only, limit_only, post_only
- trading_disabled, auction_mode
- base_display_symbol, quote_display_symbol
