#!/bin/bash

# Fix PostgreSQL Permissions for trading_bot database
# This script grants the 'trader' user proper ownership of all tables

echo "==================================================================="
echo "Fixing PostgreSQL Permissions for 'trader' user"
echo "==================================================================="

# Step 1: Grant schema permissions
echo ""
echo "[1/3] Granting schema permissions..."
psql -U postgres -d trading_bot -c "GRANT ALL ON SCHEMA public TO trader;"
psql -U postgres -d trading_bot -c "GRANT ALL ON ALL TABLES IN SCHEMA public TO trader;"
psql -U postgres -d trading_bot -c "GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO trader;"

# Step 2: Change ownership of all tables to trader
echo ""
echo "[2/3] Transferring table ownership to 'trader'..."
psql -U postgres -d trading_bot -c "ALTER TABLE IF EXISTS candles_4h OWNER TO trader;"
psql -U postgres -d trading_bot -c "ALTER TABLE IF EXISTS candles_5m OWNER TO trader;"
psql -U postgres -d trading_bot -c "ALTER TABLE IF EXISTS swing_levels OWNER TO trader;"
psql -U postgres -d trading_bot -c "ALTER TABLE IF EXISTS liquidity_sweeps OWNER TO trader;"
psql -U postgres -d trading_bot -c "ALTER TABLE IF EXISTS confluence_state OWNER TO trader;"
psql -U postgres -d trading_bot -c "ALTER TABLE IF EXISTS trades OWNER TO trader;"
psql -U postgres -d trading_bot -c "ALTER TABLE IF EXISTS system_config OWNER TO trader;"
psql -U postgres -d trading_bot -c "ALTER TABLE IF EXISTS position_sizes OWNER TO trader;"
psql -U postgres -d trading_bot -c "ALTER TABLE IF EXISTS reclaim_confirmations OWNER TO trader;"
psql -U postgres -d trading_bot -c "ALTER TABLE IF EXISTS system_state OWNER TO trader;"
psql -U postgres -d trading_bot -c "ALTER TABLE IF EXISTS system_logs OWNER TO trader;"

# Step 3: Verify permissions
echo ""
echo "[3/3] Verifying permissions..."
psql -U trader -d trading_bot -c "\dt"

echo ""
echo "==================================================================="
echo "✓ Permissions fixed successfully!"
echo "==================================================================="
echo ""
echo "The 'trader' user now has full access to all tables."
echo "You can now run: psql -U trader -d trading_bot"
echo ""
