# Quickstart - Making Your First REST API Call

This guide provides instructions for establishing an API key, configuring the Exchange Go SDK, and executing initial REST API requests.

## Initial Setup

1. **Create a Coinbase Exchange Account:** Register at [Coinbase Exchange](https://exchange.coinbase.com/).
2. **Generate an API Key:** Access the [API section](https://exchange.coinbase.com/apikeys) through the web interface.
3. **Authenticate:** All API requests require authentication, with detailed instructions available at [API Authentication](/exchange/rest-api/authentication).

**REST API URL:** `https://api.exchange.coinbase.com`

## Using the Exchange Go SDK

### Setting up the SDK

Initialize a new Go module, add the Exchange Go SDK, and update dependencies with these commands (substitute your project path):

```
go mod init example.com/test
go get github.com/coinbase-samples/exchange-sdk-go
go mod tidy
go build
```

Initialize the `Credentials` struct and instantiate a client:

```go
credentials, err := credentials.ReadEnvCredentials("EXCHANGE_CREDENTIALS")
if err != nil {
    panic(fmt.Sprintf("unable to read exchange credentials: %v", err))
}

httpClient, err := core.DefaultHttpClient()
if err != nil {
    panic(fmt.Sprintf("unable to load default http client: %v", err))
}

client := client.NewRestClient(credentials, httpClient)
```

The SDK provides helper functions: `credentials.ReadEnvCredentials` retrieves credentials from environment variables, while `credentials.UnmarshalCredentials` deserializes JSON from other sources.

Configure credentials by adding to `~/.zshrc`:

```
export EXCHANGE_CREDENTIALS='{
    "apiKey":"YOUR_API_KEY",
    "passphrase":"YOUR_PASSPHRASE",
    "signingKey":"YOUR_SIGNING_KEY"
}'
```

Then execute `source ~/.zshrc` to activate the environment variable.

## Making your first API call

Following client initialization, set up the relevant service to interact with specific API endpoints.

### Listing Accounts

Account IDs enable tracking of asset-level activities like transfers. To retrieve all accounts, initialize the accounts service, submit the request, handle errors, and process results:

```go
func main() {
    credentials, err := credentials.ReadEnvCredentials("EXCHANGE_CREDENTIALS")
    if err != nil {
        panic(fmt.Sprintf("unable to read exchange credentials: %v", err))
    }

    httpClient, err := core.DefaultHttpClient()
    if err != nil {
        panic(fmt.Sprintf("unable to load default http client: %v", err))
    }

    client := client.NewRestClient(credentials, httpClient)

    accountsSvc := accounts.NewAccountsService(client)
    request := &accounts.ListAccountsRequest{}

    response, err := accountsSvc.ListAccounts(context.Background(), request)
    if err != nil {
        panic(fmt.Sprintf("unable to list accounts: %v", err))
    }

    jsonResponse, err := json.MarshalIndent(response, "", "  ")
    if err != nil {
        panic(fmt.Sprintf("error marshaling response to JSON: %v", err))
    }
    fmt.Println(string(jsonResponse))
}
```

### Get Account Transfers

Leverage account IDs to review historical transfer activity. To obtain transfer history for a specific account, set up the service, provide the request with an account ID, and process the response:

```go
func main() {
    credentials, err := credentials.ReadEnvCredentials("EXCHANGE_CREDENTIALS")
    if err != nil {
        panic(fmt.Sprintf("unable to read exchange credentials: %v", err))
    }

    httpClient, err := core.DefaultHttpClient()
    if err != nil {
        panic(fmt.Sprintf("unable to load default http client: %v", err))
    }

    client := client.NewRestClient(credentials, httpClient)

    accountsSvc := accounts.NewAccountsService(client)
    request := &accounts.GetAccountTransfersRequest{
        AccountId: "account_id_here",
    }

    response, err := accountsSvc.GetAccountTransfers(context.Background(), request)
    if err != nil {
        panic(fmt.Sprintf("unable to get account transfers: %v", err))
    }

    jsonResponse, err := json.MarshalIndent(response, "", "  ")
    if err != nil {
        panic(fmt.Sprintf("error marshaling response to JSON: %v", err))
    }
    fmt.Println(string(jsonResponse))
}
```

### Listing Profiles

Many operations require your Profile ID. To display all profile IDs connected to your account, set up the profiles service and retrieve the results:

```go
func main() {
    credentials, err := credentials.ReadEnvCredentials("EXCHANGE_CREDENTIALS")
    if err != nil {
        panic(fmt.Sprintf("unable to read exchange credentials: %v", err))
    }

    httpClient, err := core.DefaultHttpClient()
    if err != nil {
        panic(fmt.Sprintf("unable to load default http client: %v", err))
    }

    client := client.NewRestClient(credentials, httpClient)

    profilesSvc := profiles.NewProfilesService(client)
    request := &profiles.ListProfilesRequest{}

    response, err := profilesSvc.ListProfiles(context.Background(), request)
    if err != nil {
        panic(fmt.Sprintf("unable to list profiles: %v", err))
    }

    jsonResponse, err := json.MarshalIndent(response, "", "  ")
    if err != nil {
        panic(fmt.Sprintf("error marshaling response to JSON: %v", err))
    }
    fmt.Println(string(jsonResponse))
}
```

### Get Product Details

To retrieve product information, initialize the products service with a Product ID (such as `BTC-USD`):

```go
func main() {
    credentials, err := credentials.ReadEnvCredentials("EXCHANGE_CREDENTIALS")
    if err != nil {
        panic(fmt.Sprintf("unable to read exchange credentials: %v", err))
    }

    httpClient, err := core.DefaultHttpClient()
    if err != nil {
        panic(fmt.Sprintf("unable to load default http client: %v", err))
    }

    client := client.NewRestClient(credentials, httpClient)

    productsSvc := products.NewProductsService(client)

    request := &products.GetProductRequest{
        ProductId: "BTC-USD",
    }

    response, err := productsSvc.GetProduct(context.Background(), request)
    if err != nil {
        panic(fmt.Sprintf("unable to get product: %v", err))
    }

    jsonResponse, err := json.MarshalIndent(response, "", "  ")
    if err != nil {
        panic(fmt.Sprintf("error marshaling response to JSON: %v", err))
    }
    fmt.Println(string(jsonResponse))
}
```
