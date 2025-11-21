# Edit Portfolio

Edit a portfolio via the Coinbase API.

## Endpoint Details

**Method:** PUT
**URL:** `https://api.coinbase.com/api/v3/brokerage/portfolios/{portfolio_uuid}`

## Authentication

Requires bearer token authentication using a JWT signed with your CDP API Key Secret, encoded in base64. Reference the Coinbase App Authentication documentation for generating Bearer Tokens.

## Request Parameters

**Path Parameter:**
- `portfolio_uuid` (string, required): The portfolio identifier

**Request Body (application/json):**

```json
{
  "name": "<string>"
}
```

The request accepts a portfolio name as a required field.

## Response

**Success Response (200):**

```json
{
  "portfolio": {
    "name": "<string>",
    "uuid": "<string>",
    "type": "UNDEFINED",
    "deleted": true
  }
}
```

Returns the updated portfolio object with properties including name, UUID, type, and deletion status.

**Portfolio Type Enum:**
- `UNDEFINED`
- `DEFAULT`
- `CONSUMER`
- `INTX`

**Error Response (default):**

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

Returns error details with error message, integer code, descriptive message, and additional details array.

**Content Types:** Supports both `application/json` and `text/event-stream` response formats.
