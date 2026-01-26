---
spec: links
phase: requirements
created: 2026-01-26
---

# Requirements: Task History with Tabbed UI

## Goal

Add a tabbed interface to the popup with "Create Task" (default) and "History" tabs. History shows recently created tasks with clickable links to Asana.

## User Decisions

| Question | Answer |
|----------|--------|
| Primary users | Both developers and end users |
| Priority tradeoff | Speed of delivery - ship quickly, iterate later |

## User Stories

### US-1: View Popup with Tabs

**As a** user
**I want to** see tabs at the top of the popup
**So that** I can switch between creating tasks and viewing history

**Acceptance Criteria:**
- [ ] AC-1.1: Two tabs visible: "Create Task" and "History"
- [ ] AC-1.2: "Create Task" tab selected by default on popup open
- [ ] AC-1.3: Clicking a tab switches content without page reload
- [ ] AC-1.4: Active tab has visual indicator (underline/highlight)
- [ ] AC-1.5: Tabs fit within 380px popup width

### US-2: View Task History

**As a** user
**I want to** see a list of tasks I've created
**So that** I can quickly access them in Asana

**Acceptance Criteria:**
- [ ] AC-2.1: History displays task name and relative time ("2h ago")
- [ ] AC-2.2: Most recent tasks appear first (reverse chronological)
- [ ] AC-2.3: Each entry is clickable
- [ ] AC-2.4: Empty state message when no history exists

### US-3: Open Task from History

**As a** user
**I want to** click a task in history
**So that** it opens in Asana in a new browser tab

**Acceptance Criteria:**
- [ ] AC-3.1: Clicking task opens `permalink_url` in new tab
- [ ] AC-3.2: Popup remains open after click
- [ ] AC-3.3: Link opens via `chrome.tabs.create` (not target="_blank")

### US-4: Automatic History Persistence

**As a** user
**I want to** have tasks automatically saved to history on creation
**So that** I don't need to manually track them

**Acceptance Criteria:**
- [ ] AC-4.1: Task saved to history after successful creation
- [ ] AC-4.2: Stored data: `gid`, `name`, `permalink_url`, `createdAt`
- [ ] AC-4.3: History persists across popup close/reopen
- [ ] AC-4.4: History persists across browser restart
- [ ] AC-4.5: History capped at 50 entries (oldest removed first)

### US-5: Clear All History (P1 - Stretch)

**As a** user
**I want to** clear my task history
**So that** I can start fresh or protect privacy

**Acceptance Criteria:**
- [ ] AC-5.1: "Clear History" button visible in History tab
- [ ] AC-5.2: Confirmation prompt before clearing
- [ ] AC-5.3: All history entries removed on confirm

## Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-1 | Tab UI with two tabs ("Create Task", "History") | P0 | Tabs switch content; active state visible |
| FR-2 | History list renders from `chrome.storage.local` | P0 | List displays on History tab selection |
| FR-3 | Task saved to history after successful creation | P0 | `TASK_HISTORY` key populated in storage |
| FR-4 | History entries store `{gid, name, permalink_url, createdAt}` | P0 | All four fields present per entry |
| FR-5 | History capped at 50 entries (LIFO) | P0 | 51st entry removes oldest |
| FR-6 | Click history entry opens Asana in new tab | P0 | `chrome.tabs.create` with permalink_url |
| FR-7 | Empty state shown when history is empty | P0 | Message displayed, no broken UI |
| FR-8 | Relative time display ("2h ago", "Yesterday") | P0 | Human-readable timestamps |
| FR-9 | Clear all history button | P1 | Button removes all entries after confirm |
| FR-10 | Tab selection persists between popup opens | P1 | Last active tab restored |

## Non-Functional Requirements

| ID | Requirement | Metric | Target |
|----|-------------|--------|--------|
| NFR-1 | History loads fast | Time to render | < 100ms for 50 entries |
| NFR-2 | Storage efficiency | Data size | < 50KB for max history |
| NFR-3 | Accessibility | Tab navigation | Keyboard accessible (arrow keys, Enter) |
| NFR-4 | Visual consistency | Styling | Matches existing popup CSS variables |
| NFR-5 | No external dependencies | Build size | Zero new npm packages |

## Glossary

- **gid**: Asana global identifier for a task
- **permalink_url**: Full URL to task in Asana web app
- **LIFO**: Last In, First Out - newest entries kept, oldest removed
- **History entry**: Single record of a created task `{gid, name, permalink_url, createdAt}`

## Out of Scope

- Deleting individual history entries (iterate later)
- Searching/filtering history
- Syncing history across devices
- Showing project name in history entries
- Editing task names from history
- Undo task creation
- History pagination

## Dependencies

- Existing `chrome.storage.local` helpers in `src/shared/storage.ts`
- `STORAGE_KEYS` enum in `src/shared/constants.ts`
- Task creation response already returns `gid`, `name`, `permalink_url`
- Popup.ts success handler as integration point

## Success Criteria

- Users can create tasks via existing UI (no regression)
- Users can view and click through to recently created tasks
- History persists across sessions
- No increase in popup load time > 50ms

## Unresolved Questions

1. Should tab selection persist between popup opens? (Marked P1, can skip for MVP)
2. What happens to history on extension update? (Assumed: preserved by Chrome)

## Next Steps

1. User approves requirements
2. Generate technical design (design phase)
3. Generate implementation tasks (tasks phase)
