# Exchange WebSocket Overview

## Endpoints

The WebSocket feed offers real-time market data through two publicly available endpoints:

**Coinbase Market Data** (no authentication required):
- Production: `wss://ws-feed.exchange.coinbase.com`
- Sandbox: `wss://ws-feed-public.sandbox.exchange.coinbase.com`

**Coinbase Direct Market Data** (requires authentication):
- Production: `wss://ws-direct.exchange.coinbase.com`
- Sandbox: `wss://ws-direct.sandbox.exchange.coinbase.com`

Both endpoints support production and sandbox environments. Users may subscribe to both, with the direct connection as primary and traditional feed as failover.

## Protocol

Messages use JSON format with a bidirectional protocol. Each message includes a "type" attribute for proper handling. The system accommodates new message types added at any time; clients should ignore unsupported messages.

## Subscription Management

### Subscribe

Connection requires sending a `subscribe` message within 5 seconds or the connection closes. Specify channels and product IDs:

```json
{
  "type": "subscribe",
  "product_ids": ["ETH-USD", "ETH-EUR"],
  "channels": [
    "level2",
    "heartbeat",
    {
      "name": "ticker",
      "product_ids": ["ETH-BTC", "ETH-USD"]
    }
  ]
}
```

### Unsubscribe

Send an `unsubscribe` message with equivalent structure to disconnect from specific channel/product combinations:

```json
{
  "type": "unsubscribe",
  "channels": ["heartbeat"]
}
```

### Product ID Specification

Define product IDs either per-channel or at the root level (applying to all subscribed channels).

### Subscriptions Response

The server responds with a `subscriptions` message listing all active subscriptions after subscribe/unsubscribe requests.

## WebSocket Compression

RFC7692 permessage-deflate compression can be enabled via header:

```
Sec-WebSocket-Extensions: permessage-deflate
```

Compression increases throughput and potentially reduces latency.

## Sequence Numbers

Feed messages contain sequence numbers—incrementing integers per product. Gaps indicate dropped messages; lower numbers suggest out-of-order delivery. Systems should handle both scenarios appropriately.

## Python Example

A complete implementation demonstrating authentication and connection:

```python
import asyncio, base64, hashlib, hmac, json, os, time, websockets

API_KEY = str(os.environ.get('API_KEY'))
PASSPHRASE = str(os.environ.get('PASSPHRASE'))
SECRET_KEY = str(os.environ.get('SECRET_KEY'))

URI = 'wss://ws-feed.exchange.coinbase.com'
SIGNATURE_PATH = '/users/self/verify'

async def generate_signature():
    timestamp = str(time.time())
    message = f'{timestamp}GET{SIGNATURE_PATH}'
    hmac_key = base64.b64decode(SECRET_KEY)
    signature = hmac.new(
        hmac_key,
        message.encode('utf-8'),
        digestmod=hashlib.sha256).digest()
    signature_b64 = base64.b64encode(signature).decode().rstrip('\n')
    return signature_b64, timestamp

async def websocket_listener():
    signature_b64, timestamp = await generate_signature()
    subscribe_message = json.dumps({
        'type': 'subscribe',
        'channels': [{'name': 'level2', 'product_ids': ['ETH-USD']}],
        'signature': signature_b64,
        'key': API_KEY,
        'passphrase': PASSPHRASE,
        'timestamp': timestamp
    })

    while True:
        try:
            async with websockets.connect(URI, ping_interval=None) as websocket:
                await websocket.send(subscribe_message)
                while True:
                    response = await websocket.recv()
                    print(json.loads(response))
        except (websockets.exceptions.ConnectionClosedError, websockets.exceptions.ConnectionClosedOK):
            print('Connection closed, retrying..')
            await asyncio.sleep(1)

if __name__ == '__main__':
    asyncio.run(websocket_listener())
```

Complete sample code available at [Coinbase Samples](https://github.com/coinbase-samples/exchange-scripts-py/tree/main/websocket).
