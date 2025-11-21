# Connection Pooling in node-postgres

## Overview

Connection pooling is the recommended approach for web applications and frequent query scenarios. The node-postgres library includes built-in pooling via the pg-pool module.

## Why Use Connection Pooling?

### Performance Concerns

Establishing a new PostgreSQL connection involves a handshake process taking 20-30 milliseconds. During this phase, password negotiation, SSL setup, and configuration sharing occur. Repeating this overhead for every query significantly impacts application speed.

### Server Resource Limitations

PostgreSQL servers handle a finite number of concurrent connections based on available memory. Creating unlimited client connections risks server crashes. The documentation notes a cautionary example: "I have crashed a large production PostgreSQL server instance in RDS by opening new clients and never disconnecting them."

### Query Processing Constraints

Single-client connections process queries sequentially in FIFO order. Multi-tenant applications using one client would serialize all simultaneous requests, eliminating parallelism.

## Implementation Examples

### Checkout, Use, and Return Pattern

```javascript
import pg from 'pg'
const { Pool } = pg

const pool = new Pool()

pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err)
  process.exit(-1)
})

const client = await pool.connect()
const res = await client.query('SELECT * FROM users WHERE id = $1', [1])
console.log(res.rows[0])

client.release()
```

**Critical Warning:** Always release checked-out clients, even after errors. Failing to do so causes client leaks, eventually exhausting the pool.

### Single Query Method

For standalone queries without transactions, use the pool's convenience method:

```javascript
import pg from 'pg'
const { Pool } = pg

const pool = new Pool()

const res = await pool.query('SELECT * FROM users WHERE id = $1', [1])
console.log('user:', res.rows[0])
```

This approach eliminates client leak risks.

### Graceful Shutdown

```javascript
import pg from 'pg'
const { Pool } = pg

const pool = new Pool()

await pool.end()
```

The `pool.end()` method waits for all active clients to return before closing connections and clearing timers. Subsequent connection attempts after shutdown will trigger errors.
