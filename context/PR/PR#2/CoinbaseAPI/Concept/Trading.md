# Trading Guide: Orders and Order Types

## Overview

The Coinbase Exchange facilitates trading through orders, which form the foundation of effective crypto trading strategies. Traders must understand available order types and their operational characteristics.

## Product Pairs

Prior to placing orders, traders should identify available trading pairs and their requirements. The system provides access to metadata about minimum order sizes and other constraints:

```go
package main

import (
    "context"
    "encoding/json"
    "fmt"
    "log"

    "github.com/coinbase-samples/core-go"
    "github.com/coinbase-samples/exchange-sdk-go/client"
    "github.com/coinbase-samples/exchange-sdk-go/credentials"
    "github.com/coinbase-samples/exchange-sdk-go/products"
)

func main() {
    credentials, err := credentials.ReadEnvCredentials("EXCHANGE_CREDENTIALS")
    if err != nil {
        log.Fatalf("unable to read credentials from environment: %v", err)
    }

    httpClient, err := core.DefaultHttpClient()
    if err != nil {
        log.Fatalf("unable to load default http client: %v", err)
    }

    client := client.NewRestClient(credentials, httpClient)
    productsSvc := products.NewProductsService(client)
    request := &products.ListProductsRequest{}
    response, err := productsSvc.ListProducts(context.Background(), request)
    if err != nil {
        log.Fatalf("unable to list products: %v", err)
    }

    output, err := json.MarshalIndent(response, "", "  ")
    if err != nil {
        log.Fatalf("error marshaling response to JSON: %v", err)
    }
    fmt.Println(string(output))
}
```

## Order Types

### Limit Orders

These allow traders to set both price and quantity parameters. Key characteristics include:

- Order executes at your specified price or better
- Protection against unfavorable pricing
- Fills occur based on price-time priority
- Maximum 500 open orders per product per profile

### Market Orders

Designed for rapid execution prioritizing speed over price precision:

- Immediate fulfillment against current liquidity
- Always functions as a liquidity-taking order
- No guaranteed execution price
- Risk of adverse pricing on large volumes

## Order Amount Parameters

Traders specify order amounts using either:

- **Size**: Quantity in base currency (BTC in BTC-USD)
- **Funds**: Amount in quote currency (USD in BTC-USD)
- Market orders accept either parameter, not both

### Stop Orders

These facilitate automated strategies through:

- Exit positions triggered by adverse price movements
- Entry activation upon reaching specified price thresholds
- Conversion to market orders upon trigger

## Advanced Order Features

### Post-Only Orders

Order rejected if any part would execute immediately, guaranteeing maker status and associated fee benefits.

### Self-Trade Prevention

Options for handling self-matching scenarios:

- **Decrease and Cancel (DC)**: Reduces newer order, cancels if fully affected
- **Cancel Oldest (CO)**: Removes earlier resting order
- **Cancel Newest (CN)**: Removes incoming order
- **Cancel Both (CB)**: Removes both orders

### Time in Force Options

- **GTC**: Remains until filled or canceled
- **GTT**: Expires at specified timestamp
- **IOC**: Fills available quantity immediately, cancels remainder
- **FOK**: Executes completely or cancels entirely

## Creating Orders

**Go Implementation**:

```go
credentials, err := credentials.ReadEnvCredentials("EXCHANGE_CREDENTIALS")
httpClient, err := core.DefaultHttpClient()
client := client.NewRestClient(credentials, httpClient)

ordersSvc := accounts.NewOrdersService(client)
request := &orders.CreateOrderRequest{
    Type:        "market",
    Side:        "buy",
    ProductId:   "BTC-USD",
    ClientOid:   "UUID",
    Funds:       "10",
}
response, err := ordersSvc.CreateOrder(context.Background(), request)
```

**TypeScript/JavaScript Implementation**:

```js
const ordersService = new OrdersService(client);
const today = new Date();

ordersService.createOrder({
    portfolioId: "PORTFOLIO_ID_HERE",
    baseQuantity: "5",
    limitPrice: "0.32",
    side: OrderSide.BUY,
    productId: "ADA-USD",
    type: OrderType.LIMIT,
    expiryTime: date.setDate(date.getDate() + 1),
    clientOrderId: uuidv4()
}).then(async (response) => {
    console.log('Order: ', response);
})
```

## Listing Orders

Retrieve current order status:

- Returns only open orders, settled orders are excluded by default
- Order conditions may shift between request submission and response receipt
- Pending orders contain limited data fields

```go
credentials, err := credentials.ReadEnvCredentials("EXCHANGE_CREDENTIALS")
if err != nil {
    log.Fatalf("unable to read credentials from environment: %v", err)
}

httpClient, err := core.DefaultHttpClient()
if err != nil {
    log.Fatalf("unable to load default http client: %v", err)
}

client := client.NewRestClient(credentials, httpClient)
ordersSvc := orders.NewOrdersService(client)
request := &orders.ListOrdersRequest{}
response, err := ordersSvc.ListOrders(context.Background(), request)
if err != nil {
    log.Fatalf("unable to list orders: %v", err)
}

output, err := json.MarshalIndent(response, "", "  ")
if err != nil {
    log.Fatalf("error marshaling response to JSON: %v", err)
}
fmt.Println(string(output))
```
