# Advanced Trade WebSocket Overview

The WebSocket feed is publicly accessible and delivers live market data for orders and trades. Two production endpoints are available:

* **Market Data** - Traditional feed offering order and trade updates; most channels work without authentication
* **User Order Data** - Delivers updates specific to user orders

## Endpoints

- **Market Data**: `wss://advanced-trade-ws.coinbase.com`
- **User Order Data**: `wss://advanced-trade-ws-user.coinbase.com`

> "You can subscribe to the Heartbeats Channel, User Channel and Futures Balance Summary Channel with the User Order Data endpoint."

For reliability, use the primary User Order Data connection with Market Data as a backup.

## Protocol Details

Messages use a bidirectional JSON-based protocol where each message includes a `type` attribute for proper handling. The system supports adding new message types at any time, requiring clients to gracefully ignore unsupported message types.

## Subscription Process with CDP Keys

### Subscribing to Channels

Clients must send a `subscribe` message within 5 seconds or face disconnection. Each channel requires a separate subscription message.

```json
{
  "type": "subscribe",
  "product_ids": ["ETH-USD", "ETH-EUR"],
  "channel": "level2",
  "jwt": "exampleJWT"
}
```

Required fields:
- `channel`: Single channel name per subscription message
- `jwt`: Generate fresh tokens for each message (2-minute expiration); see WebSocket Authentication documentation

### Unsubscribing

Send an `unsubscribe` message with the same structure to discontinue receiving updates. Omit `product_ids` to unsubscribe from the entire channel.

```json
{
  "type": "unsubscribe",
  "product_ids": ["ETH-USD", "ETH-EUR"],
  "channel": "level2",
  "jwt": "exampleJWT"
}
```

A `subscriptions` message confirms the unsubscribe action.

## Code Examples

### JavaScript Implementation

```javascript
const WebSocket = require("ws");
const { sign } = require("jsonwebtoken");
const crypto = require("crypto");
const fs = require("fs");

const API_KEY = "organizations/{org_id}/apiKeys/{key_id}";
const SIGNING_KEY = "-----BEGIN EC PRIVATE KEY-----\nYOUR PRIVATE KEY\n-----END EC PRIVATE KEY-----\n";
const algorithm = "ES256";

const CHANNEL_NAMES = {
  level2: "level2",
  user: "user",
  tickers: "ticker",
  ticker_batch: "ticker_batch",
  status: "status",
  market_trades: "market_trades",
  candles: "candles",
};

const WS_API_URL = "wss://advanced-trade-ws.coinbase.com";

function signWithJWT(message, channel, products = []) {
  const jwt = sign(
    {
      iss: "cdp",
      nbf: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 120,
      sub: API_KEY,
    },
    SIGNING_KEY,
    {
      algorithm,
      header: {
        kid: API_KEY,
        nonce: crypto.randomBytes(16).toString("hex"),
      },
    }
  );

  return { ...message, jwt: jwt };
}

const ws = new WebSocket(WS_API_URL);

function subscribeToProducts(products, channelName, ws) {
  const message = {
    type: "subscribe",
    channel: channelName,
    product_ids: products,
  };
  const subscribeMsg = signWithJWT(message, channelName, products);
  ws.send(JSON.stringify(subscribeMsg));
}

function unsubscribeToProducts(products, channelName, ws) {
  const message = {
    type: "unsubscribe",
    channel: channelName,
    product_ids: products,
  };
  const subscribeMsg = signWithJWT(message, channelName, products);
  ws.send(JSON.stringify(subscribeMsg));
}

const connections = [];
let sentUnsub = false;

const date1 = new Date(new Date().toUTCString());
const ws = new WebSocket(WS_API_URL);

ws.on("message", function (data) {
  const date2 = new Date(new Date().toUTCString());
  const diffTime = Math.abs(date2 - date1);
  if (diffTime > 5000 && !sentUnsub) {
    unsubscribeToProducts(["BTC-USD"], CHANNEL_NAMES.level2, ws);
    sentUnsub = true;
  }

  const parsedData = JSON.parse(data);
  fs.appendFile("Output1.txt", data, (err) => {
    if (err) throw err;
  });
});

ws.on("open", function () {
  const products = ["BTC-USD"];
  subscribeToProducts(products, CHANNEL_NAMES.level2, ws);
});

connections.push(ws);
```

### Python Implementation

```python
import time
import json
import jwt
import hashlib
import os
import websocket
import threading
from datetime import datetime, timedelta

API_KEY = "organizations/{org_id}/apiKeys/{key_id}"
SIGNING_KEY = """-----BEGIN EC PRIVATE KEY-----
YOUR PRIVATE KEY
-----END EC PRIVATE KEY-----"""

ALGORITHM = "ES256"

if not SIGNING_KEY or not API_KEY:
    raise ValueError("Missing mandatory environment variable(s)")

CHANNEL_NAMES = {
    "level2": "level2",
    "user": "user",
    "tickers": "ticker",
    "ticker_batch": "ticker_batch",
    "status": "status",
    "market_trades": "market_trades",
    "candles": "candles",
}

WS_API_URL = "wss://advanced-trade-ws.coinbase.com"

def sign_with_jwt(message, channel, products=[]):
    payload = {
        "iss": "coinbase-cloud",
        "nbf": int(time.time()),
        "exp": int(time.time()) + 120,
        "sub": API_KEY,
    }
    headers = {
        "kid": API_KEY,
        "nonce": hashlib.sha256(os.urandom(16)).hexdigest()
    }
    token = jwt.encode(payload, SIGNING_KEY, algorithm=ALGORITHM, headers=headers)
    message['jwt'] = token
    return message

def on_message(ws, message):
    data = json.loads(message)
    with open("Output1.txt", "a") as f:
        f.write(json.dumps(data) + "\n")

def subscribe_to_products(ws, products, channel_name):
    message = {
        "type": "subscribe",
        "channel": channel_name,
        "product_ids": products
    }
    signed_message = sign_with_jwt(message, channel_name, products)
    ws.send(json.dumps(signed_message))

def unsubscribe_to_products(ws, products, channel_name):
    message = {
        "type": "unsubscribe",
        "channel": channel_name,
        "product_ids": products
    }
    signed_message = sign_with_jwt(message, channel_name, products)
    ws.send(json.dumps(signed_message))

def on_open(ws):
    products = ["BTC-USD"]
    subscribe_to_products(ws, products, CHANNEL_NAMES["level2"])

def start_websocket():
    ws = websocket.WebSocketApp(WS_API_URL, on_open=on_open, on_message=on_message)
    ws.run_forever()

def main():
    ws_thread = threading.Thread(target=start_websocket)
    ws_thread.start()

    sent_unsub = False
    start_time = datetime.utcnow()

    try:
        while True:
            if (datetime.utcnow() - start_time).total_seconds() > 5 and not sent_unsub:
                ws = websocket.create_connection(WS_API_URL)
                unsubscribe_to_products(ws, ["BTC-USD"], CHANNEL_NAMES["level2"])
                ws.close()
                sent_unsub = True
            time.sleep(1)
    except Exception as e:
        print(f"Exception: {e}")

if __name__ == "__main__":
    main()
```

## Public Subscriptions (Without API Keys)

### Subscribe Without Authentication

```json
{
  "type": "subscribe",
  "product_ids": ["ETH-USD", "ETH-EUR"],
  "channel": "level2"
}
```

### Unsubscribe Without Authentication

```json
{
  "type": "unsubscribe",
  "product_ids": ["ETH-USD", "ETH-EUR"],
  "channel": "level2"
}
```

## Sequence Numbers

Most messages include sequence numbers—incrementing integers per product where each new message is exactly one greater than the previous.

**Sequence Number Interpretation:**
- **Gap greater than one**: A message was dropped
- **Lower than previous**: Out-of-order arrival; can be ignored
- **Action required**: Implement logic to verify system state accuracy

> "Even though a WebSocket connection is over TCP, the WebSocket servers receive market data in a manner that can result in dropped messages."

Design consumers to handle gaps and out-of-order delivery, or use channels guaranteeing message delivery.

## Best Practices

For synchronized order books without data loss, consider using the level2 channel, which provides delivery guarantees.

---

## Related Documentation

- [WebSocket Channels](/coinbase-app/advanced-trade-apis/websocket/websocket-channels)
- [WebSocket Rate Limits](/coinbase-app/advanced-trade-apis/websocket/websocket-rate-limits)
