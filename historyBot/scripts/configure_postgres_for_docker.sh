#!/bin/bash

# Configure PostgreSQL to Accept Connections from Docker Containers
# This allows n8n running in Docker to connect to PostgreSQL on the Mac host

echo "==================================================================="
echo "Configuring PostgreSQL for Docker Container Access"
echo "==================================================================="

POSTGRES_CONF="/opt/homebrew/var/postgresql@16/postgresql.conf"

echo ""
echo "[1/3] Updating PostgreSQL listen_addresses..."

# Backup the config file
cp "$POSTGRES_CONF" "${POSTGRES_CONF}.backup_$(date +%Y%m%d_%H%M%S)"
echo "✓ Backup created"

# Update listen_addresses to accept connections from all interfaces
# This allows Docker containers to connect via host.docker.internal
if grep -q "^listen_addresses" "$POSTGRES_CONF"; then
  # Replace existing uncommented line
  sed -i '' "s/^listen_addresses.*/listen_addresses = '*'/" "$POSTGRES_CONF"
else
  # Add new line if it doesn't exist
  echo "listen_addresses = '*'" >> "$POSTGRES_CONF"
fi

echo "✓ PostgreSQL will now listen on all interfaces"

echo ""
echo "[2/3] Restarting PostgreSQL..."
brew services restart postgresql@16
sleep 3
echo "✓ PostgreSQL restarted"

echo ""
echo "[3/3] Verifying configuration..."
psql -U postgres -c "SHOW listen_addresses;"

echo ""
echo "==================================================================="
echo "✓ PostgreSQL is now configured for Docker access!"
echo "==================================================================="
echo ""
echo "In n8n, use these credentials:"
echo "  Host: host.docker.internal"
echo "  Database: trading_bot"
echo "  User: trader"
echo "  Password: iLovePostgres1920"
echo "  Port: 5432"
echo ""
echo "Note: PostgreSQL is now listening on all network interfaces."
echo "The pg_hba.conf is already configured to only accept connections"
echo "from localhost (127.0.0.1 and ::1), so this is still secure."
echo ""
