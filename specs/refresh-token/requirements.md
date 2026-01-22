---
spec: refresh-token
phase: requirements
created: 2026-01-22
---

# Requirements: Refresh Token Fix

## Goal

Ensure users stay authenticated indefinitely (unless they log out) by properly handling token refresh errors with parsing, retry logic, and diagnostic logging.

## User Decisions

| Question | Decision |
|----------|----------|
| Primary users | Both developers and end users |
| Priority tradeoff | Feature completeness (full solution including logging, retry, storage verification) |

## User Stories

### US-1: Persistent Authentication
**As a** plugin user
**I want to** remain logged in to Asana indefinitely
**So that** I don't have to re-authenticate unless I explicitly log out

**Acceptance Criteria:**
- [ ] AC-1.1: User stays authenticated after browser restart
- [ ] AC-1.2: User stays authenticated after 1+ hours of inactivity
- [ ] AC-1.3: User stays authenticated after 24+ hours of inactivity
- [ ] AC-1.4: User only sees re-auth prompt if refresh token is truly invalid

### US-2: Transient Failure Recovery
**As a** plugin user
**I want** the plugin to retry when temporary network issues occur
**So that** brief connectivity problems don't force me to re-authenticate

**Acceptance Criteria:**
- [ ] AC-2.1: Transient network failures trigger retry (max 3 attempts)
- [ ] AC-2.2: Exponential backoff between retries (1s, 2s, 4s)
- [ ] AC-2.3: User not prompted to re-auth for recoverable errors
- [ ] AC-2.4: After retries exhausted, appropriate error shown (not "session expired")

### US-3: Diagnostic Logging for Developers
**As a** developer
**I want** detailed error logs when token refresh fails
**So that** I can diagnose production issues

**Acceptance Criteria:**
- [ ] AC-3.1: Asana error response body is parsed and logged
- [ ] AC-3.2: Error type (invalid_grant, invalid_client, etc.) is logged
- [ ] AC-3.3: HTTP status code is logged
- [ ] AC-3.4: Timestamp of failure is logged
- [ ] AC-3.5: Logs differentiate between recoverable and fatal errors

### US-4: Accurate Error Messages
**As a** plugin user
**I want** to see correct error messages based on actual failure reason
**So that** I understand what went wrong and what to do next

**Acceptance Criteria:**
- [ ] AC-4.1: `invalid_grant` shows "Session expired" message
- [ ] AC-4.2: `invalid_client` shows "Configuration error" message (app misconfigured)
- [ ] AC-4.3: Network errors show "Connection failed" message
- [ ] AC-4.4: Unknown errors show generic message with retry suggestion

## Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-1 | Parse Asana error response body on 400/401 | P0 | Error body JSON parsed; `error` and `error_description` extracted |
| FR-2 | Differentiate error handling by error type | P0 | `invalid_grant` triggers re-auth; `invalid_client` logs config error; network errors trigger retry |
| FR-3 | Add retry logic for transient failures | P0 | Max 3 retries with exponential backoff (1s, 2s, 4s) |
| FR-4 | Log refresh failures with context | P1 | Console logs include: error type, status code, timestamp, attempt number |
| FR-5 | Verify token storage after save | P1 | Read-after-write verification; log warning if mismatch |
| FR-6 | Add error type to AuthExpiredError | P2 | Include `asanaErrorCode` property for debugging |

## Non-Functional Requirements

| ID | Requirement | Metric | Target |
|----|-------------|--------|--------|
| NFR-1 | Retry latency | Total retry time | < 10 seconds before giving up |
| NFR-2 | Logging verbosity | Log size | Minimal in production; detailed in debug mode |
| NFR-3 | Backward compatibility | Breaking changes | Zero - existing token storage format unchanged |
| NFR-4 | Test coverage | Unit tests | 90%+ coverage for refreshTokens function |

## Success Criteria

1. **Zero false re-auth prompts** - Users with valid refresh tokens never see "session expired"
2. **Transient failures recovered** - 95%+ of network blips handled by retry logic
3. **Root cause diagnosable** - All refresh failures have clear logs identifying cause
4. **Storage verified** - Token persistence confirmed after every save

## Out of Scope

- Token encryption at rest (separate security feature)
- Automatic re-login flow (beyond current manual re-auth)
- Refresh token rotation (Asana doesn't rotate refresh tokens)
- UI changes for error display (use existing error handling)
- Analytics/telemetry for failure rates

## Dependencies

| Dependency | Type | Notes |
|------------|------|-------|
| Asana OAuth API | External | Must handle `invalid_grant`, `invalid_client`, `unauthorized_client` errors |
| chrome.storage.local | Platform | Used for token persistence |
| navigator.onLine | Platform | Network status detection |

## Glossary

| Term | Definition |
|------|------------|
| Access Token | Short-lived token (1 hour) for API requests |
| Refresh Token | Long-lived token (never expires) used to obtain new access tokens |
| PKCE | Proof Key for Code Exchange - security enhancement for OAuth |
| `invalid_grant` | Asana error: refresh token revoked or invalid |
| `invalid_client` | Asana error: client credentials misconfigured |
| Transient Failure | Temporary error (network timeout, server 5xx) that may succeed on retry |

## Open Questions

1. Should retry logic apply to initial token exchange (not just refresh)?
2. Should storage verification failure block the operation or just log a warning?
3. What's the maximum acceptable total retry time before showing error to user?

## Risk Analysis

| Risk | Impact | Mitigation |
|------|--------|------------|
| Retry logic hides persistent failures | Users wait too long | Cap total retry time at 10s; show progress indicator |
| Verbose logging exposes tokens | Security breach | Never log access/refresh token values |
| Storage verification overhead | Performance | Only verify on refresh, not every read |
