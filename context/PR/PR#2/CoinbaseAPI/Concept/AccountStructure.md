# Coinbase Exchange Account Structure

## Profiles

Profiles function as the top-level organizational units enabling traders to establish multiple isolated portfolios within a single Exchange account. The system supports up to 100 profiles per account.

### Default Profile Characteristics

Every Exchange account includes a default profile serving three key functions:

- Primary interface for executing trades
- Entry/exit point for cryptocurrency deposits and withdrawals
- Storage location for initial account funding

### Profile Management

Developers can retrieve all profiles associated with an Exchange account using the Go SDK:

```go
credentials, err := credentials.ReadEnvCredentials("EXCHANGE_CREDENTIALS")
httpClient, err := core.DefaultHttpClient()
client := client.NewRestClient(credentials, httpClient)

profilesSvc := profiles.NewProfilesService(client)
request := &profiles.ListProfilesRequest{}
response, err := profilesSvc.ListProfiles(context.Background(), request)
```

### Creating Additional Profiles

Organizations can create new profiles through the API to accomplish objectives like separating trading strategies or managing different risk categories. The system is designed for institutional portfolio management rather than tracking individual retail user balances.

### Creating a New Profile Example

```go
credentials, err := credentials.ReadEnvCredentials("EXCHANGE_CREDENTIALS")
httpClient, err := core.DefaultHttpClient()
client := client.NewRestClient(credentials, httpClient)

profilesSvc := profiles.NewProfilesService(client)
request := &profiles.CreateProfileRequest{
    Name: profileName,
}
response, err := profilesSvc.CreateProfile(context.Background(), request)
```

### API Key Scoping

Each API key is restricted to a specific profile and can only access data belonging to that profile across REST API, FIX API, and Websocket Feed interfaces. Accessing different profiles requires creating separate API keys on the Coinbase Exchange website.

### Profile Deletion

When profiles are deleted via the Coinbase Exchange website, associated API keys automatically receive "View" permissions only.

## Accounts

Accounts represent individual asset holdings within specific profiles, with each account holding a single currency type and serving as the foundation for trading activities.

### Account Structure

- Each profile maintains its own distinct set of accounts
- Individual accounts hold only one asset type
- Identical assets across different profiles have separate account IDs and balances
- Accounts enable order placement and trade execution

For instance, Bitcoin held in Profile A and Profile B would have different account identifiers and independent transaction records.

### Retrieving Account Information

```go
credentials, err := credentials.ReadEnvCredentials("EXCHANGE_CREDENTIALS")
httpClient, err := core.DefaultHttpClient()
client := client.NewRestClient(credentials, httpClient)

accountsSvc := accounts.NewAccountsService(client)
request := &accounts.ListAccountsRequest{}
response, err := accountsSvc.ListAccounts(context.Background(), request)
```

### Account Ledger Tracking

Account ledgers maintain comprehensive historical records documenting:

- Transfers between accounts or profiles
- Completed trades and balance impacts
- Trading fees, maker rebates, and related charges
- Asset conversions and associated costs
- Funding and withdrawal transactions

### Querying Historical Data

Developers can query account ledgers for specific periods using start dates for reporting, performance analysis, or transaction reconciliation:

```go
credentials, err := credentials.ReadEnvCredentials("EXCHANGE_CREDENTIALS")
httpClient, err := core.DefaultHttpClient()
client := client.NewRestClient(credentials, httpClient)

accountsSvc := accounts.NewAccountsService(client)
request := &accounts.GetAccountLedgerRequest{
    AccountId: accountId,
    StartDate: "2025-01-01T00:00:00Z",
}
response, err := accountsSvc.GetAccountLedger(context.Background(), request)
```

## Coinbase Accounts

Coinbase Accounts bridge Exchange accounts and retail Coinbase accounts, connected through shared email addresses and enabling fund transfers via API.

### Integration Benefits

- Direct access to Coinbase.com-managed wallets
- Fund movement capabilities between platforms
- Unified management of institutional and retail activities
- Combined liquidity leverage

### Accessing Coinbase Account Wallets

```go
credentials, err := credentials.ReadEnvCredentials("EXCHANGE_CREDENTIALS")
httpClient, err := core.DefaultHttpClient()
client := client.NewRestClient(credentials, httpClient)

accountsSvc := accounts.NewAccountsService(client)
request := &accounts.ListCoinbaseAccountsRequest{}
response, err := accountsSvc.ListCoinbaseAccounts(context.Background(), request)
```

## Overview

The Coinbase Exchange architecture comprises three interconnected components: profiles organizing trading activities into separate portfolios, accounts managing individual asset balances within profiles, and Coinbase Accounts linking Exchange and retail platform functionality for streamlined institutional trading and portfolio management.
