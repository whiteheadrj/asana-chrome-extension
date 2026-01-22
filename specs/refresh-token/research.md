---
spec: refresh-token
phase: research
created: 2026-01-22
---

# Research: refresh-token

## Executive Summary

The Asana Chrome extension forces users to re-authenticate after periods of inactivity, despite Asana refresh tokens having no expiration. Root cause analysis reveals the `refreshTokens` function lacks proper error response parsing and logging, making diagnosis difficult. Additionally, the error handling treats all 400/401 responses identically without inspecting the actual error type from Asana.

## External Research

### Asana OAuth2 Token Specifications

| Property | Value | Source |
|----------|-------|--------|
| Access Token Lifetime | 1 hour (3600 seconds) | [Asana OAuth Docs](https://developers.asana.com/docs/oauth) |
| Refresh Token Lifetime | **Never expires** | [Asana Forum](https://forum.asana.com/t/lifetime-of-refresh-token/123429) |
| Token Endpoint | `POST https://app.asana.com/-/oauth_token` | [Asana OAuth Docs](https://developers.asana.com/docs/oauth) |
| Refresh Grant Type | `refresh_token` | [Asana OAuth Docs](https://developers.asana.com/docs/oauth) |

### Asana Token Refresh Requirements

Per Asana documentation, refresh token exchange requires:
- `grant_type`: "refresh_token"
- `client_id`: Application identifier
- `client_secret`: Application secret
- `refresh_token`: The stored refresh token

**Key finding**: Asana refresh tokens remain valid indefinitely unless:
1. User manually revokes app authorization
2. User deauthorizes via `POST https://app.asana.com/-/oauth_revoke`
3. App is deleted from Asana developer console

### Asana Error Responses

Asana returns specific error codes on token refresh failure:
- `invalid_grant`: Refresh token is invalid or revoked
- `invalid_client`: Client credentials are incorrect
- `unauthorized_client`: Client not authorized for this grant type

## Codebase Analysis

### Current Implementation (`/Users/rjwhitehead/asana-plugin/src/background/oauth.ts`)

#### Token Refresh Flow

```typescript
// Lines 265-313: refreshTokens function
export async function refreshTokens(refreshToken: string): Promise<OAuthTokens> {
  // Sends correct parameters to Asana
  body: new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    refresh_token: refreshToken,
  }).toString(),
```

**Finding**: Parameters are correct per Asana documentation.

#### Proactive Refresh (`getValidAccessToken`)

```typescript
// Lines 323-342: Proactive refresh when token expires in <5 minutes
if (tokens.expiresAt < fiveMinutesFromNow) {
  const newTokens = await refreshTokens(tokens.refreshToken);
  return newTokens.accessToken;
}
```

**Finding**: Good practice - refreshes before expiration.

### Identified Issues

#### Issue 1: Insufficient Error Response Parsing

**Location**: `oauth.ts` lines 289-294

```typescript
if (!response.ok) {
  if (response.status === 401 || response.status === 400) {
    throw new AuthExpiredError('Your session has expired. Please log in again.');
  }
  throw wrapResponseError(response, 'Token refresh');
}
```

**Problem**:
- Does NOT parse Asana's error response body
- Treats ALL 400 errors as "expired session"
- Could be `invalid_client` (wrong credentials), not `invalid_grant` (expired token)
- No logging of actual Asana error message

**Impact**: Users asked to re-authenticate for issues that may not require it. No diagnostic information available.

#### Issue 2: Missing Error Logging

**Location**: `oauth.ts` `refreshTokens` function

**Problem**: When refresh fails, the actual error from Asana is never:
1. Parsed from response body
2. Logged for debugging
3. Differentiated by error type

**Impact**: Cannot diagnose WHY refresh is failing in production.

#### Issue 3: No Retry Logic for Transient Failures

**Location**: `oauth.ts` `refreshTokens` function

**Problem**: Network glitches or transient Asana issues immediately trigger re-authentication.

**Impact**: Users forced to re-auth unnecessarily for temporary issues.

#### Issue 4: Storage Verification Missing

**Location**: `storage.ts` `setTokens` function

**Problem**: No verification that tokens were actually persisted after `chrome.storage.local.set()`. Chrome storage operations can silently fail due to:
- Storage quota exceeded
- Extension context invalidated
- Race conditions

**Impact**: Tokens may not persist, causing unexpected auth loss.

### Token Flow Diagram

```
User Action -> getValidAccessToken()
                |
                v
         Check expiresAt
                |
    +-----------+-----------+
    |                       |
  Valid               Expiring/Expired
    |                       |
    v                       v
  Return             refreshTokens()
  token                     |
                           v
                    POST /oauth_token
                           |
              +------------+------------+
              |            |            |
           200 OK       400/401      Network Error
              |            |            |
              v            v            v
         Store new    AuthExpiredError  NetworkError
         tokens       (Forces re-auth)  (Could retry)
```

## Quality Commands

| Type | Command | Source |
|------|---------|--------|
| Lint | `pnpm lint` | package.json scripts.lint |
| TypeCheck | `pnpm check-types` | package.json scripts.check-types |
| Unit Test | `pnpm test` | package.json scripts.test |
| E2E Test | `pnpm test:e2e` | package.json scripts.test:e2e |
| Build | `pnpm build` | package.json scripts.build |

**Local CI**: `pnpm lint && pnpm check-types && pnpm test && pnpm build`

## Feasibility Assessment

| Aspect | Assessment | Notes |
|--------|------------|-------|
| Technical Viability | High | Changes are localized to oauth.ts |
| Effort Estimate | S | 2-4 hours of work |
| Risk Level | Low | Well-tested module, clear fix paths |

## Related Specs

| Spec | Relationship | mayNeedUpdate |
|------|--------------|---------------|
| asana-chrome-extension | Original OAuth implementation | false |
| ai-title | Unrelated | false |

## Recommendations for Requirements

1. **Parse and log Asana error responses** - Extract actual error type (`invalid_grant`, `invalid_client`, etc.) from response body
2. **Differentiate error handling by error type** - Only treat `invalid_grant` as session expired; handle `invalid_client` differently
3. **Add retry logic for transient failures** - Retry 1-2 times for network errors before giving up
4. **Add storage verification** - Verify tokens persisted after storage operation
5. **Add diagnostic logging** - Log refresh attempts and failures (with redacted tokens) for debugging
6. **Consider background refresh** - Refresh tokens in service worker before they expire, not just on API calls

## Open Questions

1. Is the user seeing any specific error message when forced to re-connect? This would help identify the error path.
2. How long is "not using the plugin" before re-connection is required? (Minutes? Hours? Days?)
3. Has the user verified their Asana app is still authorized in Asana's "Apps" settings?
4. Are there any console errors in the service worker when the issue occurs?

## Sources

- [Asana OAuth Documentation](https://developers.asana.com/docs/oauth)
- [Asana Forum: Lifetime of Refresh Token](https://forum.asana.com/t/lifetime-of-refresh-token/123429)
- [Asana Forum: Refresh Token and Access Token](https://forum.asana.com/t/refresh-token-and-access-token/786339)
- `/Users/rjwhitehead/asana-plugin/src/background/oauth.ts`
- `/Users/rjwhitehead/asana-plugin/src/shared/storage.ts`
- `/Users/rjwhitehead/asana-plugin/src/background/__tests__/oauth.test.ts`
