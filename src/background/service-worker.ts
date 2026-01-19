/**
 * Service Worker for Asana Chrome Extension
 * Central hub for message routing between popup, content scripts, and APIs
 */

import type {
  ExtensionMessage,
  CreateTaskResponse,
  AsanaWorkspace,
  AsanaProject,
  AsanaSection,
  AsanaTag,
} from '../shared/types';
import {
  createMessageRouter,
  createSuccessResponse,
  createErrorResponse,
  type MessageResponse,
  type MessageHandlerRegistry,
  type MessageErrorCode,
} from '../shared/messaging';
import { isAuthenticated, startAuthFlow, logout, handleOAuthCallback } from './oauth';
import { getWorkspaces, getProjects, getSections, getTags, createTask } from './asana-api';
import { getOrFetch, clearCache } from './cache';
import { setupContextMenu } from './context-menu';
import {
  isOffline,
  getUserMessage,
  getErrorCode,
} from '../shared/errors';

// =============================================================================
// Cache Key Helpers
// =============================================================================

const CACHE_KEYS = {
  WORKSPACES: 'cache_workspaces',
  PROJECTS: (workspaceGid: string) => `cache_projects_${workspaceGid}`,
  SECTIONS: (projectGid: string) => `cache_sections_${projectGid}`,
  TAGS: (workspaceGid: string) => `cache_tags_${workspaceGid}`,
};

// =============================================================================
// Error Handling Helpers
// =============================================================================

/**
 * Map ExtensionError code to MessageErrorCode
 */
function mapErrorCode(error: unknown): MessageErrorCode {
  const code = getErrorCode(error);

  // Map error codes to MessageErrorCode
  switch (code) {
    case 'AUTH_REQUIRED':
    case 'AUTH_EXPIRED':
      return 'AUTH_REQUIRED';
    case 'AUTH_FAILED':
      return 'AUTH_FAILED';
    case 'NETWORK_OFFLINE':
    case 'NETWORK_ERROR':
      return 'NETWORK_ERROR';
    case 'RATE_LIMITED':
      return 'RATE_LIMITED';
    case 'NOT_FOUND':
      return 'NOT_FOUND';
    case 'VALIDATION_ERROR':
    case 'INVALID_REQUEST':
      return 'INVALID_REQUEST';
    case 'API_ERROR':
      return 'API_ERROR';
    default:
      return 'UNKNOWN_ERROR';
  }
}

/**
 * Create an error response from any error type
 * Provides user-friendly messages and appropriate error codes
 */
function handleError(error: unknown): MessageResponse<never> {
  const userMessage = getUserMessage(error);
  const errorCode = mapErrorCode(error);

  // Log the original error for debugging
  console.error('[ServiceWorker] Error:', error);

  return createErrorResponse(userMessage, errorCode);
}

// =============================================================================
// Message Handlers
// =============================================================================

/**
 * Handle GET_AUTH_STATUS message
 * Returns current authentication state
 */
async function handleGetAuthStatus(): Promise<MessageResponse<{ isAuthenticated: boolean }>> {
  // Check for offline state first
  if (isOffline()) {
    // Still check local state when offline
    try {
      const authenticated = await isAuthenticated();
      return createSuccessResponse({ isAuthenticated: authenticated });
    } catch (error) {
      return handleError(error);
    }
  }

  try {
    const authenticated = await isAuthenticated();
    return createSuccessResponse({ isAuthenticated: authenticated });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Handle START_AUTH message
 * Initiates OAuth flow with Asana
 */
async function handleStartAuth(): Promise<MessageResponse<{ isAuthenticated: boolean }>> {
  // Check for offline state first
  if (isOffline()) {
    return createErrorResponse(
      'You appear to be offline. Please check your internet connection.',
      'NETWORK_ERROR'
    );
  }

  try {
    const success = await startAuthFlow();
    return createSuccessResponse({ isAuthenticated: success });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Handle LOGOUT message
 * Clears stored tokens and cache
 */
async function handleLogout(): Promise<MessageResponse<void>> {
  try {
    await logout();
    await clearCache();
    return createSuccessResponse();
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Handle GET_WORKSPACES message
 * Returns user's workspaces (from cache or API)
 */
async function handleGetWorkspaces(): Promise<MessageResponse<AsanaWorkspace[]>> {
  try {
    const workspaces = await getOrFetch<AsanaWorkspace[]>(
      CACHE_KEYS.WORKSPACES,
      getWorkspaces
    );
    return createSuccessResponse(workspaces);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Handle GET_PROJECTS message
 * Returns projects in a workspace (from cache or API)
 */
async function handleGetProjects(
  message: Extract<ExtensionMessage, { type: 'GET_PROJECTS' }>
): Promise<MessageResponse<AsanaProject[]>> {
  try {
    const projects = await getOrFetch<AsanaProject[]>(
      CACHE_KEYS.PROJECTS(message.workspaceGid),
      () => getProjects(message.workspaceGid)
    );
    return createSuccessResponse(projects);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Handle GET_SECTIONS message
 * Returns sections in a project (from cache or API)
 */
async function handleGetSections(
  message: Extract<ExtensionMessage, { type: 'GET_SECTIONS' }>
): Promise<MessageResponse<AsanaSection[]>> {
  try {
    const sections = await getOrFetch<AsanaSection[]>(
      CACHE_KEYS.SECTIONS(message.projectGid),
      () => getSections(message.projectGid)
    );
    return createSuccessResponse(sections);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Handle GET_TAGS message
 * Returns tags in a workspace (from cache or API)
 */
async function handleGetTags(
  message: Extract<ExtensionMessage, { type: 'GET_TAGS' }>
): Promise<MessageResponse<AsanaTag[]>> {
  try {
    const tags = await getOrFetch<AsanaTag[]>(
      CACHE_KEYS.TAGS(message.workspaceGid),
      () => getTags(message.workspaceGid)
    );
    return createSuccessResponse(tags);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Handle CREATE_TASK message
 * Creates a new task in Asana
 */
async function handleCreateTask(
  message: Extract<ExtensionMessage, { type: 'CREATE_TASK' }>
): Promise<MessageResponse<CreateTaskResponse>> {
  // Check for offline state first
  if (isOffline()) {
    return createErrorResponse(
      'You appear to be offline. Please check your internet connection.',
      'NETWORK_ERROR'
    );
  }

  try {
    const task = await createTask(message.payload);
    const response: CreateTaskResponse = {
      success: true,
      taskGid: task.gid,
      taskUrl: task.permalink_url,
    };
    return createSuccessResponse(response);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Handle REFRESH_CACHE message
 * Clears all cached data
 */
async function handleRefreshCache(): Promise<MessageResponse<void>> {
  try {
    await clearCache();
    return createSuccessResponse();
  } catch (error) {
    return handleError(error);
  }
}

// =============================================================================
// Message Handler Registry
// =============================================================================

/**
 * Registry mapping message types to their handlers
 * Uses the createMessageRouter utility for type-safe routing
 */
const messageHandlers: MessageHandlerRegistry = {
  // Auth messages
  GET_AUTH_STATUS: async () => handleGetAuthStatus(),
  START_AUTH: async () => handleStartAuth(),
  LOGOUT: async () => handleLogout(),

  // Data messages
  GET_WORKSPACES: async () => handleGetWorkspaces(),
  GET_PROJECTS: async (message) => handleGetProjects(message as Extract<ExtensionMessage, { type: 'GET_PROJECTS' }>),
  GET_SECTIONS: async (message) => handleGetSections(message as Extract<ExtensionMessage, { type: 'GET_SECTIONS' }>),
  GET_TAGS: async (message) => handleGetTags(message as Extract<ExtensionMessage, { type: 'GET_TAGS' }>),

  // Task creation
  CREATE_TASK: async (message) => handleCreateTask(message as Extract<ExtensionMessage, { type: 'CREATE_TASK' }>),

  // Cache management
  REFRESH_CACHE: async () => handleRefreshCache(),

  // Page info (handled by content scripts, not service worker)
  GET_PAGE_INFO: async () => createErrorResponse('GET_PAGE_INFO should be sent to content script', 'INVALID_REQUEST'),
};

// =============================================================================
// Event Listeners
// =============================================================================

/**
 * Listen for messages from popup and content scripts
 * Uses createMessageRouter for consistent message handling
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle OAuth callback separately (different message format)
  if (message?.type === 'OAUTH_CALLBACK' && message?.code) {
    handleOAuthCallback(message.code).then(sendResponse);
    return true;
  }

  // Route all other messages through the standard router
  const router = createMessageRouter(messageHandlers);
  return router(message, sender, sendResponse);
});

// =============================================================================
// Service Worker Lifecycle
// =============================================================================

/**
 * Handle extension install/update
 */
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Asana Task Creator extension installed');
  } else if (details.reason === 'update') {
    console.log('Asana Task Creator extension updated to', chrome.runtime.getManifest().version);
  }

  // Register context menu on install/update
  setupContextMenu();
});

// =============================================================================
// Service Worker Startup
// =============================================================================

// Initialize context menu on service worker startup
// (needed because service workers can be terminated and restarted)
setupContextMenu();

// Log service worker activation
console.log('Asana Task Creator service worker started');
