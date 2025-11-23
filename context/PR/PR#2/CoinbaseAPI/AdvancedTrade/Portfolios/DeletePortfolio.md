# Delete Portfolio

## Overview

This endpoint removes a portfolio from a user's account via the Coinbase API.

## Endpoint Details

**Method:** DELETE
**Path:** `/api/v3/brokerage/portfolios/{portfolio_uuid}`
**Base URL:** `https://api.coinbase.com`

## Authentication

The request requires bearer token authentication using a JWT signed with your CDP API Key Secret (base64-encoded). See the Coinbase App Authentication documentation for instructions on generating your Bearer Token.

## Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `portfolio_uuid` | string | Yes | Unique identifier for the portfolio to delete |

## Responses

### Success Response (200)

Returns an empty `DeletePortfolioResponse` object.

**Content Types:**
- `application/json`
- `text/event-stream`

### Error Response (Default)

Returns error details in the following structure:

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

**Content Types:**
- `application/json`
- `text/event-stream`
