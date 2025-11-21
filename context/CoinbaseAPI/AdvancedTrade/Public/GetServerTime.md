# Get Server Time

## Overview

This endpoint retrieves the current time from the Coinbase Advanced API.

## Endpoint Details

**Method:** GET
**Path:** `/api/v3/brokerage/time`
**Base URL:** `https://api.coinbase.com`

## Authentication

The endpoint requires Bearer token authentication using a JWT signed with your CDP API Key Secret (base64-encoded). Refer to Coinbase's API Key Authentication documentation for token generation details.

## Response Schema

### Success Response (200)

Returns an object with timestamp data in multiple formats:

| Field | Type | Description |
|-------|------|-------------|
| `iso` | string | An ISO-8601 representation of the timestamp |
| `epochSeconds` | string (int64) | A second-precision representation of the timestamp |
| `epochMillis` | string (int64) | A millisecond-precision representation of the timestamp |

**Example Response:**

```json
{
  "iso": "<string>",
  "epochSeconds": "<string>",
  "epochMillis": "<string>"
}
```

### Error Response (Default)

Returns error details with the following structure:

| Field | Type | Description |
|-------|------|-------------|
| `error` | string | Error identifier |
| `code` | integer | HTTP status code |
| `message` | string | Human-readable error message |
| `details` | array | Additional error context |

**Example Error:**

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

## Content Types

Responses are available in both `application/json` and `text/event-stream` formats.
