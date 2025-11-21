# List Accounts

Retrieves authenticated accounts for the current user via the Coinbase API.

## Endpoint

**GET** `https://api.coinbase.com/api/v3/brokerage/accounts`

## Authentication

Requires bearer token authentication using a JWT signed with your CDP API Key Secret, encoded in base64.

## Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `limit` | integer | No | The number of accounts to display per page. By default, displays 49 (max 250). |
| `cursor` | string | No | For paginated responses, returns all responses that come after this value. |
| `retail_portfolio_id` | string | No | Deprecated; filters accounts by portfolio ID for legacy keys only. |

## Response Schema (200 Success)

```json
{
  "accounts": [
    {
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
  ],
  "has_next": true,
  "cursor": "789100",
  "size": 123
}
```

## Account Object Properties

| Field | Type | Description |
|-------|------|-------------|
| `uuid` | string | Unique account identifier |
| `name` | string | Account name |
| `currency` | string | Currency symbol |
| `available_balance` | Amount | Available balance in the account |
| `default` | boolean | Primary account indicator |
| `active` | boolean | Whether or not this account is active and okay to use |
| `created_at` | RFC3339 timestamp | Account creation time |
| `updated_at` | RFC3339 timestamp | Last update time |
| `deleted_at` | RFC3339 timestamp | Deletion time |
| `type` | AccountType | Account category |
| `ready` | boolean | Trading readiness status |
| `hold` | Amount | Amount being held for pending transfers against available balance |
| `retail_portfolio_id` | string | Associated portfolio ID |
| `platform` | AccountPlatform | Platform type (CONSUMER, CFM_CONSUMER, INTX) |

## Account Type Enum

- `ACCOUNT_TYPE_CRYPTO`
- `ACCOUNT_TYPE_FIAT`
- `ACCOUNT_TYPE_VAULT`
- `ACCOUNT_TYPE_PERP_FUTURES`

## Account Platform Enum

- `ACCOUNT_PLATFORM_CONSUMER`
- `ACCOUNT_PLATFORM_CFM_CONSUMER`
- `ACCOUNT_PLATFORM_INTX`

## Error Response

Default error responses return:
- `error` (string)
- `code` (integer)
- `message` (string)
- `details` (array of protobuf Any objects)
