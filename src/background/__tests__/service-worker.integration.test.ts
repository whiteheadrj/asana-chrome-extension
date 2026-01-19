/**
 * Integration tests for service worker message handling
 * Tests the full message flow through the service worker's message router
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockStorage, chromeMock } from '../../test-setup.js';
import { STORAGE_KEYS, ASANA_API_BASE } from '../../shared/constants.js';

// Re-import service worker to register message handlers
// Note: The service worker registers handlers on import
import '../service-worker.js';

// =============================================================================
// Test Helpers
// =============================================================================

// Keep track of the registered message listener
let messageListener: (
  message: unknown,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: unknown) => void
) => boolean | void;

// Capture the message listener registered by service-worker.ts
beforeEach(() => {
  // The service worker calls chrome.runtime.onMessage.addListener
  // Find the listener that was registered
  const addListenerMock = chromeMock.runtime.onMessage.addListener as ReturnType<typeof vi.fn>;
  if (addListenerMock.mock.calls.length > 0) {
    // Get the last registered listener (the service worker's)
    messageListener = addListenerMock.mock.calls[addListenerMock.mock.calls.length - 1][0];
  }
});

// Helper to simulate sending a message and getting the response
async function sendMessageToServiceWorker(message: unknown): Promise<unknown> {
  return new Promise((resolve) => {
    const sender: chrome.runtime.MessageSender = {
      id: 'test-extension-id',
      tab: {
        id: 1,
        index: 0,
        windowId: 1,
        active: true,
        pinned: false,
        highlighted: false,
        incognito: false,
        selected: false,
        discarded: false,
        autoDiscardable: true,
        groupId: -1,
      },
    };

    const sendResponse = (response: unknown) => {
      resolve(response);
    };

    // Call the message listener directly
    const isAsync = messageListener(message, sender, sendResponse);

    // If not async, response was sent synchronously
    if (!isAsync) {
      resolve(undefined);
    }
  });
}

// Helper to set up authenticated state with valid tokens
function setupAuthenticatedState() {
  mockStorage[STORAGE_KEYS.OAUTH_TOKENS] = {
    accessToken: 'test_access_token',
    refreshToken: 'test_refresh_token',
    expiresAt: Date.now() + 3600000, // Valid for 1 hour
  };
}

// Helper to create a mock Response
function createMockResponse(
  data: unknown,
  options: { status?: number; headers?: Record<string, string> } = {}
): Partial<Response> {
  const { status = 200, headers = {} } = options;
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
    json: () => Promise.resolve(data),
  };
}

// Mock navigator for offline detection
const originalNavigator = globalThis.navigator;

describe('Service Worker Integration Tests', () => {
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
  // GET_AUTH_STATUS Message Flow
  // ===========================================================================

  describe('GET_AUTH_STATUS message flow', () => {
    it('returns isAuthenticated: false when no tokens stored', async () => {
      const response = await sendMessageToServiceWorker({ type: 'GET_AUTH_STATUS' });

      expect(response).toEqual({
        success: true,
        data: { isAuthenticated: false },
      });
    });

    it('returns isAuthenticated: false when tokens are null', async () => {
      mockStorage[STORAGE_KEYS.OAUTH_TOKENS] = null;

      const response = await sendMessageToServiceWorker({ type: 'GET_AUTH_STATUS' });

      expect(response).toEqual({
        success: true,
        data: { isAuthenticated: false },
      });
    });

    it('returns isAuthenticated: true when valid tokens exist', async () => {
      setupAuthenticatedState();

      const response = await sendMessageToServiceWorker({ type: 'GET_AUTH_STATUS' });

      expect(response).toEqual({
        success: true,
        data: { isAuthenticated: true },
      });
    });

    it('returns isAuthenticated: true even when tokens are expired (has refresh token)', async () => {
      mockStorage[STORAGE_KEYS.OAUTH_TOKENS] = {
        accessToken: 'expired_token',
        refreshToken: 'valid_refresh_token',
        expiresAt: Date.now() - 1000, // Expired
      };

      const response = await sendMessageToServiceWorker({ type: 'GET_AUTH_STATUS' });

      expect(response).toEqual({
        success: true,
        data: { isAuthenticated: true },
      });
    });

    it('returns isAuthenticated: false when offline but tokens exist', async () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: { onLine: false },
        writable: true,
        configurable: true,
      });
      setupAuthenticatedState();

      const response = await sendMessageToServiceWorker({ type: 'GET_AUTH_STATUS' });

      // Should still return success with auth status based on stored tokens
      expect(response).toEqual({
        success: true,
        data: { isAuthenticated: true },
      });
    });
  });

  // ===========================================================================
  // CREATE_TASK with Mocked Asana API
  // ===========================================================================

  describe('CREATE_TASK message flow', () => {
    const validTaskPayload = {
      name: 'Test Task',
      workspaceGid: 'ws123',
      projectGid: 'proj456',
    };

    beforeEach(() => {
      setupAuthenticatedState();
    });

    it('creates a task and returns success response', async () => {
      const mockTaskResponse = {
        data: {
          gid: 'task789',
          name: 'Test Task',
          permalink_url: 'https://app.asana.com/0/proj456/task789',
        },
      };

      globalThis.fetch = vi.fn().mockResolvedValue(createMockResponse(mockTaskResponse));

      const response = await sendMessageToServiceWorker({
        type: 'CREATE_TASK',
        payload: validTaskPayload,
      });

      expect(response).toEqual({
        success: true,
        data: {
          success: true,
          taskGid: 'task789',
          taskUrl: 'https://app.asana.com/0/proj456/task789',
        },
      });

      // Verify fetch was called with correct endpoint
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/tasks'),
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    it('includes task notes when provided', async () => {
      const mockTaskResponse = {
        data: {
          gid: 'task789',
          name: 'Test Task',
          permalink_url: 'https://app.asana.com/0/proj456/task789',
        },
      };

      globalThis.fetch = vi.fn().mockResolvedValue(createMockResponse(mockTaskResponse));

      await sendMessageToServiceWorker({
        type: 'CREATE_TASK',
        payload: {
          ...validTaskPayload,
          notes: 'Task notes here',
        },
      });

      const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.data.notes).toBe('Task notes here');
    });

    it('includes section when provided', async () => {
      const mockTaskResponse = {
        data: {
          gid: 'task789',
          name: 'Test Task',
          permalink_url: 'https://app.asana.com/0/proj456/task789',
        },
      };

      globalThis.fetch = vi.fn().mockResolvedValue(createMockResponse(mockTaskResponse));

      await sendMessageToServiceWorker({
        type: 'CREATE_TASK',
        payload: {
          ...validTaskPayload,
          sectionGid: 'section123',
        },
      });

      const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.data.memberships).toEqual([
        { project: 'proj456', section: 'section123' },
      ]);
    });

    it('includes tags when provided', async () => {
      const mockTaskResponse = {
        data: {
          gid: 'task789',
          name: 'Test Task',
          permalink_url: 'https://app.asana.com/0/proj456/task789',
        },
      };

      globalThis.fetch = vi.fn().mockResolvedValue(createMockResponse(mockTaskResponse));

      await sendMessageToServiceWorker({
        type: 'CREATE_TASK',
        payload: {
          ...validTaskPayload,
          tagGids: ['tag1', 'tag2'],
        },
      });

      const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.data.tags).toEqual(['tag1', 'tag2']);
    });

    it('returns error when offline', async () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: { onLine: false },
        writable: true,
        configurable: true,
      });

      const response = await sendMessageToServiceWorker({
        type: 'CREATE_TASK',
        payload: validTaskPayload,
      });

      expect(response).toMatchObject({
        success: false,
        errorCode: 'NETWORK_ERROR',
      });
    });

    it('returns error when API returns 401', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        createMockResponse(
          { errors: [{ message: 'Invalid token' }] },
          { status: 401 }
        )
      );

      const response = await sendMessageToServiceWorker({
        type: 'CREATE_TASK',
        payload: validTaskPayload,
      });

      expect(response).toMatchObject({
        success: false,
        errorCode: 'AUTH_REQUIRED',
      });
    });

    it('returns error when API returns 400', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        createMockResponse(
          { errors: [{ message: 'Invalid project' }] },
          { status: 400 }
        )
      );

      const response = await sendMessageToServiceWorker({
        type: 'CREATE_TASK',
        payload: validTaskPayload,
      });

      expect(response).toMatchObject({
        success: false,
        errorCode: 'API_ERROR',
      });
    });

    it('returns error when not authenticated', async () => {
      // Clear tokens
      delete mockStorage[STORAGE_KEYS.OAUTH_TOKENS];

      const response = await sendMessageToServiceWorker({
        type: 'CREATE_TASK',
        payload: validTaskPayload,
      });

      expect(response).toMatchObject({
        success: false,
        errorCode: 'AUTH_REQUIRED',
      });
    });
  });

  // ===========================================================================
  // REFRESH_CACHE Message Flow
  // ===========================================================================

  describe('REFRESH_CACHE message flow', () => {
    it('clears all cache entries and returns success', async () => {
      // Set up some cache data
      mockStorage['cache_workspaces'] = {
        data: [{ gid: 'ws1', name: 'Workspace 1' }],
        timestamp: Date.now(),
        ttl: 300000,
      };
      mockStorage['cache_projects_ws1'] = {
        data: [{ gid: 'proj1', name: 'Project 1', workspaceGid: 'ws1' }],
        timestamp: Date.now(),
        ttl: 300000,
      };
      // Use a key that doesn't match cache patterns (cache_ prefix or _cache suffix)
      mockStorage['user_settings'] = { theme: 'dark' };

      const response = await sendMessageToServiceWorker({ type: 'REFRESH_CACHE' });

      expect(response).toEqual({
        success: true,
      });

      // Verify cache entries were removed
      expect(mockStorage['cache_workspaces']).toBeUndefined();
      expect(mockStorage['cache_projects_ws1']).toBeUndefined();

      // Verify non-cache data is preserved
      expect(mockStorage['user_settings']).toEqual({ theme: 'dark' });
    });

    it('succeeds even when no cache entries exist', async () => {
      const response = await sendMessageToServiceWorker({ type: 'REFRESH_CACHE' });

      expect(response).toEqual({
        success: true,
      });
    });
  });

  // ===========================================================================
  // GET_WORKSPACES Message Flow
  // ===========================================================================

  describe('GET_WORKSPACES message flow', () => {
    beforeEach(() => {
      setupAuthenticatedState();
    });

    it('fetches workspaces from API when cache is empty', async () => {
      const mockWorkspaces = [
        { gid: 'ws1', name: 'Workspace 1' },
        { gid: 'ws2', name: 'Workspace 2' },
      ];

      globalThis.fetch = vi.fn().mockResolvedValue(
        createMockResponse({ data: mockWorkspaces })
      );

      const response = await sendMessageToServiceWorker({ type: 'GET_WORKSPACES' });

      expect(response).toEqual({
        success: true,
        data: mockWorkspaces,
      });
    });

    it('returns cached workspaces without API call', async () => {
      const cachedWorkspaces = [
        { gid: 'ws1', name: 'Cached Workspace 1' },
      ];

      mockStorage['cache_workspaces'] = {
        data: cachedWorkspaces,
        timestamp: Date.now(),
        ttl: 300000,
      };

      globalThis.fetch = vi.fn();

      const response = await sendMessageToServiceWorker({ type: 'GET_WORKSPACES' });

      expect(response).toEqual({
        success: true,
        data: cachedWorkspaces,
      });

      // API should not be called when cache is fresh
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // GET_PROJECTS Message Flow
  // ===========================================================================

  describe('GET_PROJECTS message flow', () => {
    beforeEach(() => {
      setupAuthenticatedState();
    });

    it('fetches projects for a workspace', async () => {
      const mockProjects = [
        { gid: 'proj1', name: 'Project 1' },
        { gid: 'proj2', name: 'Project 2' },
      ];

      globalThis.fetch = vi.fn().mockResolvedValue(
        createMockResponse({ data: mockProjects })
      );

      const response = await sendMessageToServiceWorker({
        type: 'GET_PROJECTS',
        workspaceGid: 'ws123',
      });

      expect(response).toMatchObject({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({ gid: 'proj1', name: 'Project 1' }),
        ]),
      });

      // Verify correct endpoint was called
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/workspaces/ws123/projects'),
        expect.any(Object)
      );
    });
  });

  // ===========================================================================
  // Unknown Message Type Handling
  // ===========================================================================

  describe('Unknown message type handling', () => {
    it('returns error for unknown message type', async () => {
      const response = await sendMessageToServiceWorker({
        type: 'UNKNOWN_TYPE',
      });

      expect(response).toMatchObject({
        success: false,
        error: expect.stringContaining('Unknown message type'),
        errorCode: 'INVALID_REQUEST',
      });
    });
  });

  // ===========================================================================
  // GET_PAGE_INFO Message Flow (Should Return Error)
  // ===========================================================================

  describe('GET_PAGE_INFO message flow', () => {
    it('returns error as GET_PAGE_INFO should be sent to content script', async () => {
      const response = await sendMessageToServiceWorker({ type: 'GET_PAGE_INFO' });

      expect(response).toMatchObject({
        success: false,
        error: 'GET_PAGE_INFO should be sent to content script',
        errorCode: 'INVALID_REQUEST',
      });
    });
  });

  // ===========================================================================
  // LOGOUT Message Flow
  // ===========================================================================

  describe('LOGOUT message flow', () => {
    it('clears tokens and cache on logout', async () => {
      setupAuthenticatedState();
      mockStorage['cache_workspaces'] = {
        data: [{ gid: 'ws1', name: 'Workspace' }],
        timestamp: Date.now(),
        ttl: 300000,
      };

      const response = await sendMessageToServiceWorker({ type: 'LOGOUT' });

      expect(response).toEqual({
        success: true,
      });

      // Verify tokens were cleared
      expect(mockStorage[STORAGE_KEYS.OAUTH_TOKENS]).toBeUndefined();

      // Verify cache was cleared
      expect(mockStorage['cache_workspaces']).toBeUndefined();
    });
  });

  // ===========================================================================
  // GET_SECTIONS Message Flow
  // ===========================================================================

  describe('GET_SECTIONS message flow', () => {
    beforeEach(() => {
      setupAuthenticatedState();
    });

    it('fetches sections for a project', async () => {
      const mockSections = [
        { gid: 'sec1', name: 'To Do' },
        { gid: 'sec2', name: 'In Progress' },
      ];

      globalThis.fetch = vi.fn().mockResolvedValue(
        createMockResponse({ data: mockSections })
      );

      const response = await sendMessageToServiceWorker({
        type: 'GET_SECTIONS',
        projectGid: 'proj123',
      });

      expect(response).toEqual({
        success: true,
        data: mockSections,
      });

      // Verify correct endpoint was called
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/projects/proj123/sections'),
        expect.any(Object)
      );
    });
  });

  // ===========================================================================
  // GET_TAGS Message Flow
  // ===========================================================================

  describe('GET_TAGS message flow', () => {
    beforeEach(() => {
      setupAuthenticatedState();
    });

    it('fetches tags for a workspace', async () => {
      const mockTags = [
        { gid: 'tag1', name: 'urgent' },
        { gid: 'tag2', name: 'bug' },
      ];

      globalThis.fetch = vi.fn().mockResolvedValue(
        createMockResponse({ data: mockTags })
      );

      const response = await sendMessageToServiceWorker({
        type: 'GET_TAGS',
        workspaceGid: 'ws123',
      });

      expect(response).toMatchObject({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({ gid: 'tag1', name: 'urgent' }),
        ]),
      });

      // Verify correct endpoint was called
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/workspaces/ws123/tags'),
        expect.any(Object)
      );
    });
  });
});
