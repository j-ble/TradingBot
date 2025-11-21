# Create Order API Documentation

## Overview

The Create Order endpoint allows you to submit orders to Coinbase's trading system by specifying a product ID (asset-pair), side (buy/sell), and order configuration.

**Endpoint:** `POST /api/v3/brokerage/orders`

**Base URL:** `https://api.coinbase.com`

## Authentication

The API requires Bearer token authentication using a JWT signed with your CDP API Key Secret, encoded in base64. Refer to the Coinbase App Authentication documentation for details on generating your Bearer Token.

**Header:** `Authorization: Bearer <jwt_token>`

## Request Body Parameters

### Required Fields

- **client_order_id** (string): A unique identifier for the order. If the ID is not unique, the system returns the existing order instead of creating a new one.

- **product_id** (string): The trading pair identifier (e.g., "BTC-USD")

- **side** (enum): The market side - either "BUY" or "SELL"

- **order_configuration** (object): Specifies the order type and parameters

### Optional Fields

- **leverage** (string): Multiplier for the order (default: "1.0")

- **margin_type** (enum): Either "CROSS" or "ISOLATED" (default: "CROSS")

- **retail_portfolio_id** (string): Portfolio association (deprecated for CDP keys)

- **preview_id** (string): Associates the order with a preview request

- **attached_order_configuration** (object): Configuration for attached orders (TriggerBracketGtc only)

- **sor_preference** (enum): Smart Order Routing preference - "SOR_ENABLED", "SOR_DISABLED", or "SOR_PREFERENCE_UNSPECIFIED"

- **prediction_metadata** (object): For prediction market orders

- **cost_basis_method** (enum): Tax lot matching method - "COST_BASIS_METHOD_HIFO", "COST_BASIS_METHOD_LIFO", "COST_BASIS_METHOD_FIFO"

## Order Configuration Types

The system supports multiple order types through the `order_configuration` object:

### Market Orders

- **market_market_ioc**: Execute immediately at current best market price
- **market_market_fok**: Execute immediately and completely or cancel

### Limit Orders

- **limit_limit_gtc**: Remains on book until canceled
- **limit_limit_gtd**: Remains on book until specified end time
- **limit_limit_fok**: Execute completely immediately or cancel
- **sor_limit_ioc**: Smart Order Routing limit with immediate fill or cancel

### Advanced Orders

- **twap_limit_gtd**: Time-weighted average price execution over specified duration
- **stop_limit_stop_limit_gtc**: Triggers when price reaches stop level, then posts limit order
- **stop_limit_stop_limit_gtd**: Stop-limit order with time expiration
- **trigger_bracket_gtc**: Limit order with embedded stop-loss parameters
- **trigger_bracket_gtd**: Bracket order with time expiration
- **scaled_limit_gtc**: Divides large orders into incremental smaller orders across price range

### Common Order Fields

- **base_size** (string): Amount of the primary asset (e.g., BTC in BTC-USD)
- **quote_size** (string): Amount of the secondary asset (e.g., USD in BTC-USD)
- **limit_price** (string): Execution price or better
- **post_only** (boolean): Only place as maker order
- **end_time** (RFC3339 timestamp): Order expiration time

## Response Format

### Success Response (HTTP 200)

```json
{
  "success": true,
  "success_response": {
    "order_id": "11111-00000-000000",
    "product_id": "BTC-USD",
    "side": "BUY",
    "client_order_id": "0000-00000-000000"
  },
  "order_configuration": { }
}
```

### Error Response

```json
{
  "success": false,
  "error_response": {
    "error": "UNKNOWN_FAILURE_REASON",
    "message": "The order configuration was invalid",
    "error_details": "Market orders cannot be placed with empty order sizes",
    "new_order_failure_reason": "UNKNOWN_FAILURE_REASON"
  }
}
```

## Common Failure Reasons

- UNSUPPORTED_ORDER_CONFIGURATION
- INSUFFICIENT_FUND
- INVALID_PRODUCT_ID
- INVALID_SIDE
- INVALID_SIZE_PRECISION
- INVALID_PRICE_PRECISION
- ORDER_ENTRY_DISABLED
- UNTRADABLE_PRODUCT
- GEOFENCING_RESTRICTION
- FOK_DISABLED
- POST_ONLY_NOT_ALLOWED_WITH_FOK
- INVALID_LEVERAGE
- INVALID_MARGIN_TYPE

## Example Request

```json
{
  "client_order_id": "0000-00000-000000",
  "product_id": "BTC-USD",
  "side": "BUY",
  "order_configuration": {
    "limit_limit_gtc": {
      "base_size": "0.001",
      "limit_price": "10000.00",
      "post_only": false
    }
  }
}
```

## Response Content Types

The API returns responses in either `application/json` or `text/event-stream` format depending on client requirements.
