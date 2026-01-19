/**
 * Unit tests for cache module
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockStorage } from '../../test-setup.js';

// Import functions under test
import {
  getCached,
  setCached,
  getOrFetch,
  isCacheValid,
  clearCache,
} from '../cache.js';
import { DEFAULT_CACHE_TTL } from '../../shared/constants.js';

describe('cache module', () => {
  beforeEach(() => {
    // Clear mock storage before each test
    for (const key of Object.keys(mockStorage)) {
      delete mockStorage[key];
    }
    vi.clearAllMocks();
  });

  // ===========================================================================
  // isCacheValid
  // ===========================================================================

  describe('isCacheValid', () => {
    it('returns false for null entry', () => {
      expect(isCacheValid(null)).toBe(false);
    });

    it('returns true for non-expired entry', () => {
      const entry = {
        data: 'test',
        timestamp: Date.now(),
        ttl: 60000,
      };
      expect(isCacheValid(entry)).toBe(true);
    });

    it('returns false for expired entry', () => {
      const entry = {
        data: 'test',
        timestamp: Date.now() - 120000, // 2 minutes ago
        ttl: 60000, // 1 minute TTL
      };
      expect(isCacheValid(entry)).toBe(false);
    });

    it('returns false when exactly at expiration boundary', () => {
      const now = Date.now();
      const entry = {
        data: 'test',
        timestamp: now - 60000, // exactly TTL ago
        ttl: 60000,
      };
      // At exactly the expiration time, now >= expiresAt, so it's expired
      expect(isCacheValid(entry)).toBe(false);
    });
  });

  // ===========================================================================
  // getCached
  // ===========================================================================

  describe('getCached', () => {
    it('returns null for missing key', async () => {
      const result = await getCached('nonexistent_key');
      expect(result).toBeNull();
    });

    it('returns null for expired cache entry', async () => {
      const expiredEntry = {
        data: { value: 'old data' },
        timestamp: Date.now() - 600000, // 10 minutes ago
        ttl: 300000, // 5 minute TTL
      };
      mockStorage['test_key'] = expiredEntry;

      const result = await getCached('test_key');
      expect(result).toBeNull();
    });

    it('returns data for valid cache entry', async () => {
      const validEntry = {
        data: { value: 'fresh data' },
        timestamp: Date.now(),
        ttl: 300000,
      };
      mockStorage['test_key'] = validEntry;

      const result = await getCached<{ value: string }>('test_key');
      expect(result).toEqual({ value: 'fresh data' });
    });

    it('returns data for entry just before expiration', async () => {
      const entry = {
        data: 'almost expired',
        timestamp: Date.now() - 299999, // 1ms before TTL expires
        ttl: 300000,
      };
      mockStorage['test_key'] = entry;

      const result = await getCached<string>('test_key');
      expect(result).toBe('almost expired');
    });
  });

  // ===========================================================================
  // setCached
  // ===========================================================================

  describe('setCached', () => {
    it('stores data with timestamp and default TTL', async () => {
      const beforeTime = Date.now();
      await setCached('test_key', { value: 'test data' });
      const afterTime = Date.now();

      const stored = mockStorage['test_key'] as {
        data: { value: string };
        timestamp: number;
        ttl: number;
      };

      expect(stored).toBeDefined();
      expect(stored.data).toEqual({ value: 'test data' });
      expect(stored.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(stored.timestamp).toBeLessThanOrEqual(afterTime);
      expect(stored.ttl).toBe(DEFAULT_CACHE_TTL);
    });

    it('stores data with custom TTL', async () => {
      const customTTL = 60000; // 1 minute
      await setCached('test_key', 'custom ttl data', customTTL);

      const stored = mockStorage['test_key'] as {
        data: string;
        timestamp: number;
        ttl: number;
      };

      expect(stored.data).toBe('custom ttl data');
      expect(stored.ttl).toBe(customTTL);
    });

    it('overwrites existing cache entry', async () => {
      mockStorage['test_key'] = {
        data: 'old data',
        timestamp: Date.now() - 1000,
        ttl: 300000,
      };

      await setCached('test_key', 'new data');

      const stored = mockStorage['test_key'] as { data: string };
      expect(stored.data).toBe('new data');
    });

    it('stores complex objects', async () => {
      const complexData = {
        workspaces: [
          { gid: '1', name: 'Workspace 1' },
          { gid: '2', name: 'Workspace 2' },
        ],
        nested: { deep: { value: 42 } },
      };

      await setCached('complex_key', complexData);

      const stored = mockStorage['complex_key'] as { data: typeof complexData };
      expect(stored.data).toEqual(complexData);
    });
  });

  // ===========================================================================
  // getOrFetch - TTL Expiration
  // ===========================================================================

  describe('getOrFetch - TTL expiration', () => {
    it('fetches when no cached data exists', async () => {
      const fetchFn = vi.fn().mockResolvedValue({ fetched: true });

      const result = await getOrFetch('new_key', fetchFn);

      expect(fetchFn).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ fetched: true });
    });

    it('returns cached data when not expired', async () => {
      mockStorage['cached_key'] = {
        data: { cached: true },
        timestamp: Date.now(),
        ttl: 300000,
      };

      const fetchFn = vi.fn().mockResolvedValue({ fetched: true });

      const result = await getOrFetch('cached_key', fetchFn);

      expect(fetchFn).not.toHaveBeenCalled();
      expect(result).toEqual({ cached: true });
    });

    it('fetches fresh data when cache is expired', async () => {
      mockStorage['expired_key'] = {
        data: { stale: true },
        timestamp: Date.now() - 600000, // 10 minutes ago
        ttl: 300000, // 5 minute TTL
      };

      const fetchFn = vi.fn().mockResolvedValue({ fresh: true });

      const result = await getOrFetch('expired_key', fetchFn);

      expect(fetchFn).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ fresh: true });
    });

    it('caches fetched data with provided TTL', async () => {
      const fetchFn = vi.fn().mockResolvedValue('fetched value');
      const customTTL = 120000;

      await getOrFetch('fetch_key', fetchFn, { ttl: customTTL });

      const stored = mockStorage['fetch_key'] as {
        data: string;
        ttl: number;
      };
      expect(stored.data).toBe('fetched value');
      expect(stored.ttl).toBe(customTTL);
    });

    it('uses default TTL when not specified', async () => {
      const fetchFn = vi.fn().mockResolvedValue('data');

      await getOrFetch('default_ttl_key', fetchFn);

      const stored = mockStorage['default_ttl_key'] as { ttl: number };
      expect(stored.ttl).toBe(DEFAULT_CACHE_TTL);
    });
  });

  // ===========================================================================
  // getOrFetch - Force Refresh
  // ===========================================================================

  describe('getOrFetch - force refresh', () => {
    it('bypasses cache when forceRefresh is true', async () => {
      mockStorage['force_key'] = {
        data: { cached: true },
        timestamp: Date.now(),
        ttl: 300000,
      };

      const fetchFn = vi.fn().mockResolvedValue({ fresh: true });

      const result = await getOrFetch('force_key', fetchFn, {
        forceRefresh: true,
      });

      expect(fetchFn).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ fresh: true });
    });

    it('updates cache when forceRefresh is used', async () => {
      mockStorage['force_key'] = {
        data: 'old',
        timestamp: Date.now() - 1000,
        ttl: 300000,
      };

      const fetchFn = vi.fn().mockResolvedValue('new');

      await getOrFetch('force_key', fetchFn, { forceRefresh: true });

      const stored = mockStorage['force_key'] as { data: string };
      expect(stored.data).toBe('new');
    });
  });

  // ===========================================================================
  // getOrFetch - Stale-While-Revalidate
  // ===========================================================================

  describe('getOrFetch - stale-while-revalidate', () => {
    it('returns stale data immediately and triggers background refresh', async () => {
      const ttl = 300000; // 5 minutes
      const staleThreshold = ttl * 0.8; // 4 minutes (80% of TTL)

      // Cache entry that is stale (past 80% threshold) but not expired
      mockStorage['stale_key'] = {
        data: { stale: true },
        timestamp: Date.now() - staleThreshold - 1000, // Just past stale threshold
        ttl,
      };

      const fetchFn = vi.fn().mockResolvedValue({ fresh: true });

      const result = await getOrFetch('stale_key', fetchFn, { ttl });

      // Should return stale data immediately
      expect(result).toEqual({ stale: true });

      // Background refresh should be triggered
      // Wait for background refresh to complete
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it('does not trigger background refresh for fresh data', async () => {
      const ttl = 300000;
      // Fresh data - only 10% into TTL
      mockStorage['fresh_key'] = {
        data: { fresh: true },
        timestamp: Date.now() - ttl * 0.1,
        ttl,
      };

      const fetchFn = vi.fn().mockResolvedValue({ newer: true });

      const result = await getOrFetch('fresh_key', fetchFn, { ttl });

      expect(result).toEqual({ fresh: true });

      // Wait a bit to ensure no background fetch occurs
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(fetchFn).not.toHaveBeenCalled();
    });

    it('uses custom stale threshold when provided', async () => {
      const ttl = 300000;
      const customStaleThreshold = 60000; // 1 minute (much lower than default 80%)

      // Cache entry that is past custom threshold but not 80% of TTL
      mockStorage['custom_stale_key'] = {
        data: { stale: true },
        timestamp: Date.now() - customStaleThreshold - 1000,
        ttl,
      };

      const fetchFn = vi.fn().mockResolvedValue({ fresh: true });

      const result = await getOrFetch('custom_stale_key', fetchFn, {
        ttl,
        staleThreshold: customStaleThreshold,
      });

      expect(result).toEqual({ stale: true });

      // Wait for background refresh
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it('silently ignores background refresh errors', async () => {
      const ttl = 300000;
      const staleThreshold = ttl * 0.8;

      mockStorage['error_key'] = {
        data: { stale: true },
        timestamp: Date.now() - staleThreshold - 1000,
        ttl,
      };

      const fetchFn = vi.fn().mockRejectedValue(new Error('Network error'));

      const result = await getOrFetch('error_key', fetchFn, { ttl });

      // Should still return stale data
      expect(result).toEqual({ stale: true });

      // Wait for background refresh to fail
      await new Promise(resolve => setTimeout(resolve, 10));

      // fetchFn was called but error was silently handled
      expect(fetchFn).toHaveBeenCalledTimes(1);

      // Original cache entry should remain unchanged
      const stored = mockStorage['error_key'] as { data: { stale: boolean } };
      expect(stored.data).toEqual({ stale: true });
    });

    it('updates cache after successful background refresh', async () => {
      const ttl = 300000;
      const staleThreshold = ttl * 0.8;

      mockStorage['update_key'] = {
        data: 'stale',
        timestamp: Date.now() - staleThreshold - 1000,
        ttl,
      };

      const fetchFn = vi.fn().mockResolvedValue('fresh');

      await getOrFetch('update_key', fetchFn, { ttl });

      // Wait for background refresh
      await new Promise(resolve => setTimeout(resolve, 10));

      const stored = mockStorage['update_key'] as { data: string };
      expect(stored.data).toBe('fresh');
    });
  });

  // ===========================================================================
  // clearCache
  // ===========================================================================

  describe('clearCache', () => {
    it('removes keys starting with cache_', async () => {
      mockStorage['cache_workspaces'] = { data: 'workspaces' };
      mockStorage['cache_projects'] = { data: 'projects' };
      mockStorage['oauth_tokens'] = { accessToken: 'secret' };

      await clearCache();

      expect(mockStorage['cache_workspaces']).toBeUndefined();
      expect(mockStorage['cache_projects']).toBeUndefined();
      expect(mockStorage['oauth_tokens']).toEqual({ accessToken: 'secret' });
    });

    it('removes keys containing _cache', async () => {
      mockStorage['user_data_cache'] = { data: 'user data' };
      mockStorage['settings_cache'] = { data: 'settings' };
      mockStorage['api_key'] = 'secret-key';

      await clearCache();

      expect(mockStorage['user_data_cache']).toBeUndefined();
      expect(mockStorage['settings_cache']).toBeUndefined();
      expect(mockStorage['api_key']).toBe('secret-key');
    });

    it('does nothing when no cache keys exist', async () => {
      mockStorage['other_key'] = 'value';

      await clearCache();

      expect(mockStorage['other_key']).toBe('value');
    });

    it('handles empty storage', async () => {
      await expect(clearCache()).resolves.toBeUndefined();
    });
  });
});
