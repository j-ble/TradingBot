# BTC Trading Bot Dashboard

Real-time Next.js dashboard for monitoring and controlling the autonomous AI-powered BTC futures trading bot.

## Features

- **Real-time System Status**: Monitor database, Coinbase API, AI model, and n8n workflows
- **Account Overview**: Track balance, total P&L, daily P&L, and win rate progress to 90% goal
- **Open Positions**: View live positions with real-time P&L, stop loss, take profit, and trailing stops
- **Emergency Stop**: Immediately close all positions and halt trading activity
- **Auto-refresh**: Dashboard updates every 2-10 seconds for real-time monitoring

## Getting Started

### Prerequisites

- Node.js 20 LTS or higher
- PostgreSQL 16 with trading_bot database running
- Trading bot backend services operational

### Installation

1. Install dependencies:
```bash
npm install
```

2. Configure environment:
```bash
cp .env.example .env
# Edit .env with your database credentials and configuration
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

### Build for Production

```bash
npm run build
npm start
```

## Project Structure

```
dashboard/
├── pages/
│   ├── api/              # API routes
│   │   ├── status.ts     # System status endpoint
│   │   ├── positions.ts  # Open positions endpoint
│   │   ├── account.ts    # Account stats endpoint
│   │   └── emergency-stop.ts  # Emergency stop endpoint
│   ├── _app.tsx          # App wrapper
│   ├── _document.tsx     # HTML document
│   └── index.tsx         # Main dashboard page
├── components/
│   ├── SystemStatus.tsx      # System status component
│   ├── AccountStats.tsx      # Account statistics component
│   ├── PositionCard.tsx      # Position display component
│   └── EmergencyStop.tsx     # Emergency stop component
├── lib/
│   └── db.ts             # Database connection utility
└── styles/
    └── globals.css       # Global styles with Tailwind
```

## API Endpoints

### GET /api/status
Returns system status for all components.

**Response:**
```json
{
  "timestamp": "2024-01-15T12:00:00Z",
  "database": { "connected": true, "latency": 5 },
  "coinbase": { "connected": true, "lastUpdate": "2024-01-15T12:00:00Z" },
  "ai": { "available": true, "model": "gpt-oss:20b" },
  "n8n": { "running": true, "lastActivity": "2024-01-15T11:55:00Z" },
  "overall": "healthy"
}
```

### GET /api/positions
Returns all open trading positions with live P&L.

**Response:**
```json
[
  {
    "id": 1,
    "direction": "LONG",
    "entry_price": 90000,
    "current_price": 91000,
    "stop_loss": 88200,
    "take_profit": 93600,
    "unrealized_pnl": 55.5,
    "unrealized_pnl_percent": 1.11,
    ...
  }
]
```

### GET /api/account
Returns account balance and trading statistics.

**Response:**
```json
{
  "balance": 10000,
  "totalPnl": 450.50,
  "totalPnlPercent": 4.51,
  "winRate": 85.5,
  "totalTrades": 45,
  "wins": 38,
  "losses": 5,
  ...
}
```

### POST /api/emergency-stop
Immediately closes all positions and stops trading.

**Response:**
```json
{
  "success": true,
  "message": "Emergency stop executed successfully. 2 position(s) closed.",
  "positionsClosed": 2,
  "timestamp": "2024-01-15T12:00:00Z"
}
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_HOST` | PostgreSQL host | `localhost` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_NAME` | Database name | `trading_bot` |
| `DB_USER` | Database user | `postgres` |
| `DB_PASSWORD` | Database password | `postgres` |
| `NEXT_PUBLIC_API_URL` | API base URL | `http://localhost:3000` |
| `ACCOUNT_BALANCE` | Initial account balance | `10000` |
| `OLLAMA_HOST` | Ollama API host | `http://localhost:11434` |
| `AI_MODEL` | AI model name | `gpt-oss:20b` |

## Technology Stack

- **Framework**: Next.js 14 with React 18
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Data Fetching**: SWR (stale-while-revalidate)
- **Database**: PostgreSQL with node-postgres (pg)
- **Real-time Updates**: Auto-refresh with SWR

## Development

### Type Checking
```bash
npm run type-check
```

### Linting
```bash
npm run lint
```

## Security Notes

⚠️ **Important Security Considerations:**

1. **Emergency Stop**: The emergency stop button immediately closes all positions at market price. Use only in genuine emergencies.

2. **Database Access**: Ensure PostgreSQL is properly secured with strong credentials.

3. **Production Deployment**:
   - Use environment variables for all sensitive data
   - Enable HTTPS
   - Implement authentication (not included in MVP)
   - Restrict network access to dashboard

4. **Rate Limiting**: Consider adding rate limiting for API endpoints in production.

## Monitoring

The dashboard provides real-time monitoring of:
- System component health
- Trading performance metrics
- Open position P&L
- Risk management alerts
- Win rate progress toward 90% goal

## Troubleshooting

### Dashboard shows "Database not connected"
- Verify PostgreSQL is running: `pg_isready`
- Check database credentials in `.env`
- Ensure `trading_bot` database exists

### Positions not updating
- Check that trading bot backend is running
- Verify 5M candles are being updated in database
- Check browser console for API errors

### Emergency stop fails
- Check database connection
- Verify user has write permissions
- Review server logs for detailed error messages

## License

MIT

## Support

For issues and questions, please refer to the main project documentation.
