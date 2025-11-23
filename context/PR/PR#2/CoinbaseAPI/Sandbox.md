# Exchange Sandbox

A public sandbox environment enables developers to test API connectivity and web trading features without using real funds.

## Key Characteristics

The sandbox provides a testing environment with important limitations. As noted in the documentation, "The sandbox hosts a *subset* of the production order books" and supports most exchange functionality, though transfer operations are excluded. Users can generate unlimited test funds for experimentation.

Login credentials and API keys remain entirely separate from the production system. Developers should visit the dedicated sandbox web interface to establish API keys and manage test funds.

## API Endpoints

The following URLs serve sandbox testing:

| API Type | Endpoint |
|----------|----------|
| REST API | `https://api-public.sandbox.exchange.coinbase.com` |
| Websocket Feed | `wss://ws-feed-public.sandbox.exchange.coinbase.com` |
| Websocket Direct Feed | `wss://ws-direct.sandbox.exchange.coinbase.com` |
| FIX Order Entry 4.2 | `tcp+ssl://fix-public.sandbox.exchange.coinbase.com:4198` |
| FIX Order Entry 5.0 SP2 | `tcp+ssl://fix-ord.sandbox.exchange.coinbase.com:6121` |
| FIX Market Data 5.0 SP2 | `tcp+ssl://fix-md.sandbox.exchange.coinbase.com:6121` |

## SSL Certificate Information

FIX API clients must validate against the provided sandbox SSL certificate (Amazon-issued, valid through April 2023).

## Unavailable Features

Transfer functionality remains unavailable in sandbox, including payment method deposits/withdrawals, Coinbase account transfers, and cryptocurrency address withdrawals.

## Setup Instructions

**API Key Creation:** Access the sandbox interface, navigate to API settings in your profile menu, and create a new key.

**Fund Management:** Use the Portfolios tab to deposit or withdraw test currency as needed for development.
