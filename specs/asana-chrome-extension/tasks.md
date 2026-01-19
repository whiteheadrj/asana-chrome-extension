---
spec: asana-chrome-extension
phase: tasks
total_tasks: 47
created: 2026-01-17
---

# Tasks: Asana Chrome Extension

## Execution Context

- **Testing depth**: Comprehensive - unit tests + integration tests + end-to-end browser tests
- **Deployment**: Standard CI/CD pipeline (build, lint, test on each commit)
- **E2E validation**: Use MCP browser tools to load extension, test OAuth flow, create actual tasks in Asana
- **Quality commands** (to be configured in Phase 1):
  - Lint: `pnpm lint`
  - TypeCheck: `pnpm check-types`
  - Unit Test: `pnpm test`
  - Build: `pnpm build`

---

## Phase 1: Make It Work (POC)

Focus: Validate OAuth + task creation works end-to-end. Skip tests, accept hardcoded values.

### 1.1 Project Setup

- [x] 1.1.1 Initialize project with package.json and dependencies
  - **Do**:
    1. Create `package.json` with name "asana-chrome-extension", type "module"
    2. Add dependencies: none (vanilla TS)
    3. Add devDependencies: typescript, esbuild, @anthropic-ai/sdk (for types only), @types/chrome
    4. Add scripts: build, dev, check-types, lint
    5. Run `pnpm install`
  - **Files**: `/Users/rjwhitehead/asana-plugin/package.json`
  - **Done when**: `pnpm install` succeeds, node_modules exists
  - **Verify**: `ls /Users/rjwhitehead/asana-plugin/node_modules/.pnpm | head -5`
  - **Commit**: `chore(setup): initialize project with dependencies`

- [x] 1.1.2 Configure TypeScript
  - **Do**:
    1. Create `tsconfig.json` with strict mode, ES2022 target, module ESNext
    2. Set rootDir to `src`, outDir to `dist`
    3. Include `src/**/*.ts`
    4. Add types: ["chrome"]
  - **Files**: `/Users/rjwhitehead/asana-plugin/tsconfig.json`
  - **Done when**: `pnpm check-types` runs (may have no files yet)
  - **Verify**: `pnpm check-types 2>&1 || echo "OK - no files yet"`
  - **Commit**: `chore(setup): configure TypeScript`

- [x] 1.1.3 Configure esbuild for extension bundling
  - **Do**:
    1. Create `esbuild.config.js` with entry points: service-worker, popup, gmail-content, outlook-content, settings
    2. Set outdir to `dist`, bundle true, format esm
    3. Configure external: ["chrome"]
    4. Add build script that copies manifest, HTML, CSS, icons
  - **Files**: `/Users/rjwhitehead/asana-plugin/esbuild.config.js`
  - **Done when**: Running build script creates dist folder structure
  - **Verify**: `node /Users/rjwhitehead/asana-plugin/esbuild.config.js && ls /Users/rjwhitehead/asana-plugin/dist`
  - **Commit**: `chore(setup): configure esbuild bundler`

- [x] 1.1.4 Create manifest.json for Chrome Extension MV3
  - **Do**:
    1. Create `manifest.json` with version 3
    2. Add permissions: identity, storage, contextMenus, activeTab
    3. Add host_permissions: https://app.asana.com/*, https://api.anthropic.com/*
    4. Configure service_worker, content_scripts for Gmail/Outlook
    5. Configure action popup, options_page, commands (Alt+A)
  - **Files**: `/Users/rjwhitehead/asana-plugin/manifest.json`
  - **Done when**: Valid JSON, all required MV3 fields present
  - **Verify**: `node -e "JSON.parse(require('fs').readFileSync('/Users/rjwhitehead/asana-plugin/manifest.json')); console.log('Valid JSON')"`
  - **Commit**: `feat(manifest): create MV3 manifest with permissions`
  - _Requirements: FR-16, AC-9.1_
  - _Design: Manifest V3 Configuration_

### 1.2 Shared Modules

- [x] 1.2.1 Create shared TypeScript types
  - **Do**:
    1. Create `src/shared/types.ts`
    2. Define ExtensionMessage union type
    3. Define CreateTaskPayload, CreateTaskResponse
    4. Define Asana types: Workspace, Project, Section, Tag, Task
    5. Define OAuth types: OAuthTokens, OAuthConfig
    6. Define Cache types: CacheEntry, CacheConfig
    7. Define Gmail/Outlook info types
    8. Define PopupState, Warning types
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/shared/types.ts`
  - **Done when**: File compiles with no errors
  - **Verify**: `pnpm check-types`
  - **Commit**: `feat(types): add shared TypeScript interfaces`
  - _Design: All component interfaces_

- [x] 1.2.2 Create constants module
  - **Do**:
    1. Create `src/shared/constants.ts`
    2. Define ASANA_API_BASE = "https://app.asana.com/api/1.0"
    3. Define CLAUDE_API_BASE = "https://api.anthropic.com/v1"
    4. Define DEFAULT_CACHE_TTL = 5 * 60 * 1000
    5. Define STORAGE_KEYS enum
    6. Define OAUTH_SCOPES array
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/shared/constants.ts`
  - **Done when**: File compiles, exports all constants
  - **Verify**: `pnpm check-types`
  - **Commit**: `feat(constants): add shared constants`
  - _Design: Cache Keys table, OAuth Config_

- [x] 1.2.3 Create storage utilities module
  - **Do**:
    1. Create `src/shared/storage.ts`
    2. Implement get<T>(key): Promise<T | null>
    3. Implement set<T>(key, value): Promise<void>
    4. Implement remove(key): Promise<void>
    5. Implement getTokens(): Promise<OAuthTokens | null>
    6. Implement setTokens(tokens): Promise<void>
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/shared/storage.ts`
  - **Done when**: File compiles, exports all functions
  - **Verify**: `pnpm check-types`
  - **Commit**: `feat(storage): add chrome.storage utilities`
  - _Requirements: AC-2.3, AC-8.1_
  - _Design: Storage utilities_

- [x] V1 [VERIFY] Quality checkpoint: build and type check
  - **Do**: Run build and type check commands
  - **Verify**: `pnpm check-types && pnpm build`
  - **Done when**: No type errors, dist folder created
  - **Commit**: `chore(setup): pass initial quality checkpoint` (if fixes needed)

### 1.3 OAuth Implementation

- [x] 1.3.1 Create OAuth module with PKCE flow
  - **Do**:
    1. Create `src/background/oauth.ts`
    2. Implement generateCodeVerifier() using crypto.getRandomValues
    3. Implement generateCodeChallenge(verifier) with SHA-256
    4. Implement startAuthFlow() using chrome.identity.launchWebAuthFlow
    5. Implement exchangeCodeForTokens(code, verifier)
    6. Store tokens via storage.ts
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/background/oauth.ts`
  - **Done when**: startAuthFlow exports, compiles
  - **Verify**: `pnpm check-types`
  - **Commit**: `feat(oauth): implement PKCE authorization flow`
  - _Requirements: FR-1, AC-2.1, AC-2.2_
  - _Design: OAuth Module_

- [x] 1.3.2 Implement token refresh and access management
  - **Do**:
    1. Add refreshTokens() to oauth.ts - POST to /oauth/token with refresh_token grant
    2. Add getValidAccessToken() - checks expiry, auto-refreshes if <5 min left
    3. Add isAuthenticated() - checks for valid tokens
    4. Add logout() - clears tokens from storage
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/background/oauth.ts`
  - **Done when**: All 4 functions export, compile
  - **Verify**: `pnpm check-types`
  - **Commit**: `feat(oauth): add token refresh and management`
  - _Requirements: FR-2, AC-2.4, AC-2.6_
  - _Design: Token Refresh Strategy diagram_

### 1.4 Asana API

- [x] 1.4.1 Create Asana API wrapper module
  - **Do**:
    1. Create `src/background/asana-api.ts`
    2. Implement asanaFetch(endpoint, options) - adds auth header, handles errors
    3. Implement getWorkspaces(): Promise<AsanaWorkspace[]>
    4. Implement getProjects(workspaceGid): Promise<AsanaProject[]>
    5. Implement getSections(projectGid): Promise<AsanaSection[]>
    6. Implement getTags(workspaceGid): Promise<AsanaTag[]>
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/background/asana-api.ts`
  - **Done when**: All functions export, compile
  - **Verify**: `pnpm check-types`
  - **Commit**: `feat(api): add Asana API wrapper for data fetching`
  - _Requirements: FR-3, FR-4, FR-5_
  - _Design: Asana API Module_

- [x] 1.4.2 Implement task creation endpoint
  - **Do**:
    1. Add createTask(payload: CreateTaskPayload): Promise<AsanaTask>
    2. POST to /tasks with name, notes, projects, tags, workspace
    3. Return gid and permalink_url from response
    4. Add basic error handling (throw on non-2xx)
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/background/asana-api.ts`
  - **Done when**: createTask exports, compiles
  - **Verify**: `pnpm check-types`
  - **Commit**: `feat(api): add task creation endpoint`
  - _Requirements: FR-3, AC-1.7, FR-17_
  - _Design: CreateTaskPayload, CreateTaskResponse_

- [x] 1.4.3 Add rate limit handling with exponential backoff
  - **Do**:
    1. Modify asanaFetch to detect 429 status
    2. Implement retry with delays: 1s, 2s, 4s (max 3 retries)
    3. Parse Retry-After header if present
    4. Throw after max retries exhausted
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/background/asana-api.ts`
  - **Done when**: 429 handling logic present, compiles
  - **Verify**: `pnpm check-types`
  - **Commit**: `feat(api): add rate limit handling with backoff`
  - _Requirements: FR-19_
  - _Design: Error Handling table_

- [x] V2 [VERIFY] Quality checkpoint: build passes
  - **Do**: Run build and type check
  - **Verify**: `pnpm check-types && pnpm build`
  - **Done when**: No errors
  - **Commit**: `chore(api): pass quality checkpoint` (if fixes needed)

### 1.5 Cache Module

- [x] 1.5.1 Implement cache with TTL support
  - **Do**:
    1. Create `src/background/cache.ts`
    2. Implement getCached<T>(key): returns data if not expired, null otherwise
    3. Implement setCached<T>(key, data, ttl): stores with timestamp
    4. Implement isCacheValid(entry): checks TTL
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/background/cache.ts`
  - **Done when**: Basic cache functions work
  - **Verify**: `pnpm check-types`
  - **Commit**: `feat(cache): add TTL-based caching`
  - _Requirements: AC-8.1, AC-8.2, AC-8.3_
  - _Design: Cache Module interfaces_

- [x] 1.5.2 Implement stale-while-revalidate pattern
  - **Do**:
    1. Add getOrFetch<T>(key, fetchFn, options) to cache.ts
    2. Return cached data immediately if exists
    3. Trigger background refresh if stale
    4. Support forceRefresh option to bypass cache
    5. Add clearCache() function
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/background/cache.ts`
  - **Done when**: getOrFetch exports, compiles
  - **Verify**: `pnpm check-types`
  - **Commit**: `feat(cache): add stale-while-revalidate pattern`
  - _Requirements: AC-8.4, AC-8.6_
  - _Design: Cache Module, Performance Considerations_

### 1.6 Service Worker

- [x] 1.6.1 Create service worker with message routing
  - **Do**:
    1. Create `src/background/service-worker.ts`
    2. Add chrome.runtime.onMessage listener
    3. Route messages by type: GET_AUTH_STATUS, START_AUTH, LOGOUT
    4. Route data messages: GET_WORKSPACES, GET_PROJECTS, GET_SECTIONS, GET_TAGS
    5. Route CREATE_TASK to Asana API
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/background/service-worker.ts`
  - **Done when**: Message handler routes all message types
  - **Verify**: `pnpm check-types && pnpm build`
  - **Commit**: `feat(sw): create service worker with message routing`
  - _Design: Service Worker component_

- [x] 1.6.2 Implement context menu registration
  - **Do**:
    1. Create `src/background/context-menu.ts`
    2. Register "Create Asana Task" context menu on install
    3. Handle click events - send message to open popup with selected text
    4. Import and call from service-worker.ts on startup
  - **Files**:
    - `/Users/rjwhitehead/asana-plugin/src/background/context-menu.ts`
    - `/Users/rjwhitehead/asana-plugin/src/background/service-worker.ts`
  - **Done when**: Context menu registers, compiles
  - **Verify**: `pnpm check-types && pnpm build`
  - **Commit**: `feat(menu): add right-click context menu`
  - _Requirements: FR-14, AC-10.1, AC-10.2_
  - _Design: Context Menu handler_

- [x] V3 [VERIFY] Quality checkpoint: full build
  - **Do**: Run complete build
  - **Verify**: `pnpm check-types && pnpm build && ls /Users/rjwhitehead/asana-plugin/dist/*.js`
  - **Done when**: All JS files in dist
  - **Commit**: `chore(sw): pass quality checkpoint` (if fixes needed)

### 1.7 Content Scripts

- [x] 1.7.1 Implement Gmail content script
  - **Do**:
    1. Create `src/content/gmail-content.ts`
    2. Implement parseGmailUrl(url): extract userId, messageId from hash
    3. Build permanent URL using #all/{messageId}
    4. Detect current account email from DOM (profile element)
    5. Check for confidential mode UI indicators
    6. Listen for messages from popup, respond with GmailEmailInfo
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/content/gmail-content.ts`
  - **Done when**: parseGmailUrl handles inbox, all, sent, search views
  - **Verify**: `pnpm check-types && pnpm build`
  - **Commit**: `feat(gmail): add email link extraction content script`
  - _Requirements: FR-6, FR-8, AC-6.1-AC-6.10_
  - _Design: Gmail Content Script_

- [x] 1.7.2 Implement Outlook content script
  - **Do**:
    1. Create `src/content/outlook-content.ts`
    2. Implement parseOutlookUrl(url): detect variant, extract ItemID
    3. Handle all 3 variants: live.com, office.com, office365.com
    4. Build permanent deep link with office365.com/owa format
    5. Listen for messages from popup, respond with OutlookEmailInfo
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/content/outlook-content.ts`
  - **Done when**: Handles all 3 Outlook variants
  - **Verify**: `pnpm check-types && pnpm build`
  - **Commit**: `feat(outlook): add email link extraction content script`
  - _Requirements: FR-7, FR-9, AC-7.1-AC-7.6_
  - _Design: Outlook Content Script_

### 1.8 AI Module

- [x] 1.8.1 Implement Claude API task name generation
  - **Do**:
    1. Create `src/shared/ai.ts`
    2. Implement generateTaskName(input, config, signal?)
    3. Build system prompt for concise task titles
    4. Call Claude API with anthropic-dangerous-direct-browser-access header
    5. Support AbortSignal for cancellation
    6. Handle errors gracefully, return null on failure
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/shared/ai.ts`
  - **Done when**: generateTaskName exports, handles success/error/cancel
  - **Verify**: `pnpm check-types`
  - **Commit**: `feat(ai): add Claude API integration for task names`
  - _Requirements: FR-11, FR-11a, AC-5.1-AC-5.7_
  - _Design: AI Module_

### 1.9 Popup UI

- [x] 1.9.1 Create popup HTML and CSS
  - **Do**:
    1. Create `src/popup/popup.html` with form structure
    2. Add fields: task name (with AI indicator), notes, URL
    3. Add dropdowns: workspace, project, section, tags
    4. Add buttons: submit, refresh cache
    5. Create `src/popup/popup.css` with clean styling
    6. Add loading states, error message areas
  - **Files**:
    - `/Users/rjwhitehead/asana-plugin/src/popup/popup.html`
    - `/Users/rjwhitehead/asana-plugin/src/popup/popup.css`
  - **Done when**: HTML renders, CSS loads
  - **Verify**: `pnpm build && ls /Users/rjwhitehead/asana-plugin/dist/popup`
  - **Commit**: `feat(popup): create task creation form UI`
  - _Requirements: AC-1.4, AC-1.5, AC-1.6, AC-3.1-AC-3.3, AC-4.1-AC-4.3_
  - _Design: Popup UI, PopupState_

- [x] 1.9.2 Implement popup logic - auth and data loading
  - **Do**:
    1. Create `src/popup/popup.ts`
    2. On load: check auth status via message to service worker
    3. If not authenticated: show login button, trigger START_AUTH
    4. If authenticated: load workspaces from cache/API
    5. Populate dropdowns with workspace/project/section/tag data
    6. Remember and restore last-used selections
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/popup/popup.ts`
  - **Done when**: Auth flow works, dropdowns populate
  - **Verify**: `pnpm check-types && pnpm build`
  - **Commit**: `feat(popup): add auth flow and data loading`
  - _Requirements: AC-3.4, AC-3.5, FR-13_
  - _Design: PopupState, Data Flow diagram_

- [x] 1.9.3 Implement popup logic - AI suggestion and page info
  - **Do**:
    1. On load: request page info from content script (if email page)
    2. Auto-populate URL field with permanent email link
    3. Trigger AI generation if API key configured
    4. Show loading indicator during AI
    5. Allow cancel button for AI
    6. Fill task name with suggestion or leave editable
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/popup/popup.ts`
  - **Done when**: AI suggestion appears, can be cancelled
  - **Verify**: `pnpm check-types && pnpm build`
  - **Commit**: `feat(popup): add AI task name suggestion`
  - _Requirements: AC-5.2, AC-5.3, AC-5.4, AC-5.5, AC-6.4, AC-7.5_
  - _Design: Data Flow diagram_

- [x] 1.9.4 Implement popup logic - task submission
  - **Do**:
    1. Handle form submit (button click and Ctrl+Enter)
    2. Validate required fields (name, project)
    3. Send CREATE_TASK message to service worker
    4. Show loading state during submission
    5. On success: show task link to Asana
    6. On error: show error message
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/popup/popup.ts`
  - **Done when**: Task submission works, shows result
  - **Verify**: `pnpm check-types && pnpm build`
  - **Commit**: `feat(popup): add task submission with success/error states`
  - _Requirements: AC-1.7, AC-1.8, AC-9.3_
  - _Design: Data Flow diagram, Error Handling table_

- [x] V4 [VERIFY] Quality checkpoint: full build passes
  - **Do**: Run full build
  - **Verify**: `pnpm check-types && pnpm build`
  - **Done when**: All files compiled
  - **Commit**: `chore(popup): pass quality checkpoint` (if fixes needed)

### 1.10 Settings Page

- [x] 1.10.1 Create settings page for API key and cache
  - **Do**:
    1. Create `src/settings/settings.html` with form
    2. Add Claude API key input field (password type)
    3. Add current keyboard shortcut display
    4. Add cache TTL setting
    5. Add buttons: clear cache, disconnect account
    6. Create `src/settings/settings.ts` for logic
    7. Create `src/settings/settings.css` for styling
  - **Files**:
    - `/Users/rjwhitehead/asana-plugin/src/settings/settings.html`
    - `/Users/rjwhitehead/asana-plugin/src/settings/settings.ts`
    - `/Users/rjwhitehead/asana-plugin/src/settings/settings.css`
  - **Done when**: Settings page loads, saves API key
  - **Verify**: `pnpm check-types && pnpm build`
  - **Commit**: `feat(settings): add settings page for API key and cache`
  - _Requirements: AC-5.1, AC-8.3, AC-8.6, AC-9.2_
  - _Design: File Structure table_

### 1.11 Extension Assets

- [x] 1.11.1 Create extension icons
  - **Do**:
    1. Create `icons/` directory
    2. Create simple Asana-style icon in 3 sizes: 16x16, 48x48, 128x128
    3. Use PNG format
    4. Simple design: checkmark or task icon
  - **Files**:
    - `/Users/rjwhitehead/asana-plugin/icons/icon16.png`
    - `/Users/rjwhitehead/asana-plugin/icons/icon48.png`
    - `/Users/rjwhitehead/asana-plugin/icons/icon128.png`
  - **Done when**: All 3 icon sizes exist
  - **Verify**: `ls /Users/rjwhitehead/asana-plugin/icons/*.png | wc -l` (should be 3)
  - **Commit**: `feat(icons): add extension icons`
  - _Design: Manifest icons configuration_

### 1.12 POC E2E Validation

- [x] 1.12.1 [SKIP] POC Checkpoint: Load extension and complete OAuth
  - **Skipped**: Requires manual user action (chrome://extensions access blocked by browser security, OAuth requires human authorization)
  - **Do**:
    1. Build extension: `pnpm build`
    2. Use MCP browser tools to open chrome://extensions
    3. Enable Developer mode, load unpacked from dist/
    4. Click extension icon
    5. Complete OAuth flow with Asana
    6. Verify workspaces load in dropdown
  - **Done when**: OAuth succeeds, workspaces appear
  - **Verify**: Use MCP browser automation to screenshot popup showing workspaces
  - **Commit**: `feat(poc): complete OAuth and workspace loading`
  - _Requirements: US-2, US-3_

- [x] 1.12.2 [SKIP] POC Checkpoint: Create task from web page
  - **Skipped**: Requires manual user action (depends on 1.12.1, OAuth authorization)
  - **Do**:
    1. Navigate to any web page
    2. Click extension icon
    3. Enter task name, select project
    4. Click Create Task
    5. Verify task appears in Asana.com
  - **Done when**: Task visible in Asana with correct name/URL
  - **Verify**: Use MCP browser to navigate to created task URL, verify it exists
  - **Commit**: `feat(poc): complete basic task creation`
  - _Requirements: US-1, FR-3_

- [x] 1.12.3 [SKIP] POC Checkpoint: Gmail email link extraction
  - **Skipped**: Requires manual user action (depends on 1.12.1, OAuth authorization)
  - **Do**:
    1. Navigate to Gmail, open an email
    2. Click extension icon
    3. Verify URL field shows permanent email link (#all/ format)
    4. Create task
    5. Click email link in created Asana task
    6. Verify correct email opens
  - **Done when**: Email link in task opens correct email
  - **Verify**: Use MCP browser to click link in Asana task, verify Gmail opens to correct email
  - **Commit**: `feat(poc): complete Gmail email link extraction`
  - _Requirements: US-6, FR-6, FR-8_

---

## Phase 2: Refactoring

After POC validated, clean up code structure.

- [x] 2.1 Extract common message handling patterns
  - **Do**:
    1. Create message handler utilities in shared/
    2. Add typed message sender/receiver functions
    3. Refactor service worker to use utilities
    4. Add consistent error response format
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/shared/messaging.ts`
  - **Done when**: All message handling uses utilities
  - **Verify**: `pnpm check-types`
  - **Commit**: `refactor(messaging): extract typed message utilities`
  - _Design: ExtensionMessage types_

- [x] 2.2 Add comprehensive error handling
  - **Do**:
    1. Create error types: AuthError, ApiError, NetworkError
    2. Add try/catch in all async functions
    3. Propagate meaningful error messages to UI
    4. Add network offline detection
  - **Files**:
    - `/Users/rjwhitehead/asana-plugin/src/shared/errors.ts`
    - Update all modules
  - **Done when**: All error paths handled, UI shows user-friendly messages
  - **Verify**: `pnpm check-types`
  - **Commit**: `refactor(errors): add comprehensive error handling`
  - _Design: Error Handling table_

- [x] 2.3 Implement warning system for Gmail edge cases
  - **Do**:
    1. Add email-to-userId cache mapping
    2. Detect account reorder by comparing cached vs current email
    3. Show warning in popup if mismatch detected
    4. Detect confidential mode emails, show warning
    5. Include email address in task notes
  - **Files**:
    - `/Users/rjwhitehead/asana-plugin/src/content/gmail-content.ts`
    - `/Users/rjwhitehead/asana-plugin/src/popup/popup.ts`
  - **Done when**: Warnings display for edge cases
  - **Verify**: `pnpm check-types`
  - **Commit**: `refactor(gmail): add account reorder and confidential mode detection`
  - _Requirements: FR-8a, FR-8b, FR-8c, AC-6.7, AC-6.8, AC-6.9, AC-6.10_
  - _Design: Edge Cases section_

- [x] V5 [VERIFY] Quality checkpoint: lint and types
  - **Do**: Run lint and type check
  - **Verify**: `pnpm lint && pnpm check-types`
  - **Done when**: No errors
  - **Commit**: `chore(refactor): pass quality checkpoint` (if fixes needed)

---

## Phase 3: Testing

- [x] 3.1 Configure Vitest for unit testing
  - **Do**:
    1. Install vitest as dev dependency
    2. Create `vitest.config.ts`
    3. Add mock for chrome APIs
    4. Add test script to package.json
  - **Files**:
    - `/Users/rjwhitehead/asana-plugin/vitest.config.ts`
    - `/Users/rjwhitehead/asana-plugin/package.json`
  - **Done when**: `pnpm test` runs (no tests yet)
  - **Verify**: `pnpm test 2>&1 | grep -E "(vitest|0 tests)"`
  - **Commit**: `test(setup): configure Vitest for unit testing`
  - _Design: Test Strategy_

- [x] 3.2 Add unit tests for Gmail URL parsing
  - **Do**:
    1. Create `src/content/__tests__/gmail-content.test.ts`
    2. Test parseGmailUrl with inbox view
    3. Test parseGmailUrl with all mail view
    4. Test parseGmailUrl with search view
    5. Test parseGmailUrl with different userIds
    6. Test fallback when no messageId found
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/content/__tests__/gmail-content.test.ts`
  - **Done when**: All tests pass
  - **Verify**: `pnpm test src/content/__tests__/gmail-content.test.ts`
  - **Commit**: `test(gmail): add URL parsing unit tests`
  - _Design: Test Strategy - gmail-content.ts_

- [x] 3.3 Add unit tests for Outlook URL parsing
  - **Do**:
    1. Create `src/content/__tests__/outlook-content.test.ts`
    2. Test parseOutlookUrl for live.com (personal)
    3. Test parseOutlookUrl for office.com (business)
    4. Test parseOutlookUrl for office365.com
    5. Test permanent link generation
    6. Test fallback when no ItemID found
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/content/__tests__/outlook-content.test.ts`
  - **Done when**: All tests pass
  - **Verify**: `pnpm test src/content/__tests__/outlook-content.test.ts`
  - **Commit**: `test(outlook): add URL parsing unit tests`
  - _Design: Test Strategy - outlook-content.ts_

- [x] 3.4 Add unit tests for cache module
  - **Do**:
    1. Create `src/background/__tests__/cache.test.ts`
    2. Mock chrome.storage.local
    3. Test getCached returns null for missing key
    4. Test setCached stores with timestamp
    5. Test TTL expiration
    6. Test stale-while-revalidate behavior
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/background/__tests__/cache.test.ts`
  - **Done when**: All tests pass
  - **Verify**: `pnpm test src/background/__tests__/cache.test.ts`
  - **Commit**: `test(cache): add caching unit tests`
  - _Design: Test Strategy - cache.ts_

- [x] 3.5 Add unit tests for OAuth module
  - **Do**:
    1. Create `src/background/__tests__/oauth.test.ts`
    2. Mock chrome.identity and chrome.storage
    3. Test PKCE code verifier generation
    4. Test code challenge generation
    5. Test token refresh logic
    6. Test isAuthenticated states
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/background/__tests__/oauth.test.ts`
  - **Done when**: All tests pass
  - **Verify**: `pnpm test src/background/__tests__/oauth.test.ts`
  - **Commit**: `test(oauth): add OAuth flow unit tests`
  - _Design: Test Strategy - oauth.ts_

- [x] V6 [VERIFY] Quality checkpoint: all tests pass
  - **Do**: Run full test suite
  - **Verify**: `pnpm test`
  - **Done when**: All unit tests pass
  - **Commit**: `chore(test): pass quality checkpoint` (if fixes needed)

- [x] 3.6 Add unit tests for AI module
  - **Do**:
    1. Create `src/shared/__tests__/ai.test.ts`
    2. Mock fetch
    3. Test successful API call formatting
    4. Test error handling (API error, network error)
    5. Test AbortSignal cancellation
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/shared/__tests__/ai.test.ts`
  - **Done when**: All tests pass
  - **Verify**: `pnpm test src/shared/__tests__/ai.test.ts`
  - **Commit**: `test(ai): add Claude API unit tests`
  - _Design: Test Strategy - ai.ts_

- [x] 3.7 Add unit tests for Asana API module
  - **Do**:
    1. Create `src/background/__tests__/asana-api.test.ts`
    2. Mock fetch
    3. Test API call formatting with auth header
    4. Test rate limit 429 handling
    5. Test exponential backoff timing
    6. Test error response handling
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/background/__tests__/asana-api.test.ts`
  - **Done when**: All tests pass
  - **Verify**: `pnpm test src/background/__tests__/asana-api.test.ts`
  - **Commit**: `test(api): add Asana API unit tests`
  - _Design: Test Strategy - asana-api.ts_

- [x] 3.8 Add integration tests for service worker message handling
  - **Do**:
    1. Create `src/background/__tests__/service-worker.integration.test.ts`
    2. Mock chrome APIs fully
    3. Test GET_AUTH_STATUS message flow
    4. Test CREATE_TASK with mocked Asana API
    5. Test cache refresh message
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/background/__tests__/service-worker.integration.test.ts`
  - **Done when**: All tests pass
  - **Verify**: `pnpm test src/background/__tests__/service-worker.integration.test.ts`
  - **Commit**: `test(sw): add service worker integration tests`
  - _Design: Integration Tests table_

- [x] V7 [VERIFY] Quality checkpoint: full test suite
  - **Do**: Run complete test suite
  - **Verify**: `pnpm test`
  - **Done when**: All tests pass
  - **Commit**: `chore(test): pass quality checkpoint` (if fixes needed)

---

## Phase 4: Quality Gates

- [x] 4.1 Configure ESLint
  - **Do**:
    1. Install eslint, @typescript-eslint/parser, @typescript-eslint/eslint-plugin
    2. Create `.eslintrc.json` with recommended rules
    3. Add lint script to package.json
    4. Fix any linting errors
  - **Files**:
    - `/Users/rjwhitehead/asana-plugin/.eslintrc.json`
    - `/Users/rjwhitehead/asana-plugin/package.json`
  - **Done when**: `pnpm lint` passes
  - **Verify**: `pnpm lint`
  - **Commit**: `chore(lint): configure ESLint`

- [x] 4.2 Fix all linting and type errors
  - **Do**:
    1. Run `pnpm lint --fix` for auto-fixable issues
    2. Manually fix remaining lint errors
    3. Fix any type errors
  - **Files**: Various source files
  - **Done when**: Zero lint/type errors
  - **Verify**: `pnpm lint && pnpm check-types`
  - **Commit**: `fix(lint): resolve all linting errors`

- [x] V8 [VERIFY] Full local CI: lint + types + test + build
  - **Do**: Run complete local CI suite
  - **Verify**: `pnpm lint && pnpm check-types && pnpm test && pnpm build`
  - **Done when**: All commands pass
  - **Commit**: `chore(ci): pass local CI` (if fixes needed)

- [x] 4.3 Create GitHub Actions CI workflow
  - **Do**:
    1. Create `.github/workflows/ci.yml`
    2. Trigger on push and PR
    3. Steps: checkout, setup pnpm, install, lint, check-types, test, build
    4. Cache node_modules
  - **Files**: `/Users/rjwhitehead/asana-plugin/.github/workflows/ci.yml`
  - **Done when**: Workflow file valid YAML
  - **Verify**: `node -e "require('js-yaml').load(require('fs').readFileSync('.github/workflows/ci.yml')); console.log('Valid YAML')" 2>/dev/null || echo "Need to install js-yaml or check manually"`
  - **Commit**: `ci: add GitHub Actions workflow`

- [x] 4.4 Create feature branch and push
  - **Do**:
    1. Verify current branch: `git branch --show-current`
    2. If on main, create feature branch: `git checkout -b feat/asana-extension`
    3. Push branch: `git push -u origin feat/asana-extension`
  - **Done when**: Branch pushed to origin
  - **Verify**: `git branch -r | grep feat/asana-extension`
  - **Commit**: None (just push)

- [x] V9 [VERIFY] CI pipeline passes
  - **Do**: Verify GitHub Actions passes after push
  - **Verify**: `gh pr checks --watch` or `gh run list --limit 1`
  - **Done when**: CI pipeline shows all green
  - **Commit**: None

- [x] 4.5 Create PR with summary
  - **Do**:
    1. Create PR: `gh pr create --title "feat: Asana Chrome Extension" --body "<summary>"`
    2. Include: feature list, test coverage, how to test manually
    3. Link to requirements
  - **Done when**: PR created, URL returned
  - **Verify**: `gh pr view --json state,title | jq`
  - **Commit**: None

- [ ] V10 [VERIFY] AC checklist
  - **Do**: Verify all acceptance criteria from requirements.md
  - **Verify**:
    - AC-1.x: Check popup.ts implements all task creation flows
    - AC-2.x: Check oauth.ts implements all auth flows
    - AC-3.x: Check dropdowns work in popup
    - AC-4.x: Check tag selection in popup
    - AC-5.x: Check AI integration in ai.ts and popup.ts
    - AC-6.x: Check Gmail extraction in gmail-content.ts
    - AC-7.x: Check Outlook extraction in outlook-content.ts
    - AC-8.x: Check cache.ts implementation
    - AC-9.x: Check manifest.json commands and settings
    - AC-10.x: Check context-menu.ts implementation
  - **Done when**: All grep/code checks confirm AC implementation
  - **Commit**: None

---

## Notes

### POC Shortcuts Taken

- Hardcoded Asana OAuth client ID (needs env var for production)
- Minimal error messages (refined in Phase 2)
- No input validation (added in Phase 2)
- Gmail confidential mode detection is basic DOM check

### Production TODOs

- Add .env file support for client ID
- Add input sanitization
- Add analytics/telemetry hooks
- Add keyboard accessibility improvements
- Add more detailed logging for debugging
- Consider adding task edit capability in future version

### Dependencies Between Tasks

- 1.1.x (setup) must complete before any other tasks
- 1.2.x (shared) must complete before 1.3-1.9
- 1.3.x (OAuth) must complete before 1.6 (service worker API calls)
- 1.4.x (API) must complete before 1.6 (service worker task creation)
- 1.5.x (cache) should complete before 1.6 (service worker data loading)
- 1.6.x (service worker) must complete before 1.9 (popup)
- Phase 2 depends on Phase 1 POC validation
- Phase 3 depends on Phase 2 refactoring
- Phase 4 depends on Phase 3 testing

### Risk Areas

- OAuth token refresh timing edge cases
- Gmail/Outlook URL parsing with new UI versions
- Claude API CORS with browser extension context
- Large tag lists (>100) performance
