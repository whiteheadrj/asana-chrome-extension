---
spec: task-creation-fields
phase: research
created: 2026-01-23
---

# Research: task-creation-fields

## Executive Summary

Adding assignee and due date fields to task creation is fully supported by Asana API. Gmail/Outlook search strings are straightforward to generate from extracted email metadata. The main work involves extending the popup UI, types, and API integration. Email date extraction is NOT currently implemented and will need DOM scraping or parsing.

## External Research

### Asana API: Assignee Field

| Aspect | Details | Source |
|--------|---------|--------|
| Field Name | `assignee` | [Asana Tasks API](https://developers.asana.com/reference/tasks) |
| Format | User GID string (e.g., `"123456"`) | [Asana Forum](https://forum.asana.com/t/create-a-task-via-api/159563) |
| Optional | Yes - null/omit for unassigned | Asana API docs |
| Endpoint | `GET /workspaces/{workspace_gid}/users` | [Asana Users API](https://developers.asana.com/reference/getusersforworkspace) |
| User Fields | `gid`, `name`, `email` (via opt_fields) | Asana API docs |

### Asana API: Due Date Fields

| Field | Format | Use Case | Source |
|-------|--------|----------|--------|
| `due_on` | `YYYY-MM-DD` | Date only (e.g., `"2024-05-27"`) | [Dates and Times](https://developers.asana.com/docs/dates-and-times) |
| `due_at` | ISO 8601 UTC (`YYYY-MM-DDTHH:mm:ssZ`) | Specific time (e.g., `"2024-05-27T10:30:00Z"`) | [Dates and Times](https://developers.asana.com/docs/dates-and-times) |

**Key insight**: `due_on` is simpler and sufficient for most use cases. `due_at` only needed if user wants time-specific deadlines.

### Gmail Search Syntax

| Operator | Syntax | Example | Source |
|----------|--------|---------|--------|
| From | `from:` | `from:john@example.com` | [Gmail Help](https://support.google.com/mail/answer/7190) |
| Subject | `subject:` | `subject:"quarterly report"` | Gmail Help |
| Date After | `after:YYYY/MM/DD` | `after:2024/01/15` | [Hiver](https://hiverhq.com/blog/top-gmail-search-operators) |
| Date Before | `before:YYYY/MM/DD` | `before:2024/01/16` | Hiver |
| Relative | `newer_than:Xd` | `newer_than:7d` | Gmail Help |

**Recommended search string format:**
```
from:sender@example.com subject:"Email Subject" after:2024/01/15 before:2024/01/16
```

### Outlook Search Syntax

| Operator | Syntax | Example | Source |
|----------|--------|---------|--------|
| From | `from:"name"` or `from:email` | `from:"John Smith"` | [Microsoft Support](https://support.microsoft.com/en-us/office/how-to-search-in-outlook-d824d1e9-a255-4c8a-8553-276fb895a8da) |
| Subject | `subject:"term"` | `subject:"quarterly report"` | Microsoft Support |
| Date Received | `received:date` | `received:1/15/2024` | Microsoft Support |
| Relative Date | `received:"this week"` | `received:"last month"` | Microsoft Support |

**Recommended search string format:**
```
from:"sender@example.com" subject:"Email Subject" received:1/15/2024
```

## Codebase Analysis

### Current Task Creation Flow

**Types** (`src/shared/types.ts`):
```typescript
export interface CreateTaskPayload {
  name: string;
  notes?: string;
  projectGid: string;
  sectionGid?: string;
  tagGids?: string[];
  workspaceGid: string;
  // MISSING: assignee, due_on
}
```

**API** (`src/background/asana-api.ts`):
- `createTask()` builds request body from payload
- Does NOT include `assignee` or `due_on` fields currently
- Would need simple extension to pass these through

**Popup State** (`src/popup/popup.ts`):
```typescript
interface PopupLocalState {
  // Current fields for email extraction:
  emailSubject?: string;
  accountEmail?: string;  // Gmail only
  emailBody?: string;
  emailSender?: string;
  // MISSING: emailDate (date received)
}
```

### Current Email Metadata Extraction

**Gmail Content Script** (`src/content/gmail-content.ts`):
| Field | Extracted | Location |
|-------|-----------|----------|
| Subject | Yes | `getEmailSubject()` |
| Sender Name | Yes | `getEmailSender()` (via span.gD) |
| Sender Email | Yes | `getEmailSender()` (via [email] attr) |
| Account Email | Yes | `detectAccountEmail()` |
| Email Body | Yes | `getEmailBody()` |
| Date Received | **NO** | Not implemented |

**Outlook Content Script** (`src/content/outlook-content.ts`):
| Field | Extracted | Location |
|-------|-----------|----------|
| Subject | Yes | `getEmailSubject()` |
| Sender Info | Yes | `getSenderInfo()` (name or email) |
| Email Body | Yes | `getEmailBody()` |
| Date Received | **NO** | Not implemented |
| Account Email | **NO** | Not implemented |

### Current Defaulting Logic

From `src/popup/popup.ts`:
```typescript
// loadWorkspaces() -> loadProjects() -> loadSections()
const lastUsed = await get<LastUsedSelections>(STORAGE_KEYS.LAST_USED_SELECTIONS);
if (lastUsed?.workspaceGid) { ... }
```

**LastUsedSelections** (`src/shared/types.ts`):
```typescript
export interface LastUsedSelections {
  workspaceGid: string;
  projectGid: string;
  sectionGid?: string;
  // MISSING: assigneeGid, defaultDueDate
}
```

### Current Note Generation

From `src/popup/popup.ts` lines 877-889:
```typescript
if (notes || url || state.accountEmail) {
  const noteParts: string[] = [];
  if (notes) noteParts.push(notes);
  if (url) noteParts.push(`Source: ${url}`);
  if (state.accountEmail) {
    noteParts.push(`Email account: ${state.accountEmail}`);
  }
  payload.notes = noteParts.join('\n\n');
}
```

**Enhancement needed for email tasks:**
- Add sender name
- Add sender email
- Add date received
- Add email subject
- Add search string for Gmail/Outlook

## Feasibility Assessment

| Requirement | Feasibility | Effort | Notes |
|-------------|-------------|--------|-------|
| Assignee field (optional) | High | S | API supports it, need users endpoint + UI dropdown |
| Assignee defaulting | High | S | Extend LastUsedSelections, same pattern as section |
| Due date field (optional) | High | S | HTML date input, format to YYYY-MM-DD |
| Due date blank option | High | XS | Input is optional, empty = no due date |
| Email sender in notes | High | XS | Already extracted, add to noteParts |
| Email date in notes | Medium | M | **Not currently extracted** - need DOM scraping |
| Gmail search string | High | S | Build from sender + subject + date |
| Outlook search string | High | S | Build from sender + subject + date |

### Key Implementation Gaps

1. **Email Date Extraction**: Neither Gmail nor Outlook content scripts extract the email received date
   - Gmail: Look for date in email header DOM (`.gH .gK .g3` or similar)
   - Outlook: Look for date in email header DOM

2. **Sender Email vs Name**: Currently `emailSender` returns name OR email
   - Need both separately for proper email client search strings
   - Gmail: name from textContent, email from [email] attribute
   - Outlook: parse from `Name<email@domain.com>` format

3. **Users Endpoint**: Need new API function `getUsers(workspaceGid)` and caching

## Related Specs

| Spec | Relationship | mayNeedUpdate |
|------|--------------|---------------|
| ai-title | Low - shares email metadata types | false |
| refresh-token | Low - unrelated OAuth concerns | false |
| asana-chrome-extension | Medium - base implementation | false |

## Recommendations for Requirements

1. **Use `due_on` not `due_at`**: Date-only is simpler, matches typical task workflows
2. **Assignee as dropdown**: Fetch users from workspace, cache like projects/tags
3. **Email date extraction**: Add `getEmailDate()` to both content scripts
4. **Separate sender name/email**: Modify extraction to return both fields
5. **Conditional search string**: Only show when source is email (contentType === 'email')
6. **Format consistency**: Gmail uses `YYYY/MM/DD`, Outlook uses `M/D/YYYY`

## Quality Commands

| Type | Command | Source |
|------|---------|--------|
| Lint | `pnpm lint` | package.json scripts.lint |
| TypeCheck | `pnpm check-types` | package.json scripts.check-types |
| Test | `pnpm test` | package.json scripts.test |
| E2E | `pnpm test:e2e` | package.json scripts.test:e2e |
| Build | `pnpm build` | package.json scripts.build |

**Local CI**: `pnpm lint && pnpm check-types && pnpm test && pnpm build`

## Open Questions

1. **Default assignee behavior**: Should it default to "me" (authenticated user) or blank?
2. **Due date relative options**: Just date picker, or also "Today", "Tomorrow", "+1 week" quick buttons?
3. **Email date format**: Should notes show human-readable date or ISO format?
4. **Search string placement**: In notes section, or separate copyable field in success view?

## Sources

- [Asana Tasks API](https://developers.asana.com/reference/tasks)
- [Asana Dates and Times](https://developers.asana.com/docs/dates-and-times)
- [Asana Users API](https://developers.asana.com/reference/getusersforworkspace)
- [Gmail Search Operators](https://support.google.com/mail/answer/7190)
- [Gmail Search Guide - Hiver](https://hiverhq.com/blog/top-gmail-search-operators)
- [Outlook Search Syntax](https://support.microsoft.com/en-us/office/how-to-search-in-outlook-d824d1e9-a255-4c8a-8553-276fb895a8da)
