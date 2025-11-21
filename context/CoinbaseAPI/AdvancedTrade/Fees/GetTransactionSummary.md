# Get Transaction Summary

## Overview

Retrieves a summary of transactions including fee tiers, total volume, and fees.

## Endpoint Details

**Method:** GET
**Path:** `/api/v3/brokerage/transaction_summary`
**Base URL:** `https://api.coinbase.com`

## Authentication

Requires bearer token authentication using a JWT signed with your CDP API Key Secret (base64-encoded). Refer to Coinbase App Authentication documentation for token generation details.

## Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `product_type` | Enum | No | Filter by product type (UNKNOWN_PRODUCT_TYPE, SPOT, FUTURE). Default: UNKNOWN_PRODUCT_TYPE |
| `contract_expiry_type` | Enum | No | Filter by contract expiry (UNKNOWN_CONTRACT_EXPIRY_TYPE, EXPIRING, PERPETUAL). Only applies to FUTURE products. Default: UNKNOWN_CONTRACT_EXPIRY_TYPE |
| `product_venue` | Enum | No | Venue for product (UNKNOWN_VENUE_TYPE, CBE, FCM, INTX). Default: UNKNOWN_VENUE_TYPE |

## Response Schema (200 Success)

**Required Fields:**
- `total_volume`
- `total_fees`
- `fee_tier`

**Response Properties:**

| Field | Type | Description |
|-------|------|-------------|
| `total_fees` | number (double) | Aggregate fees across assets in USD |
| `fee_tier` | object | Maker/taker rates across applicable tiers |
| `margin_rate` | Decimal | Margin rate (FUTURE products only) |
| `goods_and_services_tax` | object | GST information |
| `advanced_trade_only_volume` | number | Advanced Trade volume (excluding Pro) in USD |
| `advanced_trade_only_fees` | number | Advanced Trade fees (excluding Pro) in USD |
| `coinbase_pro_volume` | number | Coinbase Pro volume in USD |
| `coinbase_pro_fees` | number | Coinbase Pro fees in USD |
| `total_balance` | string | Aggregate balance across spot, INTX, FCM in USD |
| `volume_breakdown` | array | Volume types contributing to fee tier calculation |
| `has_cost_plus_commission` | boolean | Indicates cost plus commission pricing model usage |

## Fee Tier Structure

| Field | Type | Description |
|-------|------|-------------|
| `pricing_tier` | string | User tier based on notional volume |
| `taker_fee_rate` | string | Rate applied for liquidity-taking orders |
| `maker_fee_rate` | string | Rate applied for liquidity-creating orders |
| `aop_from` | string | Lower bound (inclusive) of tier in USD |
| `aop_to` | string | Upper bound (exclusive) of tier in USD |
| `volume_types_and_range` | array | Rules combining specific volume types |

## Volume Types

- `VOLUME_TYPE_UNKNOWN` – Unknown/unspecified volume
- `VOLUME_TYPE_SPOT` – Spot trading volume
- `VOLUME_TYPE_INTX_PERPS` – International perpetual contracts
- `VOLUME_TYPE_US_DERIVATIVES` – US futures trading volume

## Example Response

```json
{
  "total_fees": 25,
  "fee_tier": {
    "pricing_tier": "<$10k",
    "taker_fee_rate": "0.0010",
    "maker_fee_rate": "0.0020",
    "aop_from": "0",
    "aop_to": "10000",
    "volume_types_and_range": [
      {
        "volume_types": ["VOLUME_TYPE_SPOT", "VOLUME_TYPE_US_DERIVATIVES"],
        "vol_from": "0",
        "vol_to": "50000"
      }
    ]
  },
  "margin_rate": 0.5,
  "goods_and_services_tax": {
    "rate": "<string>",
    "type": "INCLUSIVE"
  },
  "advanced_trade_only_volume": 1000,
  "advanced_trade_only_fees": 25,
  "coinbase_pro_volume": 1000,
  "coinbase_pro_fees": 25,
  "total_balance": "1000",
  "volume_breakdown": [
    {
      "volume_type": "VOLUME_TYPE_SPOT",
      "volume": 1000
    }
  ],
  "has_cost_plus_commission": false
}
```

## Error Response (Default)

```json
{
  "error": "<string>",
  "code": 123,
  "message": "<string>",
  "details": [
    {
      "type_url": "<string>",
      "value": "aSDinaTvuI8gbWludGxpZnk="
    }
  ]
}
```

## Response Content Types

- `application/json`
- `text/event-stream`
