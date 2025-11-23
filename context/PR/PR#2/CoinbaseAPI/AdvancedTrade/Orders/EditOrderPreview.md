# Edit Order Preview

## Overview

This endpoint allows you to preview an edit order request with specified updates to order size or price.

## API Endpoint

**POST** `/api/v3/brokerage/orders/edit_preview`

**Base URL:** `https://api.coinbase.com`

## Authentication

Requires Bearer token authentication via JWT signed with your CDP API Key Secret (base64 encoded). Refer to the authentication documentation for token generation instructions.

## Request Body

### Required Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `order_id` | string | The ID of the order being edited |
| `price` | string | Updated order price (e.g., `"19000.00"`) |
| `size` | string | Updated order size (e.g., `"0.001"`) |

### Optional Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `attached_order_configuration` | object | Configuration for attached orders (TriggerBracketGtc, LimitLimitGtc, or StopLimitStopLimitGtc). Available for INTX/FCM products |
| `cancel_attached_order` | boolean | Removes both TP/SL legs, converting order to simple limit. Available for INTX/FCM |
| `stop_price` | string | Updated stop price for TP/SL or SL orders (e.g., `"17000.00"`) |

## Response

### Success Response (200)

Returns a preview object containing:

| Field | Type | Description |
|-------|------|-------------|
| `errors` | array | Any validation or preview errors encountered |
| `slippage` | string | Expected price slippage |
| `order_total` | string | Total order value |
| `commission_total` | string | Total commission charges |
| `quote_size` | string | Quote asset amount (e.g., USD in BTC/USD pair) |
| `base_size` | string | Base asset amount (e.g., BTC in BTC/USD pair) |
| `best_bid` | string | Current best bid price |
| `best_ask` | string | Current best ask price |
| `average_filled_price` | string | Average execution price if partially filled |
| `order_margin_total` | string | Margin requirement for order |
| `commission_detail_total` | object | Breakdown: total_commission, gst_commission, withholding_commission, client_commission, venue_commission, regulatory_commission, clearing_commission |
| `pnl_configuration` | object | Expected PNL (estimate; excludes fees and slippage) |

### Error Response

Default error responses include:
- `error` (string)
- `code` (integer)
- `message` (string)
- `details` (array)

## Supported Order Types

Editable configurations include:
- Market orders (IOC/FOK)
- Limit orders (GTC/GTD/FOK)
- SOR Limit IOC
- TWAP Limit GTD
- Stop-Limit orders (GTC/GTD)
- Trigger Bracket orders (GTC/GTD)
- Scaled Limit GTC

## Error Codes

Common edit failure reasons include:
- `ORDER_NOT_FOUND`
- `ONLY_LIMIT_ORDER_EDITS_SUPPORTED`
- `INVALID_EDITED_SIZE` / `INVALID_EDITED_PRICE`
- `CANNOT_EDIT_TO_BELOW_FILLED_SIZE`
- `ONLY_OPEN_ORDERS_CAN_BE_EDITED`
- `EXCEEDED_MAX_ALLOWED_EDIT_REQUEST_COUNT`

## Example Request

```json
{
  "order_id": "string",
  "price": "19000.00",
  "size": "0.001",
  "stop_price": "17000.00"
}
```

## Example Response

```json
{
  "errors": [],
  "quote_size": "10",
  "base_size": "0.001",
  "slippage": "string",
  "order_total": "string",
  "commission_total": "string",
  "best_bid": "string",
  "best_ask": "string",
  "average_filled_price": "string",
  "order_margin_total": "string",
  "commission_detail_total": {
    "total_commission": "string"
  },
  "pnl_configuration": {
    "trigger_bracket_pnl": {
      "take_profit_pnl": "string",
      "stop_loss_pnl": "string"
    }
  }
}
```
