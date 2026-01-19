---
spec: asana-chrome-extension
phase: research
created: 2026-01-17
---

# Research: asana-chrome-extension

## Executive Summary

Building a Chrome extension for Asana task creation is highly feasible. Asana provides a JavaScript SDK and OAuth2 support. Gmail email link extraction is well-supported via gmail.js library and URL parsing. Outlook.com extraction requires URL parsing from the browser address bar, with ItemID embedded in the path. AI task name generation can use Claude or OpenAI APIs.

## External Research

### Asana API & SDK

| Aspect | Details | Source |
|--------|---------|--------|
| SDK | `npm install asana` (v3 recommended) | [Asana JS Docs](https://developers.asana.com/docs/javascript) |
| Auth | OAuth2 authorization code grant + PKCE supported | [Asana OAuth](https://developers.asana.com/docs/oauth) |
| Token Lifetime | Access tokens: 3600s (1 hour), refresh tokens: long-lived | [Asana OAuth](https://developers.asana.com/docs/oauth) |
| Scopes | Format: `<resource>:<action>` (e.g., `tasks:write`, `projects:read`) | [Asana OAuth](https://developers.asana.com/docs/oauth) |

**Key API Endpoints:**

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/tasks` | POST | Create task |
| `/workspaces` | GET | List user workspaces |
| `/projects` | GET | List projects |
| `/projects/{id}/sections` | GET | Get sections in project |
| `/tags` | GET | List tags |
| `/workspaces/{id}/tags` | GET | Tags by workspace |

**Create Task Request:**
```json
POST https://app.asana.com/api/1.0/tasks
{
  "data": {
    "name": "Task title",
    "notes": "Description with URL",
    "projects": ["project_gid"],
    "tags": ["tag_gid"],
    "workspace": "workspace_gid"
  }
}
```

### Chrome Extension Manifest V3

| Aspect | Best Practice | Source |
|--------|---------------|--------|
| OAuth | Use `chrome.identity.launchWebAuthFlow()` for third-party providers | [Chrome Identity API](https://developer.chrome.com/docs/extensions/reference/api/identity) |
| Redirect URL | `chrome.identity.getRedirectURL()` -> `https://<app-id>.chromiumapp.org/*` | [Chrome Identity API](https://developer.chrome.com/docs/extensions/reference/api/identity) |
| Storage | Use `chrome.storage.local` (not localStorage, unavailable in service workers) | [Chrome Storage API](https://developer.chrome.com/docs/extensions/reference/api/storage) |
| Permissions | `"identity"`, `"storage"`, `"contextMenus"`, `"activeTab"` | [Chrome Docs](https://developer.chrome.com/docs/extensions) |

**OAuth Flow for Chrome Extension:**
1. Register app in Asana developer console
2. Set redirect URL to `https://<extension-id>.chromiumapp.org/`
3. Call `chrome.identity.launchWebAuthFlow()` with Asana auth URL
4. Parse returned URL for auth code
5. Exchange code for tokens (must handle manually, not like Google's getAuthToken)
6. Store tokens in `chrome.storage.local`

### Gmail Email Link Extraction (CRITICAL)

**URL Structure:**
```
https://mail.google.com/mail/u/{userId}/#all/{messageId}
https://mail.google.com/mail/u/{userId}/#inbox/{messageId}
```

**Extraction Approaches:**

| Method | Description | Reliability |
|--------|-------------|-------------|
| URL Parsing | Extract messageId from current URL path | High |
| gmail.js Library | DOM-based extraction via `gmail.new.get.email_id()` | High |
| RFC822 Search | `#search/rfc822msgid:<message-id>` format | Medium |

**gmail.js Library (Recommended):**
- NPM: `npm install gmail-js`
- GitHub: [KartikTalwar/gmail.js](https://github.com/KartikTalwar/gmail.js)
- Requires jQuery, inject with `"run_at": "document_start"`

Key methods:
```javascript
gmail.new.get.email_id()     // Current email ID
gmail.new.get.thread_id()    // Current thread ID
gmail.new.get.email_data(id) // Full email metadata
gmail.observe.on('view_email', callback)  // Detect email open
```

**Permanent Link Format:**
```
https://mail.google.com/mail/u/0/#all/{messageId}
```

**Caveat:** User ID (`u/0`, `u/1`) depends on sign-in order. Links may fail if order changes.

### Outlook.com Email Link Extraction (CRITICAL)

**URL Structures:**

| Account Type | URL Format |
|--------------|------------|
| Personal (outlook.live.com) | `https://outlook.live.com/mail/0/inbox/id/{ItemID}` |
| Business (office.com) | `https://outlook.office.com/mail/inbox/id/{ItemID}` |
| Office 365 | `https://outlook.office365.com/mail/inbox/id/{ItemID}` |

**Extraction Approaches:**

| Method | Description | Reliability |
|--------|-------------|-------------|
| URL Parsing | Extract ItemID from URL path after `/id/` | High |
| Bookmarklet Pattern | `window.location.href.split("/id/")[1]` | High |
| Office Add-in API | `Office.context.mailbox.item.itemId` | N/A (different arch) |

**Permanent Link Formats:**
```
https://outlook.office365.com/owa/?ItemID={ItemID}&exvsurl=1&viewmodel=ReadMessageItem
https://outlook.office.com/mail/deeplink/read/{URL_ENCODED_ItemID}
```

**Content Script Strategy:**
```javascript
// For Outlook Web
if (window.location.hostname.includes('outlook')) {
  const pathParts = window.location.pathname.split('/id/');
  if (pathParts.length > 1) {
    const itemId = pathParts[1].split('/')[0];
    const deepLink = `https://outlook.office365.com/owa/?ItemID=${encodeURIComponent(itemId)}&exvsurl=1&viewmodel=ReadMessageItem`;
  }
}
```

**Caveat:** ItemID in URL path format differs from OWA query param format. May need URL encoding.

### AI Integration Options

| Provider | Approach | Pros | Cons |
|----------|----------|------|------|
| Claude API | Direct API call | High quality, Anthropic ecosystem | Requires API key |
| OpenAI API | Direct API call | Well documented | Requires API key |
| Chrome Built-in | Summarizer API (Chrome 138+) | No API key needed | Limited availability |

**Claude API for Task Name Generation:**
```javascript
const response = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': API_KEY,
    'anthropic-version': '2023-06-01'
  },
  body: JSON.stringify({
    model: 'claude-3-haiku-20240307',
    max_tokens: 100,
    messages: [{
      role: 'user',
      content: `Generate a concise task title from: ${pageContent}`
    }]
  })
});
```

**Recommendation:** Use Claude Haiku for fast, cost-effective task name suggestions.

### Chrome Storage & Caching

**Best Practices:**

| Practice | Rationale |
|----------|-----------|
| Use `chrome.storage.local` | Available in service workers, async |
| Preload cache on startup | Service workers don't persist |
| Use `onChanged` listener | Sync cache across contexts |
| Store with timestamps | Enable cache invalidation |

**Cache Pattern:**
```javascript
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getCachedData(key, fetchFn) {
  const cached = await chrome.storage.local.get(key);
  if (cached[key] && Date.now() - cached[key].timestamp < CACHE_TTL) {
    return cached[key].data;
  }
  const fresh = await fetchFn();
  await chrome.storage.local.set({
    [key]: { data: fresh, timestamp: Date.now() }
  });
  return fresh;
}
```

### Prior Art

| Extension | Features | Source |
|-----------|----------|--------|
| Asana Official Example | QuickAdd popup, ALT+A shortcut, page title/URL auto-fill | [GitHub](https://github.com/Asana/Chrome-Extension-Example) |
| AsanaNG | Fork of official, additional features | [GitHub](https://github.com/amitg87/asana-chrome-plugin) |
| Official Asana Extension | Full-featured, context menu, email integration | [Chrome Store](https://chrome.google.com/webstore/detail/asana/khnpeclbnipcdacdkhejifenadikeghk) |

**Note:** Official example is archived (Jan 2024), uses MV2 and jQuery 1.7.1. Will need modernization.

### Pitfalls to Avoid

1. **Gmail URL instability** - User ID in URL depends on sign-in order
2. **Outlook DOM obfuscation** - DOM structure changes frequently, prefer URL parsing
3. **Token refresh** - Must handle manually with `launchWebAuthFlow`
4. **Service worker lifecycle** - Can't persist state, must reload from storage
5. **Rate limiting** - Asana returns 429 on excess requests, implement backoff
6. **Scope inheritance** - Asana `write` scope does NOT include `read`

## Codebase Analysis

### Existing Patterns

This is a new project. No existing codebase patterns to leverage.

### Dependencies

| Dependency | Purpose | Required |
|------------|---------|----------|
| asana (npm) | Asana JavaScript SDK v3 | Yes |
| gmail-js | Gmail DOM interaction | Recommended |
| jQuery | Required by gmail-js | If using gmail-js |

### Constraints

- **Manifest V3** - Must use service workers, not background pages
- **OAuth** - Can't use Asana SDK's built-in OAuth in browser context
- **Content Scripts** - Need separate scripts for Gmail, Outlook, generic pages
- **Storage Limits** - 10MB for `chrome.storage.local` without `unlimitedStorage`

## Quality Commands

| Type | Command | Source |
|------|---------|--------|
| Lint | Not found | - |
| TypeCheck | Not found | - |
| Unit Test | Not found | - |
| Integration Test | Not found | - |
| E2E Test | Not found | - |
| Test (all) | Not found | - |
| Build | Not found | - |

**Note:** New project, no build tooling configured yet. Will need to set up:
- TypeScript compilation
- ESLint for linting
- Vitest or Jest for testing
- esbuild or webpack for bundling

## Related Specs

No other specs found in project.

## Feasibility Assessment

| Aspect | Assessment | Notes |
|--------|------------|-------|
| Technical Viability | **High** | Well-documented APIs, existing examples |
| Effort Estimate | **M** (Medium) | ~2-3 weeks for full implementation |
| Risk Level | **Medium** | Email link extraction reliability varies |

**Key Risks:**
1. Gmail/Outlook DOM changes could break extraction
2. OAuth token management complexity
3. AI API costs and latency
4. Asana rate limiting under heavy use

## Recommendations for Requirements

1. **Use URL parsing as primary email link extraction** - More stable than DOM scraping
2. **Implement gmail.js as enhancement** - For richer email metadata if needed
3. **Use `chrome.identity.launchWebAuthFlow`** - Don't try to use Asana SDK OAuth directly
4. **Cache aggressively** - Projects, sections, tags change infrequently
5. **Make AI optional** - Allow manual task naming, AI as suggestion
6. **Implement both personal and business Outlook support** - Different URL patterns
7. **Use Claude Haiku for AI** - Fast and cost-effective
8. **Add fallback for non-email pages** - Just use current page URL
9. **Store last-used project/section** - Better UX for repeat usage
10. **Implement offline detection** - Graceful degradation when Asana unreachable

## Architecture Recommendations

```
/src
  /background
    service-worker.js     # Main background script
    oauth.js              # OAuth flow handling
    asana-api.js          # API wrapper with caching
  /content
    gmail.js              # Gmail-specific extraction
    outlook.js            # Outlook-specific extraction
    generic.js            # Generic page extraction
  /popup
    popup.html            # Main UI
    popup.js              # UI logic
    components/           # UI components
  /shared
    storage.js            # Storage utilities
    ai.js                 # AI task name generation
    constants.js          # Shared constants
manifest.json
```

## Open Questions

1. **AI API key management** - Should user provide their own key or use shared?
2. **Multi-workspace support** - How to handle users in multiple Asana workspaces?
3. **Offline mode** - Should we queue tasks for later submission?
4. **Keyboard shortcut conflicts** - What if ALT+A is already used?
5. **Gmail multi-account** - How to handle when user has multiple Gmail accounts?

## Sources

### Asana
- [Asana JavaScript SDK](https://developers.asana.com/docs/javascript)
- [Asana OAuth Documentation](https://developers.asana.com/docs/oauth)
- [Asana REST API Reference](https://developers.asana.com/reference/rest-api-reference)
- [Asana Create Task API](https://developers.asana.com/reference/createtask)

### Chrome Extension
- [Chrome Identity API](https://developer.chrome.com/docs/extensions/reference/api/identity)
- [Chrome Storage API](https://developer.chrome.com/docs/extensions/reference/api/storage)
- [Manifest V3 OAuth Tutorial](https://developer.chrome.com/docs/extensions/how-to/integrate/oauth)

### Email Extraction
- [gmail.js Library](https://github.com/KartikTalwar/gmail.js)
- [Gmail Permanent URLs](https://www.labnol.org/internet/gmail-emails-have-permanent-web-address/6811)
- [Outlook Deep Links](https://joshuachini.com/2024/11/09/get-deep-link-to-outlook-email/)

### Prior Art
- [Asana Chrome Extension Example](https://github.com/Asana/Chrome-Extension-Example)
- [AsanaNG Plugin](https://github.com/amitg87/asana-chrome-plugin)
