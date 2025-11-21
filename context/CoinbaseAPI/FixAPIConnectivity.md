# Exchange FIX API Connectivity

## Overview

The Financial Information eXchange (FIX) protocol enables order entry, cancellation requests, and trade fills. Organizations with established FIX-based order management systems can leverage this standard protocol for exchange connectivity.

The baseline specification adheres to FIX 5.0 SP2 for both order entry and market data functionality.

### Maintenance Windows

**Weekly Reset**: The system resets every Saturday at 1PM ET (6PM UTC), disconnecting all active sessions.

**Deployment Schedule**: Updates roll out Mondays and Thursdays near 2PM EST (7PM UTC), with server-initiated logout messages signaling session termination. U.S. federal holidays are excluded from deployment windows.

## Available Endpoints

### Production Environment
- Order Entry: `tcp+ssl://fix-ord.exchange.coinbase.com:6121`
- Market Data (Snapshots Enabled): `tcp+ssl://fix-md.exchange.coinbase.com:6121`
- Market Data (Snapshots Disabled): `tcp+ssl://fix-md.exchange.coinbase.com:6122`
- Dedicated Drop Copy: `tcp+ssl://fix-dc.exchange.coinbase.com:6122`

### Sandbox Environment
- Order Entry: `tcp+ssl://fix-ord.sandbox.exchange.coinbase.com:6121`
- Market Data (Snapshots Enabled): `tcp+ssl://fix-md.sandbox.exchange.coinbase.com:6121`
- Market Data (Snapshots Disabled): `tcp+ssl://fix-md.sandbox.exchange.coinbase.com:6122`
- Dedicated Drop Copy: `tcp+ssl://fix-dc.sandbox.exchange.coinbase.com:6122`

## Connection Requirements

**Resend Requests**: Not supported. Each connection establishes independent session sequence numbers.

**SSL/TLS Support**: Implementations lacking native SSL support must employ local proxy solutions like [stunnel](https://www.stunnel.org).

**IP Whitelist Constraints**: Static IP allocation is unavailable. Organizations requiring IP-based firewall rules should implement TCP proxy servers with static IPs using DNS resolution, or reference AWS provided resources for IP range whitelisting when connecting from external servers.

## Security Specifications

The platform supports TLSv1.2 with four approved cipher suites:

| Status | Strength | Cipher Suite | Curve |
|--------|----------|--------------|-------|
| Preferred | 128-bit | `ECDHE-RSA-AES128-GCM-SHA256` | P-256 DHE 256 |
| Accepted | 128-bit | `ECDHE-RSA-AES128-SHA256` | P-256 DHE 256 |
| Accepted | 256-bit | `ECDHE-RSA-AES256-GCM-SHA384` | P-256 DHE 256 |
| Accepted | 256-bit | `ECDHE-RSA-AES256-SHA384` | P-256 DHE 256 |

All connections must utilize SSL-secured TCP tunnels.
