---
spec: links
phase: tasks
total_tasks: 21
created: 2026-01-26
---

# Tasks: Task History with Tabbed UI

## Phase 1: Make It Work (POC)

Focus: Validate tabbed UI + history persistence end-to-end. Skip tests, accept minimal styling.

- [x] 1.1 Add TaskHistoryEntry type
  - **Do**: Add interface to types.ts after existing AsanaTask type
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/shared/types.ts`
  - **Done when**: `TaskHistoryEntry` interface exists with `gid`, `name`, `permalink_url`, `createdAt` (number)
  - **Verify**: `pnpm check-types`
  - **Commit**: `feat(types): add TaskHistoryEntry interface`
  - _Requirements: FR-4, AC-4.2_
  - _Design: Data Model_

- [x] 1.2 Add TASK_HISTORY storage key
  - **Do**: Add `TASK_HISTORY = 'task_history'` to STORAGE_KEYS enum
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/shared/constants.ts`
  - **Done when**: TASK_HISTORY enum member exists
  - **Verify**: `pnpm check-types`
  - **Commit**: `feat(constants): add TASK_HISTORY storage key`
  - _Requirements: FR-3_
  - _Design: STORAGE_KEYS Addition_

- [x] 1.3 Create history.ts module with storage functions
  - **Do**:
    1. Create new file `/Users/rjwhitehead/asana-plugin/src/popup/history.ts`
    2. Import `TaskHistoryEntry` from types, `STORAGE_KEYS` from constants, `get`/`set` from storage
    3. Implement `loadHistory()`: returns `Promise<TaskHistoryEntry[]>`, reads from storage, defaults to empty array
    4. Implement `saveToHistory(task)`: prepends to array, caps at 50 entries (LIFO), saves to storage
    5. Export both functions
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/popup/history.ts`
  - **Done when**: Module exports `loadHistory` and `saveToHistory`
  - **Verify**: `pnpm check-types`
  - **Commit**: `feat(history): add history storage functions`
  - _Requirements: FR-2, FR-3, FR-5, AC-4.1, AC-4.3, AC-4.4, AC-4.5_
  - _Design: history.ts Module_

- [x] 1.4 [VERIFY] Quality checkpoint
  - **Do**: Run lint and type check
  - **Verify**: `pnpm lint && pnpm check-types`
  - **Done when**: No lint errors, no type errors
  - **Commit**: `chore(history): pass quality checkpoint` (only if fixes needed)

- [x] 1.5 Add formatRelativeTime to history.ts
  - **Do**:
    1. Add `formatRelativeTime(timestamp: number): string` function
    2. Return "Just now" for < 1 minute
    3. Return "Xm ago" for < 60 minutes
    4. Return "Xh ago" for < 24 hours
    5. Return "Yesterday" for 1 day ago
    6. Return "Mon DD" format for older dates
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/popup/history.ts`
  - **Done when**: Function handles all time cases
  - **Verify**: `pnpm check-types`
  - **Commit**: `feat(history): add relative time formatting`
  - _Requirements: FR-8, AC-2.1_
  - _Design: Interface Definitions_

- [x] 1.6 Add renderHistoryList to history.ts
  - **Do**:
    1. Add `renderHistoryList(container: HTMLElement, entries: TaskHistoryEntry[]): void`
    2. Clear container innerHTML
    3. If entries empty, show empty state div with "No tasks created yet" message
    4. Otherwise create `<ul class="history-list">` with `<li class="history-item">` per entry
    5. Each li has: `data-url` attribute, span.history-name (textContent = name), span.history-time (relative time)
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/popup/history.ts`
  - **Done when**: Function renders list or empty state
  - **Verify**: `pnpm check-types`
  - **Commit**: `feat(history): add history list rendering`
  - _Requirements: FR-2, FR-7, AC-2.1, AC-2.2, AC-2.4_
  - _Design: History List, Empty State_

- [x] 1.7 Add tab bar and history panel to popup.html
  - **Do**:
    1. After `</header>`, add tab bar nav with role="tablist"
    2. Two buttons: "Create Task" (data-tab="create", active) and "History" (data-tab="history")
    3. Include aria-selected, aria-controls attributes
    4. Wrap auth-section through task-form in `<div id="panel-create" class="tab-panel" role="tabpanel">`
    5. Add `<div id="panel-history" class="tab-panel hidden" role="tabpanel">` after panel-create
    6. Inside panel-history: `<div id="history-container"></div>`
    7. Move success-section outside both panels (keep after panel-history)
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/popup/popup.html`
  - **Done when**: Tab bar and both panels exist in HTML
  - **Verify**: `pnpm build && ls -la dist/popup/popup.html`
  - **Commit**: `feat(popup): add tab bar and history panel HTML`
  - _Requirements: FR-1, AC-1.1, AC-1.4_
  - _Design: HTML Structure Changes_

- [x] 1.8 [VERIFY] Quality checkpoint
  - **Do**: Run lint and type check
  - **Verify**: `pnpm lint && pnpm check-types`
  - **Done when**: No lint errors, no type errors
  - **Commit**: `chore(popup): pass quality checkpoint` (only if fixes needed)

- [x] 1.9 Add tab and history CSS styles
  - **Do**:
    1. Add `.tab-bar` (flex, border-bottom)
    2. Add `.tab-button` (flex:1, padding, transparent bg, border-bottom:2px transparent)
    3. Add `.tab-button.active` (color primary, border-bottom primary)
    4. Add `.tab-button:hover` (color text)
    5. Add `.tab-panel` (no special styles needed, uses .hidden)
    6. Add `.history-list` (list-style:none, max-height:400px, overflow-y:auto)
    7. Add `.history-item` (flex, justify-between, padding, cursor:pointer)
    8. Add `.history-item:hover` (background-hover)
    9. Add `.history-name` (flex:1, truncate with ellipsis, color primary)
    10. Add `.history-time` (flex-shrink:0, muted color, xs font)
    11. Add `.history-empty` (text-align center, padding xl, muted)
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/popup/popup.css`
  - **Done when**: All tab and history styles added using CSS variables
  - **Verify**: `pnpm build`
  - **Commit**: `feat(popup): add tab and history CSS styles`
  - _Requirements: AC-1.4, AC-1.5, NFR-4_
  - _Design: CSS Additions_

- [x] 1.10 Add tab switching logic to popup.ts
  - **Do**:
    1. Import `loadHistory`, `renderHistoryList` from `./history`
    2. Add DOM elements: tabButtons, panelCreate, panelHistory, historyContainer
    3. Add state: `activeTab: 'create' | 'history'`, `historyLoaded: boolean`
    4. Add `switchTab(tab)` function: toggle .active on buttons, toggle .hidden on panels
    5. Add click listener on tab bar (event delegation): call switchTab
    6. On History tab first switch: call loadHistory, renderHistoryList, set historyLoaded=true
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/popup/popup.ts`
  - **Done when**: Clicking tabs switches visible panels, history loads lazily
  - **Verify**: `pnpm build`
  - **Commit**: `feat(popup): add tab switching logic`
  - _Requirements: FR-1, FR-2, AC-1.2, AC-1.3_
  - _Design: Tab Switching_

- [x] 1.11 [VERIFY] Quality checkpoint
  - **Do**: Run lint and type check
  - **Verify**: `pnpm lint && pnpm check-types`
  - **Done when**: No lint errors, no type errors
  - **Commit**: `chore(popup): pass quality checkpoint` (only if fixes needed)

- [x] 1.12 Integrate history save into task creation success
  - **Do**:
    1. In popup.ts task creation success handler (after saveLastUsedSelections)
    2. Import `saveToHistory` from `./history`
    3. Call `await saveToHistory({ gid: response.data.gid, name: response.data.name, permalink_url: response.data.permalink_url })`
    4. Reset historyLoaded to false so next History tab visit reloads
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/popup/popup.ts`
  - **Done when**: Task creation saves entry to history storage
  - **Verify**: `pnpm build`
  - **Commit**: `feat(popup): save task to history on creation`
  - _Requirements: FR-3, AC-4.1, AC-4.2_
  - _Design: Data Flow_

- [x] 1.13 Add history item click handler
  - **Do**:
    1. In popup.ts, add click listener to historyContainer (event delegation)
    2. Check if click target is within .history-item
    3. Get data-url from closest .history-item
    4. Call `chrome.tabs.create({ url })`
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/popup/popup.ts`
  - **Done when**: Clicking history item opens Asana URL in new tab
  - **Verify**: `pnpm build`
  - **Commit**: `feat(popup): add history item click handler`
  - _Requirements: FR-6, AC-3.1, AC-3.2, AC-3.3_
  - _Design: History List_

- [x] 1.14 POC Checkpoint: End-to-end validation
  - **Do**:
    1. Build extension: `pnpm build`
    2. Load extension in Chrome manually
    3. Create a task (requires auth - manual step)
    4. Switch to History tab, verify task appears
    5. Click task, verify Asana opens in new tab
    6. Close/reopen popup, verify history persists
  - **Done when**: Full flow works: create task, view in history, click opens Asana
  - **Verify**: `pnpm build && echo "Manual E2E validation required - load extension, create task, check history"`
  - **Commit**: `feat(links): complete POC - tabbed UI with history`
  - _Requirements: US-1, US-2, US-3, US-4_

## Phase 2: Refactoring

After POC validated, clean up code structure.

- [x] 2.1 Extract tab constants and improve type safety
  - **Do**:
    1. Add TabName type: `'create' | 'history'`
    2. Add TAB_IDS constant object with panel IDs
    3. Update switchTab to use constants
    4. Ensure all tab-related code uses typed values
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/popup/popup.ts`
  - **Done when**: Tab logic uses constants and explicit types
  - **Verify**: `pnpm check-types`
  - **Commit**: `refactor(popup): extract tab constants and improve types`
  - _Design: Technical Decisions_

- [x] 2.2 Add error handling to history operations
  - **Do**:
    1. In loadHistory: wrap in try/catch, log error, return empty array on failure
    2. In saveToHistory: wrap in try/catch, log error, don't block task creation
    3. In renderHistoryList: handle invalid entries gracefully
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/popup/history.ts`
  - **Done when**: All history functions handle errors without crashing
  - **Verify**: `pnpm check-types`
  - **Commit**: `refactor(history): add error handling`
  - _Design: Error Handling_

- [x] 2.3 [VERIFY] Quality checkpoint
  - **Do**: Run lint, type check, and existing tests
  - **Verify**: `pnpm lint && pnpm check-types && pnpm test`
  - **Done when**: All commands pass
  - **Commit**: `chore(links): pass quality checkpoint` (only if fixes needed)

## Phase 3: Testing

- [ ] 3.1 Unit tests for history.ts functions
  - **Do**:
    1. Create `/Users/rjwhitehead/asana-plugin/src/popup/__tests__/history.test.ts`
    2. Mock chrome.storage.local
    3. Test loadHistory: empty storage, with data, invalid data
    4. Test saveToHistory: first entry, under cap, at cap (51st removes oldest)
    5. Test formatRelativeTime: just now, minutes, hours, yesterday, older
    6. Use vitest, follow existing test patterns from ai.test.ts
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/popup/__tests__/history.test.ts`
  - **Done when**: All history functions have test coverage
  - **Verify**: `pnpm test`
  - **Commit**: `test(history): add unit tests for history module`
  - _Requirements: AC-2.1, AC-4.5_
  - _Design: Test Strategy_

- [ ] 3.2 E2E test for tab switching and history display
  - **Do**:
    1. Create `/Users/rjwhitehead/asana-plugin/e2e/task-history.e2e.test.ts`
    2. Follow pattern from task-creation-fields.e2e.test.ts
    3. Test: extension loads, popup has tab bar, both tabs visible
    4. Test: clicking History tab shows history panel, Create tab shows form
    5. Test: built extension includes history.js module
    6. Test: popup.html contains tab-bar, panel-create, panel-history elements
  - **Files**: `/Users/rjwhitehead/asana-plugin/e2e/task-history.e2e.test.ts`
  - **Done when**: E2E tests verify tab UI and history panel exist in built extension
  - **Verify**: `pnpm test:e2e`
  - **Commit**: `test(e2e): add task history E2E tests`
  - _Requirements: US-1, US-2_
  - _Design: Test Strategy_

- [ ] 3.3 [VERIFY] Quality checkpoint
  - **Do**: Run full test suite
  - **Verify**: `pnpm lint && pnpm check-types && pnpm test && pnpm test:e2e`
  - **Done when**: All tests pass
  - **Commit**: `chore(links): pass test quality checkpoint` (only if fixes needed)

## Phase 4: Quality Gates

- [ ] 4.1 [VERIFY] Full local CI
  - **Do**: Run complete local CI suite
  - **Verify**: `pnpm lint && pnpm check-types && pnpm test && pnpm test:e2e && pnpm build`
  - **Done when**: Build succeeds, all tests pass
  - **Commit**: `chore(links): pass local CI` (if fixes needed)

- [ ] 4.2 [VERIFY] CI pipeline passes
  - **Do**:
    1. Create feature branch if not exists: `git checkout -b feat/task-history-links`
    2. Stage and commit all changes
    3. Push: `git push -u origin feat/task-history-links`
    4. Create PR: `gh pr create --title "feat(links): add tabbed UI with task history" --body "..."`
    5. Wait for CI: `gh pr checks --watch`
  - **Verify**: `gh pr checks` shows all green
  - **Done when**: CI pipeline passes
  - **Commit**: None (PR already created)

- [ ] 4.3 [VERIFY] AC checklist
  - **Do**: Programmatically verify each acceptance criteria
  - **Verify**:
    - AC-1.1: `grep -q 'tab-button.*Create Task' dist/popup/popup.html && grep -q 'tab-button.*History' dist/popup/popup.html`
    - AC-1.2: `grep -q 'tab-button active.*data-tab="create"' dist/popup/popup.html`
    - AC-1.3: Verified by E2E test (tab switching without reload)
    - AC-1.4: `grep -q '.tab-button.active' dist/popup/popup.css`
    - AC-2.1: `grep -q 'history-name.*history-time' dist/popup/popup.js || grep -q 'formatRelativeTime' dist/popup/popup.js`
    - AC-2.2: Verified by unit test (saveToHistory prepends)
    - AC-2.3: `grep -q 'data-url' dist/popup/popup.js`
    - AC-2.4: `grep -q 'No tasks created yet' dist/popup/popup.js`
    - AC-3.1, AC-3.3: `grep -q 'chrome.tabs.create' dist/popup/popup.js`
    - AC-4.1, AC-4.2: `grep -q 'saveToHistory' dist/popup/popup.js`
    - AC-4.3, AC-4.4: Verified by storage.local usage
    - AC-4.5: `grep -q '50' dist/popup/popup.js || grep -q 'slice' dist/popup/popup.js` (cap enforcement)
  - **Done when**: All AC verified
  - **Commit**: None

## Notes

- **POC shortcuts taken**:
  - Minimal CSS polish - styling is functional but may need visual refinement
  - No keyboard navigation for tabs (P1 stretch - can add arrows/Enter later)
  - Tab persistence between opens skipped (P1)
  - Clear history button skipped (P1)

- **Production TODOs for future iterations**:
  - Add keyboard navigation (arrow keys between tabs, Enter to select history item)
  - Tab selection persistence via STORAGE_KEYS.LAST_ACTIVE_TAB
  - "Clear History" button with confirmation dialog
  - Individual history entry deletion
  - Visual polish: hover effects, focus states, animations
