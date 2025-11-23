# Basic Usage - Zod Documentation

## Overview

This guide covers the fundamentals of working with Zod schemas, including creation, validation, error handling, and type inference.

## Defining a Schema

Before validation, you must define a schema. Here's a simple object schema example:

**Zod:**
```typescript
import * as z from "zod";

const Player = z.object({
  username: z.string(),
  xp: z.number()
});
```

**Zod Mini:**
```typescript
import * as z from "zod/mini"

const Player = z.object({
  username: z.string(),
  xp: z.number()
});
```

## Parsing Data

Use `.parse()` to validate input. Upon success, Zod returns a strongly-typed deep clone of the input.

```typescript
Player.parse({ username: "billie", xp: 100 });
// => returns { username: "billie", xp: 100 }
```

**Note:** For schemas with asynchronous APIs like async refinements or transforms, use `.parseAsync()` instead.

```typescript
await Player.parseAsync({ username: "billie", xp: 100 });
```

## Handling Errors

When validation fails, `.parse()` throws a `ZodError` containing detailed validation issues.

**Zod approach:**
```typescript
try {
  Player.parse({ username: 42, xp: "100" });
} catch(error){
  if(error instanceof z.ZodError){
    error.issues; // Array of validation problems
  }
}
```

**Zod Mini approach:**
```typescript
try {
  Player.parse({ username: 42, xp: "100" });
} catch(error){
  if(error instanceof z.core.$ZodError){
    error.issues;
  }
}
```

### Safe Parsing

Use `.safeParse()` to avoid try-catch blocks. This returns a discriminated union with either success or error data.

```typescript
const result = Player.safeParse({ username: 42, xp: "100" });
if (!result.success) {
  result.error;   // ZodError instance
} else {
  result.data;    // { username: string; xp: number }
}
```

For async operations, use `.safeParseAsync()`.

## Inferring Types

Extract TypeScript types from schemas using the `z.infer<>` utility.

```typescript
const Player = z.object({
  username: z.string(),
  xp: z.number()
});

type Player = z.infer<typeof Player>;

const player: Player = { username: "billie", xp: 100 };
```

### Input and Output Types

When schemas transform data, input and output types may differ. Extract them independently:

```typescript
const mySchema = z.string().transform((val) => val.length);

type MySchemaIn = z.input<typeof mySchema>;
// => string

type MySchemaOut = z.output<typeof mySchema>;
// => number
```

---

For comprehensive API documentation, consult the "Defining schemas" section.
