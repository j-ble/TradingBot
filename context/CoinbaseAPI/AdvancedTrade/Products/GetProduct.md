# Get Product

## Overview

Retrieve comprehensive information about a single product using its product ID through the Coinbase API.

## Endpoint

```
GET /api/v3/brokerage/products/{product_id}
```

**Base URL:** `https://api.coinbase.com`

## Authentication

This endpoint requires Bearer token authentication via JWT signed with your CDP API Key Secret, encoded in base64. Details on generating credentials are available in Coinbase App Authentication documentation.

## Request Parameters

### Path Parameters

- **product_id** (required, string): The trading pair identifier (e.g., 'BTC-USD')

### Query Parameters

- **get_tradability_status** (optional, boolean): When enabled, populates the `view_only` field with product tradability information. Available for SPOT products only.

## Response Schema

The endpoint returns a Product object containing:

### Core Trading Information

- `product_id`: Trading pair identifier
- `price`: Current price in quote currency
- `price_percentage_change_24h`: 24-hour percentage change
- `volume_24h`: Trading volume in last 24 hours
- `volume_percentage_change_24h`: 24-hour volume change percentage

### Size and Increment Details

- `base_increment`: Minimum base value adjustment unit
- `quote_increment`: Minimum quote value adjustment unit
- `base_min_size` / `base_max_size`: Base currency size limits
- `quote_min_size` / `quote_max_size`: Quote currency size limits
- `price_increment`: Minimum price adjustment unit

### Asset Information

- `base_name`: Base currency full name
- `quote_name`: Quote currency full name
- `base_currency_id`: Base currency symbol
- `quote_currency_id`: Quote currency symbol
- `base_display_symbol`: Base display currency symbol
- `quote_display_symbol`: Quote display currency symbol

### Trading Status Flags

- `is_disabled`: Product trading disabled status
- `trading_disabled`: Market-wide trading disabled status
- `cancel_only`: Only cancellations allowed
- `limit_only`: Limit orders only
- `post_only`: Posted orders only
- `auction_mode`: Product in auction mode status

### Product Characteristics

- `product_type`: Product classification (SPOT, FUTURE, etc.)
- `status`: Current product status
- `new`: New product flag
- `watched`: User watchlist status
- `product_venue`: Sole venue identifier
- `mid_market_price`: Current bid-ask midpoint

### Additional Details

- `display_name`: Product display name
- `display_name_overwrite`: Alternative product name
- `icon_url`: Icon image URL
- `icon_color`: Icon color designation
- `market_cap`: Base asset market capitalization
- `about_description`: Asset description for information sections
- `is_alpha_testing`: Alpha testing participation flag

### Futures/FCM Specific

- `fcm_trading_session_details`: Session state, timing, and maintenance info
- `future_product_details`: Contract specifications, expiry details, funding rates, margin requirements
- `view_only`: FCM product expiration status; SPOT tradability status when requested

### Alias Information

- `alias`: Unified book product identifier
- `alias_to`: Products this serves as alias for

## Response Format

**Success (200):** Returns Product object in application/json or text/event-stream format

**Error (Default):** Returns error object containing:
- `error`: Error identifier
- `code`: HTTP status code
- `message`: Human-readable error message
- `details`: Additional error context array

## Example Response

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
  "base_currency_id": "BTC",
  "quote_currency_id": "USD",
  "mid_market_price": "140.22"
}
```
