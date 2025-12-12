---
name: content-processing
description: Fetch and convert web content to markdown for analysis. Use for documentation parsing, article extraction, and technical guide conversion.
---

# Content Processing Skill

## When to Use This Skill

Trigger this skill when you need to:
- Extract trading strategy articles for analysis
- Convert API documentation to readable markdown
- Parse technical blog posts about trading patterns
- Extract content from Coinbase documentation
- Convert web pages for offline reading
- Process long-form content (with pagination)

## Available Tools

### Fetch & Convert
- `fetch` - Fetch URLs and extract content as simplified markdown
  - Removes HTML complexity, navigation, ads
  - Configurable character limits and pagination
  - Optional raw HTML mode
  - Works with http://, https:// URLs

- `convert_to_markdown` - Convert various URIs to markdown
  - Supports http://, https://, file://, data: URIs
  - Consistent markdown output format

## Key Features

### Smart Extraction
- Automatically removes navigation, ads, footers
- Preserves article structure (headings, lists, code blocks)
- Maintains links and images
- Clean, readable output

### Pagination Support
```
For long documents:
- fetch with max_length: 5000, start_index: 0
- Check if truncated
- fetch again with start_index: 5000
- Repeat until complete
```

### Raw HTML Mode
```
When you need original HTML:
- fetch with raw: true
- Get unprocessed HTML
- Useful for custom parsing
```

## Trading Bot Use Cases

### Extract Trading Strategy Articles
```
Learn from expert strategies:
1. brave_web_search: "liquidity sweep trading strategy"
2. Select most relevant article
3. fetch: Extract article content as markdown
4. Analyze patterns and techniques
5. Document insights in project

Example:
fetch(url="https://example.com/liquidity-sweeps", max_length=10000)
```

### Process API Documentation
```
Extract Coinbase API docs:
1. brave_web_search: "Coinbase Advanced Trade API orders"
2. fetch: Convert docs to markdown
3. Compare with developer-docs skill output
4. Extract specific endpoint details

Pro Tip: Combine with developer-docs for comprehensive understanding
```

### Convert Technical Guides
```
Process implementation guides:
1. Find guide via brave_web_search
2. fetch: Convert to markdown
3. Extract code examples
4. Save as reference in project docs

Example use case: "How to implement trailing stops"
```

### Parse Research Papers
```
Extract academic trading research:
1. Find paper URL
2. fetch: Convert to markdown
3. Extract methodology and results
4. Apply to trading bot strategy

Note: PDFs may need special handling
```

## Best Practices

### Character Limits
- **Default**: 5000 characters (balance detail vs token usage)
- **Short Articles**: 3000-5000 sufficient
- **Long Docs**: Use 10000+ with pagination
- **Max**: 1,000,000 characters (avoid unless necessary)

### Pagination Strategy
```
For comprehensive extraction:
1. Start with max_length: 5000, start_index: 0
2. Check if content is truncated (ends abruptly)
3. Continue: start_index: 5000, max_length: 5000
4. Repeat until content complete
5. Combine all chunks
```

### URL Validation
```
Before fetching:
1. Verify URL is from trusted domain
2. Check it's actual content, not login page
3. Test with small max_length first
4. Use raw: false unless you need HTML
```

### Integration Workflows

#### With Brave Search
```
Research workflow:
1. brave_web_search: Find relevant articles
2. fetch: Extract top 3 results
3. Analyze and compare content
4. Document key findings
```

#### With Developer Docs
```
Documentation workflow:
1. developer-docs: Get library docs from Context7
2. fetch: Get official docs from web
3. Compare both sources
4. Resolve discrepancies
```

#### With Browser Automation
```
When fetch doesn't work (JS-heavy sites):
1. browser_navigate to URL
2. browser_wait_for content to load
3. browser_evaluate to extract text
4. Manual markdown conversion
```

## File URI Support

### Local Files
```
convert_to_markdown for local files:
- file:///Users/ble/Documents/trading-strategy.html
- Useful for converting saved research
- Works with local documentation archives
```

### Data URIs
```
For embedded content:
- data:text/html,<html>...</html>
- Useful for testing
- Small snippets only
```

## Common URL Patterns

### Documentation Sites
- Coinbase: `https://docs.cdp.coinbase.com/...`
- n8n: `https://docs.n8n.io/...`
- Next.js: `https://nextjs.org/docs/...`

### Trading Education
- Investopedia: `https://www.investopedia.com/...`
- TradingView: `https://www.tradingview.com/...`
- CoinDesk: `https://www.coindesk.com/...`

### Technical Blogs
- Medium: `https://medium.com/...`
- Dev.to: `https://dev.to/...`
- Personal blogs about trading

## Limitations

### What Works Well
- Blog posts and articles
- Documentation pages
- News articles
- Technical guides
- Static HTML pages

### What Doesn't Work Well
- JavaScript-heavy SPAs (use browser automation)
- Content behind authentication (use API if available)
- Paywalled content
- Sites with anti-scraping measures
- Dynamic/infinite scroll content

### Alternatives for Difficult Sites
1. **JS-Heavy**: Use browser-automation skill
2. **Paywalled**: Find alternative sources via brave-search
3. **API Available**: Use direct API access
4. **PDFs**: May need specialized PDF tools

## Related Skills

See also:
- **brave-search** skill for finding content to fetch
- **browser-automation** skill for JS-heavy sites
- **developer-docs** skill for structured library documentation

---

**Auto-loaded**: Yes (essential for research)
**Token Impact**: ~2k tokens (included in startup context)
**Primary Use**: Converting web content to markdown for analysis
**Best For**: Articles, documentation, technical guides
**Security Note**: Only fetch from trusted domains
