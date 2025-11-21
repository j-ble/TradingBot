# Get Account

Retrieves account information for a specified account UUID from the Coinbase API.

## Endpoint

**GET** `/api/v3/brokerage/accounts/{account_uuid}`

**Base URL:** `https://api.coinbase.com`

## Authentication

Requires Bearer token authentication using a JWT signed with your CDP API Key Secret, encoded in base64. Refer to the Creating API Keys section of Coinbase App Authentication docs for information on how to generate your Bearer Token.

## Request Parameters

### Path Parameters

- **account_uuid** (required, string): The account's UUID.

## Response

### Success Response (200)

Returns account details in the following structure:

```json
{
  "account": {
    "uuid": "8bfc20d7-f7c6-4422-bf07-8243ca4169fe",
    "name": "BTC Wallet",
    "currency": "BTC",
    "available_balance": {
      "value": "1.23",
      "currency": "BTC"
    },
    "default": false,
    "active": true,
    "created_at": "2021-05-31T09:59:59.000Z",
    "updated_at": "2021-05-31T09:59:59.000Z",
    "deleted_at": "2021-05-31T09:59:59.000Z",
    "type": "FIAT",
    "ready": true,
    "hold": {
      "value": "1.23",
      "currency": "BTC"
    },
    "retail_portfolio_id": "b87a2d3f-8a1e-49b3-a4ea-402d8c389aca",
    "platform": "ACCOUNT_PLATFORM_CONSUMER"
  }
}
```

### Account Object Properties

- **uuid**: Unique identifier for account
- **name**: Name for the account
- **currency**: Currency symbol (e.g., BTC)
- **available_balance**: Available balance in the account
- **default**: Whether or not this account is the user's primary account
- **active**: Whether or not this account is active and okay to use
- **created_at**: RFC3339 timestamp format
- **updated_at**: RFC3339 timestamp format
- **deleted_at**: RFC3339 timestamp format
- **type**: Account type (CRYPTO, FIAT, VAULT, PERP_FUTURES)
- **ready**: Whether or not this account is ready to trade
- **hold**: Amount that is being held for pending transfers against the available balance
- **retail_portfolio_id**: The ID of the portfolio this account is associated with
- **platform**: Platform designation (CONSUMER, CFM_CONSUMER, INTX)

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

## Account Type Enum

- ACCOUNT_TYPE_UNSPECIFIED
- ACCOUNT_TYPE_CRYPTO
- ACCOUNT_TYPE_FIAT
- ACCOUNT_TYPE_VAULT
- ACCOUNT_TYPE_PERP_FUTURES

## Account Platform Enum

- ACCOUNT_PLATFORM_UNSPECIFIED
- ACCOUNT_PLATFORM_CONSUMER
- ACCOUNT_PLATFORM_CFM_CONSUMER
- ACCOUNT_PLATFORM_INTX
