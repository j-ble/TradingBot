# Edit Order API Documentation

## Endpoint Overview

The Edit Order endpoint allows modification of existing orders by updating their `size`, `price`, or other parameters.

**Endpoint:** `POST /api/v3/brokerage/orders/edit`
**Base URL:** `https://api.coinbase.com`

## Authentication

Requires bearer token authentication using a JWT signed with your CDP API Key Secret encoded in base64. Refer to Coinbase App Authentication documentation for key generation details.

## Request Body

### Required Parameters

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `order_id` | string | The ID of the order to modify | |
| `price` | string | Updated order price | "19000.00" |
| `size` | string | Updated order size | "0.001" |

### Optional Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `attached_order_configuration` | object | Configuration for attached orders (TriggerBracketGtc, LimitLimitGtc, or StopLimitStopLimitGtc). Available for INTX and FCM products |
| `cancel_attached_order` | boolean | Removes both TP/SL legs; order becomes a simple limit order (INTX/FCM only) |
| `stop_price` | string | Updated stop price for TP/SL or SL orders only (INTX/FCM) |

## Response

### Success Response (200)

```json
{
  "success": true,
  "errors": [
    {
      "edit_failure_reason": "UNKNOWN_EDIT_ORDER_FAILURE_REASON",
      "preview_failure_reason": "UNKNOWN_PREVIEW_FAILURE_REASON"
    }
  ]
}
```

**Response Fields:**
- `success` (boolean): Whether the edit request was placed
- `errors` (array): Array of EditOrderError objects with failure reasons

### Supported Order Types for `attached_order_configuration`

- `market_market_ioc` / `market_market_fok`
- `sor_limit_ioc`
- `limit_limit_gtc` / `limit_limit_gtd` / `limit_limit_fok`
- `twap_limit_gtd`
- `stop_limit_stop_limit_gtc` / `stop_limit_stop_limit_gtd`
- `trigger_bracket_gtc` / `trigger_bracket_gtd`
- `scaled_limit_gtc`

## Edit Failure Reasons

Common failure reasons include:
- `COMMANDER_REJECTED_EDIT_ORDER`
- `CANNOT_EDIT_TO_BELOW_FILLED_SIZE`
- `ORDER_NOT_FOUND`
- `ONLY_LIMIT_ORDER_EDITS_SUPPORTED`
- `ONLY_OPEN_ORDERS_CAN_BE_EDITED`
- `CANNOT_EDIT_FUTURES_ORDER`
- `EXCEEDED_MAX_ALLOWED_EDIT_REQUEST_COUNT`

(30+ additional error codes available for specific scenarios)

## Preview Failure Reasons

Extensive list of validation failures including insufficient funds, invalid price/size, margin issues, compliance restrictions, and product-specific constraints.

## Error Response (Default)

```json
{
  "error": "<string>",
  "code": 123,
  "message": "<string>",
  "details": [
    {
      "type_url": "<string>",
      "value": "<base64_encoded_value>"
    }
  ]
}
```
