# Get Order

> Retrieve a single order by order ID.

## Endpoint

**GET** `/api/v3/brokerage/orders/historical/{order_id}`

**Base URL:** `https://api.coinbase.com`

## Authentication

This endpoint requires Bearer token authentication using a JWT signed with your CDP API Key Secret, encoded in base64. Refer to the Coinbase App Authentication documentation for details on generating your Bearer Token.

**Security Scheme:** `apiKeyAuth`
- **Type:** HTTP Bearer
- **Header:** `Authorization`

## Request Parameters

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `order_id` | string | Yes | The ID of the order to retrieve |

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `client_order_id` | string | No | **(Deprecated)** Client Order ID to fetch the order with |
| `user_native_currency` | string | No | **(Deprecated)** Native currency for order retrieval; defaults to USD |

## Response

### Success (200)

Returns a `GetHistoricalOrderResponse` object containing the order details.

#### Response Schema

```json
{
  "order": {
    "order_id": "string",
    "product_id": "string",
    "user_id": "string",
    "order_configuration": { },
    "side": "BUY|SELL",
    "client_order_id": "string",
    "status": "PENDING|OPEN|FILLED|CANCELLED|EXPIRED|FAILED|UNKNOWN_ORDER_STATUS|QUEUED|CANCEL_QUEUED|EDIT_QUEUED",
    "time_in_force": "UNKNOWN_TIME_IN_FORCE|GOOD_UNTIL_DATE_TIME|GOOD_UNTIL_CANCELLED|IMMEDIATE_OR_CANCEL|FILL_OR_KILL",
    "created_time": "RFC3339 Timestamp",
    "completion_percentage": "string",
    "filled_size": "string",
    "average_filled_price": "string",
    "number_of_fills": "string",
    "filled_value": "string",
    "pending_cancel": "boolean",
    "size_in_quote": "boolean",
    "total_fees": "string",
    "size_inclusive_of_fees": "boolean",
    "total_value_after_fees": "string",
    "trigger_status": "UNKNOWN_TRIGGER_STATUS|INVALID_ORDER_TYPE|STOP_PENDING|STOP_TRIGGERED",
    "order_type": "UNKNOWN_ORDER_TYPE|MARKET|LIMIT|STOP|STOP_LIMIT|BRACKET|TWAP|ROLL_OPEN|ROLL_CLOSE|LIQUIDATION|SCALED",
    "reject_reason": "REJECT_REASON_UNSPECIFIED|HOLD_FAILURE|TOO_MANY_OPEN_ORDERS|REJECT_REASON_INSUFFICIENT_FUNDS|RATE_LIMIT_EXCEEDED",
    "settled": "boolean",
    "product_type": "UNKNOWN_PRODUCT_TYPE|SPOT|FUTURE",
    "reject_message": "string",
    "cancel_message": "string",
    "order_placement_source": "UNKNOWN_PLACEMENT_SOURCE|RETAIL_SIMPLE|RETAIL_ADVANCED",
    "outstanding_hold_amount": "string",
    "is_liquidation": "boolean",
    "last_fill_time": "RFC3339 Timestamp",
    "edit_history": [ ],
    "leverage": "string",
    "margin_type": "CROSS|ISOLATED",
    "retail_portfolio_id": "UUID",
    "originating_order_id": "UUID",
    "attached_order_id": "UUID",
    "attached_order_configuration": { },
    "current_pending_replace": { },
    "commission_detail_total": { },
    "workable_size": "string",
    "workable_size_completion_pct": "string",
    "product_details": { },
    "cost_basis_method": "COST_BASIS_METHOD_UNSPECIFIED|COST_BASIS_METHOD_HIFO|COST_BASIS_METHOD_LIFO|COST_BASIS_METHOD_FIFO",
    "displayed_order_config": "UNKNOWN_DISPLAYED_ORDER_CONFIG|INSTANT_GFD|LIMIT_GFD",
    "equity_trading_session": "UNKNOWN_EQUITY_TRADING_SESSION|EQUITY_TRADING_SESSION_NORMAL|EQUITY_TRADING_SESSION_AFTER_HOURS|EQUITY_TRADING_SESSION_MULTI_SESSION|EQUITY_TRADING_SESSION_OVERNIGHT|EQUITY_TRADING_SESSION_PRE_MARKET"
  }
}
```

### Error Response (Default)

```json
{
  "error": "string",
  "code": "integer",
  "message": "string",
  "details": [
    {
      "type_url": "string",
      "value": "byte"
    }
  ]
}
```

## Order Configuration Types

The endpoint supports multiple order configuration types:

- **Market IOC/FOK:** Immediate execution at current market price
- **SOR Limit IOC:** Limit order that fills immediately or cancels remainder
- **Limit GTC/GTD/FOK:** Limit orders with various time-in-force options
- **TWAP Limit GTD:** Time-weighted average price orders
- **Stop Limit GTC/GTD:** Orders triggered by stop price
- **Trigger Bracket GTC/GTD:** Limit orders with embedded stop parameters
- **Scaled Limit GTC:** Large orders split across price range

## Content Type

Responses available in:
- `application/json`
- `text/event-stream`
