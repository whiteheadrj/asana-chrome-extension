---
spec: ai-title
phase: tasks
total_tasks: 32
created: 2026-01-19T17:00:00Z
---

# Tasks: AI Task Title Enhancement

## Phase 1: Make It Work (POC)

Focus: Validate email body/sender extraction and improved prompts work end-to-end. Skip tests, accept hardcoded values.

### Types Extension

- [x] 1.1 Extend AIInput type with new fields
  - **Do**:
    1. Add `emailBody?: string` (truncated to 1000 chars)
    2. Add `emailSender?: string` (sender name or email)
    3. Add `pageContent?: string` (for non-email pages, up to 2000 chars)
    4. Add `contentType?: 'email' | 'webpage'` (helps prompt strategy)
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/shared/types.ts`
  - **Done when**: AIInput interface includes all 4 new optional fields
  - **Verify**: `pnpm check-types`
  - **Commit**: `feat(types): extend AIInput with emailBody, emailSender, pageContent, contentType`
  - _Requirements: FR-5_
  - _Design: Types (types.ts) section_

- [x] 1.2 Extend GmailEmailInfo type
  - **Do**:
    1. Add `emailBody?: string` to GmailEmailInfo interface
    2. Add `emailSender?: string` to GmailEmailInfo interface
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/shared/types.ts`
  - **Done when**: GmailEmailInfo has emailBody and emailSender optional fields
  - **Verify**: `pnpm check-types`
  - **Commit**: `feat(types): extend GmailEmailInfo with emailBody and emailSender`
  - _Requirements: FR-5_
  - _Design: Extended GmailEmailInfo section_

- [x] 1.3 Extend OutlookEmailInfo type
  - **Do**:
    1. Add `subject?: string` to OutlookEmailInfo interface
    2. Add `emailBody?: string` to OutlookEmailInfo interface
    3. Add `emailSender?: string` to OutlookEmailInfo interface
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/shared/types.ts`
  - **Done when**: OutlookEmailInfo has subject, emailBody, and emailSender optional fields
  - **Verify**: `pnpm check-types`
  - **Commit**: `feat(types): extend OutlookEmailInfo with subject, emailBody, emailSender`
  - _Requirements: FR-5_
  - _Design: Extended OutlookEmailInfo section_

### Gmail Content Script

- [x] 1.4 Add getEmailBody() to Gmail content script
  - **Do**:
    1. Create `getEmailBody(): string | undefined` function
    2. Use selectors: `.a3s.aiL`, `[data-message-id] .ii.gt`, `.adn.ads`
    3. Chain selectors with fallback (try each until found)
    4. Get innerText and truncate to 1000 chars
    5. Return undefined if all selectors fail (log debug message)
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/content/gmail-content.ts`
  - **Done when**: Function extracts email body text from Gmail DOM
  - **Verify**: `pnpm check-types`
  - **Commit**: `feat(gmail): add getEmailBody() function with DOM selectors`
  - _Requirements: FR-1_
  - _Design: Gmail Content Script section_

- [x] 1.5 Add getEmailSender() to Gmail content script
  - **Do**:
    1. Create `getEmailSender(): string | undefined` function
    2. Use selectors: `span.gD`, `[email]`, `span[data-hovercard-id]`
    3. For `span.gD`, try textContent first, then `email` attribute
    4. For `[email]`, get the email attribute value
    5. For `span[data-hovercard-id]`, extract email from data-hovercard-id
    6. Return first found value, undefined if all fail
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/content/gmail-content.ts`
  - **Done when**: Function extracts sender name or email from Gmail DOM
  - **Verify**: `pnpm check-types`
  - **Commit**: `feat(gmail): add getEmailSender() function with DOM selectors`
  - _Requirements: FR-3_
  - _Design: Gmail Content Script section_

- [x] 1.6 Update Gmail message listener to include new fields
  - **Do**:
    1. In `getGmailEmailInfoWithWarnings()`, call `getEmailBody()` and add to return object
    2. Call `getEmailSender()` and add to return object
    3. Update `GmailEmailInfoWithWarnings` return type if needed
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/content/gmail-content.ts`
  - **Done when**: GET_PAGE_INFO response includes emailBody and emailSender
  - **Verify**: `pnpm check-types`
  - **Commit**: `feat(gmail): include emailBody and emailSender in message response`
  - _Requirements: FR-1, FR-3_
  - _Design: Gmail Content Script section_

- [x] V1 [VERIFY] Quality checkpoint: types and Gmail changes
  - **Do**: Run quality commands to verify types and Gmail changes compile
  - **Verify**: `pnpm check-types && pnpm lint`
  - **Done when**: No type errors, no lint errors
  - **Commit**: `chore(gmail): pass quality checkpoint` (only if fixes needed)

### Outlook Content Script

- [x] 1.7 Add getEmailBody() to Outlook content script
  - **Do**:
    1. Create `getEmailBody(): string | undefined` function
    2. Use selectors: `[data-app-section="ConversationReadingPane"]`, `.XbIp4.jmmB7.GNqVo`, `[aria-label="Message body"]`
    3. Chain selectors with fallback
    4. Get innerText and truncate to 1000 chars
    5. Return undefined if all selectors fail
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/content/outlook-content.ts`
  - **Done when**: Function extracts email body text from Outlook DOM
  - **Verify**: `pnpm check-types`
  - **Commit**: `feat(outlook): add getEmailBody() function with DOM selectors`
  - _Requirements: FR-2_
  - _Design: Outlook Content Script section_

- [x] 1.8 Enhance getSenderInfo() in Outlook content script
  - **Do**:
    1. Add additional fallback selectors to existing `getSenderInfo()`
    2. Add `[role="img"][aria-label*="@"]` selector for sender email in avatar
    3. Add `button[aria-label*="@"]` for clickable sender
    4. Ensure function returns most specific value (name > email)
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/content/outlook-content.ts`
  - **Done when**: getSenderInfo has enhanced fallback selectors
  - **Verify**: `pnpm check-types`
  - **Commit**: `feat(outlook): enhance getSenderInfo() with additional fallback selectors`
  - _Requirements: FR-4_
  - _Design: Outlook Content Script section_

- [x] 1.9 Update Outlook message listener to include new fields
  - **Do**:
    1. In `getOutlookEmailInfo()`, call `getEmailBody()` and add to return object
    2. Call `getSenderInfo()` and add as emailSender to return object
    3. Call existing `getEmailSubject()` and add as subject to return object
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/content/outlook-content.ts`
  - **Done when**: GET_PAGE_INFO response includes subject, emailBody, and emailSender
  - **Verify**: `pnpm check-types`
  - **Commit**: `feat(outlook): include subject, emailBody, emailSender in message response`
  - _Requirements: FR-2, FR-4_
  - _Design: Outlook Content Script section_

- [x] V2 [VERIFY] Quality checkpoint: Outlook changes
  - **Do**: Run quality commands to verify Outlook changes compile
  - **Verify**: `pnpm check-types && pnpm lint`
  - **Done when**: No type errors, no lint errors
  - **Commit**: `chore(outlook): pass quality checkpoint` (only if fixes needed)

### Popup Updates

- [x] 1.10 Fix pageTitle bug in popup
  - **Do**:
    1. In `generateAiSuggestion()`, get active tab via `chrome.tabs.query()`
    2. Use `tab.title` instead of `document.title` for pageTitle
    3. Store tab.title in state or pass directly to AIInput
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/popup/popup.ts`
  - **Done when**: AIInput.pageTitle uses tab.title, not document.title
  - **Verify**: `pnpm check-types`
  - **Commit**: `fix(popup): use tab.title instead of document.title for AI input`
  - _Requirements: FR-6, AC-4.1_
  - _Design: Popup (popup.ts) section_

- [x] 1.11 Add state fields for new email data
  - **Do**:
    1. Add `emailBody?: string` to PopupLocalState interface
    2. Add `emailSender?: string` to PopupLocalState interface
    3. Add `contentType?: 'email' | 'webpage'` to PopupLocalState interface
    4. Initialize as undefined in state object
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/popup/popup.ts`
  - **Done when**: State has fields for emailBody, emailSender, contentType
  - **Verify**: `pnpm check-types`
  - **Commit**: `feat(popup): add state fields for emailBody, emailSender, contentType`
  - _Requirements: FR-7_
  - _Design: Popup (popup.ts) section_

- [x] 1.12 Update requestPageInfo() to capture new fields
  - **Do**:
    1. In Gmail branch, capture `gmailInfo.emailBody` and `gmailInfo.emailSender` to state
    2. Set `state.contentType = 'email'` for Gmail
    3. In Outlook branch, capture `outlookInfo.emailBody`, `outlookInfo.emailSender`, `outlookInfo.subject`
    4. Set `state.contentType = 'email'` for Outlook
    5. For non-email pages, set `state.contentType = 'webpage'`
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/popup/popup.ts`
  - **Done when**: requestPageInfo populates all new state fields from content script responses
  - **Verify**: `pnpm check-types`
  - **Commit**: `feat(popup): capture emailBody, emailSender, contentType from content scripts`
  - _Requirements: FR-7, FR-12_
  - _Design: Popup (popup.ts) section_

- [x] 1.13 Add page content extraction for non-email pages
  - **Do**:
    1. Create `extractPageContent(tabId: number): Promise<string | undefined>` function
    2. Use `chrome.scripting.executeScript` to get `document.body.innerText`
    3. Truncate result to 2000 chars
    4. Handle errors gracefully, return undefined on failure
    5. In requestPageInfo(), call for non-email pages and store in state.pageContent
    6. Add `pageContent?: string` to PopupLocalState if not done in 1.11
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/popup/popup.ts`
  - **Done when**: Non-email pages have page content extracted and stored in state
  - **Verify**: `pnpm check-types`
  - **Commit**: `feat(popup): add page content extraction for non-email pages`
  - _Requirements: FR-10, AC-3.1_
  - _Design: Popup (popup.ts) section_

- [x] 1.14 Update generateAiSuggestion() to pass new data to AI
  - **Do**:
    1. Build AIInput with all new fields:
       - emailBody: state.emailBody
       - emailSender: state.emailSender
       - pageContent: state.pageContent
       - contentType: state.contentType
    2. Ensure all fields passed to generateTaskName()
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/popup/popup.ts`
  - **Done when**: AIInput passed to generateTaskName() includes all new fields
  - **Verify**: `pnpm check-types`
  - **Commit**: `feat(popup): pass emailBody, emailSender, pageContent, contentType to AI`
  - _Requirements: FR-7_
  - _Design: Popup (popup.ts) section_

- [x] V3 [VERIFY] Quality checkpoint: popup changes
  - **Do**: Run quality commands to verify popup changes compile
  - **Verify**: `pnpm check-types && pnpm lint`
  - **Done when**: No type errors, no lint errors
  - **Commit**: `chore(popup): pass quality checkpoint` (only if fixes needed)

### AI Module Updates

- [x] 1.15 Improve SYSTEM_PROMPT for action-oriented titles
  - **Do**:
    1. Replace current SYSTEM_PROMPT with action-verb focused version:
       ```
       You extract actionable task titles from emails and web pages.

       Rules:
       - Start with action verb (Review, Follow up, Schedule, Reply to, Complete, etc.)
       - Include key entity (person name, document, project, deadline)
       - 5-10 words maximum
       - Preserve specific details (dates, numbers, names)
       - Output ONLY the task title, no explanation

       Examples:
       - Email about budget review -> "Review Q4 budget before Thursday meeting"
       - Invoice approval request -> "Approve invoice #4521 for John"
       - PR review notification -> "Review PR #123 - authentication fix"
       ```
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/shared/ai.ts`
  - **Done when**: SYSTEM_PROMPT updated with action-verb-first instructions and examples
  - **Verify**: `pnpm check-types`
  - **Commit**: `feat(ai): improve SYSTEM_PROMPT for action-oriented task titles`
  - _Requirements: FR-9, AC-6.1, AC-6.2, AC-6.3, AC-6.4_
  - _Design: AI Module (ai.ts) section_

- [x] 1.16 Update buildUserPrompt() for new fields
  - **Do**:
    1. Add priority order logic: selectedText > emailSubject > emailBody > pageContent
    2. If selectedText present, add as "Selected text (primary): {truncated to 500}"
    3. If emailSender present, add as "From: {emailSender}"
    4. If emailBody present, add as "Email content: {truncated to 1000}"
    5. If pageContent present AND contentType === 'webpage', add as "Page content: {truncated to 2000}"
    6. Skip pageTitle if it equals emailSubject (avoid duplication)
    7. Create truncate helper function if not exists
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/shared/ai.ts`
  - **Done when**: buildUserPrompt includes all new fields with proper truncation and priority
  - **Verify**: `pnpm check-types`
  - **Commit**: `feat(ai): update buildUserPrompt() to include new context fields`
  - _Requirements: FR-8, AC-5.1, AC-5.2, AC-5.3_
  - _Design: AI Module (ai.ts) section_

- [x] 1.17 Update confidence calculation for new inputs
  - **Do**:
    1. Set confidence = 'high' if emailBody present and length > 50
    2. Adjust existing confidence logic to consider emailBody
    3. Keep existing selectedText and emailSubject high confidence logic
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/shared/ai.ts`
  - **Done when**: Confidence calculation considers emailBody
  - **Verify**: `pnpm check-types`
  - **Commit**: `feat(ai): update confidence calculation for emailBody input`
  - _Requirements: FR-8_
  - _Design: AI Module (ai.ts) section_

- [x] V4 [VERIFY] Quality checkpoint: AI module changes
  - **Do**: Run quality commands to verify all changes compile and lint
  - **Verify**: `pnpm check-types && pnpm lint`
  - **Done when**: No type errors, no lint errors
  - **Commit**: `chore(ai): pass quality checkpoint` (only if fixes needed)

### POC Checkpoint

- [x] 1.18 POC Checkpoint - Build and manual verification
  - **Do**:
    1. Run full build: `pnpm build`
    2. Build succeeds without errors
    3. Verify console shows no type/lint errors
  - **Done when**: Build succeeds, extension ready for manual testing
  - **Verify**: `pnpm build`
  - **Commit**: `feat(ai-title): complete POC - email body and improved prompts`

## Phase 2: Refactoring

After POC validated, clean up code.

- [x] 2.1 Extract truncate helper function
  - **Do**:
    1. Create `truncate(text: string, maxLength: number): string` utility function
    2. Add ellipsis when truncating: `text.substring(0, maxLength) + '...'`
    3. Move inline truncation logic in buildUserPrompt to use this helper
    4. Consider placing in shared utils file or keep in ai.ts
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/shared/ai.ts`
  - **Done when**: All truncation uses consistent helper function
  - **Verify**: `pnpm check-types`
  - **Commit**: `refactor(ai): extract truncate helper function`
  - _Design: Helper Functions section_

- [x] 2.2 Add error handling to content script extraction functions
  - **Do**:
    1. Wrap getEmailBody() DOM queries in try-catch
    2. Wrap getEmailSender() DOM queries in try-catch
    3. Log debug messages on failures
    4. Ensure undefined is returned on any error
  - **Files**:
    - `/Users/rjwhitehead/asana-plugin/src/content/gmail-content.ts`
    - `/Users/rjwhitehead/asana-plugin/src/content/outlook-content.ts`
  - **Done when**: All extraction functions have error handling
  - **Verify**: `pnpm check-types`
  - **Commit**: `refactor(content): add error handling to extraction functions`
  - _Requirements: FR-11, AC-1.3_
  - _Design: Error Handling section_

- [x] 2.3 Add logging for DOM selector debugging
  - **Do**:
    1. Add console.debug when body selector fails in Gmail
    2. Add console.debug when sender selector fails in Gmail
    3. Add console.debug when body selector fails in Outlook
    4. Add console.debug when sender selector fails in Outlook
    5. Log which selector succeeded when extraction works
  - **Files**:
    - `/Users/rjwhitehead/asana-plugin/src/content/gmail-content.ts`
    - `/Users/rjwhitehead/asana-plugin/src/content/outlook-content.ts`
  - **Done when**: Debug logging helps identify selector issues
  - **Verify**: `pnpm check-types`
  - **Commit**: `refactor(content): add debug logging for DOM selector results`
  - _Requirements: NFR-5_
  - _Design: Existing Patterns section_

- [x] V5 [VERIFY] Quality checkpoint: refactoring complete
  - **Do**: Run quality commands to verify refactoring is clean
  - **Verify**: `pnpm check-types && pnpm lint`
  - **Done when**: No type errors, no lint errors
  - **Commit**: `chore: pass refactoring quality checkpoint` (only if fixes needed)

## Phase 3: Testing

### Unit Tests for Gmail Content Script

- [x] 3.1 Unit tests for getEmailBody() in Gmail
  - **Do**:
    1. Create test cases in gmail-content.test.ts
    2. Test: returns body text from `.a3s.aiL` selector
    3. Test: falls back to `[data-message-id] .ii.gt` when primary fails
    4. Test: falls back to `.adn.ads` when others fail
    5. Test: returns undefined when all selectors fail
    6. Test: truncates body at 1000 chars
    7. Mock DOM with jsdom-like setup
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/content/__tests__/gmail-content.test.ts`
  - **Done when**: 5+ test cases for getEmailBody pass
  - **Verify**: `pnpm test`
  - **Commit**: `test(gmail): add unit tests for getEmailBody()`
  - _Requirements: AC-1.1_
  - _Design: Test Strategy - gmail-content.test.ts_

- [x] 3.2 Unit tests for getEmailSender() in Gmail
  - **Do**:
    1. Add test cases for sender extraction
    2. Test: extracts sender name from `span.gD`
    3. Test: extracts email from `[email]` attribute
    4. Test: extracts from `span[data-hovercard-id]`
    5. Test: returns undefined when all selectors fail
    6. Test: prefers name over raw email
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/content/__tests__/gmail-content.test.ts`
  - **Done when**: 5+ test cases for getEmailSender pass
  - **Verify**: `pnpm test`
  - **Commit**: `test(gmail): add unit tests for getEmailSender()`
  - _Requirements: AC-2.1_
  - _Design: Test Strategy - gmail-content.test.ts_

### Unit Tests for Outlook Content Script

- [x] 3.3 Unit tests for getEmailBody() in Outlook
  - **Do**:
    1. Add test cases in outlook-content.test.ts
    2. Test: returns body from ConversationReadingPane selector
    3. Test: returns body from reading pane body class
    4. Test: returns body from Message body aria-label
    5. Test: returns undefined when all selectors fail
    6. Test: truncates at 1000 chars
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/content/__tests__/outlook-content.test.ts`
  - **Done when**: 5+ test cases for Outlook getEmailBody pass
  - **Verify**: `pnpm test`
  - **Commit**: `test(outlook): add unit tests for getEmailBody()`
  - _Requirements: AC-1.2_
  - _Design: Test Strategy - outlook-content.test.ts_

- [x] V6 [VERIFY] Quality checkpoint: content script tests
  - **Do**: Run test suite to verify new tests pass
  - **Verify**: `pnpm test`
  - **Done when**: All tests pass
  - **Commit**: `chore: pass content script test checkpoint` (only if fixes needed)

### Unit Tests for AI Module

- [x] 3.4 Unit tests for buildUserPrompt() with new fields
  - **Do**:
    1. Add test cases in ai.test.ts
    2. Test: includes emailBody when present
    3. Test: includes emailSender when present
    4. Test: includes pageContent for webpage contentType
    5. Test: does not include pageContent for email contentType
    6. Test: truncates emailBody at 1000 chars
    7. Test: truncates pageContent at 2000 chars
    8. Test: selectedText takes priority over other fields
    9. Test: skips pageTitle when equals emailSubject
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/shared/__tests__/ai.test.ts`
  - **Done when**: 8+ new test cases for buildUserPrompt pass
  - **Verify**: `pnpm test`
  - **Commit**: `test(ai): add unit tests for buildUserPrompt with new fields`
  - _Requirements: FR-8, AC-5.1_
  - _Design: Test Strategy - ai.test.ts_

- [x] 3.5 Unit tests for confidence calculation with emailBody
  - **Do**:
    1. Test: returns high confidence when emailBody > 50 chars
    2. Test: existing emailSubject high confidence still works
    3. Test: existing selectedText high confidence still works
    4. Verify confidence logic interactions
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/shared/__tests__/ai.test.ts`
  - **Done when**: Confidence calculation tests pass
  - **Verify**: `pnpm test`
  - **Commit**: `test(ai): add unit tests for confidence calculation with emailBody`
  - _Design: Test Strategy - ai.test.ts_

- [x] V7 [VERIFY] Quality checkpoint: AI tests
  - **Do**: Run test suite to verify all AI tests pass
  - **Verify**: `pnpm test`
  - **Done when**: All tests pass
  - **Commit**: `chore: pass AI test checkpoint` (only if fixes needed)

### Integration/E2E Tests

- [ ] 3.6 Integration test for Gmail flow
  - **Do**:
    1. Create integration test that simulates Gmail page info flow
    2. Mock content script response with emailBody and emailSender
    3. Verify popup receives and processes data correctly
    4. Verify AIInput is built with correct fields
    5. Use existing service-worker.integration.test.ts patterns
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/popup/__tests__/popup.integration.test.ts` (new file)
  - **Done when**: Integration test verifies Gmail -> popup -> AI flow
  - **Verify**: `pnpm test`
  - **Commit**: `test(popup): add integration test for Gmail email flow`
  - _Requirements: US-1_
  - _Design: Test Strategy - Integration Tests_

- [ ] 3.7 E2E test setup for browser extension
  - **Do**:
    1. Add e2e test configuration if not exists
    2. Create basic e2e test that:
       - Loads built extension
       - Opens test Gmail-like page (mock HTML)
       - Triggers popup
       - Verifies AI suggestion includes email context
    3. Use Playwright or Puppeteer for extension testing
  - **Files**:
    - `/Users/rjwhitehead/asana-plugin/e2e/ai-title.e2e.test.ts` (new file)
    - `/Users/rjwhitehead/asana-plugin/playwright.config.ts` or similar (if needed)
  - **Done when**: E2E test verifies full flow works
  - **Verify**: `pnpm test:e2e` or equivalent
  - **Commit**: `test(e2e): add end-to-end test for AI title with email body`
  - _Requirements: US-1, US-2_
  - _Design: Test Strategy - E2E Tests_

- [ ] V8 [VERIFY] Quality checkpoint: all tests pass
  - **Do**: Run full test suite
  - **Verify**: `pnpm test`
  - **Done when**: All unit and integration tests pass
  - **Commit**: `chore: pass testing phase quality checkpoint` (only if fixes needed)

## Phase 4: Quality Gates

- [ ] 4.1 [VERIFY] Full local CI: lint, types, test, build
  - **Do**: Run complete local CI suite
  - **Verify**: `pnpm lint && pnpm check-types && pnpm test && pnpm build`
  - **Done when**: All commands pass with no errors
  - **Commit**: `chore(ci): pass local CI` (if fixes needed)

- [ ] 4.2 [VERIFY] CI pipeline passes
  - **Do**:
    1. Verify current branch is feature branch: `git branch --show-current`
    2. Push branch: `git push -u origin feat/ai-title` (or current branch)
    3. Create PR using gh CLI if not exists
    4. Wait for CI to complete
  - **Verify**: `gh pr checks --watch` or `gh pr checks`
  - **Done when**: CI pipeline passes, all checks green
  - **Commit**: None (verification only)

- [ ] 4.3 [VERIFY] AC checklist verification
  - **Do**: Verify each acceptance criterion programmatically:
    - AC-1.1: Grep for getEmailBody in gmail-content.ts, verify truncation to 1000
    - AC-1.2: Grep for getEmailBody in outlook-content.ts, verify truncation to 1000
    - AC-1.3: Grep for undefined return in getEmailBody functions
    - AC-2.1: Grep for getEmailSender in gmail-content.ts
    - AC-2.2: Grep for emailSender in outlook-content.ts response
    - AC-3.1: Grep for extractPageContent in popup.ts
    - AC-4.1: Grep for tab.title in popup.ts generateAiSuggestion
    - AC-5.1: Grep for selectedText priority in buildUserPrompt
    - AC-6.1: Grep for "action verb" or verb examples in SYSTEM_PROMPT
    - FR-5: Grep for emailBody, emailSender, pageContent, contentType in types.ts
    - FR-12: Grep for contentType in popup.ts
  - **Verify**: Run grep commands for each AC
  - **Done when**: All acceptance criteria verified met
  - **Commit**: None (verification only)

## Notes

- **POC shortcuts taken**:
  - No E2E browser automation in POC phase
  - Minimal error UI for extraction failures
  - Hardcoded truncation limits

- **Production TODOs**:
  - Consider smarter truncation (sentence boundaries)
  - Add user-visible warning when body extraction fails
  - Consider retry logic for DOM selectors (dynamic loading)
  - Monitor Haiku token usage with larger prompts

- **DOM Selector Risk**:
  - Gmail and Outlook DOM structures may change
  - Multiple fallback selectors mitigate this
  - Debug logging helps identify broken selectors

- **Testing Notes**:
  - E2E tests may require additional setup for Chrome extension testing
  - Integration tests mock chrome.* APIs
