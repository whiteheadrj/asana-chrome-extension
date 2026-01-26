/**
 * Shared constants for Asana Chrome Extension
 */

// =============================================================================
// API Base URLs
// =============================================================================

export const ASANA_API_BASE = 'https://app.asana.com/api/1.0';
export const CLAUDE_API_BASE = 'https://api.anthropic.com/v1';

// =============================================================================
// Cache Configuration
// =============================================================================

/** Default cache TTL: 5 minutes in milliseconds */
export const DEFAULT_CACHE_TTL = 5 * 60 * 1000;

// =============================================================================
// Storage Keys
// =============================================================================

export enum STORAGE_KEYS {
  // OAuth tokens
  OAUTH_TOKENS = 'oauth_tokens',

  // User settings
  CLAUDE_API_KEY = 'claude_api_key',
  CACHE_TTL = 'cache_ttl',

  // Cached Asana data
  CACHE_WORKSPACES = 'cache_workspaces',
  CACHE_PROJECTS = 'cache_projects',
  CACHE_SECTIONS = 'cache_sections',
  CACHE_TAGS = 'cache_tags',

  // Last used selections
  LAST_USED_SELECTIONS = 'last_used_selections',

  // Gmail account mapping (for detecting account reorder)
  EMAIL_ACCOUNT_MAPPING = 'email_account_mapping',

  // Task history
  TASK_HISTORY = 'task_history',
}

// =============================================================================
// OAuth Configuration
// =============================================================================

/** Required OAuth scopes for Asana API access */
export const OAUTH_SCOPES = ['default', 'read:user', 'write:user'] as const;

// Note: Asana's "default" scope provides read/write to most resources
// The explicit read:user and write:user ensure user profile access
