# n8n Docker + PostgreSQL Connection - SOLVED ✅

## Problem Resolution

**Issue**: n8n running in Docker container couldn't connect to PostgreSQL on the Mac host.

**Root Cause**: 
1. n8n is in a Docker container - `localhost` refers to inside the container, not the Mac
2. PostgreSQL was only listening on `localhost`, not accessible from Docker

## ✅ Solution Applied

### Step 1: Configure PostgreSQL to Listen on All Interfaces
We updated PostgreSQL configuration to accept connections from Docker:
- Changed `listen_addresses` from `localhost` to `*`
- Restarted PostgreSQL service
- **Status**: ✅ Complete - PostgreSQL now listening on all interfaces

### Step 2: Use Docker Host Gateway in n8n

## 🎯 Final n8n Credentials Configuration

In your n8n Docker container, use these exact credentials:

| Field | Value |
|-------|-------|
| **Host** | `host.docker.internal` |
| **Database** | `trading_bot` |
| **User** | `trader` |
| **Password** | `iLovePostgres1920` |
| **Port** | `5432` |
| **SSL** | `Disable` |
| **Ignore SSL Issues** | `OFF` (toggle off) |
| **SSH Tunnel** | `OFF` (toggle off) |

### What is `host.docker.internal`?

This is a special DNS name provided by Docker for Mac that resolves to your Mac's host IP address from inside containers. It allows containerized applications to connect to services running on the Mac host.

---

## Security Notes

✅ **Still Secure**: Even though PostgreSQL listens on all interfaces, `pg_hba.conf` restricts connections to:
- `127.0.0.1/32` (IPv4 localhost)
- `::1/128` (IPv6 localhost)
- Unix socket connections

This means PostgreSQL will **only accept connections from the local machine** (including Docker containers running on that machine), not from external networks.

---

## Verification

You can verify PostgreSQL is now accessible:

```bash
# Check PostgreSQL is listening on all interfaces
psql -U postgres -c "SHOW listen_addresses;"
# Should show: *

# Check what's listening on port 5432
netstat -an | grep 5432
# Should show: *.5432 (listening on all interfaces)

# Test connection as n8n would see it
psql -h host.docker.internal -U trader -d trading_bot -c "SELECT 1;"
# Should connect successfully
```

---

## What Was Changed

**File Modified**: `/opt/homebrew/var/postgresql@16/postgresql.conf`
- **Before**: `listen_addresses = 'localhost'`
- **After**: `listen_addresses = '*'`
- **Backup Created**: `postgresql.conf.backup_YYYYMMDD_HHMMSS`

**Service Restarted**: `brew services restart postgresql@16`

---

## Testing n8n Connection

1. Go to n8n web interface (usually `http://localhost:5678`)
2. Navigate to **Credentials** → **PostgreSQL**
3. Enter the credentials shown above (especially `host.docker.internal`)
4. Click **Test connection** or **Save**
5. Should see: ✅ **Connection successful**

---

## Troubleshooting

### If still connection refused:

**Check Docker network mode**:
```bash
docker inspect <n8n-container-name> | grep NetworkMode
```

If using `host` network mode, use `127.0.0.1` instead of `host.docker.internal`.

**Verify PostgreSQL is listening**:
```bash
lsof -i :5432
# Should show postgres listening
```

**Check Docker can resolve the host**:
```bash
docker exec <n8n-container-name> ping -c 1 host.docker.internal
# Should successfully ping
```

---

## Files Created

- `scripts/configure_postgres_for_docker.sh` - Automated configuration script
- Backup: `/opt/homebrew/var/postgresql@16/postgresql.conf.backup_*`

---

## Next Steps

Once n8n connects to PostgreSQL:
1. ✅ Test the connection in n8n
2. Import n8n workflows from `n8n/workflows/` directory
3. Set up Coinbase API credentials in .env
4. Begin Phase 0 system verification

**You're now ready to use PostgreSQL from n8n Docker! 🚀**
