# Node-Postgres Queries Documentation

## Overview

The node-postgres library supports multiple query methods. Both `client.query()` and `pool.query()` implement the same API, with the pool method delegating internally to the client method.

## Text Only Queries

For queries without parameters, simply pass the query string:

```javascript
await client.query('SELECT NOW() as now')
```

## Parameterized Queries

To prevent SQL injection vulnerabilities, use parameterized queries by passing query text and parameters separately. The PostgreSQL server handles safe parameter substitution:

```javascript
const text = 'INSERT INTO users(name, email) VALUES($1, $2) RETURNING *'
const values = ['brianc', 'brian@example.com']

const res = await client.query(text, values)
console.log(res.rows[0])
// { name: 'brianc', email: 'brian@example.com' }
```

**Important Note:** PostgreSQL doesn't support parameters for identifiers (database, schema, table, or column names). Use the `pg-format` package for dynamic identifiers in DDL statements.

### Parameter Type Conversion

Parameters are automatically converted using these rules:

- **null/undefined**: Converted to SQL `null`
- **Date**: Converted to UTC date string
- **Buffer**: Remains unchanged
- **Array**: Converted to PostgreSQL array syntax with recursive conversion
- **Object**: Calls `toPostgres()` method if available, otherwise uses `JSON.stringify()`
- **Other types**: Converted via `toString()`

Objects can implement custom conversion:

```javascript
toPostgres(prepareValue: (value) => any): any
```

## Query Config Object

Instead of separate text and values arguments, pass a configuration object:

```javascript
const query = {
  text: 'INSERT INTO users(name, email) VALUES($1, $2)',
  values: ['brianc', 'brian@example.com'],
}

const res = await client.query(query)
console.log(res.rows[0])
```

## Prepared Statements

Named queries cache execution plans per connection, improving performance for complex queries:

```javascript
const query = {
  name: 'fetch-user',
  text: 'SELECT * FROM user WHERE id = $1',
  values: [1],
}

const res = await client.query(query)
console.log(res.rows[0])
```

The first execution sends a parse request; subsequent executions reuse the plan. Best used for complex queries with multiple joins or aggregate operations, not for routine queries.

## Row Mode

By default, rows are returned as objects with column names as keys. Use `rowMode: 'array'` to return rows as value arrays:

```javascript
const query = {
  text: 'SELECT $1::text as first_name, $2::text as last_name',
  values: ['Brian', 'Carlson'],
  rowMode: 'array',
}

const res = await client.query(query)
console.log(res.fields.map(field => field.name)) // ['first_name', 'last_name']
console.log(res.rows[0]) // ['Brian', 'Carlson']
```

## Custom Type Parsing

Pass custom type parsers for query result parsing via the `types` property:

```javascript
const query = {
  text: 'SELECT * from some_table',
  types: {
    getTypeParser: () => val => val,
  },
}
```

The types property must conform to the Types API for custom parsing behavior.
