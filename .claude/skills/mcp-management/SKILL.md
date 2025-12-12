---
name: mcp-management
description: Dynamically manage MCP servers during runtime. Use for on-demand tool loading, server configuration, and managing optional capabilities like postgres.
---

# MCP Management Skill

## When to Use This Skill

Trigger this skill when you need to:
- Load optional MCP servers on-demand (postgres)
- Discover available MCP servers in catalog
- Configure server-specific parameters
- Execute tools not visible in standard listings
- Manage tool availability per task
- Remove unused servers to free resources

## Available Tools

### Server Discovery & Management
- `mcp-find` - Search MCP server catalog by name, title, or description
- `mcp-add` - Add MCP server to current session (with optional auto-activation)
- `mcp-remove` - Remove MCP server from registry
- `mcp-config-set` - Configure server settings (strings, numbers, booleans, objects, arrays)
- `mcp-exec` - Execute tools that may not be visible in standard tool listings

## Workflow

### Load On-Demand Server
```
1. Search: mcp-find with query
2. Verify: Check server details and tools
3. Add: mcp-add with server name
4. Activate: Use activate: true parameter
5. Use: Tools become available immediately
6. Cleanup: mcp-remove when done (optional)
```

### Configure Server
```
1. Add: mcp-add server if not already loaded
2. Configure: mcp-config-set with key-value pairs
3. Verify: Test tool functionality
```

## Trading Bot Use Cases

### Load PostgreSQL Tools On-Demand
```
When working with database:
1. mcp-find: query="postgres"
2. mcp-add: name="postgres", activate=true
3. Tools available:
   - Execute SQL queries
   - Manage schemas
   - Analyze query performance
4. mcp-remove: name="postgres" (when done)

Why on-demand?
- PostgreSQL tools are only needed during database work
- Saves ~5-10k tokens when not in use
- Can load instantly when needed
```

### Discover Available Servers
```
Explore MCP catalog:
1. mcp-find: query="trading" (find trading-related servers)
2. mcp-find: query="database" (find DB servers)
3. mcp-find: query="api" (find API integration servers)
4. Review results and add as needed
```

### Configure Server Parameters
```
Example: Configure Brave Search API
1. mcp-config-set:
   - server: "brave"
   - key: "api_key"
   - value: "your_api_key_here"

Example: Configure custom server
1. mcp-config-set:
   - server: "custom-server"
   - key: "config"
   - value: {endpoint: "https://api.example.com", timeout: 5000}
```

## Best Practices

### When to Load On-Demand
- **Load**: Servers used only for specific tasks (postgres, specialized tools)
- **Auto-Load**: Essential servers used frequently (github, brave, git)
- **Strategy**: Balance token usage vs convenience

### Server Lifecycle
```
Task-based loading:
1. Start task requiring specific tool
2. mcp-add with activate: true
3. Complete task
4. Keep loaded if needed again soon
5. mcp-remove if one-time use

Session-based loading:
1. Load at start of work session
2. Use throughout session
3. Auto-unloads when session ends
```

### Configuration Management
```
Best practices:
1. Set configuration before first use
2. Use environment variables for sensitive values
3. Document custom configurations in CLAUDE.md
4. Test configuration with simple tool call
```

## Currently Available Servers

### Auto-Loaded (in registry.yaml)
- `brave` - Web search
- `context7` - Developer documentation
- `fetch` - Content fetching
- `markitdown` - Markdown conversion
- `git` - Local Git operations
- `github-official` - GitHub API
- `playwright` - Browser automation

### On-Demand (not in registry)
- `postgres` - PostgreSQL database tools
  - **When to load**: Database schema work, query optimization, data analysis
  - **Token cost**: ~5-10k tokens
  - **Usage**: `mcp-add postgres --activate`

### Excluded (not available)
- `openzeppelin-solidity` - Not used in this project
- `youtube_transcript` - Not used in this project

## Example Workflows

### Database Development Session
```
Scenario: Working on database schema migrations

1. mcp-find: query="postgres"
   Verify postgres server is available

2. mcp-add:
   name="postgres"
   activate=true

3. Use postgres tools:
   - Execute migration SQL
   - Test queries
   - Analyze performance

4. Complete work

5. mcp-remove: name="postgres" (optional)
   Free tokens for other work
```

### Discover New Tools
```
Scenario: Looking for API integration tools

1. mcp-find: query="api integration"
   limit=10

2. Review results:
   - Check server descriptions
   - Review available tools
   - Check requirements

3. Test promising server:
   mcp-add: name="api-server", activate=false
   Read documentation first

4. Activate if useful:
   mcp-config-set if needed
   mcp-add: activate=true
```

### Execute Hidden Tool
```
Scenario: Tool not visible in standard listings

1. Know tool name from documentation
2. mcp-exec:
   name="hidden-tool"
   arguments={param1: "value1"}

Use case: Beta features, debugging tools
```

## Configuration Examples

### Set String Value
```
mcp-config-set:
  server: "brave"
  key: "api_key"
  value: "sk_live_xxxxxxxxxxxx"
```

### Set Number Value
```
mcp-config-set:
  server: "custom-server"
  key: "timeout"
  value: 5000
```

### Set Boolean Value
```
mcp-config-set:
  server: "custom-server"
  key: "debug_mode"
  value: true
```

### Set Object Value
```
mcp-config-set:
  server: "custom-server"
  key: "config"
  value: {endpoint: "https://api.example.com", retries: 3, timeout: 5000}
```

### Set Array Value
```
mcp-config-set:
  server: "custom-server"
  key: "allowed_domains"
  value: ["example.com", "api.example.com", "docs.example.com"]
```

## Token Impact Analysis

### Auto-Loaded Servers (~60k tokens at startup)
- github-official: ~40k tokens
- brave: ~10k tokens
- playwright: ~15k tokens
- Others: ~5k tokens combined

### On-Demand Loading Benefits
- Save tokens when not in use
- Load instantly when needed
- Better context management
- Reduced startup latency

### Trade-offs
- **Auto-Load**: Convenient, always available, uses tokens
- **On-Demand**: Saves tokens, requires explicit loading, slight delay

## Security Considerations

- **Configuration**: Don't expose secrets in config (use env vars)
- **Unknown Servers**: Only add servers from trusted sources
- **Exec Tool**: Use carefully, verify tool names
- **Removal**: Remove unused servers to reduce attack surface

## Related Skills

All skills can reference MCP management for:
- Loading optional related servers
- Configuring server-specific settings
- Managing tool availability

---

**Auto-loaded**: Yes (essential for dynamic tool management)
**Token Impact**: ~1k tokens (included in startup context)
**Primary Use**: On-demand loading of postgres and specialized tools
**Key Benefit**: Reduce token usage by loading tools only when needed
