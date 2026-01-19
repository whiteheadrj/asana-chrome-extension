/**
 * Unit tests for AI module (Claude API integration)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateTaskName, isApiKeyValid } from '../ai.js';
import { CLAUDE_API_BASE } from '../constants.js';
import type { AIConfig, AIInput } from '../types.js';

// Store original navigator
const originalNavigator = globalThis.navigator;

// Helper to create mock fetch response
function createMockResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

// Helper to create successful Claude API response
function createClaudeResponse(text: string) {
  return {
    id: 'msg_123',
    type: 'message',
    role: 'assistant',
    content: [{ type: 'text', text }],
    model: 'claude-3-haiku-20240307',
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 5 },
  };
}

describe('AI module', () => {
  beforeEach(() => {
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
  // generateTaskName - Successful API Calls
  // ===========================================================================

  describe('generateTaskName - successful API calls', () => {
    it('returns suggested name from Claude API response', async () => {
      const mockResponse = createClaudeResponse('Review Q4 budget proposal');
      globalThis.fetch = vi.fn().mockResolvedValue(createMockResponse(mockResponse));

      const config: AIConfig = { apiKey: 'test-api-key', model: 'claude-3-haiku-20240307' };
      const input: AIInput = { pageTitle: 'Budget Review' };

      const result = await generateTaskName(input, config);

      expect(result).not.toBeNull();
      expect(result?.suggestedName).toBe('Review Q4 budget proposal');
    });

    it('strips surrounding quotes from response', async () => {
      const mockResponse = createClaudeResponse('"Follow up on invoice #1234"');
      globalThis.fetch = vi.fn().mockResolvedValue(createMockResponse(mockResponse));

      const config: AIConfig = { apiKey: 'test-api-key', model: 'claude-3-haiku-20240307' };
      const input: AIInput = { emailSubject: 'Invoice' };

      const result = await generateTaskName(input, config);

      expect(result?.suggestedName).toBe('Follow up on invoice #1234');
    });

    it('includes correct headers in API request', async () => {
      const mockResponse = createClaudeResponse('Task name');
      globalThis.fetch = vi.fn().mockResolvedValue(createMockResponse(mockResponse));

      const config: AIConfig = { apiKey: 'my-api-key', model: 'claude-3-haiku-20240307' };
      const input: AIInput = { pageTitle: 'Test' };

      await generateTaskName(input, config);

      expect(globalThis.fetch).toHaveBeenCalledWith(
        `${CLAUDE_API_BASE}/messages`,
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'my-api-key',
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
        })
      );
    });

    it('sends correct body structure to API', async () => {
      const mockResponse = createClaudeResponse('Task name');
      globalThis.fetch = vi.fn().mockResolvedValue(createMockResponse(mockResponse));

      const config: AIConfig = { apiKey: 'test-key', model: 'claude-3-haiku-20240307' };
      const input: AIInput = { pageTitle: 'Test Page' };

      await generateTaskName(input, config);

      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body as string);

      expect(body.model).toBe('claude-3-haiku-20240307');
      expect(body.max_tokens).toBe(50);
      expect(body.messages).toHaveLength(1);
      expect(body.messages[0].role).toBe('user');
      expect(body.system).toBeDefined();
    });

    it('uses default model when not specified', async () => {
      const mockResponse = createClaudeResponse('Task name');
      globalThis.fetch = vi.fn().mockResolvedValue(createMockResponse(mockResponse));

      const config: AIConfig = { apiKey: 'test-key', model: '' };
      const input: AIInput = { pageTitle: 'Test' };

      await generateTaskName(input, config);

      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body as string);

      expect(body.model).toBe('claude-3-haiku-20240307');
    });

    it('returns high confidence for email subject input', async () => {
      const mockResponse = createClaudeResponse('Reply to email');
      globalThis.fetch = vi.fn().mockResolvedValue(createMockResponse(mockResponse));

      const config: AIConfig = { apiKey: 'test-key', model: 'claude-3-haiku-20240307' };
      const input: AIInput = { emailSubject: 'Important Meeting' };

      const result = await generateTaskName(input, config);

      expect(result?.confidence).toBe('high');
    });

    it('returns high confidence for long selected text', async () => {
      const mockResponse = createClaudeResponse('Review document');
      globalThis.fetch = vi.fn().mockResolvedValue(createMockResponse(mockResponse));

      const config: AIConfig = { apiKey: 'test-key', model: 'claude-3-haiku-20240307' };
      const input: AIInput = { selectedText: 'This is a longer piece of selected text that provides context' };

      const result = await generateTaskName(input, config);

      expect(result?.confidence).toBe('high');
    });

    it('returns medium confidence for page title only', async () => {
      const mockResponse = createClaudeResponse('Visit page');
      globalThis.fetch = vi.fn().mockResolvedValue(createMockResponse(mockResponse));

      const config: AIConfig = { apiKey: 'test-key', model: 'claude-3-haiku-20240307' };
      const input: AIInput = { pageTitle: 'Some Page' };

      const result = await generateTaskName(input, config);

      expect(result?.confidence).toBe('medium');
    });

    it('returns low confidence for empty input', async () => {
      const mockResponse = createClaudeResponse('Generic task');
      globalThis.fetch = vi.fn().mockResolvedValue(createMockResponse(mockResponse));

      const config: AIConfig = { apiKey: 'test-key', model: 'claude-3-haiku-20240307' };
      const input: AIInput = {};

      const result = await generateTaskName(input, config);

      expect(result?.confidence).toBe('low');
    });
  });

  // ===========================================================================
  // generateTaskName - Error Handling
  // ===========================================================================

  describe('generateTaskName - error handling', () => {
    it('returns null when offline', async () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: { onLine: false },
        writable: true,
        configurable: true,
      });

      const config: AIConfig = { apiKey: 'test-key', model: 'claude-3-haiku-20240307' };
      const input: AIInput = { pageTitle: 'Test' };

      const result = await generateTaskName(input, config);

      expect(result).toBeNull();
    });

    it('returns null when API key is empty', async () => {
      const config: AIConfig = { apiKey: '', model: 'claude-3-haiku-20240307' };
      const input: AIInput = { pageTitle: 'Test' };

      const result = await generateTaskName(input, config);

      expect(result).toBeNull();
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('returns null when API key is whitespace', async () => {
      const config: AIConfig = { apiKey: '   ', model: 'claude-3-haiku-20240307' };
      const input: AIInput = { pageTitle: 'Test' };

      const result = await generateTaskName(input, config);

      expect(result).toBeNull();
    });

    it('returns null on 401 unauthorized response', async () => {
      const errorResponse = {
        type: 'error',
        error: { type: 'authentication_error', message: 'Invalid API key' },
      };
      globalThis.fetch = vi.fn().mockResolvedValue(createMockResponse(errorResponse, false, 401));

      const config: AIConfig = { apiKey: 'invalid-key', model: 'claude-3-haiku-20240307' };
      const input: AIInput = { pageTitle: 'Test' };

      const result = await generateTaskName(input, config);

      expect(result).toBeNull();
    });

    it('returns null on 500 server error', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(createMockResponse({}, false, 500));

      const config: AIConfig = { apiKey: 'test-key', model: 'claude-3-haiku-20240307' };
      const input: AIInput = { pageTitle: 'Test' };

      const result = await generateTaskName(input, config);

      expect(result).toBeNull();
    });

    it('returns null on network error', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

      const config: AIConfig = { apiKey: 'test-key', model: 'claude-3-haiku-20240307' };
      const input: AIInput = { pageTitle: 'Test' };

      const result = await generateTaskName(input, config);

      expect(result).toBeNull();
    });

    it('returns null on empty response content', async () => {
      const emptyResponse = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [],
        model: 'claude-3-haiku-20240307',
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 10, output_tokens: 0 },
      };
      globalThis.fetch = vi.fn().mockResolvedValue(createMockResponse(emptyResponse));

      const config: AIConfig = { apiKey: 'test-key', model: 'claude-3-haiku-20240307' };
      const input: AIInput = { pageTitle: 'Test' };

      const result = await generateTaskName(input, config);

      expect(result).toBeNull();
    });

    it('returns null when response has no text block', async () => {
      const noTextResponse = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'other', data: 'something' }],
        model: 'claude-3-haiku-20240307',
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 10, output_tokens: 5 },
      };
      globalThis.fetch = vi.fn().mockResolvedValue(createMockResponse(noTextResponse));

      const config: AIConfig = { apiKey: 'test-key', model: 'claude-3-haiku-20240307' };
      const input: AIInput = { pageTitle: 'Test' };

      const result = await generateTaskName(input, config);

      expect(result).toBeNull();
    });
  });

  // ===========================================================================
  // generateTaskName - AbortSignal Cancellation
  // ===========================================================================

  describe('generateTaskName - AbortSignal cancellation', () => {
    it('passes AbortSignal to fetch', async () => {
      const mockResponse = createClaudeResponse('Task name');
      globalThis.fetch = vi.fn().mockResolvedValue(createMockResponse(mockResponse));

      const controller = new AbortController();
      const config: AIConfig = { apiKey: 'test-key', model: 'claude-3-haiku-20240307' };
      const input: AIInput = { pageTitle: 'Test' };

      await generateTaskName(input, config, controller.signal);

      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          signal: controller.signal,
        })
      );
    });

    it('throws AbortError when request is cancelled', async () => {
      const abortError = new DOMException('Aborted', 'AbortError');
      globalThis.fetch = vi.fn().mockRejectedValue(abortError);

      const controller = new AbortController();
      const config: AIConfig = { apiKey: 'test-key', model: 'claude-3-haiku-20240307' };
      const input: AIInput = { pageTitle: 'Test' };

      await expect(generateTaskName(input, config, controller.signal))
        .rejects.toThrow('Aborted');
    });

    it('re-throws AbortError for caller to handle', async () => {
      const abortError = new DOMException('The operation was aborted', 'AbortError');
      globalThis.fetch = vi.fn().mockRejectedValue(abortError);

      const config: AIConfig = { apiKey: 'test-key', model: 'claude-3-haiku-20240307' };
      const input: AIInput = { pageTitle: 'Test' };

      try {
        await generateTaskName(input, config);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(DOMException);
        expect((error as DOMException).name).toBe('AbortError');
      }
    });
  });

  // ===========================================================================
  // isApiKeyValid
  // ===========================================================================

  describe('isApiKeyValid', () => {
    it('returns false for empty API key', async () => {
      const result = await isApiKeyValid('');
      expect(result).toBe(false);
    });

    it('returns false for whitespace API key', async () => {
      const result = await isApiKeyValid('   ');
      expect(result).toBe(false);
    });

    it('returns false when offline', async () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: { onLine: false },
        writable: true,
        configurable: true,
      });

      const result = await isApiKeyValid('test-api-key');
      expect(result).toBe(false);
    });

    it('returns false on 401 unauthorized', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401 });

      const result = await isApiKeyValid('invalid-key');
      expect(result).toBe(false);
    });

    it('returns true on successful response', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });

      const result = await isApiKeyValid('valid-key');
      expect(result).toBe(true);
    });

    it('returns true on rate limit (429) - key is valid but rate limited', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 429 });

      const result = await isApiKeyValid('valid-key');
      expect(result).toBe(true);
    });

    it('returns false on network error', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

      const result = await isApiKeyValid('test-key');
      expect(result).toBe(false);
    });

    it('sends minimal request to validate key', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });

      await isApiKeyValid('test-key');

      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body as string);

      expect(body.max_tokens).toBe(1);
      expect(body.messages).toHaveLength(1);
      expect(body.messages[0].content).toBe('test');
    });
  });
});
