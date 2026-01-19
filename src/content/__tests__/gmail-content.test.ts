/**
 * @vitest-environment happy-dom
 */

/**
 * Unit tests for Gmail content script
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { parseGmailUrl, getEmailBody } from '../gmail-content.js';

// =============================================================================
// getEmailBody Tests
// =============================================================================

describe('getEmailBody', () => {
  let mockContainer: HTMLDivElement;

  beforeEach(() => {
    // Set up mock DOM
    mockContainer = document.createElement('div');
    document.body.appendChild(mockContainer);
  });

  afterEach(() => {
    // Clean up DOM
    mockContainer.remove();
    vi.restoreAllMocks();
  });

  describe('primary selector (.a3s.aiL)', () => {
    it('returns body text from .a3s.aiL selector', () => {
      mockContainer.innerHTML = `
        <div class="a3s aiL">
          This is the email body content from Gmail.
        </div>
      `;

      const result = getEmailBody();
      expect(result).toBe('This is the email body content from Gmail.');
    });

    it('trims whitespace from body text', () => {
      mockContainer.innerHTML = `
        <div class="a3s aiL">

          Trimmed email content.

        </div>
      `;

      const result = getEmailBody();
      expect(result).toBe('Trimmed email content.');
    });
  });

  describe('fallback selector ([data-message-id] .ii.gt)', () => {
    it('falls back to [data-message-id] .ii.gt when primary fails', () => {
      mockContainer.innerHTML = `
        <div data-message-id="123">
          <div class="ii gt">
            Fallback email body content.
          </div>
        </div>
      `;

      const result = getEmailBody();
      expect(result).toBe('Fallback email body content.');
    });

    it('uses primary selector when both are present', () => {
      mockContainer.innerHTML = `
        <div class="a3s aiL">Primary content.</div>
        <div data-message-id="123">
          <div class="ii gt">Fallback content.</div>
        </div>
      `;

      const result = getEmailBody();
      expect(result).toBe('Primary content.');
    });
  });

  describe('tertiary selector (.adn.ads)', () => {
    it('falls back to .adn.ads when others fail', () => {
      mockContainer.innerHTML = `
        <div class="adn ads">
          Third fallback email body.
        </div>
      `;

      const result = getEmailBody();
      expect(result).toBe('Third fallback email body.');
    });
  });

  describe('no selectors match', () => {
    it('returns undefined when all selectors fail', () => {
      mockContainer.innerHTML = `
        <div class="other-class">
          Not an email body element.
        </div>
      `;

      const result = getEmailBody();
      expect(result).toBeUndefined();
    });

    it('returns undefined when container is empty', () => {
      mockContainer.innerHTML = '';

      const result = getEmailBody();
      expect(result).toBeUndefined();
    });

    it('returns undefined when element has no text content', () => {
      mockContainer.innerHTML = `
        <div class="a3s aiL"></div>
      `;

      const result = getEmailBody();
      expect(result).toBeUndefined();
    });

    it('returns undefined when element has only whitespace', () => {
      mockContainer.innerHTML = `
        <div class="a3s aiL">   </div>
      `;

      const result = getEmailBody();
      expect(result).toBeUndefined();
    });
  });

  describe('truncation', () => {
    it('truncates body at 1000 chars', () => {
      const longContent = 'A'.repeat(1500);
      mockContainer.innerHTML = `
        <div class="a3s aiL">${longContent}</div>
      `;

      const result = getEmailBody();
      expect(result).toBeDefined();
      expect(result!.length).toBe(1000);
      expect(result).toBe('A'.repeat(1000));
    });

    it('does not truncate body under 1000 chars', () => {
      const shortContent = 'B'.repeat(500);
      mockContainer.innerHTML = `
        <div class="a3s aiL">${shortContent}</div>
      `;

      const result = getEmailBody();
      expect(result).toBe(shortContent);
      expect(result!.length).toBe(500);
    });

    it('returns exactly 1000 chars when content is exactly 1000', () => {
      const exactContent = 'C'.repeat(1000);
      mockContainer.innerHTML = `
        <div class="a3s aiL">${exactContent}</div>
      `;

      const result = getEmailBody();
      expect(result).toBe(exactContent);
      expect(result!.length).toBe(1000);
    });
  });

  describe('error handling', () => {
    it('returns undefined on DOM query error', () => {
      // Mock document.querySelector to throw
      const mockQuerySelector = vi.spyOn(document, 'querySelector').mockImplementation(() => {
        throw new Error('DOM error');
      });

      const result = getEmailBody();
      expect(result).toBeUndefined();

      mockQuerySelector.mockRestore();
    });
  });
});

// =============================================================================
// parseGmailUrl Tests
// =============================================================================

describe('parseGmailUrl', () => {
  describe('inbox view', () => {
    it('extracts messageId from inbox URL', () => {
      const url = 'https://mail.google.com/mail/u/0/#inbox/FMfcgzQXKJTxXvRSMlKzDWRNVBFKJBGR';
      const result = parseGmailUrl(url);

      expect(result.userId).toBe('0');
      expect(result.messageId).toBe('FMfcgzQXKJTxXvRSMlKzDWRNVBFKJBGR');
      expect(result.permanentUrl).toBe(
        'https://mail.google.com/mail/u/0/#all/FMfcgzQXKJTxXvRSMlKzDWRNVBFKJBGR'
      );
    });

    it('handles inbox URL with query parameters', () => {
      const url =
        'https://mail.google.com/mail/u/0/#inbox/FMfcgzQXKJTxXvRSMlKzDWRNVBFKJBGR?compose=new';
      const result = parseGmailUrl(url);

      expect(result.messageId).toBe('FMfcgzQXKJTxXvRSMlKzDWRNVBFKJBGR');
      expect(result.permanentUrl).toBe(
        'https://mail.google.com/mail/u/0/#all/FMfcgzQXKJTxXvRSMlKzDWRNVBFKJBGR'
      );
    });
  });

  describe('all mail view', () => {
    it('extracts messageId from all mail URL', () => {
      const url = 'https://mail.google.com/mail/u/0/#all/FMfcgzQXKJTxXvRSMlKzDWRNVBFKJBGR';
      const result = parseGmailUrl(url);

      expect(result.userId).toBe('0');
      expect(result.messageId).toBe('FMfcgzQXKJTxXvRSMlKzDWRNVBFKJBGR');
      expect(result.permanentUrl).toBe(
        'https://mail.google.com/mail/u/0/#all/FMfcgzQXKJTxXvRSMlKzDWRNVBFKJBGR'
      );
    });
  });

  describe('search view', () => {
    it('extracts messageId from search URL with simple query', () => {
      const url =
        'https://mail.google.com/mail/u/0/#search/meeting/FMfcgzQXKJTxXvRSMlKzDWRNVBFKJBGR';
      const result = parseGmailUrl(url);

      expect(result.userId).toBe('0');
      expect(result.messageId).toBe('FMfcgzQXKJTxXvRSMlKzDWRNVBFKJBGR');
      expect(result.permanentUrl).toBe(
        'https://mail.google.com/mail/u/0/#all/FMfcgzQXKJTxXvRSMlKzDWRNVBFKJBGR'
      );
    });

    it('extracts messageId from search URL with encoded query', () => {
      const url =
        'https://mail.google.com/mail/u/0/#search/from%3Aboss%40company.com/FMfcgzQXKJTxXvRSMlKzDWRNVBFKJBGR';
      const result = parseGmailUrl(url);

      expect(result.messageId).toBe('FMfcgzQXKJTxXvRSMlKzDWRNVBFKJBGR');
    });

    it('extracts messageId from search URL with complex query', () => {
      const url =
        'https://mail.google.com/mail/u/0/#search/has%3Aattachment+after%3A2024%2F01%2F01/ABC123xyz';
      const result = parseGmailUrl(url);

      expect(result.messageId).toBe('ABC123xyz');
    });
  });

  describe('other views', () => {
    it('extracts messageId from sent view', () => {
      const url = 'https://mail.google.com/mail/u/0/#sent/FMfcgzQXKJTxXvRSMlKzDWRNVBFKJBGR';
      const result = parseGmailUrl(url);

      expect(result.messageId).toBe('FMfcgzQXKJTxXvRSMlKzDWRNVBFKJBGR');
    });

    it('extracts messageId from drafts view', () => {
      const url = 'https://mail.google.com/mail/u/0/#drafts/FMfcgzQXKJTxXvRSMlKzDWRNVBFKJBGR';
      const result = parseGmailUrl(url);

      expect(result.messageId).toBe('FMfcgzQXKJTxXvRSMlKzDWRNVBFKJBGR');
    });

    it('extracts messageId from starred view', () => {
      const url = 'https://mail.google.com/mail/u/0/#starred/FMfcgzQXKJTxXvRSMlKzDWRNVBFKJBGR';
      const result = parseGmailUrl(url);

      expect(result.messageId).toBe('FMfcgzQXKJTxXvRSMlKzDWRNVBFKJBGR');
    });

    it('extracts messageId from snoozed view', () => {
      const url = 'https://mail.google.com/mail/u/0/#snoozed/FMfcgzQXKJTxXvRSMlKzDWRNVBFKJBGR';
      const result = parseGmailUrl(url);

      expect(result.messageId).toBe('FMfcgzQXKJTxXvRSMlKzDWRNVBFKJBGR');
    });

    it('extracts messageId from scheduled view', () => {
      const url = 'https://mail.google.com/mail/u/0/#scheduled/FMfcgzQXKJTxXvRSMlKzDWRNVBFKJBGR';
      const result = parseGmailUrl(url);

      expect(result.messageId).toBe('FMfcgzQXKJTxXvRSMlKzDWRNVBFKJBGR');
    });

    it('extracts messageId from label view', () => {
      const url =
        'https://mail.google.com/mail/u/0/#label/Work/FMfcgzQXKJTxXvRSMlKzDWRNVBFKJBGR';
      const result = parseGmailUrl(url);

      expect(result.messageId).toBe('FMfcgzQXKJTxXvRSMlKzDWRNVBFKJBGR');
    });

    it('extracts messageId from category view', () => {
      const url =
        'https://mail.google.com/mail/u/0/#category/social/FMfcgzQXKJTxXvRSMlKzDWRNVBFKJBGR';
      const result = parseGmailUrl(url);

      expect(result.messageId).toBe('FMfcgzQXKJTxXvRSMlKzDWRNVBFKJBGR');
    });
  });

  describe('different userIds', () => {
    it('extracts userId 0', () => {
      const url = 'https://mail.google.com/mail/u/0/#inbox/ABC123';
      const result = parseGmailUrl(url);

      expect(result.userId).toBe('0');
      expect(result.permanentUrl).toContain('/mail/u/0/');
    });

    it('extracts userId 1', () => {
      const url = 'https://mail.google.com/mail/u/1/#inbox/ABC123';
      const result = parseGmailUrl(url);

      expect(result.userId).toBe('1');
      expect(result.permanentUrl).toBe('https://mail.google.com/mail/u/1/#all/ABC123');
    });

    it('extracts userId 2', () => {
      const url = 'https://mail.google.com/mail/u/2/#all/XYZ789';
      const result = parseGmailUrl(url);

      expect(result.userId).toBe('2');
      expect(result.permanentUrl).toBe('https://mail.google.com/mail/u/2/#all/XYZ789');
    });

    it('extracts double-digit userId', () => {
      const url = 'https://mail.google.com/mail/u/15/#inbox/ABC123';
      const result = parseGmailUrl(url);

      expect(result.userId).toBe('15');
      expect(result.permanentUrl).toBe('https://mail.google.com/mail/u/15/#all/ABC123');
    });

    it('defaults to userId 0 when not in URL', () => {
      // This is an edge case - Gmail normally always has /u/N/
      const url = 'https://mail.google.com/mail/#inbox/ABC123';
      const result = parseGmailUrl(url);

      expect(result.userId).toBe('0');
    });
  });

  describe('fallback when no messageId found', () => {
    it('returns null messageId for inbox list view', () => {
      const url = 'https://mail.google.com/mail/u/0/#inbox';
      const result = parseGmailUrl(url);

      expect(result.userId).toBe('0');
      expect(result.messageId).toBeNull();
      expect(result.permanentUrl).toBe(url);
    });

    it('returns null messageId for all mail list view', () => {
      const url = 'https://mail.google.com/mail/u/0/#all';
      const result = parseGmailUrl(url);

      expect(result.messageId).toBeNull();
      expect(result.permanentUrl).toBe(url);
    });

    it('returns null messageId for search results without selected email', () => {
      const url = 'https://mail.google.com/mail/u/0/#search/meeting';
      const result = parseGmailUrl(url);

      expect(result.messageId).toBeNull();
      expect(result.permanentUrl).toBe(url);
    });

    it('returns null messageId for compose view', () => {
      const url = 'https://mail.google.com/mail/u/0/#compose';
      const result = parseGmailUrl(url);

      expect(result.messageId).toBeNull();
      expect(result.permanentUrl).toBe(url);
    });

    it('returns null messageId for settings view', () => {
      const url = 'https://mail.google.com/mail/u/0/#settings/general';
      const result = parseGmailUrl(url);

      expect(result.messageId).toBeNull();
      expect(result.permanentUrl).toBe(url);
    });

    it('returns null messageId for contacts view', () => {
      const url = 'https://mail.google.com/mail/u/0/#contacts';
      const result = parseGmailUrl(url);

      expect(result.messageId).toBeNull();
      expect(result.permanentUrl).toBe(url);
    });

    it('returns original URL as permanentUrl when no messageId', () => {
      const url = 'https://mail.google.com/mail/u/0/#inbox';
      const result = parseGmailUrl(url);

      expect(result.permanentUrl).toBe(url);
    });
  });

  describe('edge cases', () => {
    it('handles messageId with underscores and hyphens', () => {
      const url = 'https://mail.google.com/mail/u/0/#inbox/ABC_123-XYZ';
      const result = parseGmailUrl(url);

      expect(result.messageId).toBe('ABC_123-XYZ');
    });

    it('handles very long messageId', () => {
      const longId = 'A'.repeat(50);
      const url = `https://mail.google.com/mail/u/0/#inbox/${longId}`;
      const result = parseGmailUrl(url);

      expect(result.messageId).toBe(longId);
    });

    it('returns null for URL with trailing slash (malformed)', () => {
      // Trailing slash after messageId is malformed - Gmail doesn't produce these
      const url = 'https://mail.google.com/mail/u/0/#inbox/ABC123/';
      const result = parseGmailUrl(url);

      // The regex expects end of string or query param after messageId
      // A trailing slash is not a valid Gmail URL format
      expect(result.messageId).toBeNull();
    });

    it('handles URL with additional path components', () => {
      const url = 'https://mail.google.com/mail/u/0/?ui=2#inbox/ABC123';
      const result = parseGmailUrl(url);

      expect(result.userId).toBe('0');
      expect(result.messageId).toBe('ABC123');
    });
  });
});
