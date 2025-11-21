# Close Position API Documentation

## Overview

This endpoint allows you to place an order that closes any open positions for a specified product ID.

**Endpoint:** `POST /api/v3/brokerage/orders/close_position`

**Base URL:** `https://api.coinbase.com`

---

## Authentication

The API requires bearer token authentication using a JWT signed with your CDP API Key Secret, encoded in base64. For details on generating credentials, refer to the Coinbase App Authentication documentation on API key creation.

---

## Request Body

**Content Type:** `application/json`

### Required Parameters

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `client_order_id` | string | Unique identifier for order identification purposes | `0000-00000-000000` |
| `product_id` | string | The trading pair identifier | `BIT-28JUL23-CDE` |
| `size` | string | Number of contracts to close | `3` |

### Example Request

```json
{
  "client_order_id": "0000-00000-000000",
  "product_id": "BIT-28JUL23-CDE",
  "size": "3"
}
```

---

## Response

### Success Response (HTTP 200)

**Content Type:** `application/json` or `text/event-stream`

The response includes:

- **success** (boolean): Indicates whether the order was successfully created
- **success_response** (object): Contains order details on successful creation
- **error_response** (object): Contains error information if the order failed
- **order_configuration** (object): Describes the configured order parameters

### Success Response Example

```json
{
  "success": true,
  "success_response": {
    "order_id": "11111-00000-000000",
    "product_id": "BTC-USD",
    "side": "BUY",
    "client_order_id": "0000-00000-000000"
  },
  "error_response": null,
  "order_configuration": {}
}
```

### Error Response Example

```json
{
  "success": false,
  "error_response": {
    "error": "UNKNOWN_FAILURE_REASON",
    "message": "The order configuration was invalid",
    "error_details": "Market orders cannot be placed with empty order sizes",
    "preview_failure_reason": "UNKNOWN_PREVIEW_FAILURE_REASON",
    "new_order_failure_reason": "UNKNOWN_FAILURE_REASON"
  }
}
```

### Default Error Response (Non-200 Status)

```json
{
  "error": "string",
  "code": 123,
  "message": "string",
  "details": []
}
```

---

## Success Response Fields

### NewOrderSuccessResponse

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `order_id` | string | Unique order identifier (required) | `11111-00000-000000` |
| `product_id` | string | Trading pair | `BTC-USD` |
| `side` | string | Order side (BUY or SELL) | `BUY` |
| `client_order_id` | string | Client-provided order identifier | `0000-00000-000000` |

---

## Order Configuration Types

The response's `order_configuration` object can contain various order type configurations:

- **market_market_ioc**: Execute at current best market price immediately
- **market_market_fok**: Execute completely or cancel immediately
- **sor_limit_ioc**: Limit order that fills immediately or cancels
- **limit_limit_gtc**: Limit order remaining until cancellation
- **limit_limit_gtd**: Limit order with specified expiration time
- **limit_limit_fok**: Fill-or-Kill limit order
- **twap_limit_gtd**: Time-weighted average price order
- **stop_limit_stop_limit_gtc**: Stop-limit order (Good-til-Cancelled)
- **stop_limit_stop_limit_gtd**: Stop-limit order with expiration
- **trigger_bracket_gtc**: Bracket order with embedded stop parameters
- **trigger_bracket_gtd**: Bracket order with time expiration
- **scaled_limit_gtc**: Divided order across price range

---

## Common Failure Reasons

Notable failure reasons include:

- `INSUFFICIENT_FUND`: Account lacks required balance
- `INVALID_PRODUCT_ID`: Trading pair not recognized
- `ORDER_ENTRY_DISABLED`: Trading currently unavailable
- `INELIGIBLE_PAIR`: Trading pair restrictions apply
- `INVALID_LIMIT_PRICE`: Specified price violates constraints
- `UNTRADABLE_PRODUCT`: Product cannot be traded currently
- `GEOFENCING_RESTRICTION`: Geographic trading limitations apply

---

## Notes

- The endpoint supports both standard JSON responses and Server-Sent Events (text/event-stream)
- All price and size values are transmitted as strings to preserve precision
- The API is deprecated: false, indicating it remains in active use
