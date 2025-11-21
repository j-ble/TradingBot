# Advanced Trade WebSocket Rate Limits

The WebSocket feed is publicly accessible and provides real-time market data updates offering rapid visibility into order flow and trades.

## Rate Limiting Details

- **WebSocket connections:** Limited to 750 per second per IP address
- **Unauthenticated messages:** Capped at 8 per second per IP address

## Important Responsibility

You are responsible for reading the message stream and using the messages relevant for your needs, such as building real-time order books and tracking real-time trades.

## Related Resources

- [WebSocket Best Practices](/coinbase-app/advanced-trade-apis/guides/websocket)
- [WebSocket Channels](/coinbase-app/advanced-trade-apis/websocket/websocket-channels)
