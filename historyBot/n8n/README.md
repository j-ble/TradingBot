# n8n Trading Bot Setup

## Step 1: Import Workflow

1. Open n8n (access via Cloudflare tunnel or localhost:5678)
2. Click **"Add workflow"** → **"Import from File"**
3. Select `/Users/ble/TradingBot/historyBot/n8n/workflows/4h_bias_scanner.json`

## Step 2: Set Up Credentials

### PostgreSQL Credential

1. In n8n, go to **Settings** → **Credentials** → **Add Credential**
2. Select **"Postgres"**
3. Enter details:
   - **Name**: `PostgreSQL - Trading Bot`
   - **Host**: `localhost`
   - **Port**: `5432`
   - **Database**: `trading_bot`
   - **User**: `trading_user`
   - **Password**: (from your .env `DB_PASSWORD`)
4. Click **"Save"**

### Telegram Credential

1. Go to **Settings** → **Credentials** → **Add Credential**
2. Select **"Telegram API"**
3. Enter:
   - **Name**: `Telegram Bot`
   - **Access Token**: (from your .env `TELEGRAM_BOT_TOKEN`)
4. Click **"Save"**

## Step 3: Set Environment Variables in n8n

n8n needs access to your .env variables:

### Option A: Load from .env file

```bash
# Start n8n with .env loaded
cd /Users/ble/TradingBot/historyBot
export $(cat .env | xargs)
n8n start
```

### Option B: Set in n8n settings

1. Go to n8n **Settings** → **Environments**
2. Add variables:
   - `COINBASE_API_KEY`
   - `COINBASE_API_SECRET`
   - `TELEGRAM_CHAT_ID`

## Step 4: Activate Workflow

1. Open the "4H Bias Scanner" workflow
2. Click **"Activate"** toggle (top right)
3. The workflow now runs every 4 hours automatically

## Step 5: Test Manually

Before waiting 4 hours:

1. Click **"Execute Workflow"** button
2. Check the output in each node
3. Verify:
   - Candles fetched from Coinbase
   - RSI calculated correctly
   - Swings detected
   - Bias logic runs

If no bias detected (expected), you should see "No signal" logged.

## Workflow Schedule

```
Runs at: 00:00, 04:00, 08:00, 12:00, 16:00, 20:00 UTC
Aligned with 4H candle closes
```

## What This Workflow Does

1. **Fetches 4H candles** from Coinbase (last 50 candles)
2. **Calculates RSI(14)** on 4H timeframe
3. **Detects swing highs/lows** using 3-candle pattern
4. **Checks for liquidity sweeps** per your 4H_BIAS_CONTRACT.md:
   - BULLISH: LOW swept + RSI < 40 + confirmation
   - BEARISH: HIGH swept + RSI > 80 + confirmation
5. **Stores bias** in PostgreSQL `liquidity_sweeps` table
6. **Sends Telegram alert** when bias detected

## Troubleshooting

### "Cannot connect to database"
- Check PostgreSQL is running: `brew services list | grep postgres`
- Verify credentials in n8n match your .env

### "Coinbase API error"
- Check API keys are valid
- Verify environment variables are loaded

### "Telegram not sending"
- Check bot token is correct
- Verify chat_id by messaging your bot first

## Next Workflows to Build

After 4H Scanner is working:
1. **5M Monitor** - Watches for reclaim level (triggered when bias active)
2. **Trade Executor** - Places orders when all conditions met
3. **Position Monitor** - Manages open trades (breakeven, exits)
4. **Health Check** - Monitors system status every 15 min

## Monitoring

Check workflow executions:
- n8n → **Executions** tab
- See all runs, success/failure
- Debug individual nodes

Check database:
```sql
-- View recent bias detections
SELECT * FROM liquidity_sweeps
WHERE active = true
ORDER BY timestamp DESC
LIMIT 5;
```
