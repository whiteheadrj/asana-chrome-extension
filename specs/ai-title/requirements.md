---
spec: ai-title
phase: requirements
created: 2026-01-19T15:30:00Z
---

# Requirements: AI Task Title Enhancement

## Goal

Improve AI-generated task titles by utilizing email body content, sender information, and web page content - making suggestions contextually relevant and actionable.

## User Decisions

| Question | Decision |
|----------|----------|
| Primary users | End users via Chrome extension popup |
| Priority tradeoffs | Feature completeness (full implementation including edge cases) |

## User Stories

### US-1: Email Body Context for Title Generation

**As a** user creating a task from Gmail or Outlook
**I want** the AI to consider email body content
**So that** task titles reflect the actual action needed, not just the subject line

**Acceptance Criteria:**
- [ ] AC-1.1: When viewing an email in Gmail, email body text (up to 1000 chars) is extracted and sent to AI
- [ ] AC-1.2: When viewing an email in Outlook, email body text (up to 1000 chars) is extracted and sent to AI
- [ ] AC-1.3: If email body extraction fails, system falls back to subject-only generation
- [ ] AC-1.4: Confidential mode emails (Gmail) show warning but still attempt body extraction

### US-2: Sender Context for Reply Tasks

**As a** user creating a task from an email
**I want** the AI to know the sender's name
**So that** task titles include context like "Reply to John about..."

**Acceptance Criteria:**
- [ ] AC-2.1: Gmail sender name/email is extracted and passed to AI
- [ ] AC-2.2: Outlook sender name/email is extracted and passed to AI
- [ ] AC-2.3: If sender extraction fails, title generation continues without sender context

### US-3: Web Page Content for Title Generation

**As a** user creating a task from a non-email web page
**I want** the AI to consider page content
**So that** task titles are relevant to what I'm viewing

**Acceptance Criteria:**
- [ ] AC-3.1: For non-email pages, main page content (up to 2000 chars) is extracted
- [ ] AC-3.2: Content extraction prioritizes visible/meaningful text over boilerplate
- [ ] AC-3.3: System correctly identifies email vs non-email pages

### US-4: Page Title Bug Fix

**As a** user
**I want** the correct page title sent to AI
**So that** title suggestions reflect the actual page, not the popup

**Acceptance Criteria:**
- [ ] AC-4.1: Page title comes from active tab (tab.title or content script), not popup document.title
- [ ] AC-4.2: If page title unavailable, system gracefully degrades

### US-5: Selected Text Priority

**As a** user who selects specific text on a page
**I want** that selection to be the primary input for title generation
**So that** my selection drives the task title

**Acceptance Criteria:**
- [ ] AC-5.1: If selectedText is present, it takes priority over other content
- [ ] AC-5.2: Selected text is truncated to 500 chars if longer
- [ ] AC-5.3: AI prompt clearly indicates selected text as primary context

### US-6: Improved AI Prompt

**As a** user
**I want** task titles to be action-oriented
**So that** I know what to do when I see the task

**Acceptance Criteria:**
- [ ] AC-6.1: Generated titles start with action verbs (Review, Follow up, Reply to, etc.)
- [ ] AC-6.2: Generated titles include key entities (names, document titles, numbers)
- [ ] AC-6.3: Generated titles are 5-10 words
- [ ] AC-6.4: Specific details preserved (invoice numbers, dates, project names)

## Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-1 | Extract email body from Gmail DOM | P0 | Body text extracted, truncated to 1000 chars |
| FR-2 | Extract email body from Outlook DOM | P0 | Body text extracted, truncated to 1000 chars |
| FR-3 | Extract sender info from Gmail DOM | P1 | Sender name or email extracted |
| FR-4 | Extract sender info from Outlook DOM | P1 | Sender name or email extracted |
| FR-5 | Extend AIInput type with new fields | P0 | Type includes emailBody, emailSender, pageContent, contentType |
| FR-6 | Fix pageTitle bug in popup | P0 | Use tab.title or content script, not document.title |
| FR-7 | Update popup to pass new data to AI | P0 | All extracted data sent to generateTaskName() |
| FR-8 | Update buildUserPrompt() for new fields | P0 | Prompt includes all available context |
| FR-9 | Improve system prompt for action-oriented titles | P1 | New prompt with verb-first pattern |
| FR-10 | Add page content extraction for non-email pages | P2 | Extract visible text, truncate to 2000 chars |
| FR-11 | Handle email body extraction failures gracefully | P0 | Fallback to subject-only, no errors shown |
| FR-12 | Add contentType discrimination | P1 | System knows if source is 'email' or 'webpage' |

## Non-Functional Requirements

| ID | Requirement | Metric | Target |
|----|-------------|--------|--------|
| NFR-1 | AI response time | Latency | < 3 seconds for title generation |
| NFR-2 | Token efficiency | Input tokens | < 2000 tokens per request |
| NFR-3 | Graceful degradation | Availability | Fallback if any extraction fails |
| NFR-4 | Privacy | Data handling | No email content stored; used only for API call |
| NFR-5 | DOM selector resilience | Maintainability | Log warnings when selectors fail |

## Glossary

- **AIInput**: TypeScript interface defining data passed to Claude API for title generation
- **Content Script**: JavaScript that runs in context of Gmail/Outlook pages to extract data
- **Confidential Mode**: Gmail feature that restricts email access; may limit extraction
- **Haiku**: Claude 3 Haiku model used for fast, cheap title generation
- **pageTitle bug**: Current bug where popup's document.title is used instead of active tab's title

## Out of Scope

- Changing the AI model (staying with Haiku)
- Supporting email clients other than Gmail and Outlook
- Storing or caching extracted email content
- Multi-email/thread summarization (only current email)
- Automatic task creation without user confirmation
- Training custom models on user data
- Support for attachments or embedded images
- Real-time streaming of AI suggestions

## Dependencies

| Dependency | Type | Risk |
|------------|------|------|
| Gmail DOM structure | External | Medium - selectors may break on Gmail updates |
| Outlook DOM structure | External | Medium - selectors may break on Outlook updates |
| Claude API availability | External | Low - already in use |
| Chrome extension APIs | External | Low - stable APIs |

## Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| DOM selectors break on Gmail/Outlook update | High | Medium | Use multiple fallback selectors; log warnings |
| Large email bodies increase API costs | Medium | Medium | Hard limit at 1000 chars |
| Privacy concerns with email content | High | Low | Content only used for API call, not stored |
| Slower title generation with more context | Low | Medium | Haiku model is fast; acceptable tradeoff |

## Edge Cases

| Case | Expected Behavior |
|------|-------------------|
| Empty email body | Use subject only |
| Very long email body | Truncate to 1000 chars |
| No subject line | Use email body or page title |
| Confidential mode email | Warn user, attempt extraction |
| Email in non-English language | Let AI handle; no translation |
| Multiple emails selected | Use first/focused email only |
| Page with no extractable content | Use URL and any available metadata |
| Content script not loaded | Use tab.title as fallback |
| Offline mode | Skip AI entirely (existing behavior) |
| Missing sender info | Generate title without sender context |

## Success Criteria

1. **Quality**: 70%+ of generated titles include action verb
2. **Context**: Titles reference key entities from email body/page when relevant
3. **Reliability**: Zero crashes due to extraction failures
4. **Performance**: Title generation < 3 seconds in 95% of cases

## Unresolved Questions

1. Should we extract email thread history, or just the latest message?
   - **Recommendation**: Latest message only for V1 (simplicity)
2. How to handle forwarded emails with quoted content?
   - **Recommendation**: Extract all visible text; let AI filter
3. Should page content extraction use readability algorithms?
   - **Recommendation**: Simple innerText for V1; consider readability for V2

## Next Steps

1. Review and approve requirements
2. Run `/design` to create technical design
3. Run `/tasks` to generate implementation tasks
