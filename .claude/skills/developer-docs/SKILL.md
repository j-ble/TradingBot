---
name: developer-docs
description: Fetch up-to-date library documentation from Context7. Use when learning new APIs (Coinbase, n8n, PostgreSQL drivers) or troubleshooting integration issues.
---

# Developer Documentation Skill

## When to Use This Skill

Trigger this skill when you need to:
- Learn Coinbase Advanced Trade API endpoints
- Reference Next.js 14 features for dashboard
- Understand PostgreSQL driver (pg, node-postgres) usage
- Learn n8n workflow automation
- Research Ollama API integration
- Troubleshoot library-specific issues

## Available Tools

- `resolve-library-id` - Convert package names to Context7-compatible library IDs
- `get-library-docs` - Fetch documentation for specific libraries with optional topic focus

## Workflow

### Step 1: Resolve Library ID
```
Use resolve-library-id with library name:
- Input: "next.js"
- Output: List of matching libraries with IDs

Selection Criteria:
1. Name similarity to query
2. Description relevance
3. Documentation coverage (Code Snippet counts)
4. Trust score (7-10 most authoritative)
```

### Step 2: Fetch Documentation
```
Use get-library-docs with Context7 ID:
- Format: /org/project or /org/project/version
- Examples:
  - /vercel/next.js
  - /vercel/next.js/v14.3.0-canary.87
  - /mongodb/docs

Optional: Specify topic to focus docs
- topic: "hooks" (for React hooks)
- topic: "routing" (for Next.js routing)
- topic: "authentication" (for auth patterns)
```

## Trading Bot Use Cases

### Coinbase API Integration
```
Learn Coinbase Advanced Trade API:
1. resolve-library-id: "coinbase-advanced-trade"
2. Select: Most recent, high trust score
3. get-library-docs with topics:
   - "orders" - Creating and managing orders
   - "websocket" - Real-time market data
   - "accounts" - Balance and account management
```

### Next.js Dashboard Development
```
Reference Next.js features:
1. resolve-library-id: "next.js"
2. get-library-docs: /vercel/next.js/v14
3. Topics:
   - "app-router" - App directory routing
   - "server-actions" - Server-side actions
   - "api-routes" - API endpoint creation
```

### PostgreSQL Driver Usage
```
Learn node-postgres (pg):
1. resolve-library-id: "node-postgres" or "pg"
2. get-library-docs with topics:
   - "pooling" - Connection pool management
   - "transactions" - Transaction handling
   - "prepared-statements" - Parameterized queries
```

### n8n Workflow Automation
```
Understand n8n integration:
1. resolve-library-id: "n8n"
2. get-library-docs with topics:
   - "webhooks" - HTTP webhook configuration
   - "scheduling" - Cron-based workflows
   - "error-handling" - Workflow error management
```

### Ollama AI Integration
```
Learn Ollama API:
1. resolve-library-id: "ollama"
2. get-library-docs with topics:
   - "api" - REST API endpoints
   - "models" - Model management
   - "streaming" - Streaming responses
```

## Best Practices

### Token Management
- **Default**: 10,000 tokens per request
- **Adjust**: Increase for comprehensive context, decrease for focused lookups
- **Topic Filtering**: Use topic parameter to reduce noise

### Library ID Selection
- **Always Resolve First**: Don't guess library IDs
- **Check Trust Score**: Prefer 7-10 score for accuracy
- **Verify Version**: Use specific versions for production code
- **Multiple Matches**: If unsure, fetch docs for top 2-3 matches

### Integration with Other Skills
```
Combined workflow example:
1. brave-search: "Coinbase Advanced Trade API v3"
2. developer-docs: resolve-library-id "coinbase"
3. developer-docs: get-library-docs with focused topic
4. content-processing: fetch official Coinbase docs for comparison
```

## Supported Format Examples

### Context7 IDs
- `/mongodb/docs` - MongoDB documentation
- `/vercel/next.js` - Latest Next.js
- `/vercel/next.js/v14.3.0-canary.87` - Specific version
- `/nestjs/nest` - NestJS framework
- `/prisma/prisma` - Prisma ORM

### Common Libraries for Trading Bot
- **Frontend**: next.js, react, tailwindcss
- **Backend**: node.js, express, fastify
- **Database**: pg (PostgreSQL), mongoose (MongoDB)
- **API**: axios, node-fetch, ws (WebSocket)
- **Validation**: zod, joi
- **Testing**: jest, vitest

## Limitations

- **Must Resolve First**: Can't use `get-library-docs` without resolving ID first
- **Library Availability**: Not all libraries are in Context7
- **Version Coverage**: Some libraries may not have all versions documented
- **Token Limits**: Large documentation may be truncated

## Fallback Strategies

If library not found in Context7:
1. Use **brave-search** to find official documentation
2. Use **content-processing** (fetch) to extract docs
3. Use **github-integration** to search code examples
4. Use **browser-automation** to navigate documentation sites

## Related Skills

See also:
- **brave-search** skill for finding official documentation
- **content-processing** skill for fetching and converting docs
- **github-integration** skill for finding code examples

---

**Auto-loaded**: Yes (essential for learning APIs)
**Token Impact**: ~3k tokens (included in startup context)
**Primary Use**: API and library reference during development
**Best For**: Coinbase API, Next.js, PostgreSQL, n8n, Ollama
