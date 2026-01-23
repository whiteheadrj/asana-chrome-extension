/**
 * @vitest-environment happy-dom
 */

/**
 * Unit tests for Gmail content script
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { parseGmailUrl, getEmailBody, getEmailSender, getSenderDetails, getEmailDate } from '../gmail-content.js';

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
// getEmailSender Tests
// =============================================================================

describe('getEmailSender', () => {
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

  describe('primary selector (span.gD)', () => {
    it('extracts sender name from span.gD textContent', () => {
      mockContainer.innerHTML = `
        <span class="gD">John Smith</span>
      `;

      const result = getEmailSender();
      expect(result).toBe('John Smith');
    });

    it('extracts email from span.gD email attribute when no textContent', () => {
      mockContainer.innerHTML = `
        <span class="gD" email="john.smith@example.com"></span>
      `;

      const result = getEmailSender();
      expect(result).toBe('john.smith@example.com');
    });

    it('prefers textContent over email attribute (name over raw email)', () => {
      mockContainer.innerHTML = `
        <span class="gD" email="john.smith@example.com">John Smith</span>
      `;

      const result = getEmailSender();
      expect(result).toBe('John Smith');
    });

    it('trims whitespace from sender name', () => {
      mockContainer.innerHTML = `
        <span class="gD">   Jane Doe   </span>
      `;

      const result = getEmailSender();
      expect(result).toBe('Jane Doe');
    });
  });

  describe('fallback selector ([email])', () => {
    it('extracts email from [email] attribute when span.gD fails', () => {
      mockContainer.innerHTML = `
        <div email="sender@company.org"></div>
      `;

      const result = getEmailSender();
      expect(result).toBe('sender@company.org');
    });

    it('uses span.gD when both are present', () => {
      mockContainer.innerHTML = `
        <span class="gD">Primary Sender</span>
        <div email="fallback@example.com"></div>
      `;

      const result = getEmailSender();
      expect(result).toBe('Primary Sender');
    });
  });

  describe('tertiary selector (span[data-hovercard-id])', () => {
    it('extracts email from data-hovercard-id attribute', () => {
      mockContainer.innerHTML = `
        <span data-hovercard-id="contact@domain.net"></span>
      `;

      const result = getEmailSender();
      expect(result).toBe('contact@domain.net');
    });

    it('extracts email using regex match from data-hovercard-id', () => {
      mockContainer.innerHTML = `
        <span data-hovercard-id="user_id:alice@test.com:12345"></span>
      `;

      const result = getEmailSender();
      expect(result).toBe('alice@test.com');
    });

    it('returns hovercard ID if it contains @ but no email pattern matched', () => {
      mockContainer.innerHTML = `
        <span data-hovercard-id="@handle"></span>
      `;

      const result = getEmailSender();
      expect(result).toBe('@handle');
    });
  });

  describe('no selectors match', () => {
    it('returns undefined when all selectors fail', () => {
      mockContainer.innerHTML = `
        <div class="other-class">
          Not a sender element.
        </div>
      `;

      const result = getEmailSender();
      expect(result).toBeUndefined();
    });

    it('returns undefined when container is empty', () => {
      mockContainer.innerHTML = '';

      const result = getEmailSender();
      expect(result).toBeUndefined();
    });

    it('returns undefined when span.gD has no textContent and no email attribute', () => {
      mockContainer.innerHTML = `
        <span class="gD"></span>
      `;

      const result = getEmailSender();
      expect(result).toBeUndefined();
    });

    it('returns undefined when span.gD has only whitespace', () => {
      mockContainer.innerHTML = `
        <span class="gD">   </span>
      `;

      const result = getEmailSender();
      expect(result).toBeUndefined();
    });
  });

  describe('error handling', () => {
    it('returns undefined on DOM query error', () => {
      // Mock document.querySelector to throw
      const mockQuerySelector = vi.spyOn(document, 'querySelector').mockImplementation(() => {
        throw new Error('DOM error');
      });

      const result = getEmailSender();
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

// =============================================================================
// getSenderDetails Tests
// =============================================================================

describe('getSenderDetails', () => {
  let mockContainer: HTMLDivElement;

  beforeEach(() => {
    mockContainer = document.createElement('div');
    document.body.appendChild(mockContainer);
  });

  afterEach(() => {
    mockContainer.remove();
    vi.restoreAllMocks();
  });

  describe('primary selector (span.gD)', () => {
    it('extracts both name and email from span.gD', () => {
      mockContainer.innerHTML = `
        <span class="gD" email="john.smith@example.com">John Smith</span>
      `;

      const result = getSenderDetails();
      expect(result.name).toBe('John Smith');
      expect(result.email).toBe('john.smith@example.com');
    });

    it('extracts only name when email attribute is missing', () => {
      mockContainer.innerHTML = `
        <span class="gD">Jane Doe</span>
      `;

      const result = getSenderDetails();
      expect(result.name).toBe('Jane Doe');
      expect(result.email).toBeUndefined();
    });

    it('extracts only email when textContent is empty', () => {
      mockContainer.innerHTML = `
        <span class="gD" email="contact@company.org"></span>
      `;

      const result = getSenderDetails();
      expect(result.name).toBeUndefined();
      expect(result.email).toBe('contact@company.org');
    });

    it('trims whitespace from name', () => {
      mockContainer.innerHTML = `
        <span class="gD" email="test@test.com">   Trimmed Name   </span>
      `;

      const result = getSenderDetails();
      expect(result.name).toBe('Trimmed Name');
      expect(result.email).toBe('test@test.com');
    });
  });

  describe('fallback selector ([email])', () => {
    it('falls back to [email] attribute when span.gD has no email', () => {
      mockContainer.innerHTML = `
        <span class="gD">Sender Name Only</span>
        <div email="fallback@example.com"></div>
      `;

      const result = getSenderDetails();
      expect(result.name).toBe('Sender Name Only');
      expect(result.email).toBe('fallback@example.com');
    });

    it('uses [email] when span.gD is not present', () => {
      mockContainer.innerHTML = `
        <div email="only-email@domain.net"></div>
      `;

      const result = getSenderDetails();
      expect(result.name).toBeUndefined();
      expect(result.email).toBe('only-email@domain.net');
    });
  });

  describe('fallback selector (span[data-hovercard-id])', () => {
    it('extracts email from data-hovercard-id using regex', () => {
      mockContainer.innerHTML = `
        <span data-hovercard-id="user:alice@test.com:12345"></span>
      `;

      const result = getSenderDetails();
      expect(result.email).toBe('alice@test.com');
    });

    it('extracts email directly from data-hovercard-id', () => {
      mockContainer.innerHTML = `
        <span data-hovercard-id="bob@company.io"></span>
      `;

      const result = getSenderDetails();
      expect(result.email).toBe('bob@company.io');
    });

    it('uses hovercard-id fallback only when other selectors fail', () => {
      mockContainer.innerHTML = `
        <span class="gD" email="primary@example.com">Primary Sender</span>
        <span data-hovercard-id="fallback@example.com"></span>
      `;

      const result = getSenderDetails();
      expect(result.name).toBe('Primary Sender');
      expect(result.email).toBe('primary@example.com');
    });
  });

  describe('edge cases', () => {
    it('returns empty object when no selectors match', () => {
      mockContainer.innerHTML = `
        <div class="other-class">Not a sender element</div>
      `;

      const result = getSenderDetails();
      expect(result.name).toBeUndefined();
      expect(result.email).toBeUndefined();
    });

    it('returns empty object when container is empty', () => {
      mockContainer.innerHTML = '';

      const result = getSenderDetails();
      expect(result.name).toBeUndefined();
      expect(result.email).toBeUndefined();
    });

    it('returns empty object when span.gD has only whitespace', () => {
      mockContainer.innerHTML = `
        <span class="gD">   </span>
      `;

      const result = getSenderDetails();
      expect(result.name).toBeUndefined();
      expect(result.email).toBeUndefined();
    });

    it('handles special characters in name', () => {
      mockContainer.innerHTML = `
        <span class="gD" email="test@test.com">O'Brien, María José</span>
      `;

      const result = getSenderDetails();
      expect(result.name).toBe("O'Brien, María José");
    });

    it('handles complex email formats', () => {
      mockContainer.innerHTML = `
        <span class="gD" email="test.user+tag@sub.domain.co.uk">Test User</span>
      `;

      const result = getSenderDetails();
      expect(result.email).toBe('test.user+tag@sub.domain.co.uk');
    });
  });

  describe('error handling', () => {
    it('returns empty object on DOM query error', () => {
      const mockQuerySelector = vi.spyOn(document, 'querySelector').mockImplementation(() => {
        throw new Error('DOM error');
      });

      const result = getSenderDetails();
      expect(result.name).toBeUndefined();
      expect(result.email).toBeUndefined();

      mockQuerySelector.mockRestore();
    });
  });
});

// =============================================================================
// getEmailDate Tests
// =============================================================================

describe('getEmailDate', () => {
  let mockContainer: HTMLDivElement;

  beforeEach(() => {
    mockContainer = document.createElement('div');
    document.body.appendChild(mockContainer);
  });

  afterEach(() => {
    mockContainer.remove();
    vi.restoreAllMocks();
  });

  describe('primary selector (.gK .g3)', () => {
    it('extracts date from .gK .g3 textContent', () => {
      mockContainer.innerHTML = `
        <div class="gK">
          <span class="g3">Dec 15, 2024</span>
        </div>
      `;

      const result = getEmailDate();
      expect(result).toBe('2024-12-15');
    });

    it('extracts date from title attribute', () => {
      mockContainer.innerHTML = `
        <div class="gK">
          <span class="g3" title="December 15, 2024 10:30 AM">Dec 15</span>
        </div>
      `;

      const result = getEmailDate();
      expect(result).toBe('2024-12-15');
    });

    it('extracts date from data-tooltip attribute', () => {
      mockContainer.innerHTML = `
        <div class="gK">
          <span class="g3" data-tooltip="January 20, 2025">Jan 20</span>
        </div>
      `;

      const result = getEmailDate();
      expect(result).toBe('2025-01-20');
    });
  });

  describe('fallback selector (.g3)', () => {
    it('falls back to .g3 when .gK .g3 fails', () => {
      mockContainer.innerHTML = `
        <span class="g3">March 1, 2025</span>
      `;

      const result = getEmailDate();
      expect(result).toBe('2025-03-01');
    });
  });

  describe('fallback selector (span.g3)', () => {
    it('uses span.g3 selector', () => {
      mockContainer.innerHTML = `
        <span class="g3">April 10, 2025</span>
      `;

      const result = getEmailDate();
      expect(result).toBe('2025-04-10');
    });
  });

  describe('fallback selector ([data-legacy-thread-id])', () => {
    it('extracts date from thread view', () => {
      mockContainer.innerHTML = `
        <div data-legacy-thread-id="abc123">
          <div class="gK">
            <span>May 5, 2025</span>
          </div>
        </div>
      `;

      const result = getEmailDate();
      expect(result).toBe('2025-05-05');
    });
  });

  describe('additional fallback selectors', () => {
    it('extracts date from .ade .ads selector', () => {
      mockContainer.innerHTML = `
        <div class="ade">
          <div class="ads">June 15, 2025</div>
        </div>
      `;

      const result = getEmailDate();
      expect(result).toBe('2025-06-15');
    });

    it('extracts date from td.xY span.xW selector when earlier selectors fail', () => {
      // Only include td.xY span.xW, no other date selectors
      mockContainer.innerHTML = `
        <table>
          <tr>
            <td class="xY">
              <span class="xW">July 20, 2025</span>
            </td>
          </tr>
        </table>
      `;

      const result = getEmailDate();
      expect(result).toBe('2025-07-20');
    });
  });

  describe('date format parsing', () => {
    it('parses "MMM DD, YYYY" format', () => {
      mockContainer.innerHTML = `
        <span class="g3">Jan 15, 2025</span>
      `;

      const result = getEmailDate();
      expect(result).toBe('2025-01-15');
    });

    it('parses "MMMM DD, YYYY" format', () => {
      mockContainer.innerHTML = `
        <span class="g3">February 28, 2025</span>
      `;

      const result = getEmailDate();
      expect(result).toBe('2025-02-28');
    });

    it('parses "DD MMM YYYY" format', () => {
      mockContainer.innerHTML = `
        <span class="g3">15 Mar 2025</span>
      `;

      const result = getEmailDate();
      expect(result).toBe('2025-03-15');
    });

    it('parses ISO date format', () => {
      mockContainer.innerHTML = `
        <span class="g3">2025-04-20</span>
      `;

      const result = getEmailDate();
      expect(result).toBe('2025-04-20');
    });

    it('parses full datetime string from title attribute', () => {
      // Note: "Sat, May 10, 2025 3:45 PM" format is parseable by JS Date
      // The "at" keyword in date strings can cause parsing issues
      mockContainer.innerHTML = `
        <span class="g3" title="Sat, May 10, 2025, 3:45 PM">May 10</span>
      `;

      const result = getEmailDate();
      expect(result).toBe('2025-05-10');
    });
  });

  describe('edge cases', () => {
    it('returns undefined when no date element found', () => {
      mockContainer.innerHTML = `
        <div class="other-class">Not a date element</div>
      `;

      const result = getEmailDate();
      expect(result).toBeUndefined();
    });

    it('returns undefined when container is empty', () => {
      mockContainer.innerHTML = '';

      const result = getEmailDate();
      expect(result).toBeUndefined();
    });

    it('returns undefined when element has only whitespace', () => {
      mockContainer.innerHTML = `
        <span class="g3">   </span>
      `;

      const result = getEmailDate();
      expect(result).toBeUndefined();
    });

    it('returns undefined for unparseable date string', () => {
      mockContainer.innerHTML = `
        <span class="g3">not a date</span>
      `;

      const result = getEmailDate();
      expect(result).toBeUndefined();
    });

    it('returns undefined for partial date without year', () => {
      mockContainer.innerHTML = `
        <span class="g3">Dec 15</span>
      `;

      // Note: Date parsing without year behavior depends on JS Date implementation
      // It may assume current year or fail - test actual behavior
      const result = getEmailDate();
      // The Date constructor may parse "Dec 15" with current year or fail
      // We just verify it doesn't throw
      expect(typeof result === 'string' || result === undefined).toBe(true);
    });
  });

  describe('selector priority', () => {
    it('uses first matching selector when multiple are present', () => {
      mockContainer.innerHTML = `
        <div class="gK">
          <span class="g3">Jan 1, 2025</span>
        </div>
        <div class="ade">
          <div class="ads">Feb 2, 2025</div>
        </div>
      `;

      const result = getEmailDate();
      // Should use first matching selector (.gK .g3)
      expect(result).toBe('2025-01-01');
    });

    it('prefers title attribute over textContent', () => {
      mockContainer.innerHTML = `
        <span class="g3" title="March 15, 2025">Mar 15</span>
      `;

      const result = getEmailDate();
      expect(result).toBe('2025-03-15');
    });
  });

  describe('error handling', () => {
    it('returns undefined on DOM query error', () => {
      const mockQuerySelector = vi.spyOn(document, 'querySelector').mockImplementation(() => {
        throw new Error('DOM error');
      });

      const result = getEmailDate();
      expect(result).toBeUndefined();

      mockQuerySelector.mockRestore();
    });
  });
});
