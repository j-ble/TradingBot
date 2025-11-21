# Exchange Systems & Operations

## Deployment Schedule

API components roll out on different schedules:

- **FIX**: Monday, Thursday at 2PM ET
- **WebSocket**: Monday, Wednesday, Thursday at 2PM ET
- **REST**: Monday, Wednesday, Thursday at 2PM ET

Note: These schedules may change without notice.

## Production API Endpoints

Connect to Coinbase Exchange using these URLs:

| Service | Endpoint |
|---------|----------|
| REST | `https://api.exchange.coinbase.com` |
| WebSocket Feed | `wss://ws-feed.exchange.coinbase.com` |
| WebSocket Direct | `wss://ws-direct.exchange.coinbase.com` |
| FIX Order Entry | `tcp+ssl://fix-ord.exchange.coinbase.com:6121` |
| FIX Market Data (Snapshots On) | `tcp+ssl://fix-md.exchange.coinbase.com:6121` |
| FIX Market Data (Snapshots Off) | `tcp+ssl://fix-md.exchange.coinbase.com:6122` |
| FIX Drop Copy | `tcp+ssl://fix-dc.exchange.coinbase.com:6122` |

## Infrastructure Location

All components run within US-EAST-1 (AWS) across multiple availability zones, with all major systems located in zone use1-az4.

## System Architecture Overview

**REST gateways** route through Cloudflare and process requests immediately without queuing.

**FIX order gateways** maintain individual queues per user per product, accepting maximum 50 pending requests.

**Order Entry Gateway** performs real-time risk assessment.

**Trade Engine** maintains FIFO ordering at the product level.

**Market data distribution** spreads messages randomly across subscribers with no ordering advantage.
