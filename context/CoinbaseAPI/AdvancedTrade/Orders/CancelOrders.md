# Cancel Orders

## Overview

This endpoint initiates cancel requests for one or more orders through the Coinbase API.

## Endpoint Details

**Method:** POST
**Path:** `/api/v3/brokerage/orders/batch_cancel`
**Base URL:** `https://api.coinbase.com`

## Authentication

The endpoint requires bearer token authentication via a JWT signed with your CDP API Key Secret and encoded in base64. The token must be included in the Authorization header.

## Request Body

The request accepts JSON with the following structure:

```json
{
  "order_ids": [
    "0000-00000",
    "1111-11111"
  ]
}
```

**Required Field:**
- `order_ids` (array of strings): The order identifiers for which cancel requests should be initiated

## Response

### Success Response (200)

```json
{
  "results": [
    {
      "success": true,
      "failure_reason": "UNKNOWN_CANCEL_FAILURE_REASON",
      "order_id": "0000-00000"
    }
  ]
}
```

**Response Fields:**
- `success` (boolean): Indicates if the cancel request was submitted successfully
- `failure_reason` (enum): Reason the cancel request did not get submitted
- `order_id` (string): The order identifier

### Failure Reasons

Possible failure reason values:
- `UNKNOWN_CANCEL_FAILURE_REASON`
- `INVALID_CANCEL_REQUEST`
- `UNKNOWN_CANCEL_ORDER`
- `COMMANDER_REJECTED_CANCEL_ORDER`
- `DUPLICATE_CANCEL_REQUEST`
- `INVALID_CANCEL_PRODUCT_ID`
- `INVALID_CANCEL_FCM_TRADING_SESSION`
- `NOT_ALLOWED_TO_CANCEL`
- `ORDER_IS_FULLY_FILLED`
- `ORDER_IS_BEING_REPLACED`

### Error Response (Default)

```json
{
  "error": "<string>",
  "code": 123,
  "message": "<string>",
  "details": [
    {
      "type_url": "<string>",
      "value": "<byte>"
    }
  ]
}
```

## Content Types

The API supports two response content types:
- `application/json`
- `text/event-stream`
