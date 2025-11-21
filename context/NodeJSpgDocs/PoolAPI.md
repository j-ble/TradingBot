# pg.Pool API Documentation

## Overview

The Pool class manages a collection of database clients, creating them lazily as needed. All configuration fields are optional, and pool config is passed to each client instance.

## Constructor

```javascript
new Pool(config: Config)
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `connectionTimeoutMillis` | number | 0 | Milliseconds to wait before timing out when connecting a new client |
| `idleTimeoutMillis` | number | 10000 | Milliseconds before disconnecting idle clients |
| `max` | number | 10 | Maximum number of clients in the pool |
| `min` | number | 0 | Minimum clients to retain without eviction |
| `allowExitOnIdle` | boolean | false | Allows Node event loop to exit when all clients are idle |
| `maxLifetimeSeconds` | number | 0 | Maximum overall connection lifetime before eviction |

### Example

```javascript
import { Pool } from 'pg'

const pool = new Pool({
  host: 'localhost',
  user: 'database-user',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  maxLifetimeSeconds: 60
})
```

## Methods

### pool.query()

```javascript
pool.query(text: string, values?: any[]) => Promise<pg.Result>
```

Executes a single query on an available idle client and returns the result without manual client management.

```javascript
const result = await pool.query('SELECT $1::text as name', ['brianc'])
console.log(result.rows[0].name) // brianc
```

**Warning:** Do **not** use `pool.query` if you are using a transaction. Transactions require a single client connection.

### pool.connect()

```javascript
pool.connect() => Promise<pg.Client>
```

Acquires a client from the pool. Returns an idle client if available, creates a new one if the pool isn't full, or queues the request if all clients are checked out.

```javascript
const client = await pool.connect()
await client.query('SELECT NOW()')
client.release()
```

### client.release()

```javascript
client.release(destroy?: boolean) => void
```

Returns a client to the pool. Pass `true` to destroy the client instead of returning it.

```javascript
// Return client to pool
client.release()

// Destroy client instead
await client.release(true)
```

### pool.end()

Drains the pool of all active clients, disconnects them, and shuts down internal timers.

```javascript
await pool.end()
```

## Properties

| Property | Type | Description |
|----------|------|-------------|
| `totalCount` | number | Total clients in the pool |
| `idleCount` | number | Clients not checked out and idle |
| `waitingCount` | number | Queued requests waiting on a client |

## Events

The Pool extends `EventEmitter` and emits the following events:

### connect
```javascript
pool.on('connect', (client: Client) => void)
```
Fires when establishing a new connection to PostgreSQL.

### acquire
```javascript
pool.on('acquire', (client: Client) => void)
```
Fires when a client is checked out from the pool.

### error
```javascript
pool.on('error', (err: Error, client: Client) => void)
```
Fires when an idle client encounters an error. The client will be automatically terminated and removed from the pool.

### release
```javascript
pool.on('release', (err: Error, client: Client) => void)
```
Fires when a client is released back into the pool.

### remove
```javascript
pool.on('remove', (client: Client) => void)
```
Fires when a client is closed and removed from the pool.
