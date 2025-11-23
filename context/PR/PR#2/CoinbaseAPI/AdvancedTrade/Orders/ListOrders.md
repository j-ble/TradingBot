# List Orders API Documentation

## Overview

Retrieve a filtered list of orders from Coinbase's brokerage API with optional query parameters for customization.

## Endpoint Details

**Method:** GET
**Path:** `/api/v3/brokerage/orders/historical/batch`
**Base URL:** `https://api.coinbase.com`

## Authentication

The endpoint requires bearer token authentication via a JWT signed with your CDP API Key Secret, encoded in base64. Refer to the Creating API Keys section of Coinbase App Authentication docs for token generation details.

## Query Parameters

### Filtering Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `order_ids` | array[string] | Specific order ID(s) to retrieve |
| `product_ids` | array[string] | Product ID(s); defaults to all products |
| `product_type` | enum | UNKNOWN_PRODUCT_TYPE, SPOT, or FUTURE |
| `order_status` | array[string] | Filter by status (PENDING, OPEN, FILLED, CANCELLED, EXPIRED, FAILED, UNKNOWN_ORDER_STATUS, QUEUED, CANCEL_QUEUED, EDIT_QUEUED) |
| `time_in_forces` | array[string] | Filter by time in force (UNKNOWN_TIME_IN_FORCE, GOOD_UNTIL_DATE_TIME, GOOD_UNTIL_CANCELLED, IMMEDIATE_OR_CANCEL, FILL_OR_KILL) |
| `order_types` | array[string] | Filter by type (UNKNOWN_ORDER_TYPE, MARKET, LIMIT, STOP, STOP_LIMIT, BRACKET, TWAP, ROLL_OPEN, ROLL_CLOSE, LIQUIDATION, SCALED) |
| `order_side` | enum | BUY or SELL |
| `start_date` | string (RFC3339) | Inclusive start date for order retrieval |
| `end_date` | string (RFC3339) | Exclusive end date for order retrieval |
| `order_placement_source` | enum | UNKNOWN_PLACEMENT_SOURCE, RETAIL_SIMPLE, or RETAIL_ADVANCED (default: RETAIL_ADVANCED) |
| `contract_expiry_type` | enum | UNKNOWN_CONTRACT_EXPIRY_TYPE, EXPIRING, or PERPETUAL (futures only) |
| `asset_filters` | array[string] | Filter by quote, base, or underlying asset |
| `retail_portfolio_id` | string | (Deprecated) Filter by retail portfolio ID |

### Pagination & Sorting

| Parameter | Type | Description |
|-----------|------|-------------|
| `limit` | integer | Results per page; if has_next is true, additional pages available |
| `cursor` | string | For paginated responses, returns results after this cursor value |
| `sort_by` | enum | UNKNOWN_SORT_BY, LIMIT_PRICE, or LAST_FILL_TIME (default sorts by creation time) |

### Additional Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `user_native_currency` | string | (Deprecated) Native currency; defaults to USD |
| `use_simplified_total_value_calculation` | boolean | Use simplified total value calculation (default: true) |

## Response Schema

### Success Response (200)

```json
{
  "orders": [
    {
      "order_id": "0000-000000-000000",
      "product_id": "BTC-USD",
      "user_id": "2222-000000-000000",
      "order_configuration": { },
      "side": "BUY",
      "client_order_id": "11111-000000-000000",
      "status": "PENDING",
      "time_in_force": "UNKNOWN_TIME_IN_FORCE",
      "created_time": "2021-05-31T09:59:59.000Z",
      "completion_percentage": "50",
      "filled_size": "0.001",
      "average_filled_price": "50",
      "number_of_fills": "2",
      "filled_value": "10000",
      "pending_cancel": true,
      "size_in_quote": false,
      "total_fees": "5.00",
      "size_inclusive_of_fees": false,
      "total_value_after_fees": "string",
      "trigger_status": "UNKNOWN_TRIGGER_STATUS",
      "order_type": "UNKNOWN_ORDER_TYPE",
      "reject_reason": "REJECT_REASON_UNSPECIFIED",
      "settled": true,
      "product_type": "UNKNOWN_PRODUCT_TYPE",
      "order_placement_source": "UNKNOWN_PLACEMENT_SOURCE"
    }
  ],
  "sequence": "string",
  "has_next": true,
  "cursor": "789100"
}
```

### Core Order Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `order_id` | string | Yes | Unique order identifier |
| `product_id` | string | Yes | Trading pair (e.g., BTC-USD) |
| `user_id` | string | Yes | User owning the order |
| `side` | enum | Yes | BUY or SELL |
| `created_time` | RFC3339 Timestamp | Yes | Order creation timestamp |
| `status` | enum | Yes | Current order state |
| `client_order_id` | string | Yes | Client-provided order ID |
| `completion_percentage` | string | Yes | Percent of order filled |
| `average_filled_price` | string | Yes | Mean price of all fills |
| `number_of_fills` | string | Yes | Count of fill events |
| `pending_cancel` | boolean | Yes | Cancellation in progress |
| `size_in_quote` | boolean | Yes | Size denominated in quote currency |
| `total_fees` | string | Yes | Total commission charged |
| `size_inclusive_of_fees` | boolean | Yes | Whether size includes fees |
| `total_value_after_fees` | string | Yes | Filled value plus/minus fees |

### Advanced Order Fields

| Field | Type | Description |
|-------|------|-------------|
| `fee` | string | (Deprecated) Commission amount |
| `filled_value` | string | Portion of order filled in quote currency |
| `order_configuration` | object | Order type and parameters |
| `order_type` | enum | MARKET, LIMIT, STOP, STOP_LIMIT, BRACKET, TWAP, ROLL_OPEN, ROLL_CLOSE, LIQUIDATION, SCALED |
| `reject_reason` | enum | Why order was rejected |
| `reject_message` | string | Rejection explanation |
| `cancel_message` | string | Cancellation explanation |
| `outstanding_hold_amount` | string | Remaining held funds |
| `is_liquidation` | boolean | Liquidation order flag |
| `last_fill_time` | RFC3339 Timestamp | Most recent fill time |
| `edit_history` | array | Up to 5 most recent edits with price, size, timestamp |
| `leverage` | string | Order leverage multiplier |
| `margin_type` | enum | CROSS or ISOLATED margin |
| `retail_portfolio_id` | UUID | Associated portfolio |
| `originating_order_id` | UUID | Parent order for attached orders |
| `attached_order_id` | UUID | Child order reference |
| `current_pending_replace` | object | Price/size of pending edit |
| `commission_detail_total` | object | Breakdown of commission charges |
| `workable_size` | string | Filled portion of originating order |
| `workable_size_completion_pct` | string | Completion percentage |
| `product_details` | object | Product-specific details |
| `cost_basis_method` | enum | Tax lot matching method |
| `displayed_order_config` | enum | Frontend display configuration |
| `equity_trading_session` | enum | Trading session for equities |

### Pagination Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `has_next` | boolean | Whether additional pages exist |
| `cursor` | string | Pagination cursor for next page |
| `sequence` | string (int64) | (Deprecated) Database state sequence |

## Error Response

```json
{
  "error": "string",
  "code": 123,
  "message": "string",
  "details": [
    {
      "type_url": "string",
      "value": "base64-encoded-bytes"
    }
  ]
}
```

## Order Configuration Types

### Market Orders

- `market_market_ioc`: Immediate Or Cancel execution
- `market_market_fok`: Fill Or Kill execution

### Limit Orders

- `limit_limit_gtc`: Good Until Cancelled
- `limit_limit_gtd`: Good Until Date/Time
- `limit_limit_fok`: Fill Or Kill
- `sor_limit_ioc`: Smart Order Routing with Immediate Or Cancel

### Advanced Orders

- `stop_limit_stop_limit_gtc`: Stop price triggers limit order
- `stop_limit_stop_limit_gtd`: Stop limit with expiration
- `trigger_bracket_gtc`: Bracket order with stop trigger
- `trigger_bracket_gtd`: Bracket order with time expiration
- `twap_limit_gtd`: Time-Weighted Average Price order
- `scaled_limit_gtc`: Scaled order across price range

## Order Status Enums

- **PENDING**: Order awaiting processing
- **OPEN**: Active on order book
- **FILLED**: Completely executed
- **CANCELLED**: User-initiated cancellation
- **EXPIRED**: Time-based expiration
- **FAILED**: Order processing failure
- **UNKNOWN_ORDER_STATUS**: Status unknown
- **QUEUED**: Awaiting execution queue
- **CANCEL_QUEUED**: Cancellation request pending
- **EDIT_QUEUED**: Edit request pending

## Order Type Enums

- **MARKET**: Execute at current best price
- **LIMIT**: Execute at specified price or better
- **STOP**: Becomes market order when triggered
- **STOP_LIMIT**: Limit order triggered at stop price
- **BRACKET**: Limit with embedded stop trigger
- **TWAP**: Split large order into smaller chunks
- **ROLL_OPEN**: Contract roll opening leg
- **ROLL_CLOSE**: Contract roll closing leg
- **LIQUIDATION**: Special liquidation order
- **SCALED**: Order split across incrementing/decrementing prices

## Time In Force Types

- **GOOD_UNTIL_DATE_TIME** (GTD): Active until specified time
- **GOOD_UNTIL_CANCELLED** (GTC): Active indefinitely
- **IMMEDIATE_OR_CANCEL** (IOC): Fill now, cancel remainder
- **FILL_OR_KILL** (FOK): All-or-nothing execution

## Content Types

The endpoint supports both JSON and Server-Sent Events (text/event-stream) response formats.
