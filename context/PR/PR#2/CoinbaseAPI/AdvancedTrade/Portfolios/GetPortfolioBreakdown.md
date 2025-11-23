# Get Portfolio Breakdown

Retrieve comprehensive breakdown information for a specific portfolio.

## Endpoint Details

**Method:** GET
**Path:** `/api/v3/brokerage/portfolios/{portfolio_uuid}`
**Base URL:** `https://api.coinbase.com`

## Authentication

Requires bearer token authentication using JWT signed with CDP API Key Secret in base64 encoding. Reference the "Creating API Keys" section of Coinbase App Authentication documentation for token generation.

## Request Parameters

### Path Parameters

- **portfolio_uuid** (required, string): The unique identifier for the portfolio

### Query Parameters

- **currency** (optional, string): Currency symbol for response formatting (e.g., USD)

## Response Schema

### Success Response (200)

Returns a `PortfolioBreakdown` object containing:

**Portfolio Information:**
- name (string)
- uuid (string)
- type (enum: UNDEFINED, DEFAULT, CONSUMER, INTX)
- deleted (boolean)

**Portfolio Balances:**
- total_balance
- total_futures_balance
- total_cash_equivalent_balance
- total_crypto_balance
- futures_unrealized_pnl
- perp_unrealized_pnl

**Positions:**
- spot_positions (array of PortfolioPosition objects)
- perp_positions (array of PerpPosition objects)
- futures_positions (array of FuturesPosition objects)

Each balance includes `value` and `currency` fields.

### Error Response (Default)

Returns error object with:
- error (string)
- code (integer)
- message (string)
- details (array of protobuf Any objects)

## Account Types Supported

Including: WALLET, FIAT, VAULT, COLLATERAL, DEFI_YIELD, LOAN_MANAGEMENT, MULTISIG, DERIVATIVES_TRANSFER, STAKED_FUNDS, PERP_FUTURES, LENT_FUNDS, FIAT_SAVINGS, and others.
