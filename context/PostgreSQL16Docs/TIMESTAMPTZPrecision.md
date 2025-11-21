# PostgreSQL Date/Time Types Documentation

## Overview

PostgreSQL supports a complete set of SQL date and time types with flexible input/output handling. All dates follow the Gregorian calendar, even for historical dates prior to calendar adoption.

## Data Types Reference

| Type | Storage | Description | Range | Resolution |
|------|---------|-------------|-------|------------|
| `timestamp [ (p) ] without time zone` | 8 bytes | Date and time without timezone | 4713 BC to 294276 AD | 1 microsecond |
| `timestamp [ (p) ] with time zone` | 8 bytes | Date and time with timezone | 4713 BC to 294276 AD | 1 microsecond |
| `date` | 4 bytes | Date only | 4713 BC to 5874897 AD | 1 day |
| `time [ (p) ] without time zone` | 8 bytes | Time of day | 00:00:00 to 24:00:00 | 1 microsecond |
| `time [ (p) ] with time zone` | 12 bytes | Time with timezone | 00:00:00+1559 to 24:00:00-1559 | 1 microsecond |
| `interval [ fields ] [ (p) ]` | 16 bytes | Time duration | ±178000000 years | 1 microsecond |

## TIMESTAMP WITH TIME ZONE (TIMESTAMPTZ)

### Key Characteristics

- **Abbreviation**: `TIMESTAMPTZ` is recognized as shorthand for the full type name
- **Storage**: Values are stored internally as UTC regardless of input timezone
- **Display**: Output always converts from UTC to the current session timezone
- **Precision parameter**: Optional `p` (0-6) specifies fractional second digits

### Input Format

Valid inputs combine a date, time, optional timezone, and optional `AD`/`BC`:

```sql
1999-01-08 04:05:06
1999-01-08 04:05:06 -8:00
January 8 04:05:06 1999 PST
TIMESTAMP WITH TIME ZONE '2004-10-19 10:23:54+02'
```

### Timezone Handling

According to the documentation, "an input string that includes an explicit time zone will be converted to UTC using the appropriate offset for that time zone. If no time zone is stated in the input string, then it is assumed to be in the time zone indicated by the system's TimeZone parameter, and is converted to UTC using the offset for the timezone zone."

When displaying: the system converts stored UTC values to local time in the session's configured timezone using `AT TIME ZONE` for alternate zones.

## Precision Control

For `time`, `timestamp`, and `interval` types:
- **Range**: 0 to 6 fractional digits
- **Default**: No explicit upper bound unless specified
- **Application**: Controls seconds field precision only

Example with precision:
```sql
timestamp(3) -- three decimal places
```

## Interval Type

### Storage Structure

Intervals are stored as three separate integer fields:
- **Months** (accounts for variable month lengths)
- **Days** (separate from months due to DST variations)
- **Microseconds** (time component)

### Input Formats

**Verbose syntax**:
```sql
'1 year 2 months 3 days 4 hours 5 minutes 6 seconds'
'200-10'  -- 200 years 10 months
'1 12:59:10'  -- 1 day 12 hours 59 minutes 10 seconds
```

**ISO 8601 format with designators**:
```sql
P1Y2M3DT4H5M6S
P0001-02-03T04:05:06
```

### Field Restrictions

The `fields` parameter can limit stored components:
```
YEAR | MONTH | DAY | HOUR | MINUTE | SECOND
YEAR TO MONTH | DAY TO HOUR | DAY TO MINUTE | DAY TO SECOND
HOUR TO MINUTE | HOUR TO SECOND | MINUTE TO SECOND
```

When both `fields` and precision are specified, `SECOND` must be included.

## Time Zone Specifications

PostgreSQL accepts three timezone formats:

1. **Full names** (e.g., `America/New_York`): Implies daylight-saving rules
2. **Abbreviations** (e.g., `PST`): Fixed UTC offset only; cannot set as configuration parameter
3. **POSIX-style** specifications

### Critical Distinction

"Abbreviations represent a specific offset from UTC, whereas many of the full names imply a local daylight-savings time rule, and so have two possible UTC offsets." For example, `2014-06-04 12:00 EDT` differs from `2014-06-04 12:00 EST` despite both referencing Eastern time.

## Date/Time Output Styles

| Style | Example | Notes |
|-------|---------|-------|
| `ISO` | `1997-12-17 07:37:16-08` | SQL standard (default) |
| `SQL` | `12/17/1997 07:37:16.00 PST` | Traditional format |
| `Postgres` | `Wed Dec 17 07:37:16 1997 PST` | Original style |
| `German` | `17.12.1997 07:37:16.00 PST` | Regional format |

Configure via `SET datestyle` command, `postgresql.conf`, or `PGDATESTYLE` environment variable.

## Interval Output Styles

| Style | Year-Month | Day-Time | Mixed |
|-------|-----------|----------|-------|
| `sql_standard` | `1-2` | `3 4:05:06` | `-1-2 +3 -4:05:06` |
| `postgres` | `1 year 2 mons` | `3 days 04:05:06` | `-1 year -2 mons +3 days -04:05:06` |
| `postgres_verbose` | `@ 1 year 2 mons` | `@ 3 days 4 hours 5 mins 6 secs` | `@ 1 year 2 mons -3 days 4 hours 5 mins 6 secs ago` |
| `iso_8601` | `P1Y2M` | `P3DT4H5M6S` | `P-1Y-2M3DT-4H-5M-6S` |

## Important Notes

### SQL Standard Compliance

The note clarifies that "writing just timestamp be equivalent to timestamp without time zone" per SQL standard, which PostgreSQL honors.

### Time with Time Zone Caveat

The documentation advises against using `time with time zone` except for legacy compatibility: "We do not recommend using the type time with time zone. PostgreSQL assumes your local time zone for any type containing only date or time."

### Input String Handling

For consistency and safety, the documentation cautions: "the input strings now, today, tomorrow, and yesterday can have surprising behavior when the command is saved to be executed later, for example in prepared statements, views, and function definitions."

Use SQL functions like `CURRENT_DATE` instead for persistent code.

### Fractional Second Handling

The documentation notes that fractional parts of larger units "must be converted into smaller units. Fractional parts of units greater than months are rounded to be an integer number of months, e.g. '1.5 years' becomes '1 year 6 mons'."

## Special Input Values

| Value | Valid Types | Meaning |
|-------|------------|---------|
| `epoch` | date, timestamp | 1970-01-01 00:00:00+00 (Unix zero) |
| `infinity` | date, timestamp | Later than all timestamps |
| `-infinity` | date, timestamp | Earlier than all timestamps |
| `now` | date, time, timestamp | Current transaction start |
| `today` | date, timestamp | Midnight today |
| `tomorrow` | date, timestamp | Midnight tomorrow |
| `yesterday` | date, timestamp | Midnight yesterday |
| `allballs` | time | 00:00:00.00 UTC |
