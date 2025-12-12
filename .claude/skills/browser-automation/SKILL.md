---
name: browser-automation
description: Headless browser automation powered by Playwright for testing, web scraping, and interaction. Use for dashboard testing, form automation, and web data extraction.
---

# Browser Automation Skill

## When to Use This Skill

Trigger this skill when you need to:
- Test the Next.js trading dashboard UI
- Automate form filling (carefully, not for exchange logins)
- Scrape web data when APIs aren't available
- Take screenshots for documentation
- Monitor network requests for debugging
- Test responsive design at different screen sizes

## Available Tool Categories

### Navigation & Page Control
- `browser_navigate` - Navigate to URLs
- `browser_navigate_back` - Go back to previous page
- `browser_close` - Close browser page
- `browser_resize` - Resize viewport (test responsive)
- `browser_tabs` - Manage multiple tabs
- `browser_install` - Install browser binaries (Chromium/Firefox/WebKit)

### Interaction
- `browser_click` - Click elements (left/right/middle, double-click, with modifiers)
- `browser_type` - Type text into editable fields
- `browser_press_key` - Press keyboard keys (Enter, Escape, arrows, etc.)
- `browser_hover` - Hover over elements (for tooltips, dropdowns)
- `browser_drag` - Drag and drop between elements
- `browser_select_option` - Select dropdown options
- `browser_fill_form` - Fill multiple form fields at once
- `browser_file_upload` - Upload files
- `browser_handle_dialog` - Handle alerts, confirms, prompts

### Data Extraction
- `browser_snapshot` - Capture accessibility snapshot (PREFERRED for actions)
- `browser_take_screenshot` - Take PNG/JPEG screenshots (full page or elements)
- `browser_console_messages` - Retrieve console logs and errors
- `browser_network_requests` - Get all network requests since page load

### Advanced
- `browser_evaluate` - Execute JavaScript on page or elements
- `browser_run_code` - Run Playwright code snippets
- `browser_wait_for` - Wait for text to appear/disappear or time to pass

## Trading Bot Use Cases

### Dashboard Testing
```
Test Next.js trading dashboard:
1. browser_navigate to http://localhost:3000
2. browser_snapshot to capture page state
3. browser_click on "Open Positions" tab
4. browser_wait_for text="No open positions"
5. browser_take_screenshot for documentation
6. browser_console_messages to check for errors
```

### Form Automation (Use Carefully)
```
Automate non-sensitive forms only:
1. browser_navigate to target URL
2. browser_fill_form with multiple fields at once
3. browser_click submit button
4. browser_wait_for confirmation message

⚠️ NEVER automate exchange login pages
```

### Web Scraping (When APIs Unavailable)
```
Extract market data:
1. browser_navigate to data source
2. browser_snapshot to see page structure
3. browser_evaluate to extract specific data via JS
4. browser_network_requests to find API endpoints

Pro Tip: Check network tab first - might find hidden API
```

### Visual Regression Testing
```
Test dashboard UI changes:
1. browser_navigate to dashboard
2. browser_resize to test responsive (mobile, tablet, desktop)
3. browser_take_screenshot for each breakpoint
4. Compare with baseline screenshots
```

### Network Debugging
```
Debug API calls:
1. browser_navigate to dashboard
2. Trigger action that calls API
3. browser_network_requests to inspect:
   - Request/response headers
   - Payload data
   - Status codes
   - Timing information
```

## Best Practices

### Security First
1. **Trusted URLs Only**: Only navigate to trusted domains
2. **No Credentials**: Never automate login forms with real credentials
3. **Local Testing**: Use browser automation primarily for localhost testing
4. **Review Network Logs**: Check for sensitive data leaks

### Performance Optimization
1. **Use Snapshots**: Prefer `browser_snapshot` over `browser_take_screenshot` for actions
2. **Wait Smartly**: Use `browser_wait_for` instead of arbitrary delays
3. **Minimize Navigations**: Keep browser instance open for multiple operations
4. **Close When Done**: Always `browser_close` to free resources

### Error Handling
1. **Check Console**: Use `browser_console_messages` to catch JS errors
2. **Verify Network**: Use `browser_network_requests` to check API failures
3. **Take Screenshots**: Capture state on errors for debugging
4. **Handle Dialogs**: Use `browser_handle_dialog` to prevent hanging

## Element Selection

### Using `ref` Parameter
Most interaction tools require an `element` (human-readable) and `ref` (exact reference):
```
browser_click:
  element: "Submit button"
  ref: "button[type='submit']"

browser_type:
  element: "Email input field"
  ref: "input[name='email']"
  text: "test@example.com"
```

### Getting Refs from Snapshots
1. Use `browser_snapshot` first
2. Identify elements in snapshot output
3. Use ref value for subsequent interactions

## Advanced Workflows

### Multi-Step Dashboard Test
```javascript
// Use browser_run_code for complex Playwright scripts:
await page.goto('http://localhost:3000');
await page.waitForLoadState('networkidle');

// Check all tabs load correctly
const tabs = ['Overview', 'Positions', 'History', 'Settings'];
for (const tab of tabs) {
  await page.click(`text="${tab}"`);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${tab.toLowerCase()}.png` });
}
```

### Extract Live Price Data
```javascript
// Use browser_evaluate to extract data:
const prices = await page.evaluate(() => {
  return Array.from(document.querySelectorAll('.price-ticker'))
    .map(el => ({
      symbol: el.querySelector('.symbol').textContent,
      price: parseFloat(el.querySelector('.price').textContent)
    }));
});
```

## Trading Bot Integration

### Current Usage
- Testing Next.js dashboard during development
- Potential automated testing pipeline
- Debugging WebSocket connections
- Responsive design validation

### Recommended Workflows
1. **Pre-Deployment Testing**: Run automated dashboard tests before git push
2. **Visual Documentation**: Screenshot key dashboard features for README
3. **Network Debugging**: Inspect Coinbase API calls from dashboard
4. **Accessibility Testing**: Use snapshots to ensure accessible UI

### NOT Recommended
- ❌ Automating Coinbase exchange login
- ❌ Scraping exchange data (use API instead)
- ❌ Automated trading via browser (use API)
- ❌ Running browser in production (testing only)

## Related Skills

See also:
- **content-processing** skill for converting fetched HTML to markdown
- **brave-search** skill for finding web pages before scraping
- **developer-docs** skill for Playwright API documentation

---

**Auto-loaded**: Yes (essential for dashboard testing)
**Token Impact**: ~15k tokens (included in startup context)
**Security Level**: HIGH - Only use on trusted URLs
**Primary Use**: localhost testing and development
