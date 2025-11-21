# PostgreSQL 16: Numeric Data Types Documentation

## Overview

PostgreSQL provides several numeric data types for storing whole numbers, decimals, and floating-point values. These include "two-, four-, and eight-byte integers, four- and eight-byte floating-point numbers, and selectable-precision decimals."

## Integer Types

### Available Integer Types

| Type | Storage | Range |
|------|---------|-------|
| `smallint` | 2 bytes | -32,768 to +32,767 |
| `integer` | 4 bytes | -2,147,483,648 to +2,147,483,647 |
| `bigint` | 8 bytes | -9,223,372,036,854,775,808 to +9,223,372,036,854,775,807 |

The `integer` type is recommended as it "offers the best balance between range, storage size, and performance." The `smallint` type suits space-constrained scenarios, while `bigint` handles situations where `integer` range proves insufficient.

## Arbitrary Precision Numbers (NUMERIC/DECIMAL)

### Key Concepts

**Precision** represents "the total count of significant digits in the whole number, that is, the number of digits to both sides of the decimal point." **Scale** indicates "the count of decimal digits in the fractional part, to the right of the decimal point."

For example, 23.5141 has precision 6 and scale 4.

### Declaration Syntax

```sql
NUMERIC(precision, scale)
NUMERIC(precision)           -- scale defaults to 0
NUMERIC                      -- unconstrained numeric
```

### Storage and Constraints

- Maximum explicitly-specifiable precision: 1000
- Unconstrained columns support up to 131,072 digits before decimal and 16,383 after
- Actual storage: "two bytes for each group of four decimal digits, plus three to eight bytes overhead"

### Rounding and Range Examples

A column declared as `NUMERIC(3, 1)` "will round values to 1 decimal place and can store values between -99.9 and 99.9, inclusive."

PostgreSQL 15+ supports negative scales for rounding left of the decimal:

```sql
NUMERIC(2, -3)  -- rounds to nearest thousand, stores -99000 to 99000
NUMERIC(3, 5)   -- stores only fractional values between -0.00999 and 0.00999
```

### Special Values

The `numeric` type supports `Infinity`, `-Infinity`, and `NaN`. These "must put quotes around them" when used as SQL constants.

Rounding behavior differs from floating-point types: "the `numeric` type rounds ties away from zero, while (on most machines) the `real` and `double precision` types round ties to the nearest even number."

## Floating-Point Types

### Available Types

| Type | Storage | Range | Precision |
|------|---------|-------|-----------|
| `real` | 4 bytes | ~1E-37 to 1E+37 | ≥6 decimal digits |
| `double precision` | 8 bytes | ~1E-307 to 1E+308 | ≥15 decimal digits |

### Characteristics

These types are "inexact, variable-precision numeric types" implementing IEEE 754 standards. They're suitable for scientific calculations but unsuitable for financial data where exactness matters.

For financial applications, "use the `numeric` type instead."

### Output Format

By default, floating-point values output in "shortest precise decimal representation" using at most 17 digits for `float8` and 9 for `float4`. The `extra_float_digits` parameter adjusts precision for backward compatibility.

## Serial Types

### Purpose

`smallserial`, `serial`, and `bigserial` are "not true types, but merely a notational convenience for creating unique identifier columns."

### Implementation

Declaring a `SERIAL` column:

```sql
CREATE TABLE tablename (colname SERIAL);
```

Internally creates a sequence and applies it to an integer column with a `NOT NULL` constraint.

### Available Variants

| Type | Equivalent Integer | Range |
|------|-------------------|-------|
| `smallserial` / `serial2` | `smallint` | 1 to 32,767 |
| `serial` / `serial4` | `integer` | 1 to 2,147,483,647 |
| `bigserial` / `serial8` | `bigint` | 1 to 9,223,372,036,854,775,807 |

### Important Note

"There may be 'holes' or gaps in the sequence of values which appears in the column, even if no rows are ever deleted" due to rolled-back transactions or sequence allocation.
