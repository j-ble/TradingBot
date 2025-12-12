---
name: brave-search
description: Privacy-focused web search including web, news, images, videos, and local businesses. Use for market research, technical documentation, news monitoring, and finding learning resources.
---

# Brave Search Skill

## When to Use This Skill

Trigger this skill when you need to:
- Research trading patterns, strategies, or market analysis techniques
- Monitor news for market sentiment or BTC-related events
- Find technical documentation for APIs (Coinbase, n8n, etc.)
- Discover code examples and tutorials
- Research competitors or similar trading bots
- Find local services (if using local search)

## Available Search Types

### Core Search Tools
- `brave_web_search` - General web search with comprehensive results
- `brave_news_search` - Recent news articles and breaking news
- `brave_image_search` - Find images by description/keywords
- `brave_video_search` - Search for videos with metadata
- `brave_local_search` - Local businesses (requires Pro plan)
- `brave_summarizer` - AI summaries of search results (requires Pro AI)

## Key Features

### Freshness Filters
Time-based filtering for recent information:
- `pd` - Past 24 hours (for breaking news)
- `pw` - Past 7 days (recent trends)
- `pm` - Past 31 days (monthly analysis)
- `py` - Past 365 days (annual patterns)
- `YYYY-MM-DDtoYYYY-MM-DD` - Custom date ranges

### Privacy & Control
- **No Tracking**: Privacy-focused search engine
- **SafeSearch**: Content filtering (off/moderate/strict)
- **Goggles**: Custom re-ranking for specialized searches
- **40+ Languages**: Localization support

## Trading Bot Use Cases

### Market Research & News Monitoring
```
Monitor BTC market sentiment:
- brave_news_search: "Bitcoin price prediction 2025"
  - Use freshness: "pd" for breaking news
  - Always cite sources: [Title](URL)

- brave_web_search: "liquidity sweep trading strategy"
  - Filter by freshness: "pm" for recent strategies
  - Use result_filter: ["web", "discussions"] for forums
```

### Technical Documentation
```
Find API documentation:
- brave_web_search: "Coinbase Advanced Trade API documentation 2025"
- brave_web_search: "n8n webhook configuration guide"
- brave_web_search: "Ollama GPT-OSS 20B setup Mac"

Pro Tip: Add year to query for most recent docs
```

### Learning & Examples
```
Find code examples:
- brave_web_search: "Python liquidity sweep detector GitHub"
- brave_web_search: "Next.js real-time trading dashboard"
- brave_web_search: "PostgreSQL time-series data optimization"

Combine with github-integration skill for deep dive
```

### Competitive Analysis
```
Research competitors:
- brave_web_search: "autonomous crypto trading bot review"
- brave_news_search: "AI trading bot performance 2025"
- brave_web_search: "Coinbase trading bot comparison"
```

## Best Practices

### Always Cite Sources
When using search results, include markdown links:
```markdown
According to [CoinDesk](https://example.com), Bitcoin's liquidity sweeps...
The [Investopedia](https://example.com) guide explains that...
```

### Optimize Queries
1. **Be Specific**: "Coinbase Advanced Trade stop loss API" vs "Coinbase API"
2. **Use Filters**: Apply freshness for time-sensitive queries
3. **Combine Terms**: "liquidity sweep + order flow + BTC"
4. **Result Types**: Use `result_filter` to focus on specific content

### Handle Rate Limits
- Brave Search has rate limits based on your plan
- Free tier: ~2,500 queries/month
- Combine queries when possible
- Use `brave_summarizer` to consolidate multi-search results

## Advanced Features

### Custom Result Filtering
```
result_filter options:
- "web" - Web pages only
- "news" - News articles only
- "videos" - Video results only
- "discussions" - Forum/discussion threads
- "faq" - FAQ sections
- ["web", "discussions"] - Multiple types
```

### Pagination
```
For comprehensive research:
- Start: offset=0, count=20
- Next page: offset=20, count=20
- Max results: count=100 (Pro plan)
```

## Security & Privacy

- **No User Tracking**: Brave doesn't track search history
- **URL Validation**: Always validate URLs before using browser automation
- **Sensitive Queries**: Be cautious with API-related searches (no credentials in queries)

## Trading Bot Integration

### Current Usage
- Researching liquidity sweep patterns and trading strategies
- Monitoring BTC-USD news for market events
- Finding Coinbase API documentation
- Learning n8n workflow automation
- Discovering PostgreSQL optimization techniques

### Recommended Workflows
1. **Daily News Check**: `brave_news_search` with `freshness: "pd"` for market events
2. **Weekly Strategy Research**: `brave_web_search` for new trading techniques
3. **Documentation Lookup**: Combine with `fetch` tool to extract and convert docs
4. **Competitor Analysis**: Monthly searches for trading bot reviews

## Related Skills

See also:
- **content-processing** skill for fetching and converting search results
- **browser-automation** skill for interacting with search result pages
- **developer-docs** skill for focused library documentation

---

**Auto-loaded**: Yes (essential for market research)
**Token Impact**: ~10k tokens (included in startup context)
**Citation Requirement**: ALWAYS include source URLs in markdown format
