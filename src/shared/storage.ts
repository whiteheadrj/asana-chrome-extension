/**
 * Chrome storage utilities for Asana Chrome Extension
 * Wraps chrome.storage.local with typed async functions
 */

import type { OAuthTokens } from './types';
import { STORAGE_KEYS } from './constants';

// =============================================================================
// Generic Storage Functions
// =============================================================================

/**
 * Get a value from chrome.storage.local
 * @param key - Storage key
 * @returns Promise resolving to the value or null if not found
 */
export async function get<T>(key: string): Promise<T | null> {
  const result = await chrome.storage.local.get(key);
  return (result[key] as T) ?? null;
}

/**
 * Set a value in chrome.storage.local
 * @param key - Storage key
 * @param value - Value to store
 */
export async function set<T>(key: string, value: T): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

/**
 * Remove a value from chrome.storage.local
 * @param key - Storage key to remove
 */
export async function remove(key: string): Promise<void> {
  await chrome.storage.local.remove(key);
}

// =============================================================================
// Token-Specific Functions
// =============================================================================

/**
 * Get OAuth tokens from storage
 * @returns Promise resolving to tokens or null if not stored
 */
export async function getTokens(): Promise<OAuthTokens | null> {
  return get<OAuthTokens>(STORAGE_KEYS.OAUTH_TOKENS);
}

/**
 * Store OAuth tokens
 * @param tokens - OAuth tokens to store
 */
export async function setTokens(tokens: OAuthTokens): Promise<void> {
  await set(STORAGE_KEYS.OAUTH_TOKENS, tokens);
}
