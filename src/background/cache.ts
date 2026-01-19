/**
 * Cache module with TTL support for Asana Chrome Extension
 * Uses chrome.storage.local for persistence across service worker restarts
 */

import type { CacheEntry } from '../shared/types';
import { DEFAULT_CACHE_TTL } from '../shared/constants';
import { get, set } from '../shared/storage';

// =============================================================================
// Cache Validity Check
// =============================================================================

/**
 * Check if a cache entry is still valid (not expired)
 * @param entry - Cache entry to check
 * @returns true if the entry exists and has not expired
 */
export function isCacheValid<T>(entry: CacheEntry<T> | null): boolean {
  if (!entry) {
    return false;
  }

  const now = Date.now();
  const expiresAt = entry.timestamp + entry.ttl;

  return now < expiresAt;
}

// =============================================================================
// Core Cache Functions
// =============================================================================

/**
 * Get cached data if it exists and has not expired
 * @param key - Cache key
 * @returns Promise resolving to cached data or null if not found/expired
 */
export async function getCached<T>(key: string): Promise<T | null> {
  const entry = await get<CacheEntry<T>>(key);

  if (!isCacheValid(entry)) {
    return null;
  }

  return entry!.data;
}

/**
 * Store data in cache with TTL
 * @param key - Cache key
 * @param data - Data to cache
 * @param ttl - Time to live in milliseconds (default: 5 minutes)
 */
export async function setCached<T>(
  key: string,
  data: T,
  ttl: number = DEFAULT_CACHE_TTL
): Promise<void> {
  const entry: CacheEntry<T> = {
    data,
    timestamp: Date.now(),
    ttl,
  };

  await set(key, entry);
}

// =============================================================================
// Stale-While-Revalidate Pattern
// =============================================================================

/**
 * Options for getOrFetch function
 */
export interface GetOrFetchOptions {
  /** Time to live in milliseconds (default: 5 minutes) */
  ttl?: number;
  /** Force refresh from fetch function, bypassing cache */
  forceRefresh?: boolean;
  /** Stale threshold in milliseconds - if data is older than this, trigger background refresh (default: 80% of TTL) */
  staleThreshold?: number;
}

/**
 * Get data from cache or fetch it, implementing stale-while-revalidate pattern
 *
 * - Returns cached data immediately if exists (even if stale but not expired)
 * - Triggers background refresh if data is stale
 * - Falls back to fetch if no cached data
 *
 * @param key - Cache key
 * @param fetchFn - Function to fetch fresh data
 * @param options - Configuration options
 * @returns Promise resolving to data (from cache or fetch)
 */
export async function getOrFetch<T>(
  key: string,
  fetchFn: () => Promise<T>,
  options: GetOrFetchOptions = {}
): Promise<T> {
  const {
    ttl = DEFAULT_CACHE_TTL,
    forceRefresh = false,
    staleThreshold,
  } = options;

  // Calculate when data is considered stale (default: 80% of TTL)
  const effectiveStaleThreshold = staleThreshold ?? Math.floor(ttl * 0.8);

  // If force refresh, skip cache entirely
  if (forceRefresh) {
    const freshData = await fetchFn();
    await setCached(key, freshData, ttl);
    return freshData;
  }

  // Try to get cached entry
  const entry = await get<CacheEntry<T>>(key);

  // No cached data - fetch fresh
  if (!entry) {
    const freshData = await fetchFn();
    await setCached(key, freshData, ttl);
    return freshData;
  }

  const now = Date.now();
  const age = now - entry.timestamp;
  const isExpired = now >= entry.timestamp + entry.ttl;
  const isStale = age >= effectiveStaleThreshold;

  // Expired data - must fetch fresh
  if (isExpired) {
    const freshData = await fetchFn();
    await setCached(key, freshData, ttl);
    return freshData;
  }

  // Data is stale but not expired - return cached immediately, refresh in background
  if (isStale) {
    // Fire-and-forget background refresh
    void (async () => {
      try {
        const freshData = await fetchFn();
        await setCached(key, freshData, ttl);
      } catch {
        // Silently ignore background refresh errors
        // The stale data is still valid
      }
    })();
  }

  // Return cached data (either fresh or stale but valid)
  return entry.data;
}

// =============================================================================
// Cache Management
// =============================================================================

/**
 * Clear all cached data from storage
 * Removes only cache entries (keys starting with CACHE_KEY prefix pattern)
 */
export async function clearCache(): Promise<void> {
  // Get all storage keys and remove cache entries
  const storage = await chrome.storage.local.get(null);
  const cacheKeys = Object.keys(storage).filter(key =>
    key.startsWith('cache_') || key.includes('_cache')
  );

  if (cacheKeys.length > 0) {
    await chrome.storage.local.remove(cacheKeys);
  }
}
