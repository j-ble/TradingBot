---
name: mcp-skills-reference
description: Comprehensive guide to available MCP server tools including GitHub integration, Brave Search, browser automation, Git operations, developer documentation, content processing, and MCP management capabilities for the BTC Trading Bot project.
---

# MCP Skills Reference

This document catalogs the available Model Context Protocol (MCP) servers and tools integrated into the BTC Trading Bot project. These skills extend Claude's capabilities by providing specialized tools for development, research, and automation.

## What are MCP Skills?

MCP (Model Context Protocol) servers are external tools that Claude can invoke to perform specialized tasks. Each skill category below represents a collection of related capabilities that help automate workflows, gather information, and interact with external systems.

**Progressive Disclosure**: This document provides high-level overviews of each skill category. Detailed parameter specifications are available through Claude's built-in tool system.

---

## Table of Contents

1. [GitHub Integration](#github-integration)
2. [Brave Search](#brave-search)
3. [Browser Automation](#browser-automation)
4. [Git Operations](#git-operations)
5. [Developer Documentation](#developer-documentation)
6. [Content Processing](#content-processing)
7. [MCP Management](#mcp-management)
8. [Advanced Code Composition](#advanced-code-composition)

---

## GitHub Integration

**Purpose**: Comprehensive GitHub API access for repository management, issue tracking, pull requests, and code search.

### Repository Management
- `create_repository` - Create new repositories in personal account or organization
- `fork_repository` - Fork repositories to your account
- `create_branch` - Create new branches
- `list_branches` - List all branches in a repository
- `search_repositories` - Find repositories by name, description, topics, stars, language
- `get_file_contents` - Read files or directory contents from repositories
- `create_or_update_file` - Create or modify single files remotely
- `delete_file` - Remove files from repositories
- `push_files` - Batch upload multiple files in a single commit

### Issues & Project Management
- `issue_read` - Get issue details, comments, sub-issues, labels
- `issue_write` - Create or update issues with assignees, labels, milestones
- `search_issues` - Search issues across repositories with filters
- `list_issues` - List repository issues with pagination and ordering
- `list_issue_types` - Get supported issue types for an organization
- `add_issue_comment` - Add comments to issues or pull requests
- `sub_issue_write` - Manage sub-issue hierarchies and prioritization
- `get_label` - Retrieve label details
- `assign_copilot_to_issue` - Assign GitHub Copilot agent to work on issues

### Pull Requests
- `create_pull_request` - Create new pull requests
- `list_pull_requests` - List PRs with filtering by state, base, head
- `search_pull_requests` - Search PRs across repositories by author, state, etc.
- `pull_request_read` - Get PR details, diff, status, files, comments, reviews
- `update_pull_request` - Modify PR title, description, state, reviewers
- `update_pull_request_branch` - Update PR branch with latest base branch changes
- `merge_pull_request` - Merge PRs with specified merge method
- `pull_request_review_write` - Create, submit, or delete PR reviews
- `add_comment_to_pending_review` - Add review comments to pending reviews
- `request_copilot_review` - Request automated Copilot code review

### Code Search & History
- `search_code` - Fast, precise code search across all GitHub repositories
- `search_users` - Find users by username, location, followers
- `list_commits` - Get commit history for branches
- `get_commit` - Get commit details including diffs and stats
- `list_tags` - List git tags in a repository
- `get_tag` - Get tag details
- `list_releases` - List repository releases
- `get_latest_release` - Get most recent release
- `get_release_by_tag` - Get specific release by tag name

### Account & Teams
- `get_me` - Get authenticated user details
- `get_teams` - Get teams for authenticated user
- `get_team_members` - Get member usernames of a specific team

**Use Cases**:
- Automated PR creation and code reviews
- Issue tracking and project management
- Repository exploration and code search
- Release management and tagging
- Team collaboration workflows

---

## Brave Search

**Purpose**: High-quality web search without Google API dependencies. Includes web, image, video, news, and local business search.

### Search Types
- `brave_web_search` - General web search with comprehensive results (web pages, discussions, FAQs, news, videos)
- `brave_news_search` - Search recent news articles and breaking news
- `brave_image_search` - Find images by description or keywords
- `brave_video_search` - Search for videos with metadata
- `brave_local_search` - Find local businesses, restaurants, services (requires Pro plan)
- `brave_summarizer` - AI-generated summaries of search results (requires Pro AI plan)

### Key Features
- **No Tracking**: Privacy-focused search engine
- **Freshness Filters**: Filter by pd (24h), pw (7d), pm (31d), py (365d), or custom date ranges
- **Goggles**: Custom re-ranking on top of Brave's search index
- **SafeSearch**: Content filtering (off/moderate/strict)
- **Localization**: 40+ UI languages and search languages supported
- **Pagination**: Efficient pagination with configurable results per page

**Use Cases**:
- Market research and competitive analysis
- Technical documentation lookup
- News monitoring for trading signals
- Finding code examples and tutorials
- Local business discovery

**Pro Tips**:
- Always cite sources with hyperlinks in markdown: `[Title](URL)`
- Use `result_filter` parameter to focus on specific content types
- Combine `freshness` filters for time-sensitive queries
- Use `brave_summarizer` to consolidate multi-source information

---

## Browser Automation

**Purpose**: Headless browser automation powered by Playwright for web scraping, testing, and interaction.

### Navigation & Page Control
- `browser_navigate` - Navigate to URLs
- `browser_navigate_back` - Go back to previous page
- `browser_close` - Close the browser page
- `browser_resize` - Resize browser window
- `browser_tabs` - List, create, close, or select tabs
- `browser_install` - Install browser binaries (Chromium/Firefox/WebKit)

### Interaction
- `browser_click` - Click elements (left/right/middle click, double-click)
- `browser_type` - Type text into editable elements
- `browser_press_key` - Press keyboard keys
- `browser_hover` - Hover over elements
- `browser_drag` - Drag and drop between elements
- `browser_select_option` - Select dropdown options
- `browser_fill_form` - Fill multiple form fields at once
- `browser_file_upload` - Upload files
- `browser_handle_dialog` - Handle alerts, confirms, prompts

### Data Extraction
- `browser_snapshot` - Capture accessibility snapshot (preferred over screenshots for actions)
- `browser_take_screenshot` - Take PNG/JPEG screenshots (full page or specific elements)
- `browser_console_messages` - Retrieve console logs and errors
- `browser_network_requests` - Get all network requests since page load

### Advanced
- `browser_evaluate` - Execute JavaScript on page or elements
- `browser_run_code` - Run Playwright code snippets
- `browser_wait_for` - Wait for text to appear/disappear or time to pass

**Use Cases**:
- Automated testing of trading dashboard
- Web scraping for market data
- Form automation
- Screenshot documentation
- Network monitoring and debugging

**Security Note**: Browser automation can access sensitive data. Only navigate to trusted URLs.

---

## Git Operations

**Purpose**: Local Git repository management via GitPython library.

### Repository Management
- `git_init` - Initialize new Git repository
- `git_status` - Show working tree status
- `git_log` - View commit history (configurable max count)
- `git_diff` - Show differences between branches or commits
- `git_diff_staged` - Show staged changes
- `git_diff_unstaged` - Show unstaged changes in working directory

### Branch Operations
- `git_create_branch` - Create new branch from optional base branch
- `git_checkout` - Switch branches

### Staging & Committing
- `git_add` - Stage files for commit
- `git_commit` - Record changes to repository
- `git_reset` - Unstage all staged changes

### History & Inspection
- `git_show` - Show contents of a specific commit

**Use Cases**:
- Local version control workflows
- Pre-commit inspection and validation
- Branch management
- Commit history analysis

**Note**: These tools operate on local repositories only. For remote operations (push/pull), use system `git` commands via Bash tool.

---

## Developer Documentation

**Purpose**: Fetch up-to-date library documentation from Context7 to help with API usage and integration.

### Documentation Tools
- `resolve-library-id` - Convert package names to Context7-compatible library IDs
- `get-library-docs` - Fetch documentation for specific libraries with optional topic focus

### Workflow
1. **Resolve ID**: Use `resolve-library-id` with library name (e.g., "next.js", "mongodb")
2. **Select Match**: Choose most relevant match based on:
   - Name similarity
   - Description relevance
   - Documentation coverage (Code Snippet counts)
   - Trust score (7-10 most authoritative)
3. **Fetch Docs**: Use `get-library-docs` with Context7 ID (format: `/org/project` or `/org/project/version`)
4. **Optional Topic**: Specify topic (e.g., "hooks", "routing") to focus documentation

### Supported Formats
- Context7 IDs: `/mongodb/docs`, `/vercel/next.js`, `/vercel/next.js/v14.3.0-canary.87`
- Token limits: Configurable (default 10,000 tokens)

**Use Cases**:
- Learning new APIs (Coinbase Advanced Trade API, PostgreSQL drivers)
- Framework reference (Next.js for dashboard)
- Library integration (n8n, Ollama, Zod for schema validation)
- Troubleshooting integration issues

**Pro Tips**:
- Always call `resolve-library-id` first unless user provides explicit ID
- Higher token limits provide more context but consume more tokens
- Topic filtering reduces noise for specific use cases

---

## Content Processing

**Purpose**: Fetch and convert web content to markdown for analysis.

### Tools
- `fetch` - Fetch URLs and extract content as simplified markdown
  - Removes HTML complexity while preserving structure
  - Configurable character limits and start indexes
  - Optional raw HTML mode
  - Automatic retry and error handling

- `convert_to_markdown` - Convert various URIs to markdown
  - Supports http://, https://, file://, data: URIs
  - Consistent markdown output format

### Key Features
- **Smart Extraction**: Removes navigation, ads, and clutter
- **Pagination**: Use `start_index` for long documents
- **Raw Mode**: Get original HTML when needed
- **Format Flexibility**: Works with web pages, local files, data URIs

**Use Cases**:
- Documentation parsing
- Blog post analysis
- API documentation retrieval
- Research article extraction
- Technical guide conversion

**Pro Tip**: Use `fetch` for web content and `convert_to_markdown` for local files or data URIs.

---

## MCP Management

**Purpose**: Dynamically manage MCP servers during runtime.

### Server Management
- `mcp-find` - Search MCP server catalog by name, title, or description
- `mcp-add` - Add MCP server to current session (with optional auto-activation)
- `mcp-remove` - Remove MCP server from registry
- `mcp-config-set` - Configure server settings (supports strings, numbers, booleans, objects, arrays)
- `mcp-exec` - Execute tools that may not be visible in standard tool listings

### Workflow
1. **Discover**: Use `mcp-find` to search available servers
2. **Install**: Use `mcp-add` to enable server in session
3. **Configure**: Use `mcp-config-set` to set server-specific parameters
4. **Execute**: Tools become available automatically or via `mcp-exec`
5. **Cleanup**: Use `mcp-remove` to disable unused servers

**Use Cases**:
- On-demand tool loading
- Dynamic capability extension
- Server configuration management
- Tool discovery and exploration

**Pro Tip**: Use `activate: true` parameter in `mcp-add` to immediately enable all server tools.

---

## Advanced Code Composition

**Purpose**: Create JavaScript-powered tools that combine multiple MCP servers.

### Code-Mode Tool
- `code-mode` - Launch JavaScript-enabled tool that combines multiple MCP server tools
  - Allows scripts to call multiple tools
  - Combines results from different servers
  - Custom logic and data transformation
  - Must use `mcp-find` and `mcp-add` first to ensure servers are ready

### Workflow
1. **Prepare Servers**: Use `mcp-find` to locate required servers
2. **Activate Servers**: Use `mcp-add` (without activation) to enable servers
3. **Create Tool**: Use `code-mode` with:
   - Unique tool name (prefixed with 'code-mode-')
   - List of server names whose tools should be available
   - JavaScript code that orchestrates tool calls

### Key Features
- **Multi-Server Access**: Combine tools from different MCP servers
- **Custom Logic**: Write JavaScript to process and combine results
- **Dynamic Creation**: Tools created on-the-fly during session
- **Flexible Integration**: Bridge between different tool ecosystems

**Use Cases**:
- Complex workflows requiring multiple tool calls
- Custom data transformation pipelines
- Integration between GitHub and Brave Search
- Orchestrated browser + content processing workflows

**Example Scenario**: Create a tool that searches GitHub for repositories, fetches their README files, converts to markdown, and summarizes key features using Brave Search for context.

---

## Best Practices

### General Guidelines
1. **Start Specific**: Use targeted tools before broad searches
2. **Progressive Disclosure**: Load context only as needed
3. **Batch Operations**: Use batch tools (e.g., `push_files`) when available
4. **Error Handling**: Check tool responses for errors before proceeding
5. **Security First**: Only use browser automation on trusted URLs
6. **Rate Limits**: Be mindful of API rate limits (GitHub, Brave)

### When to Use Each Skill

**GitHub Integration**:
- Code reviews and repository management
- Issue tracking and project planning
- Searching for code examples or implementations

**Brave Search**:
- Market research and trend analysis
- Technical documentation discovery
- News monitoring for trading signals
- Finding learning resources

**Browser Automation**:
- Testing the Next.js dashboard
- Automated form filling (e.g., exchange onboarding)
- Web scraping when APIs unavailable
- Visual regression testing

**Git Operations**:
- Pre-commit code validation
- Local branch management
- Commit history analysis
- Staging workflow automation

**Developer Documentation**:
- Learning new APIs (Coinbase, n8n)
- Framework reference during development
- Troubleshooting integration issues
- API version compatibility checks

**Content Processing**:
- Converting documentation to readable format
- Extracting information from blog posts
- Processing technical articles
- Parsing API documentation

**MCP Management**:
- Dynamically loading capabilities as needed
- Experimenting with new MCP servers
- Managing tool availability per task
- Configuring server parameters

**Code-Mode**:
- Complex multi-tool workflows
- Custom integration logic
- Data transformation pipelines
- Orchestrated automation tasks

---

## Security Considerations

### Trusted Sources Only
- Install MCP servers only from trusted sources
- Audit code and bundled resources before use
- Pay attention to network connections in skills

### Data Handling
- Browser automation can access sensitive data
- Be cautious with file uploads and form filling
- Review console logs and network requests for leaks

### API Keys & Credentials
- Never expose API keys in code or commits
- Use environment variables for sensitive configuration
- Rotate credentials if compromised

### Trading Bot Specific
- GitHub tools can access repository code (public or private if authenticated)
- Browser automation should not navigate to exchange login pages
- Content fetching should validate URLs before processing
- Git operations have no authentication by default

---

## Integration with Trading Bot

### Current Usage
The BTC Trading Bot project currently uses these MCP skills for:
- **GitHub**: Version control, issue tracking, code collaboration
- **Brave Search**: Research trading patterns, market news, technical documentation
- **Browser Automation**: Testing dashboard, potential exchange automation
- **Git Operations**: Local repository management
- **Developer Documentation**: Learning Coinbase API, Next.js, PostgreSQL drivers
- **Content Processing**: Extracting trading strategy articles, documentation

### Planned Enhancements
- Browser automation for dashboard testing
- Brave News Search for market sentiment analysis
- GitHub Actions integration for CI/CD
- MCP management for dynamic tool loading based on trading phase

---

## Resources

- [Anthropic Agent Skills Documentation](https://docs.anthropic.com/en/docs/agents/skills)
- [Anthropic Agent Skills Cookbook](https://github.com/anthropics/anthropic-cookbook/tree/main/skills)
- [Model Context Protocol Specification](https://modelcontextprotocol.io/)
- [Claude Code Documentation](https://docs.anthropic.com/en/docs/claude-code)

---

## Acknowledgements

This skills reference is inspired by Anthropic's Agent Skills framework and adapted for the BTC Trading Bot project. Special thanks to the Anthropic team for building the progressive disclosure pattern that makes skills scalable and the MCP community for creating powerful tool servers.

**Last Updated**: December 2025
**Trading Bot Version**: Pre-production / MVP Phase
