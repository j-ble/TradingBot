# 🐋 Whale Wallet Tracker

**Console-only scanner that monitors successful whale wallets and alerts you when they buy new tokens BEFORE the pump.**

## Strategy: Copy Smart Money

Instead of trying to predict pumps yourself, this bot watches wallets that have consistently made 10x-50x returns and copies their moves in real-time.

---

## Features

✅ **Real-Time Whale Monitoring** - Checks whale wallets every 60 seconds
✅ **Smart Token Detection** - Identifies NEW token purchases only
✅ **Safety Validation** - Filters by liquidity, age, volume, and risk score
✅ **Beautiful Console Output** - Color-coded alerts with full token metrics
✅ **Alert Deduplication** - Won't spam the same token multiple times
✅ **Multi-Chain Ready** - Built for Solana (ETH/BSC support coming soon)
✅ **Zero Trading Risk** - Scanner only, no auto-trading

---

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up API Keys

Copy the example environment file:

```bash
cp .env.example .env
```

Then edit `.env` and add your Solscan API key:

```env
SOLSCAN_API_KEY=your_api_key_here
```

**Get a FREE Solscan API key:**
1. Go to https://pro-api.solscan.io/
2. Sign up for free account
3. Copy your API key
4. Free tier: 5 requests/second (plenty for this scanner)

> **Note:** The scanner will work without an API key (using public API), but you'll hit rate limits faster.

### 3. Add Whale Wallets

Edit `wallets.json` and add proven whale wallet addresses:

```json
{
  "solana": [
    {
      "address": "ACTUAL_WALLET_ADDRESS_HERE",
      "name": "Solana Sniper Pro",
      "description": "Wallet that 50x on BONK and WIF",
      "enabled": true
    }
  ]
}
```

**How to find whale wallets:**

#### Method 1: DexScreener Top Traders
1. Go to [DexScreener](https://dexscreener.com)
2. Find a token that recently did 10x-50x (e.g., search "solana gainers")
3. Click on the token
4. Scroll down to "Top Traders"
5. Look for wallets that bought early (within first few hours) and sold near peak
6. Copy their wallet address

#### Method 2: Solscan Token Holders
1. Find a successful token on Solscan
2. Go to the "Holders" tab
3. Look for wallets that bought early and still hold (or sold at profit)
4. Check their transaction history for other successful trades
5. If they have 3+ winning trades with 5x+ returns, add them

#### Method 3: Twitter/X Research
- Many successful traders share their wallet addresses on Twitter
- Search for: "my wallet" + "solana" + "10x"
- Verify their claims by checking wallet history on Solscan

### 4. Configure Settings (Optional)

Edit `config.json` to adjust:

- **Scan interval**: How often to check wallets (default: 60s)
- **Safety thresholds**: Min liquidity, token age, risk score
- **Alert filters**: New tokens only vs. position increases
- **Display options**: Show full addresses, colors, etc.

### 5. Run the Scanner

```bash
npm start
```

Or with auto-restart on file changes:

```bash
npm run dev
```

---

## Understanding the Output

### Whale Alert Example

```
🐋 WHALE ALERT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔔 Solana Sniper Pro (7xKXt...abc123)

🆕 NEW TOKEN PURCHASE
   Transaction: 3m ago

📊 SuperDog (SDOG)
   Token: A8F3m...xyz789
   Pair: Raydium - JUPyi...def456

💰 Token Metrics:
   Price: $0.00023400
   Market Cap: $1.2M
   Liquidity: $156k ✅
   24h Volume: $89k
   24h Change: +45.2%
   Token Age: 3.2 hours
   Buy/Sell Ratio: 65.0% / 35.0%

⚠️ Risk Score: 7/10 (Medium Risk)

🔗 Links:
   DexScreener: https://dexscreener.com/solana/...
   Wallet: https://solscan.io/account/7xKXt...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### What This Means

- **Whale**: A proven successful trader just bought this token
- **3m ago**: The purchase happened very recently (you're early!)
- **Token Age: 3.2 hours**: Token is brand new (high risk/reward)
- **Liquidity: $156k**: Healthy liquidity (reduces rug pull risk)
- **Buy/Sell: 65/35**: More buyers than sellers (bullish)
- **Risk Score: 7/10**: Medium-high risk, but passes safety filters

### What To Do

1. **Click DexScreener link** to view live chart
2. **Verify on Solscan** - Check contract, holders, liquidity lock
3. **Check whale's history** - Is this whale still reliable?
4. **Make your decision** - Buy manually if you agree with the signal
5. **Set stop loss** - Always protect your capital (recommended: -20%)

---

## Risk Score Explained

The scanner calculates a 0-10 risk score based on:

| Factor | Impact | Deduction |
|--------|--------|-----------|
| **Liquidity < $50k** | High rug risk | -4 points |
| **Liquidity < $100k** | Medium rug risk | -2 points |
| **Token age < 30 min** | Very new, untested | -3 points |
| **Token age < 2 hours** | New, higher risk | -2 points |
| **Volume < $10k** | Low interest | -2 points |
| **Buy/Sell ratio extreme** | Potential manipulation | -1 point |

**Risk Levels:**
- **8-10**: Low risk (safer entry, but you might be late)
- **6-7**: Medium risk (balanced risk/reward)
- **4-5**: High risk (early entry, high potential, high danger)
- **0-3**: Very high risk (blocked by default, adjust config to see)

---

## Safety Features

### 1. **Minimum Liquidity Filter**
Default: $50,000 USD

Tokens with low liquidity can't be sold easily and are prime rug pull targets. The scanner ignores anything below your threshold.

### 2. **Token Age Window**
Default: 30 minutes - 48 hours

- **Too young** (< 30 min): Instant rug pulls are common
- **Too old** (> 48 hours): You missed the early pump

### 3. **Alert Cooldown**
Default: 24 hours

Once alerted about a token, won't spam you again for 24 hours unless whale makes a significant new purchase.

### 4. **Risk Score Threshold**
Default: Minimum 4/10

Only shows tokens that meet basic safety requirements. Adjust in `config.json` if you want to see riskier opportunities.

---

## Configuration Reference

### `config.json`

```json
{
  "scanner": {
    "interval_seconds": 60,              // Check wallets every 60s
    "transaction_lookback_count": 10,    // Check last 10 transactions per scan
    "alert_cooldown_minutes": 60,        // Alert cooldown per token
    "enabled_chains": ["solana"]         // Chains to monitor
  },
  "safety_thresholds": {
    "min_liquidity_usd": 50000,          // Min $50k liquidity
    "min_token_age_minutes": 30,         // Ignore tokens < 30 min old
    "max_token_age_hours": 48,           // Ignore tokens > 48 hours old
    "min_whale_buy_usd": 500,            // Only alert if whale spent $500+
    "risk_score_min": 4                  // Min risk score 4/10
  },
  "alerts": {
    "show_new_tokens_only": true,        // Only new purchases (recommended)
    "show_position_increases": false,    // Alert when whale adds to position
    "show_whale_sells": false            // Alert when whale sells (coming soon)
  }
}
```

### `wallets.json`

```json
{
  "solana": [
    {
      "address": "WALLET_ADDRESS",       // Solana wallet address
      "name": "Whale Name",              // Friendly name for console
      "description": "Notes",            // Optional notes
      "enabled": true                    // Set to false to pause tracking
    }
  ]
}
```

---

## FAQ

### Q: How do I know if a whale is still good?

**A:** Check their recent trades on Solscan:
1. Click the whale wallet link in an alert
2. Look at their recent transactions
3. Did they profit on their last 3-5 token buys?
4. If yes, keep tracking. If no, remove them from `wallets.json`

### Q: Should I buy every token the scanner finds?

**NO!** The scanner finds opportunities, but you still need to:
- Verify the token contract on Solscan (is it verified? renounced?)
- Check holder distribution (top 10 holders shouldn't have >50%)
- Look at the chart (is it a healthy pattern or parabolic mania?)
- Trust your gut (if something feels off, skip it)

### Q: How much should I risk per trade?

**Recommended: 2-5% of portfolio maximum**

These are high-risk plays. Even with whale signals, 60-70% may fail. You need the winners to be big enough (5x-50x) to offset the losers.

### Q: What if I get no alerts?

Either:
1. **No whale wallets enabled** - Add addresses to `wallets.json` and set `enabled: true`
2. **Whales aren't trading** - They may be inactive during this period
3. **Filters too strict** - Lower `min_liquidity_usd` or `risk_score_min` in config
4. **Scan interval too long** - Reduce `interval_seconds` to 30-45s

### Q: Can I track multiple chains?

Currently **Solana only**. Ethereum/BSC/Base support coming soon.

To prepare, you can add wallets to `wallets.json` under `ethereum`, `bsc`, or `base` sections.

### Q: Is this bot profitable?

**This is a SCANNER, not a trading bot.** It finds opportunities - you decide whether to trade.

Expected outcomes when copying whales:
- 60-70% of signals: Small loss or breakeven
- 20-30% of signals: 2x-5x gain
- 5-10% of signals: 10x-50x+ gain (these make up for all losses)

**Win rate is NOT the goal.** You need big winners to offset frequent small losses.

---

## Troubleshooting

### Error: "Rate limited by Solscan API"

**Solution:**
- Get a Solscan API key (free at https://pro-api.solscan.io/)
- Add it to `.env` file
- Free tier gives 5 req/sec (plenty for this scanner)

### Error: "No enabled whale wallets found"

**Solution:**
- Edit `wallets.json`
- Add at least one wallet with `"enabled": true`
- See "How to find whale wallets" section above

### Scanner runs but shows no alerts

**Possible causes:**
1. Whales aren't actively trading right now
2. All recent trades filtered out by safety thresholds
3. Check console for "filtered out" messages to see what's being skipped

**Solution:**
- Lower safety thresholds in `config.json`
- Add more whale wallets to `wallets.json`
- Increase `transaction_lookback_count` to check more history

### DexScreener rate limit

**Solution:**
- Scanner automatically waits 20s when rate limited
- If frequent, increase `scanner.interval_seconds` to 90-120

---

## Next Steps

### Phase 1: Validate the Strategy (You are here)
- [x] Scanner finds whale purchases
- [ ] Track results manually for 1-2 weeks
- [ ] Identify which whales are most reliable
- [ ] Refine safety filters based on results

### Phase 2: Add Auto-Trading (Optional)
- [ ] Integrate Jupiter SDK for Solana swaps
- [ ] Add position sizing (2-5% per trade)
- [ ] Implement stop loss (-20%)
- [ ] Tiered take profits (50% @ 2x, 25% @ 3x, trailing)

### Phase 3: Expand (Future)
- [ ] Add Ethereum/BSC/Base support
- [ ] Telegram notifications
- [ ] Web dashboard
- [ ] Advanced whale scoring (win rate tracking)
- [ ] Portfolio P&L tracking

---

## Warning & Disclaimer

⚠️ **HIGH RISK TRADING**

Copying whale wallets is a high-risk strategy:
- Many new tokens are rug pulls or scams
- Even whales lose money on 40-60% of trades
- You can lose 100% of capital on any single trade
- Slippage and MEV can reduce profits significantly

**Only trade with capital you can afford to lose completely.**

**This tool is for educational purposes. Not financial advice.**

---

## Support

Found a bug? Have a question?

- Check `whale-tracker.js` comments for technical details
- Adjust `config.json` for your risk tolerance
- Review `wallets.json` to add/remove whales

---

## License

MIT License - Use at your own risk

---

**Good luck, and may the whales guide you to Valhalla! 🐋🚀**
