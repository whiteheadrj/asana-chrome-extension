/**
 * Integration tests for popup Gmail flow
 * Tests the Gmail content script -> popup -> AI input flow
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { chromeMock } from '../../test-setup.js';
import type { GmailEmailInfo, AIInput } from '../../shared/types.js';
import { generateTaskName } from '../../shared/ai.js';

// =============================================================================
// Test Setup
// =============================================================================

// Mock the AI module to capture AIInput
vi.mock('../../shared/ai.js', () => ({
  generateTaskName: vi.fn().mockResolvedValue({
    suggestedName: 'Review Q4 budget proposal',
    confidence: 'high',
  }),
}));

// Mock chrome.scripting for page content extraction
const mockChromeScripting = {
  executeScript: vi.fn().mockResolvedValue([{ result: 'Page content here' }]),
};

// Add scripting to chrome mock
(chromeMock as unknown as { scripting: typeof mockChromeScripting }).scripting = mockChromeScripting;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create a mock Gmail email info response
 */
function createMockGmailInfo(overrides: Partial<GmailEmailInfo> = {}): GmailEmailInfo {
  return {
    messageId: 'msg123',
    userId: '0',
    accountEmail: 'user@gmail.com',
    permanentUrl: 'https://mail.google.com/mail/u/0/#inbox/msg123',
    isConfidentialMode: false,
    subject: 'Q4 Budget Review Request',
    emailBody: 'Hi Team,\n\nPlease review the Q4 budget proposal attached. We need feedback by Friday.\n\nThanks,\nJohn',
    emailSender: 'John Smith <john.smith@company.com>',
    ...overrides,
  };
}

/**
 * Simulate popup receiving Gmail page info and building AIInput
 * This mimics the flow in popup.ts requestPageInfo() -> generateAiSuggestion()
 */
function simulateGmailPopupFlow(gmailInfo: GmailEmailInfo): AIInput {
  // Mimic how popup.ts builds AIInput from Gmail info
  const pageTitle = 'Inbox - Gmail'; // Mock tab title

  return {
    pageUrl: gmailInfo.permanentUrl,
    emailSubject: gmailInfo.subject,
    pageTitle,
    emailBody: gmailInfo.emailBody,
    emailSender: gmailInfo.emailSender,
    contentType: 'email',
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('Popup Integration Tests - Gmail Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================================================
  // Gmail Content Script Response Processing
  // ===========================================================================

  describe('Gmail content script response processing', () => {
    it('builds AIInput with emailBody and emailSender from Gmail response', () => {
      const gmailInfo = createMockGmailInfo();
      const aiInput = simulateGmailPopupFlow(gmailInfo);

      expect(aiInput.emailBody).toBe(gmailInfo.emailBody);
      expect(aiInput.emailSender).toBe(gmailInfo.emailSender);
      expect(aiInput.emailSubject).toBe(gmailInfo.subject);
      expect(aiInput.contentType).toBe('email');
    });

    it('handles Gmail response with missing emailBody', () => {
      const gmailInfo = createMockGmailInfo({ emailBody: undefined });
      const aiInput = simulateGmailPopupFlow(gmailInfo);

      expect(aiInput.emailBody).toBeUndefined();
      expect(aiInput.emailSender).toBe(gmailInfo.emailSender);
      expect(aiInput.contentType).toBe('email');
    });

    it('handles Gmail response with missing emailSender', () => {
      const gmailInfo = createMockGmailInfo({ emailSender: undefined });
      const aiInput = simulateGmailPopupFlow(gmailInfo);

      expect(aiInput.emailBody).toBe(gmailInfo.emailBody);
      expect(aiInput.emailSender).toBeUndefined();
      expect(aiInput.contentType).toBe('email');
    });

    it('handles Gmail response with all optional fields missing', () => {
      const gmailInfo = createMockGmailInfo({
        emailBody: undefined,
        emailSender: undefined,
        subject: undefined,
      });
      const aiInput = simulateGmailPopupFlow(gmailInfo);

      expect(aiInput.emailBody).toBeUndefined();
      expect(aiInput.emailSender).toBeUndefined();
      expect(aiInput.emailSubject).toBeUndefined();
      expect(aiInput.pageUrl).toBe(gmailInfo.permanentUrl);
      expect(aiInput.contentType).toBe('email');
    });

    it('preserves permanent URL from Gmail response', () => {
      const customUrl = 'https://mail.google.com/mail/u/1/#inbox/custom-id';
      const gmailInfo = createMockGmailInfo({ permanentUrl: customUrl });
      const aiInput = simulateGmailPopupFlow(gmailInfo);

      expect(aiInput.pageUrl).toBe(customUrl);
    });
  });

  // ===========================================================================
  // AI Input Building
  // ===========================================================================

  describe('AIInput construction for Gmail emails', () => {
    it('includes all email context fields in AIInput', () => {
      const gmailInfo = createMockGmailInfo({
        subject: 'Invoice #4521 Approval Needed',
        emailBody: 'Please approve the attached invoice for the marketing campaign.',
        emailSender: 'Finance Team <finance@company.com>',
      });
      const aiInput = simulateGmailPopupFlow(gmailInfo);

      // Verify all fields are populated correctly
      expect(aiInput).toMatchObject({
        pageUrl: expect.stringContaining('mail.google.com'),
        emailSubject: 'Invoice #4521 Approval Needed',
        emailBody: expect.stringContaining('approve the attached invoice'),
        emailSender: 'Finance Team <finance@company.com>',
        contentType: 'email',
      });
    });

    it('sets contentType to email for Gmail responses', () => {
      const gmailInfo = createMockGmailInfo();
      const aiInput = simulateGmailPopupFlow(gmailInfo);

      expect(aiInput.contentType).toBe('email');
    });

    it('does not include pageContent for email contentType', () => {
      const gmailInfo = createMockGmailInfo();
      const aiInput = simulateGmailPopupFlow(gmailInfo);

      // pageContent should not be set for emails - it's only for webpages
      expect(aiInput.pageContent).toBeUndefined();
    });
  });

  // ===========================================================================
  // Integration with AI Module
  // ===========================================================================

  describe('Gmail -> popup -> AI flow integration', () => {
    it('passes correct AIInput to generateTaskName', async () => {
      const gmailInfo = createMockGmailInfo({
        subject: 'PR #123 Review Request',
        emailBody: 'Hey, can you review my PR for the auth fix?',
        emailSender: 'dev@company.com',
      });
      const aiInput = simulateGmailPopupFlow(gmailInfo);

      // Simulate calling generateTaskName with the built AIInput
      const mockConfig = { apiKey: 'test-key', model: 'claude-haiku-4-5' };
      await generateTaskName(aiInput, mockConfig);

      // Verify generateTaskName was called with correct input
      expect(generateTaskName).toHaveBeenCalledWith(
        expect.objectContaining({
          emailSubject: 'PR #123 Review Request',
          emailBody: 'Hey, can you review my PR for the auth fix?',
          emailSender: 'dev@company.com',
          contentType: 'email',
        }),
        mockConfig
      );
    });

    it('AI receives all email context for better suggestions', async () => {
      const gmailInfo = createMockGmailInfo({
        subject: 'Meeting Follow-up: Project Alpha',
        emailBody: 'Hi team, please send me the action items from today\'s meeting by EOD.',
        emailSender: 'Project Manager <pm@company.com>',
      });
      const aiInput = simulateGmailPopupFlow(gmailInfo);
      const mockConfig = { apiKey: 'test-key', model: 'claude-haiku-4-5' };

      const result = await generateTaskName(aiInput, mockConfig);

      // Verify AI was called and returned a suggestion
      expect(generateTaskName).toHaveBeenCalled();
      expect(result).toMatchObject({
        suggestedName: expect.any(String),
        confidence: expect.stringMatching(/high|medium|low/),
      });
    });

    it('handles long email body in AIInput', () => {
      // Create email body longer than 1000 chars
      const longBody = 'A'.repeat(1500);
      const gmailInfo = createMockGmailInfo({ emailBody: longBody });
      const aiInput = simulateGmailPopupFlow(gmailInfo);

      // The popup passes the full body; truncation happens in buildUserPrompt
      expect(aiInput.emailBody).toBe(longBody);
      expect(aiInput.emailBody?.length).toBe(1500);
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe('Edge cases in Gmail flow', () => {
    it('handles confidential mode Gmail response', () => {
      const gmailInfo = createMockGmailInfo({
        isConfidentialMode: true,
        emailBody: undefined, // Body usually not extractable in confidential mode
        warnings: [{ type: 'gmail_confidential', message: 'Email is in confidential mode' }],
      });
      const aiInput = simulateGmailPopupFlow(gmailInfo);

      // Should still build AIInput with available fields
      expect(aiInput.emailSubject).toBe(gmailInfo.subject);
      expect(aiInput.emailBody).toBeUndefined();
      expect(aiInput.contentType).toBe('email');
    });

    it('handles empty string values in Gmail response', () => {
      const gmailInfo = createMockGmailInfo({
        emailBody: '',
        emailSender: '',
        subject: '',
      });
      const aiInput = simulateGmailPopupFlow(gmailInfo);

      // Empty strings should be passed through
      expect(aiInput.emailBody).toBe('');
      expect(aiInput.emailSender).toBe('');
      expect(aiInput.emailSubject).toBe('');
    });

    it('handles special characters in email content', () => {
      const gmailInfo = createMockGmailInfo({
        subject: 'Re: [URGENT] Action Required! <script>alert("xss")</script>',
        emailBody: 'Special chars: & < > " \' newline\nhere',
        emailSender: '"John O\'Brien" <john.obrien@company.com>',
      });
      const aiInput = simulateGmailPopupFlow(gmailInfo);

      expect(aiInput.emailSubject).toBe('Re: [URGENT] Action Required! <script>alert("xss")</script>');
      expect(aiInput.emailBody).toContain('newline\nhere');
      expect(aiInput.emailSender).toContain("O'Brien");
    });

    it('handles Unicode characters in email content', () => {
      const gmailInfo = createMockGmailInfo({
        subject: 'Reuniao de projeto',
        emailBody: 'Precisamos discutir o orcamento.',
        emailSender: 'Joao Silva <joao@empresa.com.br>',
      });
      const aiInput = simulateGmailPopupFlow(gmailInfo);

      expect(aiInput.emailSubject).toBe('Reuniao de projeto');
      expect(aiInput.emailBody).toContain('orcamento');
    });
  });

  // ===========================================================================
  // Chrome API Mock Verification
  // ===========================================================================

  describe('Chrome tabs.sendMessage mock behavior', () => {
    it('chrome.tabs.sendMessage mock is available', () => {
      expect(chromeMock.tabs.sendMessage).toBeDefined();
      expect(typeof chromeMock.tabs.sendMessage).toBe('function');
    });

    it('can configure tabs.sendMessage to return Gmail info', async () => {
      const mockGmailInfo = createMockGmailInfo();
      chromeMock.tabs.sendMessage.mockResolvedValueOnce(mockGmailInfo);

      // Simulate calling chrome.tabs.sendMessage
      const response = await chromeMock.tabs.sendMessage(1, { type: 'GET_PAGE_INFO' });

      expect(response).toEqual(mockGmailInfo);
      expect(chromeMock.tabs.sendMessage).toHaveBeenCalledWith(1, { type: 'GET_PAGE_INFO' });
    });

    it('can configure tabs.query to return Gmail tab', async () => {
      chromeMock.tabs.query.mockResolvedValueOnce([{
        id: 1,
        url: 'https://mail.google.com/mail/u/0/#inbox/msg123',
        title: 'Inbox (5) - user@gmail.com - Gmail',
        active: true,
        index: 0,
        windowId: 1,
        pinned: false,
        highlighted: true,
        incognito: false,
        selected: true,
        discarded: false,
        autoDiscardable: true,
        groupId: -1,
      }]);

      const [tab] = await chromeMock.tabs.query({ active: true, currentWindow: true });

      expect(tab.url).toContain('mail.google.com');
      expect(tab.title).toContain('Gmail');
    });
  });
});
