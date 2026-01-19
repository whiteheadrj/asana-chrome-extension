---
spec: ai-title
phase: research
created: 2026-01-19
---

# Research: ai-title

## Executive Summary

Current AI title generation uses only pageUrl, pageTitle, and emailSubject - ignoring email body content. The implementation already has infrastructure for email subject extraction (Gmail/Outlook content scripts), but the prompt lacks rich context. Enhancement requires: (1) extracting email body content from DOM, (2) optionally extracting web page main content, (3) improving the prompt to prioritize actionable task extraction.

## Current Implementation Analysis

### AI Module (`/Users/rjwhitehead/asana-plugin/src/shared/ai.ts`)

| Aspect | Current State | Gap |
|--------|---------------|-----|
| Input fields | `pageTitle`, `selectedText`, `emailSubject`, `pageUrl` | Missing: `emailBody`, `pageContent` |
| Prompt | Generic "generate concise task title" | No context-aware extraction logic |
| Model | Claude 3 Haiku (fast, cheap) | Adequate for short inputs |
| Max tokens | 50 | Sufficient for title generation |

**Current Prompt:**
```
Generate a concise, actionable task title (5-10 words).
Output ONLY the task title, no explanation.
```

**Current Input Building (`buildUserPrompt`):**
```typescript
// Only uses these fields:
- emailSubject (if available)
- pageTitle (truncated to 100 chars)
- selectedText (truncated to 500 chars)
- pageUrl
```

### Email Content Extraction

**Gmail (`/Users/rjwhitehead/asana-plugin/src/content/gmail-content.ts`):**

| Data Point | Extracted | Method |
|------------|-----------|--------|
| Subject | YES | DOM selectors (`h2.hP`, document.title parsing) |
| Body | NO | Not implemented |
| Sender | NO | Not implemented |

**Outlook (`/Users/rjwhitehead/asana-plugin/src/content/outlook-content.ts`):**

| Data Point | Extracted | Method |
|------------|-----------|--------|
| Subject | YES | DOM selectors, document.title |
| Body | NO | Not implemented |
| Sender | YES | DOM selectors (partial) |

### Popup Data Flow (`/Users/rjwhitehead/asana-plugin/src/popup/popup.ts`)

```
requestPageInfo() -> chrome.tabs.sendMessage('GET_PAGE_INFO')
                  -> Content script responds with:
                     Gmail: { permanentUrl, subject, accountEmail, warnings }
                     Outlook: { permanentUrl, itemId, variant }
                  -> state.emailSubject = gmailInfo.subject
                  -> generateAiSuggestion() uses:
                     { pageUrl, emailSubject, pageTitle: document.title }
```

**Key Finding:** `document.title` in popup is the popup's title, NOT the page title. This is a bug.

### AIInput Type (`/Users/rjwhitehead/asana-plugin/src/shared/types.ts`)

```typescript
export interface AIInput {
  pageTitle?: string;
  selectedText?: string;
  emailSubject?: string;
  pageUrl?: string;
}
```

Missing: `emailBody`, `pageContent`, `sender`

## External Research

### Best Practices for Action Item Extraction

| Technique | Description | Source |
|-----------|-------------|--------|
| XML-structured prompts | Claude excels with XML tags separating components | [AWS Blog](https://aws.amazon.com/blogs/machine-learning/prompt-engineering-techniques-and-best-practices-learn-by-doing-with-anthropics-claude-3-on-amazon-bedrock/) |
| Source text before prompt | Helps with LLM recency bias | [Prompt Engineering Guide](https://www.promptingguide.ai/prompts/text-summarization) |
| Action item extraction pattern | Extract task, responsible party, deadline, context | [AirOps Prompts](https://www.airops.com/prompts/transcript-summary-ai-seo-claude-prompts) |
| Concise format specification | Specify length (5-10 words) and style (actionable verb) | [ClickUp Claude Prompts](https://clickup.com/blog/claude-ai-prompts/) |

### Title Generation Principles

| Principle | Rationale |
|-----------|-----------|
| Lead with action verb | "Review", "Follow up", "Schedule" - makes task clear |
| Include key entity | Person, document, project name for context |
| Omit filler words | "Hi", "Hello", generic greetings waste tokens |
| Preserve specifics | Invoice numbers, dates, names - avoid generic titles |

### Prompt Engineering for Summarization

From [Microsoft ISE Blog](https://devblogs.microsoft.com/ise/gpt-summary-prompt-engineering/):
- Put source text ABOVE the prompt (recency effect)
- Specify output format explicitly
- Use few-shot examples for consistent style

## Feasibility Assessment

| Aspect | Assessment | Notes |
|--------|------------|-------|
| Technical Viability | **High** | DOM extraction is straightforward |
| Effort Estimate | **S** (Small) | 1-2 days implementation |
| Risk Level | **Low** | Non-breaking, additive changes |

### Implementation Complexity

| Change | Complexity | Files Affected |
|--------|------------|----------------|
| Add email body extraction to Gmail | Low | `gmail-content.ts` |
| Add email body extraction to Outlook | Low | `outlook-content.ts` |
| Update AIInput type | Trivial | `types.ts` |
| Update popup to pass new data | Low | `popup.ts` |
| Improve AI prompt | Low | `ai.ts` |
| Add web page content extraction | Medium | New generic content script or popup logic |

### Constraints

1. **Token limits** - Email bodies can be long. Must truncate intelligently (first 1000 chars, or extract key sentences).
2. **DOM stability** - Gmail/Outlook DOM classes change. Email body selectors may need maintenance.
3. **Privacy** - Email content is sensitive. Only used locally for AI call, not stored.
4. **Performance** - Larger prompts = slower/costlier API calls. Haiku is fast but still adds latency.

## Codebase Patterns to Leverage

| Pattern | Location | Reuse For |
|---------|----------|-----------|
| DOM selector chaining | `gmail-content.ts:getEmailSubject()` | Email body extraction |
| Truncation logic | `ai.ts:buildUserPrompt()` | Body truncation |
| Content script messaging | `gmail-content.ts:chrome.runtime.onMessage` | Adding new data to response |
| Type safety | `types.ts:AIInput` | Extending interface |

## Recommendations for Requirements

1. **Extract email body content** - Add `getEmailBody()` to Gmail and Outlook content scripts using DOM selectors.

2. **Limit email body length** - Truncate to ~1000 chars to balance context vs. cost/latency.

3. **Improve system prompt** - Use action-oriented extraction:
   ```
   Extract the primary action item from this email/page as a task title.
   Format: [Action verb] [Key entity/topic] (5-10 words)
   Prioritize: deadlines, requests, follow-ups
   Output ONLY the task title.
   ```

4. **Add sender context** - Include sender name/email for context ("Reply to John about...").

5. **Fix pageTitle bug** - Popup uses `document.title` which is popup title. Should get from content script or tab.title.

6. **Optionally add web page content** - For non-email pages, extract main content (document.body.innerText limited to ~2000 chars).

7. **Prioritize email subject when available** - If email has clear subject, weight it heavily.

8. **Consider selectedText as override** - If user selects text, use that as primary input (already supported but underutilized).

## Proposed AIInput Extension

```typescript
export interface AIInput {
  // Existing
  pageTitle?: string;
  selectedText?: string;
  emailSubject?: string;
  pageUrl?: string;
  // New
  emailBody?: string;      // Truncated email body content
  emailSender?: string;    // Sender name/email
  pageContent?: string;    // For non-email pages, main content
  contentType?: 'email' | 'webpage';  // Helps prompt selection
}
```

## Proposed Prompt Improvement

```
<system>
You extract actionable task titles from emails and web pages.

Rules:
- Start with action verb (Review, Follow up, Schedule, Reply to, etc.)
- Include key entity (person name, document, project)
- 5-10 words maximum
- Preserve specific details (dates, numbers, names)
- Output ONLY the task title, no explanation
</system>

<examples>
Email subject: "Q4 Budget Review Meeting - Thursday 3pm"
Email body: "Hi team, please review the attached budget doc before our Thursday meeting..."
Output: Review Q4 budget before Thursday meeting

Email subject: "Re: Invoice #4521"
Email body: "Can you approve this invoice when you get a chance? Thanks, John"
Output: Approve invoice #4521 for John

Page title: "GitHub - pull request #123"
Page content: "Fix authentication bug in login flow..."
Output: Review PR #123 - authentication bug fix
</examples>

<context>
{{#if emailSubject}}Email subject: {{emailSubject}}{{/if}}
{{#if emailSender}}From: {{emailSender}}{{/if}}
{{#if emailBody}}Email content: {{emailBody}}{{/if}}
{{#if pageTitle}}Page title: {{pageTitle}}{{/if}}
{{#if pageContent}}Page content: {{pageContent}}{{/if}}
{{#if selectedText}}Selected text: {{selectedText}}{{/if}}
URL: {{pageUrl}}
</context>

Generate the task title:
```

## Quality Commands

| Type | Command | Source |
|------|---------|--------|
| Lint | `pnpm lint` | package.json scripts.lint |
| TypeCheck | `pnpm check-types` | package.json scripts.check-types |
| Unit Test | `pnpm test` | package.json scripts.test |
| Build | `pnpm build` | package.json scripts.build |

**Local CI**: `pnpm lint && pnpm check-types && pnpm test && pnpm build`

## Related Specs

| Spec | Relationship | May Need Update |
|------|--------------|-----------------|
| asana-chrome-extension | Parent spec - established AI integration patterns | No - this is additive |

## Open Questions

1. **Token budget** - How much email body content should we include? 500, 1000, 2000 chars?
2. **Fallback behavior** - If email body extraction fails, should we fall back to subject-only?
3. **Web page content** - Should we add generic page content extraction for non-email pages?
4. **Performance impact** - Is added latency acceptable for better titles?

## Sources

### Internal
- `/Users/rjwhitehead/asana-plugin/src/shared/ai.ts` - Current AI implementation
- `/Users/rjwhitehead/asana-plugin/src/content/gmail-content.ts` - Gmail extraction
- `/Users/rjwhitehead/asana-plugin/src/content/outlook-content.ts` - Outlook extraction
- `/Users/rjwhitehead/asana-plugin/src/popup/popup.ts` - Popup data flow
- `/Users/rjwhitehead/asana-plugin/src/shared/types.ts` - Type definitions

### External
- [AWS - Claude Prompt Engineering](https://aws.amazon.com/blogs/machine-learning/prompt-engineering-techniques-and-best-practices-learn-by-doing-with-anthropics-claude-3-on-amazon-bedrock/)
- [Prompt Engineering Guide - Summarization](https://www.promptingguide.ai/prompts/text-summarization)
- [Microsoft ISE - GPT Summary Prompt Engineering](https://devblogs.microsoft.com/ise/gpt-summary-prompt-engineering/)
- [ClickUp - Claude AI Prompts](https://clickup.com/blog/claude-ai-prompts/)
- [Harper Reed - Claude Code Email Productivity](https://harper.blog/2025/12/03/claude-code-email-productivity-mcp-agents/)
- [AirOps - Transcript Summary Prompts](https://www.airops.com/prompts/transcript-summary-ai-seo-claude-prompts)
- [Medium - Title Generation using NLP](https://medium.com/@ishita19013/title-generation-using-nlp-440fa1156e97)
