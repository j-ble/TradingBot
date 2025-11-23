# Advanced Trade WebSocket Channels

## Overview

> **Note:** Most channels close within 60-90 seconds if no updates are sent.

Subscribe to heartbeats to maintain all active connections. The Coinbase Advanced Trade Market Data WebSocket feed offers these channels:

| Channel | Description | Authentication |
|---------|-------------|-----------------|
| **heartbeats** | Server pings to maintain connection stability | No |
| candles | Real-time product candle updates | No |
| status | Products and currencies at preset intervals | No |
| ticker | Price updates on each match | No |
| ticker_batch | Price updates every 5 seconds | No |
| level2 | Order book snapshot maintenance | No |
| user | Authenticated user order and position data | **Yes** |
| market_trades | Real-time market trade updates | No |
| futures_balance_summary | User futures balance changes | **Yes** |

> **Tip:** For the most reliable connection, authenticate with a CDP API key when subscribing to any channel.

## Heartbeats Channel

Subscribe to receive pings every second with a `heartbeat_counter` to verify message continuity. This proves especially useful for tracking illiquid trading pairs with sparse activity.

**Request:**
```json
{
  "type": "subscribe",
  "channel": "heartbeats",
  "jwt": "XYZ"
}
```

**Message Structure:**
```json
{
  "channel": "heartbeats",
  "client_id": "",
  "timestamp": "2023-06-23T20:31:26.122969572Z",
  "sequence_num": 0,
  "events": [
    {
      "current_time": "2023-06-23 20:31:56.121961769 +0000 UTC m=+91717.525857105",
      "heartbeat_counter": "3049"
    }
  ]
}
```

## Candles Channel

Receive one-second updates on product candles grouped into five-minute intervals.

**Request:**
```json
{
  "type": "subscribe",
  "product_ids": ["ETH-USD"],
  "channel": "candles",
  "jwt": "XYZ"
}
```

**Key Fields:**
- `start`: UNIX timestamp of candle opening
- `high`/`low`: Price extremes during interval
- `open`/`close`: First and final trade prices
- `volume`: Base currency trading volume
- `product_id`: Identifier for this candle

**Message Example:**
```json
{
  "channel": "candles",
  "client_id": "",
  "timestamp": "2023-06-09T20:19:35.39625135Z",
  "sequence_num": 0,
  "events": [
    {
      "type": "snapshot",
      "candles": [
        {
          "start": "1688998200",
          "high": "1867.72",
          "low": "1865.63",
          "open": "1867.38",
          "close": "1866.81",
          "volume": "0.20269406",
          "product_id": "ETH-USD"
        }
      ]
    }
  ]
}
```

## Market Trades Channel

Transmits market trades for specified products at regular intervals. Supply a `product_ids` array for desired subscriptions.

**Request:**
```json
{
  "type": "subscribe",
  "product_ids": ["ETH-USD", "BTC-USD"],
  "channel": "market_trades",
  "jwt": "XYZ"
}
```

Messages contain `snapshot` or `update` types with trade arrays. Each trade includes `side` (BUY/SELL from maker perspective). The system batches updates from the preceding 250 milliseconds into single messages.

**Message Example:**
```json
{
  "channel": "market_trades",
  "client_id": "",
  "timestamp": "2023-02-09T20:19:35.39625135Z",
  "sequence_num": 0,
  "events": [
    {
      "type": "snapshot",
      "trades": [
        {
          "trade_id": "000000000",
          "product_id": "ETH-USD",
          "price": "1260.01",
          "size": "0.3",
          "side": "BUY",
          "time": "2019-08-14T20:42:27.265Z"
        }
      ]
    }
  ]
}
```

## Status Channel

Delivers all products and currencies on scheduled intervals. Provide `product_ids` for subscriptions.

> **Note:** The status channel, like most channels, closes within 60-90 seconds when there are no updates.

Subscribe to heartbeats alongside status subscriptions to prevent disconnection.

**Request:**
```json
{
  "type": "subscribe",
  "product_ids": ["ETH-USD", "BTC-USD"],
  "channel": "status",
  "jwt": "XYZ"
}
```

**Message Example:**
```json
{
  "channel": "status",
  "client_id": "",
  "timestamp": "2023-02-09T20:29:49.753424311Z",
  "sequence_num": 0,
  "events": [
    {
      "type": "snapshot",
      "products": [
        {
          "product_type": "SPOT",
          "id": "BTC-USD",
          "base_currency": "BTC",
          "quote_currency": "USD",
          "base_increment": "0.00000001",
          "quote_increment": "0.01",
          "display_name": "BTC/USD",
          "status": "online",
          "status_message": "",
          "min_market_funds": "1"
        }
      ]
    }
  ]
}
```

## Ticker Channel

Provides instantaneous pricing whenever a match occurs, batching cascading matches to reduce bandwidth.

**Request:**
```json
{
  "type": "subscribe",
  "product_ids": ["ETH-USD", "BTC-USD"],
  "channel": "ticker",
  "jwt": "XYZ"
}
```

**Message Example:**
```json
{
  "channel": "ticker",
  "client_id": "",
  "timestamp": "2023-02-09T20:30:37.167359596Z",
  "sequence_num": 0,
  "events": [
    {
      "type": "snapshot",
      "tickers": [
        {
          "type": "ticker",
          "product_id": "BTC-USD",
          "price": "21932.98",
          "volume_24_h": "16038.28770938",
          "low_24_h": "21835.29",
          "high_24_h": "23011.18",
          "low_52_w": "15460",
          "high_52_w": "48240",
          "price_percent_chg_24_h": "-4.15775596190603",
          "best_bid": "21931.98",
          "best_bid_quantity": "8000.21",
          "best_ask": "21933.98",
          "best_ask_quantity": "8038.07770938"
        }
      ]
    }
  ]
}
```

## Ticker Batch Channel

Delivers latest pricing updates every 5000 milliseconds (5 seconds) when changes occur. Uses identical JSON structure to the ticker channel except the `channel` field reads `ticker_batch` and lacks best bid/ask fields.

**Request:**
```json
{
  "type": "subscribe",
  "product_ids": ["ETH-USD", "BTC-USD"],
  "channel": "ticker_batch",
  "jwt": "XYZ"
}
```

## Level2 Channel

> **Tip:** Subscribe to the level2 channel to guarantee that messages are delivered and your order book is in sync.

Ensures complete delivery of all updates for optimal order book snapshot management.

**Request:**
```json
{
  "type": "subscribe",
  "product_ids": ["ETH-USD", "BTC-USD"],
  "channel": "level2",
  "jwt": "XYZ"
}
```

Messages include `type` (snapshot/update), `product_id`, and `updates` array. The `updates` array contains objects with `{price_level, new_quantity, event_time, side}` properties representing complete order book state.

> **Note:** The new_quantity property is the updated size at that price level, not a delta. A new_quantity of '0' indicates the price level can be removed.

**Message Example:**
```json
{
  "channel": "l2_data",
  "client_id": "",
  "timestamp": "2023-02-09T20:32:50.714964855Z",
  "sequence_num": 0,
  "events": [
    {
      "type": "snapshot",
      "product_id": "BTC-USD",
      "updates": [
        {
          "side": "bid",
          "event_time": "1970-01-01T00:00:00Z",
          "price_level": "21921.73",
          "new_quantity": "0.06317902"
        },
        {
          "side": "bid",
          "event_time": "1970-01-01T00:00:00Z",
          "price_level": "21921.3",
          "new_quantity": "0.02"
        }
      ]
    }
  ]
}
```

## User Channel

**Authentication Required**

Transmits updates on authenticated user's open orders and active positions with subsequent changes.

The channel operates on a one-connection-per-user basis:
- Accepts multiple `product_ids` in an array
- Omitting product IDs subscribes to all products
- Close and reopen connections to modify subscribed products

> **Note:** Subscribing to the User channel returns all OPEN orders, batched by 50, in the first few messages of the stream.

Look for the initial message containing fewer than 50 orders to confirm all open orders have been received.

**Request:**
```json
{
  "type": "subscribe",
  "channel": "user",
  "product_ids": ["BTC-USD"],
  "jwt": "XYZ"
}
```

**Message Example:**
```json
{
  "channel": "user",
  "client_id": "",
  "timestamp": "2023-02-09T20:33:57.609931463Z",
  "sequence_num": 0,
  "events": [
    {
      "type": "snapshot",
      "orders": [
        {
          "avg_price": "50000",
          "cancel_reason": "",
          "client_order_id": "XXX",
          "completion_percentage": "100.00",
          "contract_expiry_type": "UNKNOWN_CONTRACT_EXPIRY_TYPE",
          "cumulative_quantity": "0.01",
          "filled_value": "500",
          "leaves_quantity": "0",
          "limit_price": "50000",
          "number_of_fills": "1",
          "order_id": "YYY",
          "order_side": "BUY",
          "order_type": "Limit",
          "outstanding_hold_amount": "0",
          "post_only": "false",
          "product_id": "BTC-USD",
          "product_type": "SPOT",
          "reject_reason": "",
          "retail_portfolio_id": "ZZZ",
          "risk_managed_by": "UNKNOWN_RISK_MANAGEMENT_TYPE",
          "status": "FILLED",
          "stop_price": "",
          "time_in_force": "GOOD_UNTIL_CANCELLED",
          "total_fees": "2",
          "total_value_after_fees": "502",
          "trigger_status": "INVALID_ORDER_TYPE",
          "creation_time": "2024-06-21T18:29:13.909347Z",
          "end_time": "0001-01-01T00:00:00Z",
          "start_time": "0001-01-01T00:00:00Z"
        }
      ],
      "positions": {
        "perpetual_futures_positions": [
          {
            "product_id": "BTC-PERP-INTX",
            "portfolio_uuid": "018c4b12-9f87-7c36-897d-28fb6a1ea88d",
            "vwap": "63049.9",
            "entry_vwap": "0",
            "position_side": "Long",
            "margin_type": "Cross",
            "net_size": "0.0041",
            "buy_order_size": "0",
            "sell_order_size": "0",
            "leverage": "1",
            "mark_price": "63049.9",
            "liquidation_price": "0",
            "im_notional": "258.5046",
            "mm_notional": "17.061304",
            "position_notional": "258.5046",
            "unrealized_pnl": "0",
            "aggregated_pnl": "258.50459"
          }
        ],
        "expiring_futures_positions": [
          {
            "product_id": "BIT-28JUN24-CDE",
            "side": "Long",
            "number_of_contracts": "1",
            "realized_pnl": "0",
            "unrealized_pnl": "-21.199999999999932",
            "entry_price": "64150"
          }
        ]
      }
    }
  ]
}
```

### Order Fields

| Field | Description |
|-------|-------------|
| `avg_price` | Average filled price to date |
| `cancel_reason` | Cancellation reason |
| `client_order_id` | Client-specified unique identifier |
| `completion_percentage` | Percentage of order completion |
| `contract_expiry_type` | UNKNOWN_CONTRACT_EXPIRY, EXPIRING, or PERPETUAL |
| `cumulative_quantity` | Amount filled in base currency |
| `filled_value` | Filled order value |
| `leaves_quantity` | Unfilled amount |
| `limit_price` | Limit price or 0 if not applicable |
| `number_of_fills` | Count of fill events |
| `order_id` | Unique order identifier |
| `order_side` | BUY or SELL |
| `order_type` | LIMIT, MARKET, or STOP_LIMIT |
| `outstanding_hold_amount` | Balance held for order |
| `post_only` | true or false |
| `product_id` | Product identifier |
| `product_type` | UNKNOWN_PRODUCT_TYPE, SPOT, or FUTURE |
| `reject_reason` | Rejection reason |
| `retail_portfolio_id` | Associated portfolio ID |
| `risk_managed_by` | UNKNOWN_RISK_MANAGEMENT_TYPE, MANAGED_BY_FCM, or MANAGED_BY_VENUE |
| `status` | PENDING, OPEN, FILLED, CANCEL_QUEUED, CANCELLED, EXPIRED, or FAILED |
| `stop_price` | Stop price or 0 if not applicable |
| `time_in_force` | UNKNOWN_TIME_IN_FORCE, GOOD_UNTIL_DATE_TIME, GOOD_UNTIL_CANCELLED, IMMEDIATE_OR_CANCEL, or FILL_OR_KILL |
| `total_fees` | Commission paid |
| `total_value_after_fees` | Order value minus fees |
| `trigger_status` | UNKNOWN_TRIGGER_STATUS, INVALID_ORDER_TYPE, STOP_PENDING, or STOP_TRIGGERED |
| `creation_time` | Placement timestamp |
| `end_time` | Order end time or 0001-01-01T00:00:00Z |
| `start_time` | Order start time or 0001-01-01T00:00:00Z |

### Position Fields

Numeric values are denominated in USDC.

> **Note:** The positions fields are in beta and is currently returned as an empty array by default.

Contact support via Discord to enable positions field access.

#### Perpetual Futures

| Field | Description |
|-------|-------------|
| `product_id` | Instrument name (e.g., BTC-PERP-INTX) |
| `portfolio_uuid` | Portfolio association identifier |
| `vwap` | Price from last settlement period |
| `entry_vwap` | Volume-weighted entry price |
| `position_side` | Long or Short |
| `margin_type` | Cross or Isolated |
| `net_size` | Position size (positive = long, negative = short) |
| `buy_order_size` | Total open buy order size |
| `sell_order_size` | Total open sell order size |
| `leverage` | Position leverage ratio |
| `mark_price` | Current mark price for risk calculations |
| `liquidation_price` | Liquidation trigger price |
| `im_notional` | Initial margin contribution |
| `mm_notional` | Maintenance margin contribution |
| `position_notional` | Position notional value |
| `unrealized_pnl` | Unrealized profit/loss (resets post-settlement) |
| `aggregated_pnl` | Total P&L since position opening |

#### Expiring Futures

| Field | Description |
|-------|-------------|
| `product_id` | Instrument name (e.g., BTC-12Jun24-CDE) |
| `side` | Long or Short |
| `number_of_contracts` | Position size in contracts |
| `realized_pnl` | Realized profit/loss |
| `unrealized_pnl` | Current unrealized profit/loss |
| `entry_price` | Average entry price |

## Futures Balance Summary Channel

**Authentication Required**

Sends updates on user's futures balances and subsequent changes.

**Request:**
```json
{
  "type": "subscribe",
  "channel": "futures_balance_summary",
  "jwt": "XYZ"
}
```

**Message Example:**
```json
{
  "channel": "futures_balance_summary",
  "client_id": "",
  "timestamp": "2023-02-09T20:33:57.609931463Z",
  "sequence_num": 0,
  "events": [
    {
      "type": "snapshot",
      "fcm_balance_summary":{
        "futures_buying_power": "100.00",
        "total_usd_balance": "200.00",
        "cbi_usd_balance": "300.00",
        "cfm_usd_balance": "400.00",
        "total_open_orders_hold_amount": "500.00",
        "unrealized_pnl": "600.00",
        "daily_realized_pnl": "0",
        "initial_margin": "700.00",
        "available_margin": "800.00",
        "liquidation_threshold": "900.00",
        "liquidation_buffer_amount": "1000.00",
        "liquidation_buffer_percentage": "1000",
        "intraday_margin_window_measure":{
          "margin_window_type":"FCM_MARGIN_WINDOW_TYPE_INTRADAY",
          "margin_level":"MARGIN_LEVEL_TYPE_BASE",
          "initial_margin":"100.00",
          "maintenance_margin":"200.00",
          "liquidation_buffer_percentage":"1000",
          "total_hold":"100.00",
          "futures_buying_power":"400.00"
        },
        "overnight_margin_window_measure":{
          "margin_window_type":"FCM_MARGIN_WINDOW_TYPE_OVERNIGHT",
          "margin_level":"MARGIN_LEVEL_TYPE_BASE",
          "initial_margin":"300.00",
          "maintenance_margin":"200.00",
          "liquidation_buffer_percentage":"1000",
          "total_hold":"-30.00",
          "futures_buying_power":"2000.00"
        }
      }
    }
  ]
}
```

### Balance Summary Fields

| Field | Description |
|-------|-------------|
| `futures_buying_power` | Cash available for CFM futures trading |
| `total_usd_balance` | Combined USD across CFTC futures and spot accounts |
| `cbi_usd_balance` | USD in spot account |
| `cfm_usd_balance` | USD in CFTC futures account (unavailable for spot) |
| `total_open_orders_hold_amount` | Combined balance held for open orders |
| `unrealized_pnl` | Current unrealized profit/loss across all positions |
| `daily_realized_pnl` | Realized P&L from current trading date |
| `initial_margin` | Margin required to open positions |
| `available_margin` | Funds available for margin requirements |
| `liquidation_threshold` | Balance level triggering position liquidation |
| `liquidation_buffer_amount` | Excess funds above liquidation threshold |
| `liquidation_buffer_percentage` | Liquidation buffer expressed as percentage |
| `intraday_margin_window_measure` | Intraday margin calculation metrics |
| `overnight_margin_window_measure` | Overnight margin calculation metrics |
