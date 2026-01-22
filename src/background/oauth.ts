/**
 * OAuth module with PKCE flow for Asana authentication
 * Handles authorization, token exchange, and token storage
 */

import type { OAuthTokens } from '../shared/types';
import { setTokens, getTokens } from '../shared/storage';
import { STORAGE_KEYS } from '../shared/constants';
import { remove } from '../shared/storage';
import {
  AuthRequiredError,
  AuthFailedError,
  AuthExpiredError,
  NetworkError,
  NetworkOfflineError,
  isOffline,
  wrapFetchError,
  wrapResponseError,
} from '../shared/errors';
import { ASANA_CLIENT_ID, ASANA_CLIENT_SECRET } from '../config';

// =============================================================================
// Constants
// =============================================================================

const ASANA_OAUTH_BASE = 'https://app.asana.com/-/oauth_authorize';
const ASANA_TOKEN_ENDPOINT = 'https://app.asana.com/-/oauth_token';

// Client credentials imported from config.ts (see config.ts for setup instructions)
const CLIENT_ID = ASANA_CLIENT_ID;
const CLIENT_SECRET = ASANA_CLIENT_SECRET;

// Retry configuration (matching asana-api.ts pattern)
const MAX_REFRESH_RETRIES = 3;
const BASE_DELAY_MS = 1000; // 1 second

// =============================================================================
// Retry Helpers
// =============================================================================

/**
 * Sleep for a specified number of milliseconds
 * @param ms - The number of milliseconds to sleep
 * @returns Promise that resolves after the specified delay
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay for a given retry attempt
 * @param attempt - The retry attempt number (0-based)
 * @returns Delay in milliseconds (2^attempt * BASE_DELAY_MS)
 */
function calculateBackoffDelay(attempt: number): number {
  return BASE_DELAY_MS * Math.pow(2, attempt);
}

// =============================================================================
// Asana Error Types
// =============================================================================

/**
 * Asana OAuth error response structure
 * Returned when token operations fail
 */
export interface AsanaOAuthError {
  error: string;
  error_description?: string;
}

/**
 * Context for logging refresh token failures
 * Used for diagnostic logging with structured data
 */
export interface RefreshFailureContext {
  timestamp: string;
  attempt: number;
  totalAttempts: number;
  httpStatus?: number;
  asanaError?: string;
  asanaDescription?: string;
  isRecoverable: boolean;
  errorType: 'auth' | 'config' | 'network' | 'unknown';
}

/**
 * Determine the error type from an Asana OAuth error code
 * @param errorCode - The error code from Asana's response
 * @returns The categorized error type
 */
export function getAsanaErrorType(errorCode?: string): 'auth' | 'config' | 'network' | 'unknown' {
  if (errorCode === 'invalid_grant') {
    return 'auth';
  }
  if (errorCode === 'invalid_client' || errorCode === 'unauthorized_client') {
    return 'config';
  }
  return 'unknown';
}

/**
 * Log a refresh token failure with structured diagnostic information
 * Never logs token values - only metadata about the failure
 * @param context - The failure context to log
 */
export function logRefreshFailure(context: RefreshFailureContext): void {
  console.error(
    `[OAuth] Token refresh failed\n` +
    `  Timestamp: ${context.timestamp}\n` +
    `  Attempt: ${context.attempt}/${context.totalAttempts}\n` +
    `  HTTP Status: ${context.httpStatus ?? 'N/A'}\n` +
    `  Error: ${context.asanaError ?? 'N/A'}\n` +
    `  Description: ${context.asanaDescription ?? 'N/A'}\n` +
    `  Recoverable: ${context.isRecoverable}\n` +
    `  Type: ${context.errorType}`
  );
}

/**
 * Parse an Asana error response from a fetch Response
 * @param response - The fetch Response to parse
 * @returns The parsed error or null if parsing fails
 */
export async function parseAsanaError(response: Response): Promise<AsanaOAuthError | null> {
  try {
    // Clone response to avoid consuming the body
    const cloned = response.clone();
    const data = await cloned.json();

    // Validate the response has the expected error field
    if (data && typeof data.error === 'string') {
      return {
        error: data.error,
        error_description: typeof data.error_description === 'string' ? data.error_description : undefined,
      };
    }

    return null;
  } catch {
    // JSON parse failed or other error
    return null;
  }
}

// =============================================================================
// PKCE Helpers
// =============================================================================

/**
 * Generate a cryptographically random code verifier for PKCE
 * @returns A random string suitable for use as a PKCE code verifier
 */
export function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  // Convert to base64url encoding
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Generate a code challenge from the code verifier using SHA-256
 * @param verifier - The code verifier to hash
 * @returns Promise resolving to the base64url-encoded SHA-256 hash
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);

  // Convert ArrayBuffer to base64url string
  const base64 = btoa(String.fromCharCode(...new Uint8Array(digest)));
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// =============================================================================
// OAuth Flow
// =============================================================================

// Store pending auth state for callback-based flow
let pendingAuthState: {
  codeVerifier: string;
  redirectUrl: string;
  resolve: (value: boolean) => void;
  reject: (error: Error) => void;
} | null = null;

/**
 * Get the OAuth callback URL (extension page)
 */
function getCallbackUrl(): string {
  return chrome.runtime.getURL('oauth-callback/callback.html');
}

/**
 * Handle OAuth callback message from the callback page
 * This is called by the service worker message handler
 */
export async function handleOAuthCallback(code: string): Promise<{ success: boolean; error?: string }> {
  if (!pendingAuthState) {
    return { success: false, error: 'No pending authentication' };
  }

  const { codeVerifier, redirectUrl, resolve, reject } = pendingAuthState;
  pendingAuthState = null;

  try {
    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code, codeVerifier, redirectUrl);
    await setTokens(tokens);
    resolve(true);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Token exchange failed';
    reject(error instanceof Error ? error : new Error(message));
    return { success: false, error: message };
  }
}

/**
 * Start the OAuth authorization flow using a callback page approach
 * Opens Asana login in a new tab, which redirects to our extension's callback page
 * @returns Promise resolving to true if auth succeeds
 * @throws AuthFailedError if authentication fails
 * @throws NetworkOfflineError if offline
 * @throws NetworkError if network request fails
 */
export async function startAuthFlow(): Promise<boolean> {
  // Check for offline state first
  if (isOffline()) {
    throw new NetworkOfflineError('Cannot authenticate while offline');
  }

  // Cancel any pending auth
  if (pendingAuthState) {
    pendingAuthState.reject(new AuthFailedError('Authentication cancelled - new auth started'));
    pendingAuthState = null;
  }

  try {
    // Get the redirect URL (our extension's callback page)
    const redirectUrl = getCallbackUrl();

    // Generate PKCE code verifier and challenge
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    // Build authorization URL
    const authParams = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: redirectUrl,
      response_type: 'code',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      // Asana requires explicit scopes
      scope: 'default',
    });

    const authUrl = `${ASANA_OAUTH_BASE}?${authParams.toString()}`;

    // Create a promise that will be resolved when the OAuth callback is received
    return new Promise<boolean>((resolve, reject) => {
      // Store the pending auth state
      pendingAuthState = {
        codeVerifier,
        redirectUrl,
        resolve,
        reject,
      };

      // Open the auth URL in a new tab
      chrome.tabs.create({ url: authUrl }, (tab) => {
        if (chrome.runtime.lastError || !tab?.id) {
          pendingAuthState = null;
          reject(new AuthFailedError('Failed to open authentication page'));
        }
        // The callback page will send us the code via message
      });
    });
  } catch (error) {
    // Re-throw our custom errors
    if (error instanceof AuthFailedError || error instanceof NetworkError || error instanceof NetworkOfflineError) {
      throw error;
    }
    // Wrap unexpected errors
    console.error('Auth flow error:', error);
    throw new AuthFailedError(
      error instanceof Error ? error.message : 'Authentication failed',
      error
    );
  }
}

/**
 * Exchange an authorization code for access and refresh tokens
 * @param code - The authorization code from OAuth callback
 * @param verifier - The PKCE code verifier used during authorization
 * @param redirectUri - The redirect URI used during authorization
 * @returns Promise resolving to tokens
 * @throws AuthFailedError if token exchange fails
 * @throws NetworkError if network request fails
 */
export async function exchangeCodeForTokens(
  code: string,
  verifier: string,
  redirectUri: string
): Promise<OAuthTokens> {
  // Check for offline state
  if (isOffline()) {
    throw new NetworkOfflineError('Cannot exchange tokens while offline');
  }

  let response: Response;
  try {
    response = await fetch(ASANA_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
        redirect_uri: redirectUri,
        code_verifier: verifier,
      }).toString(),
    });
  } catch (error) {
    throw wrapFetchError(error, 'Token exchange');
  }

  if (!response.ok) {
    let errorMessage = 'Token exchange failed';
    try {
      const errorData = await response.json();
      if (errorData.error_description) {
        errorMessage = errorData.error_description;
      } else if (errorData.error) {
        errorMessage = `Token exchange failed: ${errorData.error}`;
      }
    } catch {
      // Ignore JSON parse errors
    }
    throw new AuthFailedError(errorMessage);
  }

  const data = await response.json();

  // Calculate expiration timestamp
  // Asana tokens expire in 1 hour (3600 seconds)
  const expiresAt = Date.now() + (data.expires_in * 1000);

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt,
  };
}

// =============================================================================
// Token Refresh and Management
// =============================================================================

/**
 * Refresh OAuth tokens using the refresh token
 * Includes retry logic with exponential backoff for transient failures
 * @param refreshToken - The refresh token to use
 * @returns Promise resolving to new tokens
 * @throws AuthExpiredError if refresh token is invalid/expired (not retried)
 * @throws NetworkError if network request fails after all retries
 * @throws NetworkOfflineError if device is offline
 */
export async function refreshTokens(refreshToken: string): Promise<OAuthTokens> {
  // Check for offline state
  if (isOffline()) {
    throw new NetworkOfflineError('Cannot refresh tokens while offline');
  }

  const totalAttempts = MAX_REFRESH_RETRIES + 1; // +1 because we count from 0

  for (let attempt = 0; attempt <= MAX_REFRESH_RETRIES; attempt++) {
    let response: Response;

    try {
      response = await fetch(ASANA_TOKEN_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          refresh_token: refreshToken,
        }).toString(),
      });
    } catch (error) {
      // Network error (fetch threw): log, wait backoff, continue
      const isLastAttempt = attempt === MAX_REFRESH_RETRIES;

      logRefreshFailure({
        timestamp: new Date().toISOString(),
        attempt: attempt + 1,
        totalAttempts,
        isRecoverable: !isLastAttempt,
        errorType: 'network',
      });

      if (isLastAttempt) {
        throw new NetworkError('Connection failed after multiple retries', error);
      }

      await sleep(calculateBackoffDelay(attempt));
      continue;
    }

    // Handle 5xx server errors: recoverable, retry with backoff
    if (response.status >= 500) {
      const isLastAttempt = attempt === MAX_REFRESH_RETRIES;

      logRefreshFailure({
        timestamp: new Date().toISOString(),
        attempt: attempt + 1,
        totalAttempts,
        httpStatus: response.status,
        isRecoverable: !isLastAttempt,
        errorType: 'network',
      });

      if (isLastAttempt) {
        throw new NetworkError('Connection failed after multiple retries');
      }

      await sleep(calculateBackoffDelay(attempt));
      continue;
    }

    // Handle 4xx auth errors: NOT recoverable, parse error and throw immediately
    if (response.status === 400 || response.status === 401) {
      const asanaError = await parseAsanaError(response);
      const errorCode = asanaError?.error;

      // Determine error type for logging using extracted helper
      const errorType = getAsanaErrorType(errorCode);

      logRefreshFailure({
        timestamp: new Date().toISOString(),
        attempt: attempt + 1,
        totalAttempts,
        httpStatus: response.status,
        asanaError: asanaError?.error,
        asanaDescription: asanaError?.error_description,
        isRecoverable: false, // Auth errors are not recoverable
        errorType,
      });

      // Throw AuthExpiredError with Asana error code for user message generation
      throw new AuthExpiredError(
        asanaError?.error_description || 'Token refresh failed',
        undefined,
        errorCode
      );
    }

    // Handle other non-success responses
    if (!response.ok) {
      throw wrapResponseError(response, 'Token refresh');
    }

    // Success: parse response and store tokens
    const data = await response.json();

    // Calculate expiration timestamp
    // Asana tokens expire in 1 hour (3600 seconds)
    const expiresAt = Date.now() + (data.expires_in * 1000);

    const newTokens: OAuthTokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt,
    };

    // Store the new tokens
    await setTokens(newTokens);

    // Verify tokens were stored correctly (read-after-write check)
    const verified = await verifyTokenStorage(newTokens);
    if (!verified) {
      // Log but don't fail - verification is defensive, not critical path
      console.warn('[OAuth] Token storage verification failed after refresh');
    }

    return newTokens;
  }

  // This should never be reached due to the loop structure,
  // but TypeScript needs it for completeness
  throw new NetworkError('Connection failed after multiple retries');
}

/**
 * Get a valid access token, refreshing if needed
 * Automatically refreshes if token expires in less than 5 minutes
 * @returns Promise resolving to access token string
 * @throws AuthRequiredError if not authenticated
 * @throws AuthExpiredError if tokens cannot be refreshed
 * @throws NetworkError if network request fails
 */
export async function getValidAccessToken(): Promise<string> {
  const tokens = await getTokens();

  if (!tokens) {
    throw new AuthRequiredError('Not authenticated. Please log in to Asana.');
  }

  // Check if token expires in less than 5 minutes (300000 ms)
  const fiveMinutesFromNow = Date.now() + (5 * 60 * 1000);

  if (tokens.expiresAt < fiveMinutesFromNow) {
    // Token is expired or will expire soon, refresh it
    console.log('Access token expiring soon, refreshing...');
    const newTokens = await refreshTokens(tokens.refreshToken);
    return newTokens.accessToken;
  }

  // Token is still valid
  return tokens.accessToken;
}

/**
 * Check if the user is authenticated with valid tokens
 * @returns Promise resolving to true if authenticated, false otherwise
 */
export async function isAuthenticated(): Promise<boolean> {
  const tokens = await getTokens();

  if (!tokens) {
    return false;
  }

  // Check if we have all required token fields
  if (!tokens.accessToken || !tokens.refreshToken || !tokens.expiresAt) {
    return false;
  }

  // We have tokens - even if access token is expired,
  // we can refresh using the refresh token
  return true;
}

/**
 * Log out the user by clearing stored tokens
 */
export async function logout(): Promise<void> {
  await remove(STORAGE_KEYS.OAUTH_TOKENS);
}

/**
 * Verify that tokens were correctly stored by reading them back
 * Used for read-after-write verification to detect storage failures
 * @param expected - The tokens that were expected to be stored
 * @returns Promise resolving to true if tokens match, false otherwise
 */
export async function verifyTokenStorage(expected: OAuthTokens): Promise<boolean> {
  const stored = await getTokens();

  if (!stored) {
    console.warn('[OAuth] Token storage verification failed: no tokens found in storage');
    return false;
  }

  if (
    stored.accessToken !== expected.accessToken ||
    stored.refreshToken !== expected.refreshToken ||
    stored.expiresAt !== expected.expiresAt
  ) {
    console.warn('[OAuth] Token storage verification failed: stored tokens do not match expected values');
    return false;
  }

  return true;
}
