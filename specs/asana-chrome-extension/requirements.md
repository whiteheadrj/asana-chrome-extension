# Requirements: Asana Chrome Extension

## Goal

Chrome extension enabling users to create Asana tasks from any web page via right-click, keyboard shortcut, or extension icon. Prioritizes Gmail and Outlook email clients with direct email links, includes AI-powered task name suggestions, and caches Asana data for responsive UI.

## User Stories

### US-1: Basic Task Creation
**As a** user
**I want to** create an Asana task from any web page
**So that** I can capture action items without switching context

**Acceptance Criteria:**
- [ ] AC-1.1: User can open task creation UI via right-click context menu
- [ ] AC-1.2: User can open task creation UI via extension icon click
- [ ] AC-1.3: User can open task creation UI via configurable keyboard shortcut
- [ ] AC-1.4: Task creation UI shows task name field (editable)
- [ ] AC-1.5: Task creation UI shows notes field
- [ ] AC-1.6: Task creation UI shows current page URL (auto-populated, editable)
- [ ] AC-1.7: User can create task with name, notes, and URL via button or keyboard shortcut
- [ ] AC-1.8: After task creation, UI shows link to view task on Asana.com

### US-2: OAuth Authentication
**As a** user
**I want to** connect my Asana account via OAuth
**So that** I can create tasks in my workspaces

**Acceptance Criteria:**
- [ ] AC-2.1: First use prompts OAuth flow via `chrome.identity.launchWebAuthFlow()`
- [ ] AC-2.2: Redirect URL uses `chrome.identity.getRedirectURL()`
- [ ] AC-2.3: Access tokens stored securely in `chrome.storage.local`
- [ ] AC-2.4: Tokens refresh automatically before expiration (1 hour TTL)
- [ ] AC-2.5: Failed auth shows clear error message
- [ ] AC-2.6: User can disconnect/reconnect account from settings

### US-3: Workspace and Project Selection
**As a** user
**I want to** select workspace, project, and section for my task
**So that** tasks are organized correctly in Asana

**Acceptance Criteria:**
- [ ] AC-3.1: Workspace dropdown shows all user workspaces (multi-workspace support)
- [ ] AC-3.2: Project dropdown filters by selected workspace
- [ ] AC-3.3: Section dropdown filters by selected project
- [ ] AC-3.4: Extension remembers last-used workspace/project/section
- [ ] AC-3.5: Dropdowns load from cache for instant display (<100ms)
- [ ] AC-3.6: "Refresh" button forces fresh data from Asana API

### US-4: Tag Management
**As a** user
**I want to** add tags to my task
**So that** I can categorize and filter tasks

**Acceptance Criteria:**
- [ ] AC-4.1: Tag picker shows tags from selected workspace
- [ ] AC-4.2: User can select multiple tags
- [ ] AC-4.3: Tag search/filter supported
- [ ] AC-4.4: Tags are optional (task can be created without tags)

### US-5: AI Task Name Generation
**As a** user
**I want to** get AI-suggested task names
**So that** I can save time naming tasks

**Acceptance Criteria:**
- [ ] AC-5.1: User provides own API key (Claude/Anthropic) in settings
- [ ] AC-5.2: AI suggestion triggers automatically on popup open (if API key configured)
- [ ] AC-5.3: User can cancel AI generation in progress
- [ ] AC-5.4: AI uses page title, selected text, or email subject as input
- [ ] AC-5.5: User can accept, modify, or ignore AI suggestion
- [ ] AC-5.6: Extension works without AI key (manual task naming only)
- [ ] AC-5.7: AI errors show graceful fallback to manual entry

### US-6: Gmail Email Link Integration
**As a** Gmail user
**I want to** create tasks with direct links to specific emails
**So that** I can reference the original email from my task

**Acceptance Criteria:**
- [ ] AC-6.1: Extension detects when user is on mail.google.com
- [ ] AC-6.2: Extract messageId from URL hash pattern: `/mail/u/{userId}/#inbox/{messageId}`
- [ ] AC-6.3: Handle multiple Gmail accounts (different userId: `u/0`, `u/1`, etc.)
- [ ] AC-6.4: Auto-populate task URL with permanent Gmail link: `https://mail.google.com/mail/u/{userId}/#all/{messageId}`
- [ ] AC-6.5: Works with different Gmail views (inbox, all mail, search, etc.)
- [ ] AC-6.6: Fallback to current URL if messageId extraction fails
- [ ] AC-6.7: Cache email address associated with each userId for account reorder detection
- [ ] AC-6.8: Warn user if cached email for userId differs from current (account reorder detected)
- [ ] AC-6.9: Auto-include email address (at time of generation) in task notes for traceability
- [ ] AC-6.10: Detect Gmail confidential mode emails and show warning that link may not work

### US-7: Outlook Email Link Integration
**As an** Outlook user
**I want to** create tasks with direct links to specific emails
**So that** I can reference the original email from my task

**Acceptance Criteria:**
- [ ] AC-7.1: Extension detects Outlook personal (outlook.live.com)
- [ ] AC-7.2: Extension detects Outlook business (outlook.office.com)
- [ ] AC-7.3: Extension detects Office 365 (outlook.office365.com)
- [ ] AC-7.4: Extract ItemID from URL path after `/id/`
- [ ] AC-7.5: Generate permanent deep link with ItemID
- [ ] AC-7.6: Fallback to current URL if ItemID extraction fails

### US-8: Caching for Performance
**As a** user
**I want** data to load instantly
**So that** creating tasks is fast

**Acceptance Criteria:**
- [ ] AC-8.1: Workspaces, projects, sections, tags cached in `chrome.storage.local`
- [ ] AC-8.2: Cache includes TTL timestamp per entry
- [ ] AC-8.3: Cache TTL configurable (default: 5 minutes)
- [ ] AC-8.4: Stale data served while fresh data fetches in background
- [ ] AC-8.5: Cache persists across browser sessions
- [ ] AC-8.6: User can manually clear cache

### US-9: Keyboard Shortcut Configuration
**As a** user
**I want to** configure custom keyboard shortcuts
**So that** I can use shortcuts that don't conflict with other tools

**Acceptance Criteria:**
- [ ] AC-9.1: Default shortcut configurable via `chrome://extensions/shortcuts`
- [ ] AC-9.2: Settings page shows current shortcut and instructions to change
- [ ] AC-9.3: Task creation form supports keyboard shortcut to submit (e.g., Ctrl+Enter)

### US-10: Context Menu Integration
**As a** user
**I want to** right-click to create a task
**So that** I have quick access from any page

**Acceptance Criteria:**
- [ ] AC-10.1: Right-click shows "Create Asana Task" option
- [ ] AC-10.2: Context menu works on regular pages
- [ ] AC-10.3: Selected text (if any) passed to task creation as context for AI
- [ ] AC-10.4: Selected text auto-included in task notes field
- [ ] AC-10.5: Context menu disabled on restricted pages (chrome://, etc.)

## Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-1 | OAuth2 with PKCE via `chrome.identity.launchWebAuthFlow()` | High | Auth succeeds, tokens stored |
| FR-2 | Automatic token refresh before 1-hour expiration | High | API calls never fail due to expired token |
| FR-3 | Create task via POST to `/tasks` endpoint | High | Task appears in Asana |
| FR-4 | Multi-workspace support | High | All user workspaces accessible |
| FR-5 | Project/section/tag selection | High | Created task has correct assignments |
| FR-6 | Gmail messageId extraction from URL hash | High | Email link works when clicked |
| FR-7 | Outlook ItemID extraction from URL path | High | Email link works when clicked |
| FR-8 | Multiple Gmail account handling (userId) | High | Correct account link preserved |
| FR-8a | Gmail account reorder detection | High | Warn user if cached email differs |
| FR-8b | Include source email address in task notes | High | Email address visible in created task |
| FR-8c | Gmail confidential mode warning | Medium | User warned about potential link issues |
| FR-9 | Three Outlook variants (live.com, office.com, office365.com) | High | All variants extract ItemID correctly |
| FR-10 | Cache with TTL for Asana data | High | UI loads <100ms from cache |
| FR-11 | AI task name suggestion via Claude API | Medium | Suggestion appears in <2s |
| FR-11a | AI auto-trigger with cancel option | Medium | AI starts on popup, user can cancel |
| FR-11b | Selected text auto-included in notes | Medium | Selected text appears in notes field |
| FR-12 | User-provided API key for AI | Medium | Settings stores key securely |
| FR-13 | Last-used workspace/project/section persistence | Medium | Selection remembered on next use |
| FR-14 | Context menu integration | Medium | Right-click option available |
| FR-15 | Configurable keyboard shortcuts | Medium | User can change default |
| FR-16 | Manifest V3 with service workers | High | Extension passes Chrome Web Store review |
| FR-17 | Link to created task on Asana.com | Medium | Link opens correct task |
| FR-18 | Manual cache refresh | Low | Button clears and reloads cache |
| FR-19 | Rate limit handling with exponential backoff | Medium | 429 responses handled gracefully |

## Non-Functional Requirements

| ID | Requirement | Metric | Target |
|----|-------------|--------|--------|
| NFR-1 | UI responsiveness | Time to interactive | <200ms from cached data |
| NFR-2 | Task creation speed | API call duration | <2s typical |
| NFR-3 | AI suggestion latency | Time to display suggestion | <3s |
| NFR-4 | Storage usage | Total chrome.storage | <1MB typical |
| NFR-5 | Token security | Storage method | `chrome.storage.local` only |
| NFR-6 | Browser compatibility | Manifest version | V3 (Chrome 88+) |
| NFR-7 | Error recovery | Auth failures | Auto-retry with user notification |
| NFR-8 | Accessibility | Keyboard navigation | Full keyboard support in popup |

## Glossary

- **messageId**: Gmail's unique identifier for an email, found in URL hash after folder name
- **ItemID**: Outlook's unique identifier for an email, found in URL path after `/id/`
- **userId**: Gmail's account index (`u/0`, `u/1`) based on sign-in order
- **TTL**: Time-to-live - duration before cached data is considered stale
- **PKCE**: Proof Key for Code Exchange - OAuth security enhancement
- **Service Worker**: Manifest V3 replacement for background pages (non-persistent)
- **Deep Link**: URL that opens a specific item directly (email, task, etc.)

## Out of Scope

- Offline mode / task queueing (user decision: not needed)
- Task editing or deletion
- Due dates, assignees, or other task fields beyond name/notes/project/section/tags
- Mobile browser support
- Firefox or other browser support
- Attachment handling
- Sub-task creation
- Task templates
- Bulk task creation
- Gmail or Outlook API integration (only URL parsing used)
- Account creation (OAuth connects existing accounts only)

## Dependencies

| Dependency | Purpose | Required |
|------------|---------|----------|
| Asana Developer App | OAuth client ID/secret | Yes |
| Asana API | Task creation, workspace/project/section/tag retrieval | Yes |
| Claude API | AI task name suggestions | No (optional) |
| Chrome Extensions API | Extension platform | Yes |
| User's Asana Account | Authentication target | Yes |
| User's Claude API Key | AI functionality | No (optional) |

## Success Criteria

- Users can create Asana tasks from any web page in <5 seconds
- Gmail email links open correct email when clicked in created task
- Outlook email links open correct email when clicked in created task
- UI loads instantly (<200ms) for returning users (from cache)
- OAuth flow completes without errors
- Extension passes Chrome Web Store review

## Resolved Questions

| Question | Decision |
|----------|----------|
| AI trigger timing | Auto-trigger on popup open, with cancel option |
| Gmail account reorder | Warn if detected; cache email-to-userId mapping; include email address in notes |
| Selected text | Auto-include in task notes |
| Gmail confidential mode | Show warning that link may not work |

## Next Steps

1. Review and approve requirements
2. Proceed to design phase (`/design`)
3. Define technical architecture and component breakdown
4. Create implementation tasks
