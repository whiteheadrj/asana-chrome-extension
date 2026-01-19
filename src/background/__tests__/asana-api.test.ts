/**
 * Unit tests for Asana API module
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockStorage, chromeMock } from '../../test-setup.js';

// Import functions under test
import {
  asanaFetch,
  getWorkspaces,
  getProjects,
  getSections,
  getTags,
  createTask,
} from '../asana-api.js';
import { STORAGE_KEYS, ASANA_API_BASE } from '../../shared/constants.js';
import {
  NetworkOfflineError,
  RateLimitError,
  ApiError,
  AuthExpiredError,
} from '../../shared/errors.js';

// Mock navigator for offline detection
const originalNavigator = globalThis.navigator;

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

describe('asana-api module', () => {
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

    // Set up authenticated state by default
    setupAuthenticatedState();
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
  // asanaFetch - Core API Call Formatting
  // ===========================================================================

  describe('asanaFetch', () => {
    describe('API call formatting', () => {
      it('includes Authorization header with Bearer token', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue(
          createMockResponse({ data: {} })
        );

        await asanaFetch('/test-endpoint');

        expect(globalThis.fetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            headers: expect.any(Headers),
          })
        );

        const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
        const headers = call[1].headers as Headers;
        expect(headers.get('Authorization')).toBe('Bearer test_access_token');
      });

      it('includes Content-Type application/json header', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue(
          createMockResponse({ data: {} })
        );

        await asanaFetch('/test-endpoint');

        const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
        const headers = call[1].headers as Headers;
        expect(headers.get('Content-Type')).toBe('application/json');
      });

      it('constructs correct URL with base path', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue(
          createMockResponse({ data: {} })
        );

        await asanaFetch('/workspaces');

        expect(globalThis.fetch).toHaveBeenCalledWith(
          `${ASANA_API_BASE}/workspaces`,
          expect.any(Object)
        );
      });

      it('appends query parameters to URL', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue(
          createMockResponse({ data: {} })
        );

        await asanaFetch('/projects', {
          params: {
            opt_fields: 'gid,name',
            archived: 'false',
          },
        });

        const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
        const url = new URL(call[0]);
        expect(url.searchParams.get('opt_fields')).toBe('gid,name');
        expect(url.searchParams.get('archived')).toBe('false');
      });

      it('passes through fetch options like method and body', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue(
          createMockResponse({ data: { gid: '123' } })
        );

        const body = JSON.stringify({ data: { name: 'Test Task' } });
        await asanaFetch('/tasks', {
          method: 'POST',
          body,
        });

        expect(globalThis.fetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            method: 'POST',
            body,
          })
        );
      });

      it('returns data property from response', async () => {
        const responseData = { gid: '123', name: 'Test' };
        globalThis.fetch = vi.fn().mockResolvedValue(
          createMockResponse({ data: responseData })
        );

        const result = await asanaFetch('/test');

        expect(result).toEqual(responseData);
      });
    });

    describe('offline detection', () => {
      it('throws NetworkOfflineError when offline', async () => {
        Object.defineProperty(globalThis, 'navigator', {
          value: { onLine: false },
          writable: true,
          configurable: true,
        });

        await expect(asanaFetch('/workspaces'))
          .rejects.toThrow(NetworkOfflineError);
      });
    });

    describe('rate limit 429 handling', () => {
      it('retries on 429 response', async () => {
        vi.useFakeTimers();

        const fetchMock = vi.fn()
          .mockResolvedValueOnce(createMockResponse({}, { status: 429 }))
          .mockResolvedValueOnce(createMockResponse({ data: { success: true } }));

        globalThis.fetch = fetchMock;

        const fetchPromise = asanaFetch('/test');

        // Advance past first retry delay (1s)
        await vi.advanceTimersByTimeAsync(1000);

        const result = await fetchPromise;

        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(result).toEqual({ success: true });

        vi.useRealTimers();
      });

      it('throws RateLimitError after max retries (3)', async () => {
        vi.useFakeTimers();

        globalThis.fetch = vi.fn().mockResolvedValue(
          createMockResponse({}, { status: 429 })
        );

        // Immediately attach the error handler to prevent unhandled rejection
        const fetchPromise = asanaFetch('/test').catch((e) => e);

        // Run all timers to completion
        await vi.runAllTimersAsync();

        const error = await fetchPromise;
        expect(error).toBeInstanceOf(RateLimitError);

        // Initial request + 3 retries = 4 total calls
        expect(globalThis.fetch).toHaveBeenCalledTimes(4);

        vi.useRealTimers();
      });

      it('includes Retry-After in RateLimitError when header present', async () => {
        vi.useFakeTimers();

        globalThis.fetch = vi.fn().mockResolvedValue(
          createMockResponse({}, {
            status: 429,
            headers: { 'Retry-After': '30' },
          })
        );

        // Immediately attach the error handler to prevent unhandled rejection
        const fetchPromise = asanaFetch('/test').catch((e) => e);

        // Run all timers to completion
        await vi.runAllTimersAsync();

        const error = await fetchPromise;
        expect(error).toBeInstanceOf(RateLimitError);
        expect((error as RateLimitError).retryAfterSeconds).toBe(30);

        vi.useRealTimers();
      });
    });

    describe('exponential backoff timing', () => {
      it('waits with exponential backoff between retries', async () => {
        vi.useFakeTimers();

        const fetchMock = vi.fn()
          .mockResolvedValueOnce(createMockResponse({}, { status: 429 }))
          .mockResolvedValueOnce(createMockResponse({}, { status: 429 }))
          .mockResolvedValueOnce(createMockResponse({ data: { success: true } }));

        globalThis.fetch = fetchMock;

        const fetchPromise = asanaFetch('/test');

        // First call immediate
        await vi.advanceTimersByTimeAsync(0);
        expect(fetchMock).toHaveBeenCalledTimes(1);

        // First retry after 1s (1000ms)
        await vi.advanceTimersByTimeAsync(1000);
        expect(fetchMock).toHaveBeenCalledTimes(2);

        // Second retry after 2s (2000ms)
        await vi.advanceTimersByTimeAsync(2000);
        expect(fetchMock).toHaveBeenCalledTimes(3);

        const result = await fetchPromise;
        expect(result).toEqual({ success: true });

        vi.useRealTimers();
      });

      it('uses Retry-After header value when present', async () => {
        vi.useFakeTimers();

        const fetchMock = vi.fn()
          .mockResolvedValueOnce(
            createMockResponse({}, {
              status: 429,
              headers: { 'Retry-After': '5' },
            })
          )
          .mockResolvedValueOnce(createMockResponse({ data: { success: true } }));

        globalThis.fetch = fetchMock;

        const fetchPromise = asanaFetch('/test');

        // First call immediate
        await vi.advanceTimersByTimeAsync(0);
        expect(fetchMock).toHaveBeenCalledTimes(1);

        // Should wait 5 seconds (from Retry-After header)
        await vi.advanceTimersByTimeAsync(4999);
        expect(fetchMock).toHaveBeenCalledTimes(1);

        await vi.advanceTimersByTimeAsync(1);
        expect(fetchMock).toHaveBeenCalledTimes(2);

        await fetchPromise;
        vi.useRealTimers();
      });
    });

    describe('error response handling', () => {
      it('throws AuthExpiredError on 401 response', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue(
          createMockResponse(
            { errors: [{ message: 'Invalid token' }] },
            { status: 401 }
          )
        );

        await expect(asanaFetch('/test'))
          .rejects.toThrow(AuthExpiredError);
      });

      it('throws ApiError on 400 response', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue(
          createMockResponse(
            { errors: [{ message: 'Bad request' }] },
            { status: 400 }
          )
        );

        await expect(asanaFetch('/test'))
          .rejects.toThrow(ApiError);
      });

      it('throws ApiError on 500 response', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue(
          createMockResponse(
            { errors: [{ message: 'Server error' }] },
            { status: 500 }
          )
        );

        await expect(asanaFetch('/test'))
          .rejects.toThrow(ApiError);
      });

      it('parses error message from Asana error response', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue(
          createMockResponse(
            { errors: [{ message: 'Project not found' }] },
            { status: 404 }
          )
        );

        try {
          await asanaFetch('/test');
          expect.fail('Should have thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(ApiError);
          expect((error as ApiError).apiMessage).toBe('Project not found');
        }
      });

      it('handles missing error message gracefully', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue(
          createMockResponse({}, { status: 500 })
        );

        await expect(asanaFetch('/test'))
          .rejects.toThrow(ApiError);
      });

      it('handles network errors during fetch', async () => {
        globalThis.fetch = vi.fn().mockRejectedValue(
          new TypeError('Failed to fetch')
        );

        await expect(asanaFetch('/test'))
          .rejects.toThrow();
      });
    });
  });

  // ===========================================================================
  // getWorkspaces
  // ===========================================================================

  describe('getWorkspaces', () => {
    it('fetches workspaces with correct endpoint', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        createMockResponse({
          data: [
            { gid: 'ws1', name: 'Workspace 1' },
            { gid: 'ws2', name: 'Workspace 2' },
          ],
        })
      );

      const result = await getWorkspaces();

      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/workspaces'),
        expect.any(Object)
      );
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ gid: 'ws1', name: 'Workspace 1' });
    });

    it('requests gid and name opt_fields', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        createMockResponse({ data: [] })
      );

      await getWorkspaces();

      const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const url = new URL(call[0]);
      expect(url.searchParams.get('opt_fields')).toBe('gid,name');
    });
  });

  // ===========================================================================
  // getProjects
  // ===========================================================================

  describe('getProjects', () => {
    it('fetches projects for a workspace', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        createMockResponse({
          data: [
            { gid: 'proj1', name: 'Project 1' },
            { gid: 'proj2', name: 'Project 2' },
          ],
        })
      );

      const result = await getProjects('workspace123');

      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/workspaces/workspace123/projects'),
        expect.any(Object)
      );
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        gid: 'proj1',
        name: 'Project 1',
        workspaceGid: 'workspace123',
      });
    });

    it('excludes archived projects', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        createMockResponse({ data: [] })
      );

      await getProjects('ws1');

      const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const url = new URL(call[0]);
      expect(url.searchParams.get('archived')).toBe('false');
    });
  });

  // ===========================================================================
  // getSections
  // ===========================================================================

  describe('getSections', () => {
    it('fetches sections for a project', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        createMockResponse({
          data: [
            { gid: 'sec1', name: 'To Do' },
            { gid: 'sec2', name: 'In Progress' },
          ],
        })
      );

      const result = await getSections('project123');

      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/projects/project123/sections'),
        expect.any(Object)
      );
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ gid: 'sec1', name: 'To Do' });
    });
  });

  // ===========================================================================
  // getTags
  // ===========================================================================

  describe('getTags', () => {
    it('fetches tags for a workspace', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        createMockResponse({
          data: [
            { gid: 'tag1', name: 'urgent' },
            { gid: 'tag2', name: 'bug' },
          ],
        })
      );

      const result = await getTags('workspace123');

      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/workspaces/workspace123/tags'),
        expect.any(Object)
      );
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        gid: 'tag1',
        name: 'urgent',
        workspaceGid: 'workspace123',
      });
    });
  });

  // ===========================================================================
  // createTask
  // ===========================================================================

  describe('createTask', () => {
    it('creates a task with required fields', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        createMockResponse({
          data: {
            gid: 'task123',
            name: 'New Task',
            permalink_url: 'https://app.asana.com/0/proj/task123',
          },
        })
      );

      const result = await createTask({
        name: 'New Task',
        workspaceGid: 'ws1',
        projectGid: 'proj1',
      });

      expect(result).toEqual({
        gid: 'task123',
        name: 'New Task',
        permalink_url: 'https://app.asana.com/0/proj/task123',
      });
    });

    it('sends POST request to /tasks endpoint', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        createMockResponse({
          data: { gid: '1', name: 'Task', permalink_url: 'http://asana.com/task' },
        })
      );

      await createTask({
        name: 'Task',
        workspaceGid: 'ws',
        projectGid: 'proj',
      });

      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/tasks'),
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    it('includes task name, workspace, and project in body', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        createMockResponse({
          data: { gid: '1', name: 'My Task', permalink_url: 'http://url' },
        })
      );

      await createTask({
        name: 'My Task',
        workspaceGid: 'workspace1',
        projectGid: 'project1',
      });

      const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(call[1].body);

      expect(body.data.name).toBe('My Task');
      expect(body.data.workspace).toBe('workspace1');
      expect(body.data.projects).toContain('project1');
    });

    it('includes notes when provided', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        createMockResponse({
          data: { gid: '1', name: 'Task', permalink_url: 'http://url' },
        })
      );

      await createTask({
        name: 'Task',
        workspaceGid: 'ws',
        projectGid: 'proj',
        notes: 'Task description here',
      });

      const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(call[1].body);

      expect(body.data.notes).toBe('Task description here');
    });

    it('includes section in memberships when provided', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        createMockResponse({
          data: { gid: '1', name: 'Task', permalink_url: 'http://url' },
        })
      );

      await createTask({
        name: 'Task',
        workspaceGid: 'ws',
        projectGid: 'proj1',
        sectionGid: 'section1',
      });

      const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(call[1].body);

      expect(body.data.memberships).toEqual([
        { project: 'proj1', section: 'section1' },
      ]);
    });

    it('includes tags when provided', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        createMockResponse({
          data: { gid: '1', name: 'Task', permalink_url: 'http://url' },
        })
      );

      await createTask({
        name: 'Task',
        workspaceGid: 'ws',
        projectGid: 'proj',
        tagGids: ['tag1', 'tag2'],
      });

      const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(call[1].body);

      expect(body.data.tags).toEqual(['tag1', 'tag2']);
    });

    it('excludes tags from body when empty array', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        createMockResponse({
          data: { gid: '1', name: 'Task', permalink_url: 'http://url' },
        })
      );

      await createTask({
        name: 'Task',
        workspaceGid: 'ws',
        projectGid: 'proj',
        tagGids: [],
      });

      const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(call[1].body);

      expect(body.data.tags).toBeUndefined();
    });

    it('requests gid, name, and permalink_url opt_fields', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        createMockResponse({
          data: { gid: '1', name: 'Task', permalink_url: 'http://url' },
        })
      );

      await createTask({
        name: 'Task',
        workspaceGid: 'ws',
        projectGid: 'proj',
      });

      const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const url = new URL(call[0]);
      expect(url.searchParams.get('opt_fields')).toBe('gid,name,permalink_url');
    });
  });
});
