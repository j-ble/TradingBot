# List Fills API Documentation

## Overview

This endpoint retrieves a paginated list of trade fills with optional filtering capabilities.

**Endpoint:** `GET /api/v3/brokerage/orders/historical/fills`

**Base URL:** `https://api.coinbase.com`

## Authentication

Requires bearer token authentication using a JWT signed with your CDP API Key Secret, encoded in base64. See Coinbase App Authentication documentation for token generation details.

## Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `order_ids` | string[] | Filter by specific order ID(s) |
| `trade_ids` | string[] | Filter by trade ID(s) of fills |
| `product_ids` | string[] | Filter by product ID(s) (e.g., BTC-USD) |
| `start_sequence_timestamp` | string (RFC3339) | Return fills after this timestamp |
| `end_sequence_timestamp` | string (RFC3339) | Return fills before this timestamp |
| `retail_portfolio_id` | string | (Deprecated) Filter by portfolio ID |
| `limit` | integer | Results per page (default: 100) |
| `cursor` | string | Pagination cursor for subsequent requests |
| `sort_by` | enum | Sort by PRICE, TRADE_TIME, or default creation time |
| `asset_filters` | string[] | Filter by asset (e.g., 'BTC') |
| `order_types` | string[] | Filter by order type (MARKET, LIMIT, STOP, etc.) |
| `order_side` | enum | Filter by BUY or SELL |
| `product_types` | string[] | Filter by SPOT or FUTURE |

## Response Schema

### Success Response (200)

```json
{
  "fills": [
    {
      "entry_id": "string",
      "trade_id": "string",
      "order_id": "string",
      "trade_time": "RFC3339 timestamp",
      "trade_type": "FILL|REVERSAL|CORRECTION|SYNTHETIC",
      "price": "string",
      "size": "string",
      "commission": "string",
      "product_id": "string",
      "sequence_timestamp": "RFC3339 timestamp",
      "liquidity_indicator": "MAKER|TAKER",
      "size_in_quote": "boolean",
      "user_id": "string",
      "side": "BUY|SELL",
      "retail_portfolio_id": "string",
      "fillSource": "FILL_SOURCE_CLOB|FILL_SOURCE_RFQ",
      "commission_detail_total": {
        "total_commission": "string",
        "gst_commission": "string",
        "withholding_commission": "string",
        "client_commission": "string",
        "venue_commission": "string",
        "regulatory_commission": "string",
        "clearing_commission": "string"
      }
    }
  ],
  "cursor": "string"
}
```

### Fill Object Properties

- **entry_id:** Unique identifier for the fill
- **trade_id:** ID of fill (unique for FILL type only)
- **order_id:** Associated order identifier
- **trade_time:** Completion timestamp
- **trade_type:** Type classification (regular fills vs. adjustments)
- **price/size:** Execution details
- **commission:** Fee charged
- **liquidity_indicator:** Indicates maker or taker role
- **fillSource:** Source type (CLOB or RFQ)

### Error Response

```json
{
  "error": "string",
  "code": "integer",
  "message": "string",
  "details": [...]
}
```

## Order Types Supported

- **MARKET:** Standard market order
- **LIMIT:** Price-restricted limit order
- **STOP:** Trigger converts to market order
- **STOP_LIMIT:** Limit order triggered at stop price
- **BRACKET:** Risk mitigation with limit and stop legs
- **TWAP:** Time-weighted average price splitting
- **ROLL_OPEN/ROLL_CLOSE:** Contract roll steps
- **LIQUIDATION:** Position liquidation
- **SCALED:** Multi-tranche incremental pricing
