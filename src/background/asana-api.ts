/**
 * Asana API wrapper module
 * Handles API calls with authentication, error handling, and data fetching
 */

import type {
  AsanaWorkspace,
  AsanaProject,
  AsanaSection,
  AsanaTag,
  AsanaTask,
  AsanaUser,
  CreateTaskPayload,
} from '../shared/types';
import { ASANA_API_BASE } from '../shared/constants';
import { getValidAccessToken } from './oauth';
import {
  ApiError,
  RateLimitError,
  NetworkOfflineError,
  isOffline,
  wrapFetchError,
  wrapResponseError,
} from '../shared/errors';

// =============================================================================
// Types
// =============================================================================

interface AsanaFetchOptions extends RequestInit {
  /** Query parameters to append to the URL */
  params?: Record<string, string>;
}

interface AsanaApiResponse<T> {
  data: T;
}

interface AsanaErrorResponse {
  errors: Array<{
    message: string;
    help?: string;
  }>;
}

// =============================================================================
// Core Fetch Function
// =============================================================================

// =============================================================================
// Rate Limit Configuration
// =============================================================================

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000; // 1 second

/**
 * Sleep for a specified number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate backoff delay for a given retry attempt
 * @param attempt - The retry attempt number (0-based)
 * @param retryAfterSeconds - Optional Retry-After header value in seconds
 * @returns Delay in milliseconds
 */
function calculateBackoffDelay(attempt: number, retryAfterSeconds?: number): number {
  if (retryAfterSeconds !== undefined && retryAfterSeconds > 0) {
    return retryAfterSeconds * 1000;
  }
  // Exponential backoff: 1s, 2s, 4s
  return BASE_DELAY_MS * Math.pow(2, attempt);
}

/**
 * Make an authenticated request to the Asana API
 * Adds authorization header and handles common errors
 * Includes rate limit handling with exponential backoff
 * @param endpoint - API endpoint path (e.g., '/workspaces')
 * @param options - Fetch options including query params
 * @returns Promise resolving to the parsed response data
 * @throws ApiError on API errors
 * @throws RateLimitError when rate limited after retries
 * @throws NetworkOfflineError when offline
 * @throws AuthRequiredError when not authenticated
 */
export async function asanaFetch<T>(
  endpoint: string,
  options: AsanaFetchOptions = {}
): Promise<T> {
  // Check for offline state first
  if (isOffline()) {
    throw new NetworkOfflineError('Cannot connect to Asana while offline');
  }

  // getValidAccessToken will throw AuthRequiredError if not authenticated
  const accessToken = await getValidAccessToken();

  // Build URL with query parameters
  const url = new URL(`${ASANA_API_BASE}${endpoint}`);
  if (options.params) {
    Object.entries(options.params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
  }

  // Build headers with auth
  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${accessToken}`);
  headers.set('Content-Type', 'application/json');

  // Retry loop for rate limit handling
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    let response: Response;
    try {
      response = await fetch(url.toString(), {
        ...options,
        headers,
      });
    } catch (error) {
      throw wrapFetchError(error, `Asana API ${endpoint}`);
    }

    // Handle rate limiting (429)
    if (response.status === 429) {
      if (attempt >= MAX_RETRIES) {
        const retryAfterHeader = response.headers.get('Retry-After');
        const retryAfterSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : undefined;
        throw new RateLimitError(
          'Asana API rate limit exceeded. Please try again later.',
          retryAfterSeconds
        );
      }

      // Parse Retry-After header if present
      const retryAfterHeader = response.headers.get('Retry-After');
      const retryAfterSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : undefined;

      const delayMs = calculateBackoffDelay(attempt, retryAfterSeconds);
      await sleep(delayMs);
      continue;
    }

    // Handle other errors
    if (!response.ok) {
      // Try to parse error response
      let apiMessage: string | undefined;

      try {
        const errorData: AsanaErrorResponse = await response.json();
        if (errorData.errors && errorData.errors.length > 0) {
          apiMessage = errorData.errors[0].message;
        }
      } catch {
        // Ignore JSON parse errors
      }

      throw wrapResponseError(response, `Asana API ${endpoint}`, apiMessage);
    }

    // Parse successful response
    const responseData: AsanaApiResponse<T> = await response.json();
    return responseData.data;
  }

  // Should not reach here, but satisfy TypeScript
  throw new ApiError('Unexpected error in Asana API request', undefined, undefined);
}

// =============================================================================
// Workspace Functions
// =============================================================================

/**
 * Get all workspaces the authenticated user has access to
 * @returns Promise resolving to array of workspaces
 */
export async function getWorkspaces(): Promise<AsanaWorkspace[]> {
  const data = await asanaFetch<Array<{ gid: string; name: string }>>(
    '/workspaces',
    {
      params: {
        opt_fields: 'gid,name',
      },
    }
  );

  return data.map((workspace) => ({
    gid: workspace.gid,
    name: workspace.name,
  }));
}

// =============================================================================
// Project Functions
// =============================================================================

/**
 * Get all projects in a workspace
 * @param workspaceGid - The workspace GID
 * @returns Promise resolving to array of projects
 */
export async function getProjects(workspaceGid: string): Promise<AsanaProject[]> {
  const data = await asanaFetch<Array<{ gid: string; name: string }>>(
    `/workspaces/${workspaceGid}/projects`,
    {
      params: {
        opt_fields: 'gid,name',
        archived: 'false',
      },
    }
  );

  return data.map((project) => ({
    gid: project.gid,
    name: project.name,
    workspaceGid,
  }));
}

// =============================================================================
// Section Functions
// =============================================================================

/**
 * Get all sections in a project
 * @param projectGid - The project GID
 * @returns Promise resolving to array of sections
 */
export async function getSections(projectGid: string): Promise<AsanaSection[]> {
  const data = await asanaFetch<Array<{ gid: string; name: string }>>(
    `/projects/${projectGid}/sections`,
    {
      params: {
        opt_fields: 'gid,name',
      },
    }
  );

  return data.map((section) => ({
    gid: section.gid,
    name: section.name,
  }));
}

// =============================================================================
// Tag Functions
// =============================================================================

/**
 * Get all tags in a workspace
 * @param workspaceGid - The workspace GID
 * @returns Promise resolving to array of tags
 */
export async function getTags(workspaceGid: string): Promise<AsanaTag[]> {
  const data = await asanaFetch<Array<{ gid: string; name: string }>>(
    `/workspaces/${workspaceGid}/tags`,
    {
      params: {
        opt_fields: 'gid,name',
      },
    }
  );

  return data.map((tag) => ({
    gid: tag.gid,
    name: tag.name,
    workspaceGid,
  }));
}

// =============================================================================
// User Functions
// =============================================================================

/**
 * Get all users in a workspace
 * @param workspaceGid - The workspace GID
 * @returns Promise resolving to array of users
 */
export async function getUsers(workspaceGid: string): Promise<AsanaUser[]> {
  const data = await asanaFetch<Array<{ gid: string; name: string; email: string }>>(
    `/workspaces/${workspaceGid}/users`,
    {
      params: {
        opt_fields: 'gid,name,email',
      },
    }
  );

  return data.map((user) => ({
    gid: user.gid,
    name: user.name,
    email: user.email,
  }));
}

/**
 * Get the currently authenticated user
 * @returns Promise resolving to the current user
 */
export async function getCurrentUser(): Promise<AsanaUser> {
  const data = await asanaFetch<{ gid: string; name: string; email: string }>(
    '/users/me',
    {
      params: {
        opt_fields: 'gid,name,email',
      },
    }
  );

  return {
    gid: data.gid,
    name: data.name,
    email: data.email,
  };
}

// =============================================================================
// Task Functions
// =============================================================================

/**
 * Create a new task in Asana
 * @param payload - Task creation payload with name, notes, project, etc.
 * @returns Promise resolving to the created task with gid and permalink_url
 * @throws Error on API failure
 */
export async function createTask(payload: CreateTaskPayload): Promise<AsanaTask> {
  // Build the request body per Asana API spec
  const requestBody: Record<string, unknown> = {
    name: payload.name,
    workspace: payload.workspaceGid,
    projects: [payload.projectGid],
  };

  // Add optional fields
  if (payload.notes) {
    requestBody.notes = payload.notes;
  }

  if (payload.sectionGid) {
    // When adding to a section, we include it via memberships
    requestBody.memberships = [
      {
        project: payload.projectGid,
        section: payload.sectionGid,
      },
    ];
  }

  if (payload.tagGids && payload.tagGids.length > 0) {
    requestBody.tags = payload.tagGids;
  }

  if (payload.assignee) {
    requestBody.assignee = payload.assignee;
  }

  // due_at and due_on are mutually exclusive; due_at takes precedence
  if (payload.due_at) {
    requestBody.due_at = payload.due_at;
  } else if (payload.due_on) {
    requestBody.due_on = payload.due_on;
  }

  const data = await asanaFetch<{ gid: string; name: string; permalink_url: string }>(
    '/tasks',
    {
      method: 'POST',
      body: JSON.stringify({ data: requestBody }),
      params: {
        opt_fields: 'gid,name,permalink_url',
      },
    }
  );

  return {
    gid: data.gid,
    name: data.name,
    permalink_url: data.permalink_url,
  };
}
