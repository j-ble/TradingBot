# List Portfolios

Retrieve all portfolios associated with a user account.

## Endpoint

**GET** `/api/v3/brokerage/portfolios`

**Base URL:** `https://api.coinbase.com`

## Authentication

This endpoint requires a JWT Bearer token created using your CDP API Key Secret and encoded in base64. For generation details, refer to the Coinbase App Authentication documentation.

## Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `portfolio_type` | enum | No | UNDEFINED | Filter results by type: UNDEFINED, DEFAULT, CONSUMER, or INTX |

## Response Schemas

### Success Response (200)

Returns an object containing a portfolios array:

```json
{
  "portfolios": [
    {
      "name": "<string>",
      "uuid": "<string>",
      "type": "UNDEFINED",
      "deleted": true
    }
  ]
}
```

**Portfolio Object Properties:**
- `name` (string): Portfolio identifier
- `uuid` (string): Unique portfolio identifier
- `type` (enum): Portfolio classification (UNDEFINED, DEFAULT, CONSUMER, INTX)
- `deleted` (boolean): Deletion status

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

The endpoint supports both `application/json` and `text/event-stream` response formats.
