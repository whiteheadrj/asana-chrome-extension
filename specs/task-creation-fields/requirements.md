---
spec: task-creation-fields
phase: requirements
created: 2026-01-23
---

# Requirements: Task Creation Fields Enhancement

## Goal

Add assignee and due date fields to task creation with defaulting support, and enhance email task notes to include full sender metadata plus a search string for locating the original email in Gmail/Outlook.

## User Decisions

| Question | Answer |
|----------|--------|
| Primary users | Both developers and end users |
| Priority tradeoffs | Feature completeness over simplicity |
| Default assignee | "Me" (authenticated user) - can be cleared to unassigned |
| Due date format | Supports both date-only (`due_on`) and time-specific (`due_at`) |
| Date format in notes | Human-readable (e.g., "Jan 15, 2024") |
| Search string placement | In notes section, formatted for copy-paste |

## User Stories

### US-1: Set Task Assignee

**As a** user creating a task from the extension
**I want to** optionally assign the task to a workspace member
**So that** the task appears in the correct person's queue immediately

**Acceptance Criteria:**
- [ ] AC-1.1: Assignee dropdown shows all workspace members (name + email)
- [ ] AC-1.2: Dropdown defaults to "me" (authenticated user)
- [ ] AC-1.3: User can clear assignee to "Unassigned" option
- [ ] AC-1.4: Selected assignee persists across sessions via LastUsedSelections
- [ ] AC-1.5: Blank selection creates unassigned task in Asana
- [ ] AC-1.6: Users load when workspace changes

### US-2: Set Task Due Date

**As a** user creating a task
**I want to** optionally set a due date
**So that** the task appears in my calendar and due-date views

**Acceptance Criteria:**
- [ ] AC-2.1: Date picker input available in task creation form
- [ ] AC-2.2: Date field can be left blank (no due date)
- [ ] AC-2.3: Quick-pick buttons for "Today" and "Tomorrow"
- [ ] AC-2.4: Optional time picker for specific due time
- [ ] AC-2.5: Date-only uses `due_on` (YYYY-MM-DD), date+time uses `due_at` (ISO 8601)
- [ ] AC-2.6: Date picker shows calendar UI for selection

### US-3: Enhanced Email Metadata in Notes

**As a** user creating a task from an email
**I want** full sender details and email metadata in the task notes
**So that** I have context when returning to the task later

**Acceptance Criteria:**
- [ ] AC-3.1: Notes include sender name (if available)
- [ ] AC-3.2: Notes include sender email address
- [ ] AC-3.3: Notes include date received (human-readable format)
- [ ] AC-3.4: Notes include email subject
- [ ] AC-3.5: Notes include receiving account email (Gmail only currently)
- [ ] AC-3.6: Metadata only added for email content type (not web pages)

### US-4: Email Search String in Notes

**As a** user with a task created from email
**I want** a search string I can paste into Gmail/Outlook
**So that** I can quickly find the original email

**Acceptance Criteria:**
- [ ] AC-4.1: Gmail tasks include Gmail search syntax string
- [ ] AC-4.2: Outlook tasks include Outlook search syntax string
- [ ] AC-4.3: Search string uses: sender email, subject, date
- [ ] AC-4.4: Search string formatted as copyable text
- [ ] AC-4.5: Gmail format: `from:email subject:"text" after:YYYY/MM/DD before:YYYY/MM/DD`
- [ ] AC-4.6: Outlook format: `from:"email" subject:"text" received:M/D/YYYY`

## Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-1 | Add `getUsers(workspaceGid)` API function | P0 | Returns array of `{gid, name, email}` |
| FR-2 | Add `AsanaUser` type to shared types | P0 | Type exported, includes gid/name/email |
| FR-3 | Extend `CreateTaskPayload` with `assignee` field | P0 | Optional string field for user GID |
| FR-4 | Extend `CreateTaskPayload` with `due_on` field | P0 | Optional string field (YYYY-MM-DD) |
| FR-4b | Extend `CreateTaskPayload` with `due_at` field | P0 | Optional ISO 8601 datetime string |
| FR-5 | Add assignee dropdown to popup UI | P0 | Select element with workspace users, defaults to "me" |
| FR-6 | Add date input to popup UI | P0 | Date picker with optional time input |
| FR-6b | Add quick-pick buttons ("Today", "Tomorrow") | P0 | Buttons set date picker value |
| FR-7 | Add `getEmailDate()` to Gmail content script | P0 | Returns ISO date string or undefined |
| FR-8 | Add `getEmailDate()` to Outlook content script | P0 | Returns ISO date string or undefined |
| FR-9 | Separate sender name and email in Gmail extraction | P0 | Return `{name, email}` object |
| FR-10 | Separate sender name and email in Outlook extraction | P0 | Return `{name, email}` object |
| FR-11 | Extend `LastUsedSelections` with `assigneeGid` | P1 | Optional field, same defaulting pattern |
| FR-11b | Get authenticated user GID for "me" default | P0 | Use existing user info or `/users/me` endpoint |
| FR-12 | Add user caching (same pattern as projects/tags) | P1 | 5-minute TTL cache |
| FR-13 | Build Gmail search string from metadata | P0 | Function returns formatted string |
| FR-14 | Build Outlook search string from metadata | P0 | Function returns formatted string |
| FR-15 | Enhance note generation for email tasks | P0 | Include all metadata fields |
| FR-16 | Add `GET_USERS` message type | P0 | ExtensionMessage union updated |

## Non-Functional Requirements

| ID | Requirement | Metric | Target |
|----|-------------|--------|--------|
| NFR-1 | Users API response time | Load time | < 1s for workspaces with < 500 users |
| NFR-2 | User dropdown usability | Search/filter | Must support type-to-filter for large workspaces |
| NFR-3 | Date extraction reliability | Success rate | > 80% for standard Gmail/Outlook layouts |
| NFR-4 | Code coverage | Test coverage | > 80% for new functions |
| NFR-5 | Backward compatibility | Existing tasks | No changes to existing task creation behavior |

## Glossary

- **GID**: Global identifier - Asana's unique ID format for entities
- **due_on**: Asana's date-only field (YYYY-MM-DD, no time component)
- **due_at**: Asana's datetime field with time (ISO 8601 UTC format)
- **LastUsedSelections**: Storage pattern for persisting user's dropdown choices
- **Content script**: Chrome extension code that runs in the context of web pages

## Out of Scope

- Multi-assignee support
- Due date defaulting/persistence across sessions
- Account email extraction for Outlook (Gmail only)
- Reading pane/conversation view detection for email date
- "+1 week" or other relative date buttons beyond Today/Tomorrow

## Dependencies

- Asana `GET /workspaces/{workspace_gid}/users` endpoint (documented, available)
- Gmail DOM structure for date extraction (may vary, needs resilient selectors)
- Outlook DOM structure for date extraction (may vary, needs resilient selectors)

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Gmail DOM changes break date extraction | Medium | Medium | Multiple selector fallbacks, graceful degradation |
| Outlook DOM changes break date extraction | Medium | Medium | Multiple selector fallbacks, graceful degradation |
| Large workspace (1000+ users) performance | Low | Medium | Implement user search/filter in dropdown |

## Success Criteria

- Users can create tasks with assignee and due date (with optional time) via popup
- Assignee defaults to "me" and selection persists across sessions
- Quick-pick "Today" and "Tomorrow" buttons work correctly
- Email tasks include full metadata (sender name, email, date, subject, account)
- Gmail tasks include working Gmail search string
- Outlook tasks include working Outlook search string
- All existing tests pass
- New code has > 80% test coverage

## Unresolved Questions

1. **Gmail date selector stability**: Which DOM selector is most reliable for date extraction? Needs implementation testing.
2. **Outlook date selector stability**: Same concern for Outlook - selectors may vary by variant (personal/business/office365).
3. **Large workspace UX**: Should we implement pagination or search for workspaces with 500+ users, or defer to P2?

## Next Steps

1. Approve requirements
2. Generate technical design (`/design`)
3. Create implementation tasks (`/tasks`)
