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
import { ASANA_CLIENT_ID } from '../config';

// =============================================================================
// Constants
// =============================================================================

const ASANA_OAUTH_BASE = 'https://app.asana.com/-/oauth_authorize';
const ASANA_TOKEN_ENDPOINT = 'https://app.asana.com/-/oauth_token';

// Client ID imported from config.ts (see config.ts for setup instructions)
const CLIENT_ID = ASANA_CLIENT_ID;

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

/**
 * Start the OAuth authorization flow using Chrome's identity API
 * Opens a popup for Asana login and handles the authorization code exchange
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

  try {
    // Get the redirect URL from Chrome identity API
    const redirectUrl = chrome.identity.getRedirectURL();

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

    // Launch the web auth flow
    let responseUrl: string | undefined;
    try {
      responseUrl = await chrome.identity.launchWebAuthFlow({
        url: authUrl,
        interactive: true,
      });
    } catch (error) {
      // User closed the auth window or denied access
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('user') || message.includes('cancel') || message.includes('closed')) {
        throw new AuthFailedError('Authentication was cancelled');
      }
      throw new AuthFailedError(`Authentication failed: ${message}`, error);
    }

    if (!responseUrl) {
      throw new AuthFailedError('No response from authentication flow');
    }

    // Extract authorization code from response URL
    const url = new URL(responseUrl);
    const code = url.searchParams.get('code');

    if (!code) {
      const error = url.searchParams.get('error');
      const errorDescription = url.searchParams.get('error_description');
      throw new AuthFailedError(
        errorDescription || `OAuth error: ${error || 'unknown'}`,
      );
    }

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code, codeVerifier, redirectUrl);
    await setTokens(tokens);
    return true;
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
 * @param refreshToken - The refresh token to use
 * @returns Promise resolving to new tokens
 * @throws AuthExpiredError if refresh token is invalid/expired
 * @throws NetworkError if network request fails
 */
export async function refreshTokens(refreshToken: string): Promise<OAuthTokens> {
  // Check for offline state
  if (isOffline()) {
    throw new NetworkOfflineError('Cannot refresh tokens while offline');
  }

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
        refresh_token: refreshToken,
      }).toString(),
    });
  } catch (error) {
    throw wrapFetchError(error, 'Token refresh');
  }

  if (!response.ok) {
    // 401 or 400 with invalid_grant means the refresh token is expired
    if (response.status === 401 || response.status === 400) {
      throw new AuthExpiredError('Your session has expired. Please log in again.');
    }
    throw wrapResponseError(response, 'Token refresh');
  }

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

  return newTokens;
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
