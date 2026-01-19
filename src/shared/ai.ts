/**
 * AI Module - Claude API integration for task name generation
 */

import { AIConfig, AIInput, AIResult } from './types';
import { CLAUDE_API_BASE } from './constants';
import {
  isOffline,
  wrapFetchError,
  getUserMessage,
} from './errors';

// =============================================================================
// Constants
// =============================================================================

const SYSTEM_PROMPT = `You extract actionable task titles from emails and web pages.

Rules:
- Start with action verb (Review, Follow up, Schedule, Reply to, Complete, etc.)
- Include key entity (person name, document, project, deadline)
- 5-10 words maximum
- Preserve specific details (dates, numbers, names)
- Output ONLY the task title, no explanation

Examples:
- Email about budget review -> "Review Q4 budget before Thursday meeting"
- Invoice approval request -> "Approve invoice #4521 for John"
- PR review notification -> "Review PR #123 - authentication fix"`;

const DEFAULT_MODEL = 'claude-3-haiku-20240307';
const MAX_TOKENS = 50;
const ANTHROPIC_VERSION = '2023-06-01';

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Truncate text to a maximum length, adding ellipsis if truncated
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength) + '...';
}

/**
 * Build user prompt from input context
 * Priority order: selectedText > emailSubject > emailBody > pageContent
 */
function buildUserPrompt(input: AIInput): string {
  const parts: string[] = [];

  // Highest priority: Selected text (explicit user intent)
  if (input.selectedText) {
    parts.push(`Selected text (primary): ${truncate(input.selectedText, 500)}`);
  }

  // Email subject
  if (input.emailSubject) {
    parts.push(`Email subject: ${input.emailSubject}`);
  }

  // Email sender
  if (input.emailSender) {
    parts.push(`From: ${input.emailSender}`);
  }

  // Email body content
  if (input.emailBody) {
    parts.push(`Email content: ${truncate(input.emailBody, 1000)}`);
  }

  // Page title (skip if equals emailSubject to avoid duplication)
  if (input.pageTitle && input.pageTitle !== input.emailSubject) {
    parts.push(`Page title: ${truncate(input.pageTitle, 100)}`);
  }

  // Page content (only for webpages, not emails)
  if (input.pageContent && input.contentType === 'webpage') {
    parts.push(`Page content: ${truncate(input.pageContent, 2000)}`);
  }

  if (input.pageUrl) {
    parts.push(`URL: ${input.pageUrl}`);
  }

  if (parts.length === 0) {
    return 'Create a generic task title for a web page.';
  }

  return `Based on the following context, generate a concise task title:\n\n${parts.join('\n')}`;
}

/**
 * Extract task name from Claude API response
 */
function extractTaskName(response: ClaudeResponse): string {
  if (!response.content || response.content.length === 0) {
    throw new Error('Empty response from Claude API');
  }

  const textBlock = response.content.find(block => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text content in Claude API response');
  }

  // Clean up the response - remove quotes, extra whitespace
  let taskName = textBlock.text.trim();

  // Remove surrounding quotes if present
  if ((taskName.startsWith('"') && taskName.endsWith('"')) ||
      (taskName.startsWith("'") && taskName.endsWith("'"))) {
    taskName = taskName.slice(1, -1);
  }

  return taskName;
}

// =============================================================================
// API Types (internal)
// =============================================================================

interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ClaudeContentBlock {
  type: 'text';
  text: string;
}

interface ClaudeResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: ClaudeContentBlock[];
  model: string;
  stop_reason: string | null;
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

interface ClaudeErrorResponse {
  type: 'error';
  error: {
    type: string;
    message: string;
  };
}

// =============================================================================
// Main Functions
// =============================================================================

/**
 * Generate a task name suggestion using Claude API
 *
 * @param input - Context for generating the task name
 * @param config - API configuration (key and model)
 * @param signal - Optional AbortSignal for cancellation
 * @returns AIResult with suggested name, or null on failure
 * @throws AbortError if cancelled (this is expected and should be caught by caller)
 */
export async function generateTaskName(
  input: AIInput,
  config: AIConfig,
  signal?: AbortSignal
): Promise<AIResult | null> {
  // Check for offline state first
  if (isOffline()) {
    console.warn('[AI] Cannot generate suggestion while offline');
    return null;
  }

  // Validate API key
  if (!config.apiKey || config.apiKey.trim() === '') {
    console.warn('[AI] No API key provided');
    return null;
  }

  const userPrompt = buildUserPrompt(input);
  const model = config.model || DEFAULT_MODEL;

  let response: Response;
  try {
    response = await fetch(`${CLAUDE_API_BASE}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model,
        max_tokens: MAX_TOKENS,
        messages: [{ role: 'user', content: userPrompt }] as ClaudeMessage[],
        system: SYSTEM_PROMPT
      }),
      signal
    });
  } catch (error) {
    // Re-throw abort errors for caller to handle
    if (error instanceof Error && error.name === 'AbortError') {
      console.log('[AI] Request cancelled');
      throw error;
    }

    // Log and return null for network errors (graceful degradation)
    const wrappedError = wrapFetchError(error, 'Claude API');
    console.warn('[AI] Network error:', getUserMessage(wrappedError));
    return null;
  }

  // Handle non-2xx responses
  if (!response.ok) {
    let errorMessage = `Claude API error: ${response.status}`;

    try {
      const errorBody = await response.json() as ClaudeErrorResponse | Record<string, unknown>;
      if ('error' in errorBody && errorBody.error && typeof errorBody.error === 'object') {
        const error = errorBody.error as { type?: string; message?: string };
        errorMessage = error.message || errorMessage;

        // Check for invalid API key
        if (response.status === 401) {
          console.error('[AI] Invalid API key. Check settings.');
        }
      }
    } catch {
      // Ignore JSON parse errors
    }

    console.warn('[AI] API error:', errorMessage);
    return null;
  }

  try {
    const data = await response.json() as ClaudeResponse;
    const suggestedName = extractTaskName(data);

    // Determine confidence based on input quality
    let confidence: 'high' | 'medium' | 'low' = 'medium';
    if (input.emailSubject || (input.selectedText && input.selectedText.length > 20)) {
      confidence = 'high';
    } else if (!input.pageTitle && !input.selectedText) {
      confidence = 'low';
    }

    return {
      suggestedName,
      confidence
    };
  } catch (error) {
    console.error('[AI] Failed to parse response:', error);
    return null;
  }
}

/**
 * Check if an API key is valid by making a minimal API call
 *
 * @param apiKey - The API key to validate
 * @returns true if valid, false otherwise
 */
export async function isApiKeyValid(apiKey: string): Promise<boolean> {
  if (!apiKey || apiKey.trim() === '') {
    return false;
  }

  // Check for offline state first
  if (isOffline()) {
    // Cannot validate key while offline, assume it might be valid
    return false;
  }

  try {
    // Make a minimal request to validate the key
    const response = await fetch(`${CLAUDE_API_BASE}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'test' }]
      })
    });

    // A 401 means invalid key, anything else (including rate limits) means valid
    return response.status !== 401;
  } catch (error) {
    // Network errors don't mean invalid key, but we can't confirm validity
    console.warn('[AI] Could not validate API key:', error instanceof Error ? error.message : 'Network error');
    return false;
  }
}
