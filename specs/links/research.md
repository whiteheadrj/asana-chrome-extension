---
spec: links
phase: research
created: 2026-01-26
---

# Research: links

## Executive Summary

Implementing a tabbed UI with task history is highly feasible. The current codebase already receives `gid`, `name`, and `permalink_url` from task creation. Storage via `chrome.storage.local` is straightforward. Main work is UI (tabs + history list) and persistence layer.

## External Research

### Tabbed UI Best Practices for Chrome Extensions

| Approach | Pros | Cons |
|----------|------|------|
| Pure CSS tabs (radio buttons) | Zero JS, accessible | Limited state management |
| JS-managed tabs | Full control, easy state | Slight complexity |
| Native `<tab-container>` | Modern, semantic | Limited browser support |

**Recommendation**: Use simple JS-managed tabs with CSS transitions. Pattern matches existing codebase style.

**Sources**:
- [Chrome Extension Popup Tab Manager Tutorial](https://developer.chrome.com/docs/extensions/get-started/tutorial/popup-tabs-manager)
- [Chrome Extension Popup Development Best Practices](https://www.freecodecamp.org/news/how-to-implement-a-chrome-extension-3802d63b376)

### chrome.storage.local Best Practices

| Limit | Value |
|-------|-------|
| Default storage limit | 10 MB (5 MB in Chrome 113 and earlier) |
| Can be increased | Yes, with `unlimitedStorage` permission |
| Data format | JSON-serializable only (no Date, Set, Map) |
| Persistence | Survives browser restart, cleared on extension removal |

**Key considerations**:
- Store dates as ISO strings or timestamps
- No complex objects (classes) allowed
- History array should be bounded (e.g., max 100 entries)
- Use LIFO for recent-first display

**Sources**:
- [Chrome Storage API Reference](https://developer.chrome.com/docs/extensions/reference/api/storage)
- [State Storage Best Practices in Chrome Extensions](https://hackernoon.com/state-storage-in-chrome-extensions-options-limits-and-best-practices)

### Asana Task URL Format

| Format | Use Case |
|--------|----------|
| `https://app.asana.com/0/{projectId}/{taskId}` | Task in specific project |
| `https://app.asana.com/0/0/{taskId}` | Task in My Tasks |

**Key finding**: The API already returns `permalink_url` which is the canonical deep link. No URL construction needed.

**Sources**:
- [Asana Forum: Task URL Construction](https://forum.asana.com/t/how-can-i-construct-the-url-for-a-task-in-my-tasks/28862)
- Codebase: `src/background/asana-api.ts:376` - already requests `opt_fields: 'gid,name,permalink_url'`

## Codebase Analysis

### Current UI Structure (popup.html)

```
popup-container
  header (popup-header)
  auth-section
  loading-section
  error-message
  warnings-container
  task-form
  success-section
```

**Tab insertion point**: After `header`, wrap main content in tab panels.

**Current popup width**: `380px` (fixed in CSS)

### Task Creation Response

From `src/background/asana-api.ts`:

```typescript
const data = await asanaFetch<{ gid: string; name: string; permalink_url: string }>(
  '/tasks',
  {
    method: 'POST',
    body: JSON.stringify({ data: requestBody }),
    params: {
      opt_fields: 'gid,name,permalink_url',
    },
  }
);
```

**Key insight**: We already get all data needed for history:
- `gid`: Task identifier
- `name`: Task title (user-entered or AI-suggested)
- `permalink_url`: Direct link to task

### Existing Storage Patterns

From `src/shared/storage.ts`:
```typescript
export async function get<T>(key: string): Promise<T | null>
export async function set<T>(key: string, value: T): Promise<void>
export async function remove(key: string): Promise<void>
```

From `src/shared/constants.ts`:
```typescript
export enum STORAGE_KEYS {
  OAUTH_TOKENS = 'oauth_tokens',
  CLAUDE_API_KEY = 'claude_api_key',
  LAST_USED_SELECTIONS = 'last_used_selections',
  // ... more keys
}
```

**Pattern to follow**: Add `TASK_HISTORY = 'task_history'` to STORAGE_KEYS.

### Success Flow (popup.ts)

```typescript
if (response.success && response.data) {
  await saveLastUsedSelections();
  elements.taskLink.href = response.data.permalink_url;
  elements.taskLink.textContent = response.data.name;
  showSection('success');
}
```

**Integration point**: Add history save after `saveLastUsedSelections()`.

### Constraints

| Constraint | Impact |
|------------|--------|
| Popup closes on blur | History must persist, state survives reopen |
| 380px width | History list must be compact |
| No external deps | Use vanilla CSS/JS for tabs |
| Existing CSS vars | Maintain visual consistency |

## Feasibility Assessment

| Aspect | Assessment | Notes |
|--------|------------|-------|
| Technical Viability | High | All infrastructure exists |
| Effort Estimate | S-M | ~15-20 tasks |
| Risk Level | Low | No complex dependencies |

### Implementation Complexity Breakdown

| Component | Effort | Risk |
|-----------|--------|------|
| Tab UI HTML/CSS | Low | Straightforward CSS |
| Tab switching JS | Low | Simple state toggle |
| History data model | Low | Array of {gid, name, url, createdAt} |
| Storage layer | Low | Follows existing patterns |
| History list rendering | Low-Medium | Dynamic DOM + styling |
| Click handler for links | Low | `chrome.tabs.create` |
| History limit enforcement | Low | Array slice/splice |

## Related Specs

| Spec | Relevance | mayNeedUpdate |
|------|-----------|---------------|
| task-creation-fields | Medium - Same popup.ts, shared success flow | false |
| ai-title | Low - Unrelated feature area | false |
| asana-chrome-extension | Low - Base extension, established patterns | false |
| refresh-token | Low - Auth infrastructure | false |

## Recommendations for Requirements

1. **Tab structure**: Two tabs - "Create Task" (default), "History"
2. **History entry**: Store `{ gid, name, permalink_url, createdAt }` per task
3. **History limit**: Cap at 50-100 entries (LIFO), configurable
4. **Link behavior**: Open in new tab via `chrome.tabs.create`
5. **Empty state**: Show message when no history exists
6. **Clear history**: Optional button to clear all history
7. **Timestamp display**: Show relative time ("2 hours ago") or date

## Quality Commands

| Type | Command | Source |
|------|---------|--------|
| Lint | `pnpm lint` | package.json scripts.lint |
| TypeCheck | `pnpm check-types` | package.json scripts.check-types |
| Test (unit) | `pnpm test` | package.json scripts.test |
| Test (e2e) | `pnpm test:e2e` | package.json scripts.test:e2e |
| Build | `pnpm build` | package.json scripts.build |

**Local CI**: `pnpm lint && pnpm check-types && pnpm test && pnpm build`

## Open Questions

1. Should history persist across extension updates/reinstalls? (Default: no, per chrome.storage behavior)
2. Should history show project name alongside task name?
3. Should there be a "delete single entry" option?
4. Should the tab selection persist between popup opens?

## Sources

### External
- [Chrome Storage API Reference](https://developer.chrome.com/docs/extensions/reference/api/storage)
- [Chrome Extension Popup Best Practices](https://developer.chrome.com/docs/extensions/get-started/tutorial/popup-tabs-manager)
- [Asana Task URL Format](https://forum.asana.com/t/how-can-i-construct-the-url-for-a-task-in-my-tasks/28862)
- [State Storage in Chrome Extensions](https://hackernoon.com/state-storage-in-chrome-extensions-options-limits-and-best-practices)

### Internal Files
- `/Users/rjwhitehead/asana-plugin/src/popup/popup.html` - Current UI structure
- `/Users/rjwhitehead/asana-plugin/src/popup/popup.css` - Styling patterns
- `/Users/rjwhitehead/asana-plugin/src/popup/popup.ts` - Task creation flow (lines 1180-1200)
- `/Users/rjwhitehead/asana-plugin/src/shared/storage.ts` - Storage utilities
- `/Users/rjwhitehead/asana-plugin/src/shared/constants.ts` - Storage keys
- `/Users/rjwhitehead/asana-plugin/src/shared/types.ts` - Type definitions
- `/Users/rjwhitehead/asana-plugin/src/background/asana-api.ts` - Task creation returns permalink_url
