/**
 * Unit tests for OAuth module
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockStorage, chromeMock } from '../../test-setup.js';

// Import functions under test
import {
  generateCodeVerifier,
  generateCodeChallenge,
  startAuthFlow,
  exchangeCodeForTokens,
  refreshTokens,
  getValidAccessToken,
  isAuthenticated,
  logout,
  handleOAuthCallback,
  parseAsanaError,
} from '../oauth.js';
import { STORAGE_KEYS } from '../../shared/constants.js';
import {
  AuthRequiredError,
  AuthFailedError,
  AuthExpiredError,
  NetworkOfflineError,
  NetworkError,
} from '../../shared/errors.js';

// Mock navigator for offline detection
const originalNavigator = globalThis.navigator;

describe('oauth module', () => {
  beforeEach(() => {
    // Clear mock storage before each test
    for (const key of Object.keys(mockStorage)) {
      delete mockStorage[key];
    }
    vi.clearAllMocks();

    // Reset navigator.onLine to true (online)
    Object.defineProperty(globalThis, 'navigator', {
      value: { onLine: true },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    // Restore original navigator
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
  });

  // ===========================================================================
  // PKCE Code Verifier Generation
  // ===========================================================================

  describe('generateCodeVerifier', () => {
    it('generates a string of expected length', () => {
      const verifier = generateCodeVerifier();
      // 32 bytes -> base64 is 44 chars, minus potential = padding and with base64url encoding
      // The verifier should be at least 32 chars
      expect(verifier.length).toBeGreaterThanOrEqual(32);
    });

    it('generates unique values on each call', () => {
      const verifier1 = generateCodeVerifier();
      const verifier2 = generateCodeVerifier();
      const verifier3 = generateCodeVerifier();

      expect(verifier1).not.toBe(verifier2);
      expect(verifier2).not.toBe(verifier3);
      expect(verifier1).not.toBe(verifier3);
    });

    it('only contains base64url safe characters', () => {
      const verifier = generateCodeVerifier();
      // base64url should only contain: A-Za-z0-9-_
      const base64urlRegex = /^[A-Za-z0-9\-_]+$/;
      expect(verifier).toMatch(base64urlRegex);
    });

    it('does not contain standard base64 characters', () => {
      const verifier = generateCodeVerifier();
      // Should NOT contain +, /, or =
      expect(verifier).not.toContain('+');
      expect(verifier).not.toContain('/');
      expect(verifier).not.toContain('=');
    });
  });

  // ===========================================================================
  // PKCE Code Challenge Generation
  // ===========================================================================

  describe('generateCodeChallenge', () => {
    it('generates a hash of the verifier', async () => {
      const verifier = 'test_code_verifier_12345';
      const challenge = await generateCodeChallenge(verifier);

      expect(challenge).toBeDefined();
      expect(typeof challenge).toBe('string');
      expect(challenge.length).toBeGreaterThan(0);
    });

    it('generates different challenges for different verifiers', async () => {
      const challenge1 = await generateCodeChallenge('verifier1');
      const challenge2 = await generateCodeChallenge('verifier2');

      expect(challenge1).not.toBe(challenge2);
    });

    it('generates consistent challenge for same verifier', async () => {
      const verifier = 'consistent_verifier';
      const challenge1 = await generateCodeChallenge(verifier);
      const challenge2 = await generateCodeChallenge(verifier);

      expect(challenge1).toBe(challenge2);
    });

    it('only contains base64url safe characters', async () => {
      const verifier = generateCodeVerifier();
      const challenge = await generateCodeChallenge(verifier);

      // base64url should only contain: A-Za-z0-9-_
      const base64urlRegex = /^[A-Za-z0-9\-_]+$/;
      expect(challenge).toMatch(base64urlRegex);
    });

    it('does not contain standard base64 characters', async () => {
      const verifier = generateCodeVerifier();
      const challenge = await generateCodeChallenge(verifier);

      // Should NOT contain +, /, or =
      expect(challenge).not.toContain('+');
      expect(challenge).not.toContain('/');
      expect(challenge).not.toContain('=');
    });
  });

  // ===========================================================================
  // parseAsanaError Helper
  // ===========================================================================

  describe('parseAsanaError', () => {
    it('parses valid JSON with error field', async () => {
      const response = new Response(JSON.stringify({ error: 'invalid_grant' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });

      const result = await parseAsanaError(response);

      expect(result).not.toBeNull();
      expect(result?.error).toBe('invalid_grant');
    });

    it('parses valid JSON with error_description', async () => {
      const response = new Response(
        JSON.stringify({
          error: 'invalid_client',
          error_description: 'Client authentication failed',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const result = await parseAsanaError(response);

      expect(result).not.toBeNull();
      expect(result?.error).toBe('invalid_client');
      expect(result?.error_description).toBe('Client authentication failed');
    });

    it('returns null for non-JSON response', async () => {
      const response = new Response('Not JSON content', {
        status: 500,
        headers: { 'Content-Type': 'text/plain' },
      });

      const result = await parseAsanaError(response);

      expect(result).toBeNull();
    });

    it('returns null for empty body', async () => {
      const response = new Response('', {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });

      const result = await parseAsanaError(response);

      expect(result).toBeNull();
    });

    it('returns null for malformed JSON', async () => {
      const response = new Response('{ invalid json }', {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });

      const result = await parseAsanaError(response);

      expect(result).toBeNull();
    });

    it('returns null for JSON without error field', async () => {
      const response = new Response(JSON.stringify({ message: 'Something went wrong' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });

      const result = await parseAsanaError(response);

      expect(result).toBeNull();
    });

    it('does not consume the original response body', async () => {
      const response = new Response(JSON.stringify({ error: 'test_error' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });

      await parseAsanaError(response);

      // Original response body should still be readable
      const originalBody = await response.json();
      expect(originalBody.error).toBe('test_error');
    });
  });

  // ===========================================================================
  // Token Refresh Logic
  // ===========================================================================

  describe('refreshTokens', () => {
    it('throws NetworkOfflineError when offline', async () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: { onLine: false },
        writable: true,
        configurable: true,
      });

      await expect(refreshTokens('test_refresh_token'))
        .rejects.toThrow(NetworkOfflineError);
    });

    it('throws AuthExpiredError on 401 response', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      });

      await expect(refreshTokens('expired_refresh_token'))
        .rejects.toThrow(AuthExpiredError);
    });

    it('throws AuthExpiredError on 400 response (invalid_grant)', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: 'invalid_grant' }),
      });

      await expect(refreshTokens('invalid_refresh_token'))
        .rejects.toThrow(AuthExpiredError);
    });

    it('returns new tokens on successful refresh', async () => {
      const mockResponse = {
        access_token: 'new_access_token',
        refresh_token: 'new_refresh_token',
        expires_in: 3600,
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const tokens = await refreshTokens('valid_refresh_token');

      expect(tokens.accessToken).toBe('new_access_token');
      expect(tokens.refreshToken).toBe('new_refresh_token');
      expect(tokens.expiresAt).toBeGreaterThan(Date.now());
    });

    it('stores refreshed tokens automatically', async () => {
      const mockResponse = {
        access_token: 'stored_access_token',
        refresh_token: 'stored_refresh_token',
        expires_in: 3600,
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      await refreshTokens('refresh_token');

      // Check that tokens were stored
      const storedTokens = mockStorage[STORAGE_KEYS.OAUTH_TOKENS] as {
        accessToken: string;
        refreshToken: string;
        expiresAt: number;
      };
      expect(storedTokens).toBeDefined();
      expect(storedTokens.accessToken).toBe('stored_access_token');
    });

    it('calculates correct expiration timestamp', async () => {
      const expiresIn = 3600; // 1 hour in seconds
      const mockResponse = {
        access_token: 'access_token',
        refresh_token: 'refresh_token',
        expires_in: expiresIn,
      };

      const beforeTime = Date.now();
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const tokens = await refreshTokens('refresh_token');
      const afterTime = Date.now();

      // Expiration should be approximately now + expires_in * 1000
      const expectedMinExpiration = beforeTime + expiresIn * 1000;
      const expectedMaxExpiration = afterTime + expiresIn * 1000;

      expect(tokens.expiresAt).toBeGreaterThanOrEqual(expectedMinExpiration);
      expect(tokens.expiresAt).toBeLessThanOrEqual(expectedMaxExpiration);
    });

    // =========================================================================
    // Retry Behavior Tests
    // =========================================================================

    it('retries on network error then succeeds', async () => {
      vi.useFakeTimers();

      const mockSuccessResponse = {
        access_token: 'new_access_token',
        refresh_token: 'new_refresh_token',
        expires_in: 3600,
      };

      // Mock fetch to throw once (network error), then succeed
      globalThis.fetch = vi.fn()
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockSuccessResponse),
        });

      const tokenPromise = refreshTokens('valid_refresh_token');

      // Advance timers to skip the backoff delay
      await vi.advanceTimersByTimeAsync(2000);

      const tokens = await tokenPromise;

      expect(tokens.accessToken).toBe('new_access_token');
      expect(tokens.refreshToken).toBe('new_refresh_token');
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });

    it('retries on 5xx then succeeds', async () => {
      vi.useFakeTimers();

      const mockSuccessResponse = {
        access_token: 'retry_success_token',
        refresh_token: 'retry_success_refresh',
        expires_in: 3600,
      };

      // Mock fetch to return 503 once, then succeed
      globalThis.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockSuccessResponse),
        });

      const tokenPromise = refreshTokens('valid_refresh_token');

      // Advance timers to skip the backoff delay
      await vi.advanceTimersByTimeAsync(2000);

      const tokens = await tokenPromise;

      expect(tokens.accessToken).toBe('retry_success_token');
      expect(tokens.refreshToken).toBe('retry_success_refresh');
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });

    it('respects max retries on persistent network failure', async () => {
      vi.useFakeTimers();

      // Mock fetch to throw 4 times (more than MAX_REFRESH_RETRIES = 3)
      globalThis.fetch = vi.fn()
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockRejectedValueOnce(new TypeError('Failed to fetch'));

      // Wrap in a helper to catch rejection properly
      let caughtError: Error | null = null;
      const tokenPromise = refreshTokens('valid_refresh_token').catch((error) => {
        caughtError = error;
      });

      // Advance timers to skip all backoff delays (1s + 2s + 4s = 7s)
      await vi.advanceTimersByTimeAsync(10000);

      await tokenPromise;

      // Should have attempted 4 times (initial + 3 retries)
      expect(globalThis.fetch).toHaveBeenCalledTimes(4);
      expect(caughtError).toBeInstanceOf(NetworkError);

      vi.useRealTimers();
    });
  });

  // ===========================================================================
  // isAuthenticated States
  // ===========================================================================

  describe('isAuthenticated', () => {
    it('returns false when no tokens stored', async () => {
      const result = await isAuthenticated();
      expect(result).toBe(false);
    });

    it('returns false when tokens are null', async () => {
      mockStorage[STORAGE_KEYS.OAUTH_TOKENS] = null;

      const result = await isAuthenticated();
      expect(result).toBe(false);
    });

    it('returns false when accessToken is missing', async () => {
      mockStorage[STORAGE_KEYS.OAUTH_TOKENS] = {
        refreshToken: 'refresh_token',
        expiresAt: Date.now() + 3600000,
      };

      const result = await isAuthenticated();
      expect(result).toBe(false);
    });

    it('returns false when refreshToken is missing', async () => {
      mockStorage[STORAGE_KEYS.OAUTH_TOKENS] = {
        accessToken: 'access_token',
        expiresAt: Date.now() + 3600000,
      };

      const result = await isAuthenticated();
      expect(result).toBe(false);
    });

    it('returns false when expiresAt is missing', async () => {
      mockStorage[STORAGE_KEYS.OAUTH_TOKENS] = {
        accessToken: 'access_token',
        refreshToken: 'refresh_token',
      };

      const result = await isAuthenticated();
      expect(result).toBe(false);
    });

    it('returns true when all token fields are present', async () => {
      mockStorage[STORAGE_KEYS.OAUTH_TOKENS] = {
        accessToken: 'access_token',
        refreshToken: 'refresh_token',
        expiresAt: Date.now() + 3600000,
      };

      const result = await isAuthenticated();
      expect(result).toBe(true);
    });

    it('returns true even when access token is expired (can refresh)', async () => {
      mockStorage[STORAGE_KEYS.OAUTH_TOKENS] = {
        accessToken: 'expired_access_token',
        refreshToken: 'valid_refresh_token',
        expiresAt: Date.now() - 3600000, // Expired 1 hour ago
      };

      const result = await isAuthenticated();
      // Should still return true because we have a refresh token
      expect(result).toBe(true);
    });
  });

  // ===========================================================================
  // getValidAccessToken
  // ===========================================================================

  describe('getValidAccessToken', () => {
    it('throws AuthRequiredError when not authenticated', async () => {
      await expect(getValidAccessToken())
        .rejects.toThrow(AuthRequiredError);
    });

    it('returns existing token when not expiring soon', async () => {
      mockStorage[STORAGE_KEYS.OAUTH_TOKENS] = {
        accessToken: 'valid_access_token',
        refreshToken: 'refresh_token',
        expiresAt: Date.now() + 3600000, // Valid for 1 more hour
      };

      const token = await getValidAccessToken();
      expect(token).toBe('valid_access_token');
    });

    it('refreshes token when expiring within 5 minutes', async () => {
      mockStorage[STORAGE_KEYS.OAUTH_TOKENS] = {
        accessToken: 'expiring_access_token',
        refreshToken: 'valid_refresh_token',
        expiresAt: Date.now() + 2 * 60 * 1000, // Expires in 2 minutes
      };

      const mockResponse = {
        access_token: 'refreshed_access_token',
        refresh_token: 'new_refresh_token',
        expires_in: 3600,
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const token = await getValidAccessToken();
      expect(token).toBe('refreshed_access_token');
      expect(globalThis.fetch).toHaveBeenCalled();
    });

    it('refreshes token when already expired', async () => {
      mockStorage[STORAGE_KEYS.OAUTH_TOKENS] = {
        accessToken: 'expired_access_token',
        refreshToken: 'valid_refresh_token',
        expiresAt: Date.now() - 3600000, // Expired 1 hour ago
      };

      const mockResponse = {
        access_token: 'new_access_token',
        refresh_token: 'new_refresh_token',
        expires_in: 3600,
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const token = await getValidAccessToken();
      expect(token).toBe('new_access_token');
    });

    it('does not refresh when token valid for more than 5 minutes', async () => {
      mockStorage[STORAGE_KEYS.OAUTH_TOKENS] = {
        accessToken: 'valid_token',
        refreshToken: 'refresh_token',
        expiresAt: Date.now() + 10 * 60 * 1000, // Valid for 10 more minutes
      };

      globalThis.fetch = vi.fn();

      const token = await getValidAccessToken();
      expect(token).toBe('valid_token');
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // logout
  // ===========================================================================

  describe('logout', () => {
    it('removes tokens from storage', async () => {
      mockStorage[STORAGE_KEYS.OAUTH_TOKENS] = {
        accessToken: 'access_token',
        refreshToken: 'refresh_token',
        expiresAt: Date.now() + 3600000,
      };

      await logout();

      expect(mockStorage[STORAGE_KEYS.OAUTH_TOKENS]).toBeUndefined();
    });

    it('does not throw when no tokens exist', async () => {
      await expect(logout()).resolves.toBeUndefined();
    });
  });

  // ===========================================================================
  // exchangeCodeForTokens
  // ===========================================================================

  describe('exchangeCodeForTokens', () => {
    it('throws NetworkOfflineError when offline', async () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: { onLine: false },
        writable: true,
        configurable: true,
      });

      await expect(exchangeCodeForTokens('code', 'verifier', 'redirect'))
        .rejects.toThrow(NetworkOfflineError);
    });

    it('throws AuthFailedError on non-OK response', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'invalid_code' }),
      });

      await expect(exchangeCodeForTokens('invalid_code', 'verifier', 'redirect'))
        .rejects.toThrow(AuthFailedError);
    });

    it('returns tokens on successful exchange', async () => {
      const mockResponse = {
        access_token: 'new_access_token',
        refresh_token: 'new_refresh_token',
        expires_in: 3600,
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const tokens = await exchangeCodeForTokens('valid_code', 'verifier', 'redirect');

      expect(tokens.accessToken).toBe('new_access_token');
      expect(tokens.refreshToken).toBe('new_refresh_token');
      expect(tokens.expiresAt).toBeGreaterThan(Date.now());
    });

    it('sends correct POST body parameters', async () => {
      const mockResponse = {
        access_token: 'token',
        refresh_token: 'refresh',
        expires_in: 3600,
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      await exchangeCodeForTokens('the_code', 'the_verifier', 'the_redirect');

      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('oauth_token'),
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        })
      );

      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = fetchCall[1].body;
      expect(body).toContain('code=the_code');
      expect(body).toContain('code_verifier=the_verifier');
      expect(body).toContain('redirect_uri=the_redirect');
      expect(body).toContain('grant_type=authorization_code');
    });
  });

  // ===========================================================================
  // startAuthFlow (callback-based implementation)
  // ===========================================================================

  describe('startAuthFlow', () => {
    it('throws NetworkOfflineError when offline', async () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: { onLine: false },
        writable: true,
        configurable: true,
      });

      await expect(startAuthFlow())
        .rejects.toThrow(NetworkOfflineError);
    });

    it('opens a tab with the authorization URL containing PKCE params', async () => {
      const mockResponse = {
        access_token: 'token',
        refresh_token: 'refresh',
        expires_in: 3600,
      };
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      // Start auth flow (will wait for callback)
      const authPromise = startAuthFlow();

      // Give the async code a moment to execute - need to wait for PKCE challenge generation
      await new Promise(resolve => setTimeout(resolve, 10));

      // Verify chrome.tabs.create was called
      expect(chromeMock.tabs.create).toHaveBeenCalled();
      const createCall = chromeMock.tabs.create.mock.calls[chromeMock.tabs.create.mock.calls.length - 1];
      const authUrl = createCall[0].url;

      // Check URL contains expected OAuth parameters
      expect(authUrl).toContain('app.asana.com');
      expect(authUrl).toContain('oauth_authorize');
      expect(authUrl).toContain('code_challenge=');
      expect(authUrl).toContain('code_challenge_method=S256');
      expect(authUrl).toContain('response_type=code');

      // Complete the flow
      await handleOAuthCallback('test_code');
      await authPromise;
    });

    it('exchanges code and stores tokens when callback received', async () => {
      const mockResponse = {
        access_token: 'final_access_token',
        refresh_token: 'final_refresh_token',
        expires_in: 3600,
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      // Start auth flow
      const authPromise = startAuthFlow();

      // Give the async code a moment to set up pending state
      await new Promise(resolve => setTimeout(resolve, 0));

      // Simulate the callback from the callback page
      const callbackResult = await handleOAuthCallback('auth_code_123');

      expect(callbackResult.success).toBe(true);

      const result = await authPromise;
      expect(result).toBe(true);

      // Tokens should be stored
      const storedTokens = mockStorage[STORAGE_KEYS.OAUTH_TOKENS] as {
        accessToken: string;
      };
      expect(storedTokens.accessToken).toBe('final_access_token');
    });

    it('returns error when callback has no pending auth', async () => {
      // Call handleOAuthCallback without starting auth flow first
      const result = await handleOAuthCallback('orphan_code');

      expect(result.success).toBe(false);
      expect(result.error).toContain('No pending authentication');
    });

    it('rejects when token exchange fails', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'invalid_code' }),
      });

      // Start auth flow
      const authPromise = startAuthFlow();

      // Give the async code a moment to set up pending state
      await new Promise(resolve => setTimeout(resolve, 0));

      // Simulate the callback
      const callbackResult = await handleOAuthCallback('invalid_code');

      expect(callbackResult.success).toBe(false);
      expect(callbackResult.error).toBeDefined();

      // The auth promise should reject
      await expect(authPromise).rejects.toThrow();
    });
  });
});
