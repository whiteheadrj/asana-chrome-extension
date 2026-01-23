# Tasks: Task Creation Fields Enhancement

**Total Tasks**: 31 (Phase 1: 14, Phase 2: 6, Phase 3: 8, Phase 4: 3)

## Phase 1: Make It Work (POC)

Focus: Validate assignee/due date fields work E2E. Skip tests, accept hardcoded values.

### Types & API Layer

- [x] 1.1 Add AsanaUser type and extend CreateTaskPayload
  - **Do**:
    1. Add `AsanaUser` interface with `gid`, `name`, `email` fields
    2. Extend `CreateTaskPayload` with optional `assignee?: string`, `due_on?: string`, `due_at?: string`
    3. Add `GET_USERS` variant to `ExtensionMessage` union type
    4. Extend `LastUsedSelections` with optional `assigneeGid?: string`
    5. Extend `GmailEmailInfo` with optional `senderName?: string`, `senderEmail?: string`, `emailDate?: string`
    6. Extend `OutlookEmailInfo` with optional `senderName?: string`, `senderEmail?: string`, `emailDate?: string`
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/shared/types.ts`
  - **Done when**: Types compile without errors
  - **Verify**: `pnpm check-types`
  - **Commit**: `feat(types): add AsanaUser and extend CreateTaskPayload for assignee/due date`
  - _Requirements: FR-2, FR-3, FR-4, FR-4b, FR-11, FR-16_
  - _Design: AsanaUser Type & API, LastUsedSelections Extension_

- [x] 1.2 Implement getUsers and getCurrentUser API functions
  - **Do**:
    1. Add `getUsers(workspaceGid: string): Promise<AsanaUser[]>` function
    2. Add `getCurrentUser(): Promise<AsanaUser>` function using `/users/me` endpoint
    3. Follow existing `getProjects`/`getTags` pattern with `asanaFetch`
    4. Use `opt_fields: 'gid,name,email'` for both endpoints
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/background/asana-api.ts`
  - **Done when**: Functions export correctly and compile
  - **Verify**: `pnpm check-types`
  - **Commit**: `feat(api): add getUsers and getCurrentUser for workspace members`
  - _Requirements: FR-1, FR-11b_
  - _Design: Users API Function_

- [x] 1.3 Extend createTask to include assignee and due date fields
  - **Do**:
    1. In `createTask()`, add `assignee` to `requestBody` if `payload.assignee` is set
    2. Add `due_on` to `requestBody` if `payload.due_on` is set
    3. Add `due_at` to `requestBody` if `payload.due_at` is set (mutually exclusive with due_on)
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/background/asana-api.ts`
  - **Done when**: Request body includes new fields when provided
  - **Verify**: `pnpm check-types`
  - **Commit**: `feat(api): include assignee and due_on/due_at in task creation`
  - _Requirements: FR-3, FR-4, FR-4b_
  - _Design: Task Creation with Assignee/Due Date_

- [x] 1.4 [VERIFY] Quality checkpoint: types and API
  - **Do**: Run lint and type check
  - **Verify**: `pnpm lint && pnpm check-types`
  - **Done when**: All commands exit 0
  - **Commit**: `chore(api): pass quality checkpoint` (only if fixes needed)

- [x] 1.5 Add GET_USERS handler to service worker
  - **Do**:
    1. Import `getUsers` from `./asana-api`
    2. Import `AsanaUser` type
    3. Add `USERS` key to `CACHE_KEYS` object: `USERS: (workspaceGid: string) => \`cache_users_\${workspaceGid}\``
    4. Create `handleGetUsers` function following `handleGetProjects` pattern
    5. Add `GET_USERS` entry to `messageHandlers` registry
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/background/service-worker.ts`
  - **Done when**: Handler is registered and compiles
  - **Verify**: `pnpm check-types`
  - **Commit**: `feat(service-worker): add GET_USERS message handler with caching`
  - _Requirements: FR-12, FR-16_
  - _Design: Message handling pattern_

### Content Scripts - Email Metadata

- [x] 1.6 Add getSenderDetails and getEmailDate to Gmail content script
  - **Do**:
    1. Create `EmailSenderInfo` interface: `{ name?: string; email?: string }`
    2. Add `getSenderDetails(): EmailSenderInfo` function that extracts name from `span.gD` textContent and email from `[email]` attribute
    3. Add `getEmailDate(): string | undefined` function - look for date in `.gK .g3` or similar selectors, return ISO date string
    4. Update `getGmailEmailInfo()` to populate `senderName`, `senderEmail`, `emailDate` fields
    5. Keep backward compat: still populate `emailSender` from `getSenderDetails().name || getSenderDetails().email`
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/content/gmail-content.ts`
  - **Done when**: New fields appear in GmailEmailInfo
  - **Verify**: `pnpm check-types`
  - **Commit**: `feat(gmail): add getSenderDetails and getEmailDate extraction`
  - _Requirements: FR-7, FR-9_
  - _Design: Email Metadata Extraction_

- [x] 1.7 Add getSenderDetails and getEmailDate to Outlook content script
  - **Do**:
    1. Add `getSenderDetails(): EmailSenderInfo` function that parses "Name<email>" format from existing `getSenderInfo()` logic
    2. Add `getEmailDate(): string | undefined` function - look for date in email header DOM
    3. Update `getOutlookEmailInfo()` to populate `senderName`, `senderEmail`, `emailDate` fields
    4. Keep backward compat: still populate `emailSender`
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/content/outlook-content.ts`
  - **Done when**: New fields appear in OutlookEmailInfo
  - **Verify**: `pnpm check-types`
  - **Commit**: `feat(outlook): add getSenderDetails and getEmailDate extraction`
  - _Requirements: FR-8, FR-10_
  - _Design: Email Metadata Extraction_

- [x] 1.8 [VERIFY] Quality checkpoint: content scripts
  - **Do**: Run lint and type check
  - **Verify**: `pnpm lint && pnpm check-types`
  - **Done when**: All commands exit 0
  - **Commit**: `chore(content): pass quality checkpoint` (only if fixes needed)

### Email Search Strings

- [x] 1.9 Create email-search.ts with search string builders
  - **Do**:
    1. Create new file with `EmailSearchParams` interface: `{ senderEmail?: string; subject?: string; date?: string }`
    2. Implement `buildGmailSearchString(params)`: format as `from:email subject:"text" after:YYYY/MM/DD before:YYYY/MM/DD`
    3. Implement `buildOutlookSearchString(params)`: format as `from:"email" subject:"text" received:M/D/YYYY`
    4. Handle missing fields gracefully (omit from search string)
    5. Convert ISO date to appropriate format for each client
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/popup/email-search.ts` (create)
  - **Done when**: Both functions export and compile
  - **Verify**: `pnpm check-types`
  - **Commit**: `feat(search): add Gmail and Outlook search string builders`
  - _Requirements: FR-13, FR-14, AC-4.5, AC-4.6_
  - _Design: Email Search String Builder_

### Popup UI

- [x] 1.10 Add assignee dropdown and due date inputs to popup HTML
  - **Do**:
    1. Add assignee dropdown after section select:
       ```html
       <div class="form-group">
         <label for="assignee-select">Assignee (optional)</label>
         <select id="assignee-select" name="assigneeGid" disabled>
           <option value="">Unassigned</option>
         </select>
       </div>
       ```
    2. Add due date picker group:
       ```html
       <div class="form-group">
         <label for="due-date">Due Date (optional)</label>
         <div class="date-picker-group">
           <input type="date" id="due-date" name="dueDate">
           <div class="quick-pick-buttons">
             <button type="button" id="btn-today" class="quick-pick-btn">Today</button>
             <button type="button" id="btn-tomorrow" class="quick-pick-btn">Tomorrow</button>
           </div>
         </div>
         <div class="time-picker-group">
           <label><input type="checkbox" id="include-time"> Include time</label>
           <input type="time" id="due-time" name="dueTime" disabled>
         </div>
       </div>
       ```
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/popup/popup.html`
  - **Done when**: HTML elements present in file
  - **Verify**: `grep -q 'assignee-select' /Users/rjwhitehead/asana-plugin/src/popup/popup.html && grep -q 'due-date' /Users/rjwhitehead/asana-plugin/src/popup/popup.html && echo "OK"`
  - **Commit**: `feat(popup): add assignee dropdown and due date inputs to HTML`
  - _Requirements: FR-5, FR-6, FR-6b, AC-2.1, AC-2.3, AC-2.4, AC-2.6_
  - _Design: Popup UI - Assignee, Popup UI - Due Date_

- [x] 1.11 Add CSS styles for new form elements
  - **Do**:
    1. Add `.date-picker-group` flex container styles
    2. Add `.quick-pick-buttons` flex row styles
    3. Add `.quick-pick-btn` button styles (small, secondary style)
    4. Add `.time-picker-group` flex row styles with gap
    5. Ensure new elements match existing form styling
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/popup/popup.css`
  - **Done when**: Styles compile without errors
  - **Verify**: `pnpm build`
  - **Commit**: `feat(popup): add CSS styles for assignee and due date fields`
  - _Design: Popup UI styling_

- [x] 1.12 Wire up assignee dropdown and due date in popup.ts
  - **Do**:
    1. Add DOM element references for new inputs
    2. Add to `PopupLocalState`: `users: AsanaUser[]`, `currentUserGid: string | null`, `selectedAssigneeGid: string | null`, `dueDate: string | null`, `dueTime: string | null`, `senderName?: string`, `senderEmail?: string`, `emailDate?: string`
    3. Create `loadUsers(workspaceGid)` function following `loadProjects` pattern
    4. Create `populateAssigneeDropdown(users, currentUserGid)` function
    5. Call `loadUsers` in workspace change handler (parallel with loadProjects)
    6. Implement "Today"/"Tomorrow" quick-pick button handlers
    7. Implement time checkbox toggle logic
    8. Update `handleSubmitTask` to include `assignee`, `due_on`/`due_at` in payload
    9. Update `saveLastUsedSelections` to include `assigneeGid`
    10. Default assignee to current user GID on load
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/popup/popup.ts`
  - **Done when**: Popup compiles and shows new fields
  - **Verify**: `pnpm build`
  - **Commit**: `feat(popup): wire up assignee dropdown and due date picker`
  - _Requirements: FR-5, FR-6, FR-6b, FR-11, AC-1.1 through AC-1.6, AC-2.1 through AC-2.6_
  - _Design: Popup UI - Assignee, Popup UI - Due Date_

- [x] 1.13 Enhance notes generation with email metadata and search string
  - **Do**:
    1. Import `buildGmailSearchString`, `buildOutlookSearchString` from `./email-search`
    2. In `handleSubmitTask`, update note building to include:
       - Sender name (if available)
       - Sender email (if available)
       - Date received (human-readable format)
       - Subject
       - Account email (Gmail only)
       - Search string (Gmail or Outlook format based on content type)
    3. Only add email metadata when `state.contentType === 'email'`
    4. Format search string as: `\n\nSearch in [Gmail/Outlook]:\n{search_string}`
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/popup/popup.ts`
  - **Done when**: Notes include full metadata for email tasks
  - **Verify**: `pnpm build`
  - **Commit**: `feat(popup): enhance notes with email metadata and search string`
  - _Requirements: FR-15, AC-3.1 through AC-3.6, AC-4.1 through AC-4.4_
  - _Design: Enhanced Notes_

- [x] 1.14 POC Checkpoint - E2E validation
  - **Do**:
    1. Build extension: `pnpm build`
    2. Load extension in Chrome via chrome://extensions (developer mode)
    3. Open Gmail, view an email
    4. Open extension popup
    5. Verify: assignee dropdown populated with workspace users
    6. Verify: assignee defaults to current user ("me")
    7. Verify: due date picker and quick-pick buttons work
    8. Verify: time checkbox enables time input
    9. Create a task with assignee and due date
    10. Verify task in Asana has correct assignee and due date
    11. Verify task notes include email metadata and Gmail search string
  - **Files**: N/A (manual E2E validation using built extension)
  - **Done when**: Task created with all fields, notes include search string
  - **Verify**: `pnpm build && echo "Load dist/ in Chrome, test manually, verify task in Asana dashboard"`
  - **Commit**: `feat(task-fields): complete POC for assignee and due date fields`
  - _Requirements: All US-1, US-2, US-3, US-4 acceptance criteria_
  - _Design: All components integrated_

## Phase 2: Refactoring

After POC validated, clean up code structure.

- [x] 2.1 Extract assignee loading into dedicated function
  - **Do**:
    1. Create `loadAndDefaultAssignee(workspaceGid)` function
    2. Handle getCurrentUser failure gracefully (fall back to unassigned)
    3. Check `lastUsed.assigneeGid` and prefer that over current user if set
    4. Add proper loading states and error handling
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/popup/popup.ts`
  - **Done when**: Assignee logic cleanly separated
  - **Verify**: `pnpm check-types`
  - **Commit**: `refactor(popup): extract assignee loading logic`
  - _Design: Popup State Extension_

- [x] 2.2 Add error handling for users API
  - **Do**:
    1. Handle getUsers failure: disable dropdown, show warning, allow unassigned
    2. Handle getCurrentUser failure: fall back to first user or unassigned
    3. Add user-friendly error messages following existing patterns
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/popup/popup.ts`
  - **Done when**: All error paths handled gracefully
  - **Verify**: `pnpm check-types`
  - **Commit**: `refactor(popup): add error handling for user loading`
  - _Design: Error Handling_

- [x] 2.3 [VERIFY] Quality checkpoint: popup refactoring
  - **Do**: Run lint and type check
  - **Verify**: `pnpm lint && pnpm check-types`
  - **Done when**: All commands exit 0
  - **Commit**: `chore(popup): pass quality checkpoint` (only if fixes needed)

- [x] 2.4 Extract date formatting helpers
  - **Do**:
    1. Create helper function `formatDateForAsana(date: string, time: string | null): { due_on?: string; due_at?: string }`
    2. Create helper `formatDateHumanReadable(isoDate: string): string` for notes
    3. Ensure proper timezone handling (local to UTC for due_at)
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/popup/popup.ts`
  - **Done when**: Date logic cleanly extracted
  - **Verify**: `pnpm check-types`
  - **Commit**: `refactor(popup): extract date formatting helpers`
  - _Design: Technical Decisions - Time zone handling_

- [x] 2.5 Add multiple selector fallbacks for email date extraction
  - **Do**:
    1. Gmail: Add 3-4 fallback selectors for date element
    2. Outlook: Add 3-4 fallback selectors for date element
    3. Log selector used for debugging
    4. Return undefined gracefully if all fail
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/content/gmail-content.ts`, `/Users/rjwhitehead/asana-plugin/src/content/outlook-content.ts`
  - **Done when**: Multiple fallbacks exist for date extraction
  - **Verify**: `pnpm check-types`
  - **Commit**: `refactor(content): add fallback selectors for email date extraction`
  - _Requirements: NFR-3_
  - _Design: Edge Cases_

- [x] 2.6 [VERIFY] Quality checkpoint: refactoring complete
  - **Do**: Run full quality suite
  - **Verify**: `pnpm lint && pnpm check-types && pnpm test`
  - **Done when**: All commands exit 0
  - **Commit**: `chore: pass quality checkpoint after refactoring` (only if fixes needed)

## Phase 3: Testing

- [x] 3.1 Add unit tests for email-search.ts
  - **Do**:
    1. Create test file
    2. Test `buildGmailSearchString` with all params
    3. Test `buildGmailSearchString` with missing params (each combo)
    4. Test `buildOutlookSearchString` with all params
    5. Test `buildOutlookSearchString` with missing params
    6. Test date format conversion (ISO to Gmail YYYY/MM/DD, ISO to Outlook M/D/YYYY)
    7. Test special character escaping in subject
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/popup/__tests__/email-search.test.ts` (create)
  - **Done when**: All test cases pass
  - **Verify**: `pnpm test src/popup/__tests__/email-search.test.ts`
  - **Commit**: `test(search): add unit tests for email search string builders`
  - _Requirements: NFR-4_
  - _Design: Test Strategy - Unit Tests_

- [x] 3.2 Add unit tests for getUsers and getCurrentUser
  - **Do**:
    1. Add tests to existing asana-api.test.ts
    2. Test getUsers returns mapped users array
    3. Test getUsers handles empty workspace
    4. Test getCurrentUser returns user object
    5. Mock asanaFetch as per existing test patterns
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/background/__tests__/asana-api.test.ts`
  - **Done when**: Tests pass
  - **Verify**: `pnpm test src/background/__tests__/asana-api.test.ts`
  - **Commit**: `test(api): add unit tests for getUsers and getCurrentUser`
  - _Requirements: NFR-4_
  - _Design: Test Strategy - Unit Tests_

- [x] 3.3 [VERIFY] Quality checkpoint: API tests
  - **Do**: Run full test suite
  - **Verify**: `pnpm lint && pnpm check-types && pnpm test`
  - **Done when**: All commands exit 0
  - **Commit**: `chore(test): pass quality checkpoint` (only if fixes needed)

- [x] 3.4 Add unit tests for Gmail getSenderDetails and getEmailDate
  - **Do**:
    1. Add tests to existing gmail-content.test.ts
    2. Test getSenderDetails extracts name and email separately
    3. Test getEmailDate extracts date from DOM
    4. Test fallback selectors
    5. Test edge cases (missing name, missing email, no date element)
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/content/__tests__/gmail-content.test.ts`
  - **Done when**: Tests pass with >80% coverage for new functions
  - **Verify**: `pnpm test src/content/__tests__/gmail-content.test.ts`
  - **Commit**: `test(gmail): add tests for getSenderDetails and getEmailDate`
  - _Requirements: NFR-4_
  - _Design: Test Strategy - Unit Tests_

- [x] 3.5 Add unit tests for Outlook getSenderDetails and getEmailDate
  - **Do**:
    1. Add tests to existing outlook-content.test.ts
    2. Test getSenderDetails parses "Name<email>" format
    3. Test getEmailDate extracts date
    4. Test fallback selectors
    5. Test edge cases
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/content/__tests__/outlook-content.test.ts`
  - **Done when**: Tests pass with >80% coverage for new functions
  - **Verify**: `pnpm test src/content/__tests__/outlook-content.test.ts`
  - **Commit**: `test(outlook): add tests for getSenderDetails and getEmailDate`
  - _Requirements: NFR-4_
  - _Design: Test Strategy - Unit Tests_

- [x] 3.6 Add integration tests for createTask with new fields
  - **Do**:
    1. Add test: createTask includes assignee in request body
    2. Add test: createTask includes due_on in request body
    3. Add test: createTask includes due_at in request body
    4. Verify request body structure matches Asana API spec
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/background/__tests__/asana-api.test.ts`
  - **Done when**: Integration tests pass
  - **Verify**: `pnpm test src/background/__tests__/asana-api.test.ts`
  - **Commit**: `test(api): add integration tests for createTask with assignee/due date`
  - _Design: Test Strategy - Integration Tests_

- [x] 3.7 Add E2E tests for task creation flow
  - **Do**:
    1. Add E2E test: create task with assignee (verify in Asana)
    2. Add E2E test: create task with due date (verify in Asana)
    3. Add E2E test: create task from Gmail with search string in notes
    4. Use existing E2E test framework and patterns
  - **Files**: E2E test files (per existing project structure)
  - **Done when**: E2E tests pass
  - **Verify**: `pnpm test:e2e`
  - **Commit**: `test(e2e): add E2E tests for assignee and due date task creation`
  - _Requirements: NFR-4_
  - _Design: Test Strategy - E2E Tests_

- [x] 3.8 [VERIFY] Quality checkpoint: all tests pass
  - **Do**: Run complete test suite including E2E
  - **Verify**: `pnpm lint && pnpm check-types && pnpm test && pnpm test:e2e`
  - **Done when**: All commands exit 0
  - **Commit**: `chore(test): pass quality checkpoint` (only if fixes needed)

## Phase 4: Quality Gates

- [x] 4.1 [VERIFY] Full local CI
  - **Do**: Run complete local CI suite
  - **Verify**: `pnpm lint && pnpm check-types && pnpm test && pnpm build`
  - **Done when**: Build succeeds, all tests pass
  - **Commit**: `chore: pass local CI` (if fixes needed)

- [ ] 4.2 Create PR and verify CI
  - **Do**:
    1. Verify current branch is a feature branch: `git branch --show-current`
    2. If on default branch, STOP and alert user
    3. Push branch: `git push -u origin <branch-name>`
    4. Create PR: `gh pr create --title "feat(task-fields): add assignee and due date to task creation" --body "$(cat <<'EOF'
## Summary
- Add assignee dropdown with workspace members, defaulting to "me"
- Add due date picker with Today/Tomorrow quick buttons and optional time
- Enhance email task notes with sender name, email, date, subject
- Add Gmail/Outlook search strings to notes for finding original email

## Test plan
- [ ] Build extension and load in Chrome
- [ ] Create task from Gmail with assignee and due date
- [ ] Verify task in Asana has correct assignee and due date
- [ ] Verify notes contain email metadata and search string
- [ ] Verify assignee persists across sessions
- [ ] Test Today/Tomorrow quick-pick buttons
- [ ] Test include-time checkbox enables time picker

Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"`
    5. Wait for CI: `gh pr checks --watch`
  - **Verify**: `gh pr checks` shows all green
  - **Done when**: All CI checks green, PR ready for review
  - **If CI fails**: Fix issues locally, push, re-verify
  - **Commit**: None (PR is the deliverable)

- [ ] 4.3 [VERIFY] AC checklist verification
  - **Do**: Programmatically verify each acceptance criterion:
    1. AC-1.1: `grep -q 'getUsers' src/background/asana-api.ts`
    2. AC-1.2: Check popup.ts defaults assignee to currentUserGid
    3. AC-1.3: Check popup.html has "Unassigned" option
    4. AC-1.4: Check LastUsedSelections includes assigneeGid
    5. AC-1.5: Check createTask allows null assignee
    6. AC-1.6: Check loadUsers called on workspace change
    7. AC-2.1: `grep -q 'type="date"' src/popup/popup.html`
    8. AC-2.2: Check due_on is optional in CreateTaskPayload
    9. AC-2.3: `grep -q 'btn-today' src/popup/popup.html`
    10. AC-2.4: `grep -q 'type="time"' src/popup/popup.html`
    11. AC-2.5: Check popup.ts has due_on/due_at logic
    12. AC-3.1-3.6: Check note generation includes metadata
    13. AC-4.1-4.6: Check email-search.ts implements search formats
  - **Verify**: `pnpm test && grep -q 'assignee' src/shared/types.ts`
  - **Done when**: All ACs verified via automated checks
  - **Commit**: None

## Notes

### POC Shortcuts Taken
- Large workspace (1000+ users) relies on browser select filtering, no custom search
- DOM selectors for email date may need adjustment per Gmail/Outlook variant
- Error messages are basic, can be enhanced in P2

### Production TODOs
- Add user search/filter for large workspaces (500+ users)
- Add pagination for users API if needed
- Consider due date persistence preference (currently resets each session per user request)
- Add telemetry for date extraction success rate
- Consider adding "+1 week" quick-pick button (out of scope per requirements)

### Key Dependencies
- Task 1.1 (types) must complete before 1.2, 1.3, 1.5
- Task 1.5 (service worker) depends on 1.2
- Task 1.12 (popup wiring) depends on 1.10, 1.11
- Task 1.13 (enhanced notes) depends on 1.9, 1.6, 1.7
- Phase 3 tests depend on Phase 1 implementation
