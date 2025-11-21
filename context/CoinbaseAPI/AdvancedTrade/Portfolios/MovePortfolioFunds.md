# Move Portfolio Funds

This API endpoint enables transferring funds between different portfolios.

## Endpoint Specification

**Method:** POST
**Path:** `/api/v3/brokerage/portfolios/move_funds`
**Base URL:** `https://api.coinbase.com`

## Authentication

The endpoint requires Bearer token authentication using a JWT signed with your CDP API Key Secret, encoded in base64. Reference the Coinbase App Authentication documentation for generating Bearer Tokens.

## Request Body

The request accepts JSON with the following structure:

```json
{
  "funds": {
    "value": "<string>",
    "currency": "<string>"
  },
  "source_portfolio_uuid": "8bfc20d7-f7c6-4422-bf07-8243ca4169fe",
  "target_portfolio_uuid": "8bfc20d7-f7c6-4422-bf07-8243ca4169fe"
}
```

### Request Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `funds` | Amount object | The amount to be moved to the specified portfolio |
| `source_portfolio_uuid` | String (UUID) | Portfolio UUID to send funds from |
| `target_portfolio_uuid` | String (UUID) | Portfolio UUID to send funds to |

## Amount Object Schema

| Field | Type | Description |
|-------|------|-------------|
| `value` | String | The amount of specified currency |
| `currency` | String | Currency symbol (e.g., USD) |

## Response

### Success Response (HTTP 200)

```json
{
  "source_portfolio_uuid": "8bfc20d7-f7c6-4422-bf07-8243ca4169fe",
  "target_portfolio_uuid": "8bfc20d7-f7c6-4422-bf07-8243ca4169fe"
}
```

### Error Response

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

## Notes

- The endpoint supports both `application/json` and `text/event-stream` response content types
