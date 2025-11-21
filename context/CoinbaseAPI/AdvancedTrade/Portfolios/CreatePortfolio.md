# Create Portfolio

> Create a portfolio.

## Endpoint

**POST** `/api/v3/brokerage/portfolios`

**Server:** `https://api.coinbase.com`

## Authentication

- **Type:** Bearer Token (HTTP)
- **Details:** A JWT signed using your CDP API Key Secret, encoded in base64
- Refer to Coinbase App Authentication docs for Bearer Token generation

## Request Body

**Content-Type:** `application/json`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Yes | The portfolio's identifier name |

**Example Request:**

```json
{
  "name": "<string>"
}
```

## Response (200 Success)

**Content-Type:** `application/json` or `text/event-stream`

| Field | Type | Description |
|-------|------|-------------|
| portfolio.name | string | Portfolio name |
| portfolio.uuid | string | Unique portfolio identifier |
| portfolio.type | enum | Portfolio type (UNDEFINED, DEFAULT, CONSUMER, INTX) |
| portfolio.deleted | boolean | Deletion status flag |

**Example Response:**

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

## Error Response (Default)

**Content-Type:** `application/json` or `text/event-stream`

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

## Portfolio Type Enum

- `UNDEFINED` (default)
- `DEFAULT`
- `CONSUMER`
- `INTX`
