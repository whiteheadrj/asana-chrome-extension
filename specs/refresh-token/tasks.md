# Tasks: Refresh Token Error Handling

## Phase 1: Make It Work (POC)

Focus: Validate retry logic, error parsing, and logging work end-to-end. Skip tests, accept shortcuts.

- [x] 1.1 Add asanaErrorCode property to AuthExpiredError
  - **Do**:
    1. Open `src/shared/errors.ts`
    2. Add optional `asanaErrorCode?: string` property to AuthExpiredError class
    3. Update constructor to accept `asanaErrorCode` parameter
    4. Add `getMessageForErrorCode()` helper function to map error codes to user messages
    5. Make `userMessage` dynamic based on error code
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/shared/errors.ts`
  - **Done when**: AuthExpiredError has `asanaErrorCode` property and dynamic `userMessage`
  - **Verify**: `pnpm check-types`
  - **Commit**: `feat(errors): add asanaErrorCode property to AuthExpiredError`
  - _Requirements: FR-6, AC-4.1, AC-4.2_
  - _Design: AuthExpiredError Enhancement_

- [x] 1.2 Add AsanaOAuthError interface and parseAsanaError helper
  - **Do**:
    1. Open `src/background/oauth.ts`
    2. Add `AsanaOAuthError` interface with `error` and `error_description` fields
    3. Add `parseAsanaError(response: Response)` function that:
       - Clones response to avoid consuming body
       - Safely parses JSON
       - Returns null if parse fails
       - Returns `AsanaOAuthError` if valid
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/background/oauth.ts`
  - **Done when**: `parseAsanaError` function exists and compiles
  - **Verify**: `pnpm check-types`
  - **Commit**: `feat(oauth): add parseAsanaError helper for Asana error responses`
  - _Requirements: FR-1, AC-3.1_
  - _Design: parseAsanaError component_

- [x] 1.3 Add RefreshFailureContext interface and logRefreshFailure function
  - **Do**:
    1. Open `src/background/oauth.ts`
    2. Add `RefreshFailureContext` interface with: timestamp, attempt, totalAttempts, httpStatus, asanaError, asanaDescription, isRecoverable, errorType
    3. Add `logRefreshFailure(context: RefreshFailureContext)` function that:
       - Uses `console.error` with `[OAuth]` prefix
       - Formats multi-line output with timestamp, status, error, description, recoverable, type
       - Never logs token values
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/background/oauth.ts`
  - **Done when**: `logRefreshFailure` function exists and compiles
  - **Verify**: `pnpm check-types`
  - **Commit**: `feat(oauth): add logRefreshFailure diagnostic logging`
  - _Requirements: FR-4, AC-3.1, AC-3.2, AC-3.3, AC-3.4, AC-3.5_
  - _Design: logRefreshFailure component_

- [x] 1.4 [VERIFY] Quality checkpoint: pnpm lint && pnpm check-types
  - **Do**: Run quality commands to catch issues early
  - **Verify**: `pnpm lint && pnpm check-types`
  - **Done when**: Both commands exit 0
  - **Commit**: `chore(oauth): pass quality checkpoint` (only if fixes needed)

- [x] 1.5 Add verifyTokenStorage function
  - **Do**:
    1. Open `src/background/oauth.ts`
    2. Import `getTokens` if not already imported
    3. Add `verifyTokenStorage(expected: OAuthTokens): Promise<boolean>` function that:
       - Reads tokens from storage via `getTokens()`
       - Compares accessToken, refreshToken, expiresAt
       - Logs warning via `console.warn('[OAuth] Token storage verification failed')` if mismatch
       - Returns boolean (does NOT throw)
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/background/oauth.ts`
  - **Done when**: `verifyTokenStorage` function exists and compiles
  - **Verify**: `pnpm check-types`
  - **Commit**: `feat(oauth): add verifyTokenStorage for read-after-write verification`
  - _Requirements: FR-5_
  - _Design: verifyTokenStorage component_

- [x] 1.6 Add retry constants and sleep helper to oauth.ts
  - **Do**:
    1. Open `src/background/oauth.ts`
    2. Add constants (matching asana-api.ts pattern):
       - `const MAX_REFRESH_RETRIES = 3;`
       - `const BASE_DELAY_MS = 1000;`
    3. Add `sleep(ms: number): Promise<void>` helper
    4. Add `calculateBackoffDelay(attempt: number): number` helper (exponential: 2^n)
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/background/oauth.ts`
  - **Done when**: Retry constants and helpers exist
  - **Verify**: `pnpm check-types`
  - **Commit**: `feat(oauth): add retry constants and backoff helpers`
  - _Requirements: FR-3, AC-2.2_
  - _Design: retryWithBackoff configuration_

- [x] 1.7 Refactor refreshTokens with retry loop and error handling
  - **Do**:
    1. Open `src/background/oauth.ts`
    2. Wrap existing fetch call in retry loop (`for attempt = 0; attempt <= MAX_REFRESH_RETRIES`)
    3. On network error (fetch throws): log, wait backoff, continue
    4. On 5xx: log, wait backoff, continue
    5. On 400/401: parse error with `parseAsanaError()`, log, throw AuthExpiredError with asanaErrorCode
    6. On success: store tokens, call `verifyTokenStorage()`, return
    7. After retries exhausted: throw NetworkError with "Connection failed" message
    8. Use proper isRecoverable logic: network/5xx = recoverable, 4xx auth = not recoverable
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/background/oauth.ts`
  - **Done when**: `refreshTokens` has retry loop, error parsing, logging, verification
  - **Verify**: `pnpm check-types`
  - **Commit**: `feat(oauth): add retry logic and error parsing to refreshTokens`
  - _Requirements: FR-1, FR-2, FR-3, FR-4, FR-5, AC-2.1, AC-2.2, AC-2.3, AC-2.4_
  - _Design: Data Flow diagram_

- [x] 1.8 [VERIFY] Quality checkpoint: pnpm lint && pnpm check-types
  - **Do**: Run quality commands after major refactoring
  - **Verify**: `pnpm lint && pnpm check-types`
  - **Done when**: Both commands exit 0
  - **Commit**: `chore(oauth): pass quality checkpoint` (only if fixes needed)

- [x] 1.9 POC manual validation via test harness
  - **Do**:
    1. Run existing unit tests to ensure no regressions: `pnpm test src/background/__tests__/oauth.test.ts`
    2. If tests fail due to new behavior, note failures but continue (tests updated in Phase 3)
    3. Verify code compiles and builds: `pnpm build`
  - **Files**: None (validation only)
  - **Done when**: Build succeeds, existing tests provide baseline (failures from new behavior acceptable)
  - **Verify**: `pnpm build`
  - **Commit**: `feat(oauth): complete POC for refresh token error handling`

## Phase 2: Refactoring

Focus: Clean up code structure after POC validated.

- [x] 2.1 Extract error type classification logic
  - **Do**:
    1. Create `getAsanaErrorType(errorCode?: string): 'auth' | 'config' | 'network' | 'unknown'` helper
    2. Map: invalid_grant -> 'auth', invalid_client -> 'config', unauthorized_client -> 'config', else -> 'unknown'
    3. Use in refreshTokens to determine errorType for logging
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/background/oauth.ts`
  - **Done when**: Error type logic extracted to reusable function
  - **Verify**: `pnpm check-types`
  - **Commit**: `refactor(oauth): extract error type classification`
  - _Design: Error Handling table_

- [x] 2.2 Add isRetryableError helper for clarity
  - **Do**:
    1. Add `isRetryableError(response: Response): boolean` helper
    2. Returns true for: 5xx status, 429 (rate limit)
    3. Returns false for: 4xx (except 429), success
    4. Update retry loop to use helper instead of inline checks
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/background/oauth.ts`
  - **Done when**: Retry condition logic is cleaner via helper
  - **Verify**: `pnpm check-types`
  - **Commit**: `refactor(oauth): extract isRetryableError helper`
  - _Design: retryWithBackoff conditions_

- [ ] 2.3 [VERIFY] Quality checkpoint: pnpm lint && pnpm check-types
  - **Do**: Run quality commands after refactoring
  - **Verify**: `pnpm lint && pnpm check-types`
  - **Done when**: Both commands exit 0
  - **Commit**: `chore(oauth): pass quality checkpoint` (only if fixes needed)

## Phase 3: Testing

Focus: Add comprehensive unit tests for new behaviors.

- [ ] 3.1 Add tests for parseAsanaError helper
  - **Do**:
    1. Open `src/background/__tests__/oauth.test.ts`
    2. Add test section for parseAsanaError (export function if needed)
    3. Tests:
       - Parses valid JSON with error field
       - Parses valid JSON with error_description
       - Returns null for non-JSON response
       - Returns null for empty body
       - Returns null for malformed JSON
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/background/__tests__/oauth.test.ts`
  - **Done when**: All parseAsanaError tests pass
  - **Verify**: `pnpm test src/background/__tests__/oauth.test.ts`
  - **Commit**: `test(oauth): add unit tests for parseAsanaError`
  - _Requirements: NFR-4_
  - _Design: Test Strategy - error parsing scenarios_

- [ ] 3.2 Add tests for retry behavior on network errors
  - **Do**:
    1. Add test: "retries on network error then succeeds"
       - Mock fetch to throw once, then succeed
       - Verify returns tokens
    2. Add test: "retries on 5xx then succeeds"
       - Mock 503 once, then 200
       - Verify returns tokens
    3. Add test: "respects max retries on persistent network failure"
       - Mock fetch to throw 4 times
       - Verify throws NetworkError after 3 retries
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/background/__tests__/oauth.test.ts`
  - **Done when**: All retry tests pass
  - **Verify**: `pnpm test src/background/__tests__/oauth.test.ts`
  - **Commit**: `test(oauth): add unit tests for retry behavior`
  - _Requirements: AC-2.1, NFR-4_
  - _Design: Test Strategy - retry scenarios_

- [ ] 3.3 Add tests for no-retry on auth errors
  - **Do**:
    1. Add test: "does not retry on invalid_grant"
       - Mock 400 with invalid_grant body
       - Verify throws AuthExpiredError immediately (fetch called once)
       - Verify asanaErrorCode is 'invalid_grant'
    2. Add test: "does not retry on invalid_client"
       - Mock 400 with invalid_client body
       - Verify throws AuthExpiredError immediately
       - Verify userMessage contains "Configuration error"
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/background/__tests__/oauth.test.ts`
  - **Done when**: No-retry auth error tests pass
  - **Verify**: `pnpm test src/background/__tests__/oauth.test.ts`
  - **Commit**: `test(oauth): add tests for immediate failure on auth errors`
  - _Requirements: FR-2, AC-4.1, AC-4.2, NFR-4_
  - _Design: Test Strategy - non-retryable errors_

- [ ] 3.4 [VERIFY] Quality checkpoint: pnpm lint && pnpm check-types && pnpm test
  - **Do**: Run full quality suite after adding tests
  - **Verify**: `pnpm lint && pnpm check-types && pnpm test`
  - **Done when**: All commands exit 0
  - **Commit**: `chore(oauth): pass quality checkpoint` (only if fixes needed)

- [ ] 3.5 Add tests for storage verification
  - **Do**:
    1. Add test: "calls getTokens after setTokens for verification"
       - Mock successful refresh
       - Verify getTokens called after setTokens
    2. Add test: "logs warning when storage verification fails"
       - Mock setTokens success, getTokens returns different values
       - Spy on console.warn
       - Verify warning logged with '[OAuth]' prefix
    3. Add test: "continues without error when storage verification fails"
       - Same setup as above
       - Verify function still returns tokens (doesn't throw)
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/background/__tests__/oauth.test.ts`
  - **Done when**: All storage verification tests pass
  - **Verify**: `pnpm test src/background/__tests__/oauth.test.ts`
  - **Commit**: `test(oauth): add tests for storage verification`
  - _Requirements: FR-5, NFR-4_
  - _Design: Test Strategy - storage verification_

- [ ] 3.6 Add tests for logging output
  - **Do**:
    1. Add test: "logs failure with timestamp, status, and error code"
       - Mock 400 with invalid_grant
       - Spy on console.error
       - Verify log contains: timestamp, status (400), error (invalid_grant), recoverable (false)
    2. Add test: "logs retry attempts with attempt number"
       - Mock 503 once, then 200
       - Spy on console.error
       - Verify log shows "attempt 1/3"
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/background/__tests__/oauth.test.ts`
  - **Done when**: All logging tests pass
  - **Verify**: `pnpm test src/background/__tests__/oauth.test.ts`
  - **Commit**: `test(oauth): add tests for diagnostic logging`
  - _Requirements: FR-4, AC-3.1, AC-3.2, AC-3.3, AC-3.4, NFR-4_
  - _Design: Test Strategy - logging_

- [ ] 3.7 Add E2E test for token refresh flow
  - **Do**:
    1. Check existing E2E test structure in `tests/e2e/`
    2. Add E2E test that:
       - Loads extension
       - Simulates expired access token with valid refresh token
       - Triggers API call that needs token refresh
       - Verifies new access token is obtained
       - Note: May need to mock Asana API at network level
    3. If E2E infrastructure doesn't support this flow, document limitation and add integration test instead
  - **Files**: `/Users/rjwhitehead/asana-plugin/tests/e2e/` (new or existing file)
  - **Done when**: E2E test exists and passes (or documented why not feasible)
  - **Verify**: `pnpm test:e2e` or documented alternative
  - **Commit**: `test(oauth): add E2E test for token refresh flow`
  - _Requirements: AC-1.1, AC-1.2_
  - _Design: Test Strategy_

- [ ] 3.8 Verify test coverage meets target
  - **Do**:
    1. Run coverage report: `pnpm test --coverage`
    2. Check coverage for oauth.ts refreshTokens function
    3. Add additional tests if coverage < 90%
  - **Files**: `/Users/rjwhitehead/asana-plugin/src/background/__tests__/oauth.test.ts`
  - **Done when**: refreshTokens coverage >= 90%
  - **Verify**: `pnpm test --coverage | grep -A5 oauth.ts`
  - **Commit**: `test(oauth): achieve 90%+ coverage for refreshTokens` (if tests added)
  - _Requirements: NFR-4_

## Phase 4: Quality Gates

- [ ] 4.1 [VERIFY] Full local CI: pnpm lint && pnpm check-types && pnpm test && pnpm build
  - **Do**: Run complete local CI suite
  - **Verify**: `pnpm lint && pnpm check-types && pnpm test && pnpm build`
  - **Done when**: Build succeeds, all tests pass
  - **Commit**: `chore(oauth): pass local CI` (if fixes needed)

- [ ] 4.2 [VERIFY] CI pipeline passes
  - **Do**:
    1. Verify current branch is a feature branch: `git branch --show-current`
    2. If on default branch, STOP and alert user
    3. Push branch: `git push -u origin <branch-name>`
    4. Create PR: `gh pr create --title "feat(oauth): improve refresh token error handling" --body "..."`
    5. Wait for CI: `gh pr checks --watch`
  - **Verify**: `gh pr checks` shows all green
  - **Done when**: All CI checks passing, PR ready for review
  - **If CI fails**: Read `gh pr checks`, fix locally, push, re-verify

- [ ] 4.3 [VERIFY] AC checklist
  - **Do**: Verify each acceptance criterion programmatically:
    - AC-1.1, AC-1.2, AC-1.3: Verified by refresh retry logic (user stays authenticated)
    - AC-1.4: Grep for `invalid_grant` handling -> `grep -r "invalid_grant" src/background/oauth.ts`
    - AC-2.1: Grep for MAX_REFRESH_RETRIES -> `grep -r "MAX_REFRESH_RETRIES" src/background/oauth.ts`
    - AC-2.2: Grep for exponential backoff -> `grep -r "Math.pow(2" src/background/oauth.ts`
    - AC-2.3: Test coverage for retry-then-success scenario -> `pnpm test --grep "retries on network"`
    - AC-2.4: Grep for NetworkError on exhausted -> `grep -r "NetworkError" src/background/oauth.ts`
    - AC-3.1-3.5: Grep for logRefreshFailure calls -> `grep -r "logRefreshFailure" src/background/oauth.ts`
    - AC-4.1-4.4: Grep for getMessageForErrorCode -> `grep -r "getMessageForErrorCode" src/shared/errors.ts`
  - **Verify**: All grep commands find expected patterns, relevant tests pass
  - **Done when**: All acceptance criteria confirmed met
  - **Commit**: None

## Notes

- **POC shortcuts taken**:
  - Existing tests may fail initially due to changed behavior (acceptable in Phase 1)
  - E2E test may require mocking Asana API if full flow not feasible

- **Production TODOs**:
  - Consider extracting sleep/backoff helpers to shared utils if needed elsewhere
  - Monitor production logs for unexpected error patterns
  - May need to adjust backoff timing based on real-world behavior

- **Existing patterns followed**:
  - Retry constants match `asana-api.ts` (MAX_RETRIES=3, BASE_DELAY_MS=1000)
  - Error class pattern matches `errors.ts` (ExtensionError base)
  - Logging prefix `[OAuth]` matches codebase convention
