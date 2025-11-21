# Preview Order API Documentation

## Overview

The Preview Order endpoint allows you to preview an order before submission, retrieving estimated costs, fees, and potential failure reasons.

## Endpoint Details

**Method:** POST
**Path:** `/api/v3/brokerage/orders/preview`
**Base URL:** `https://api.coinbase.com`

## Authentication

This endpoint requires Bearer token authentication using a JWT signed with your CDP API Key Secret, encoded in base64. Refer to the Coinbase App Authentication documentation for instructions on generating your Bearer Token.

## Request Parameters

### Body (application/json)

The request body requires the following fields:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `product_id` | string | Yes | The trading pair (e.g., 'BTC-USD') |
| `side` | string | Yes | Order side: BUY or SELL |
| `order_configuration` | object | Yes | The order setup details including type, size, and pricing |
| `leverage` | string | No | Leverage amount; defaults to '1.0' |
| `margin_type` | string | No | CROSS or ISOLATED; defaults to CROSS |
| `retail_portfolio_id` | string | No | (Deprecated) Portfolio ID for legacy keys |
| `attached_order_configuration` | object | No | Setup for attached orders; only TriggerBracketGtc eligible |
| `prediction_metadata` | object | No | Metadata for prediction market orders (YES/NO) |

### Order Configuration Types

Supported order types include:

- **market_market_ioc** - Market order, immediate or cancel
- **market_market_fok** - Market order, fill or kill
- **sor_limit_ioc** - Smart order router limit, immediate or cancel
- **limit_limit_gtc** - Limit order, good till canceled
- **limit_limit_gtd** - Limit order, good till date
- **limit_limit_fok** - Limit order, fill or kill
- **twap_limit_gtd** - Time-weighted average price order
- **stop_limit_stop_limit_gtc** - Stop-limit, good till canceled
- **stop_limit_stop_limit_gtd** - Stop-limit, good till date
- **trigger_bracket_gtc** - Bracket order, good till canceled
- **trigger_bracket_gtd** - Bracket order, good till date
- **scaled_limit_gtc** - Scaled limit order

## Response Schema

### Success Response (200)

The response contains preview details and estimated execution parameters:

| Field | Type | Description |
|-------|------|-------------|
| `order_total` | string | Total order cost |
| `commission_total` | string | Currency amount of the applied commission (so not the rate that was used on input) |
| `errs` | array | Potential failure reasons if order were submitted |
| `warning` | array | Warning messages |
| `quote_size` | string | Amount of quote asset (e.g., USD in BTC-USD) |
| `base_size` | string | Amount of base asset (e.g., BTC in BTC-USD) |
| `best_bid` | string | Current best bid price |
| `best_ask` | string | Current best ask price |
| `is_max` | boolean | Whether tradable balance should be set to maximum |
| `leverage` | string | Applied leverage (default '1.0') |
| `slippage` | string | Estimated price slippage |
| `preview_id` | string | Unique preview identifier |
| `current_liquidation_buffer` | string | Current liquidation buffer for margin accounts |
| `projected_liquidation_buffer` | string | Projected liquidation buffer after order |
| `max_leverage` | string | Maximum available leverage |
| `pnl_configuration` | object | Expected profit/loss for bracket orders |
| `twap_bucket_metadata` | object | TWAP execution bucket details |
| `margin_ratio_data` | object | Current and projected margin ratios |
| `commission_detail_total` | object | Breakdown of commission charges |
| `scaled_metadata` | object | Distribution details for scaled orders |
| `compliance_limit_data` | object | Compliance limit information |
| `est_average_filled_price` | string | Estimated fill price |

### Error Response

Returns standard error object with fields: `error`, `code`, `message`, and `details`.

## Preview Failure Reasons

The API returns detailed failure codes including:

- Insufficient funds
- Invalid price or size precision
- Liquidity issues
- Margin health violations
- Leverage limit breaches
- Account restrictions
- Market condition issues
- And 100+ additional validation checks

## Request Example

```json
{
  "product_id": "BTC-USD",
  "side": "BUY",
  "order_configuration": {
    "limit_limit_gtc": {
      "base_size": "0.001",
      "limit_price": "10000.00",
      "post_only": false
    }
  },
  "leverage": "1.0",
  "margin_type": "CROSS"
}
```

## Response Format

The endpoint supports both `application/json` and `text/event-stream` response types for streaming updates.
