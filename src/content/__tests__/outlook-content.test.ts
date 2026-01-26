/**
 * @vitest-environment happy-dom
 */

/**
 * Unit tests for Outlook content script
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  parseOutlookUrl,
  detectOutlookVariant,
  getEmailBody,
  getEmailSubject,
  getSenderInfo,
  getSenderDetails,
  getEmailDate,
} from '../outlook-content.js';

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

  describe('primary selector ([aria-label="Message body"])', () => {
    it('returns body text from Message body aria-label', () => {
      mockContainer.innerHTML = `
        <div aria-label="Message body">
          This is the email body content from Outlook.
        </div>
      `;

      const result = getEmailBody();
      expect(result).toBe('This is the email body content from Outlook.');
    });

    it('trims whitespace from body text', () => {
      mockContainer.innerHTML = `
        <div aria-label="Message body">

          Trimmed email content.

        </div>
      `;

      const result = getEmailBody();
      expect(result).toBe('Trimmed email content.');
    });

    it('skips empty Message body elements and finds one with content', () => {
      // This tests the key fix: when there are multiple Message body elements
      // (e.g., a draft + actual email), find the one with content
      mockContainer.innerHTML = `
        <div aria-label="Message body"></div>
        <div aria-label="Message body">
          Actual email content from second element.
        </div>
      `;

      const result = getEmailBody();
      expect(result).toBe('Actual email content from second element.');
    });

    it('skips whitespace-only Message body elements', () => {
      mockContainer.innerHTML = `
        <div aria-label="Message body">   </div>
        <div aria-label="Message body">
          Content after whitespace-only element.
        </div>
      `;

      const result = getEmailBody();
      expect(result).toBe('Content after whitespace-only element.');
    });
  });

  describe('fallback selector ([role="document"])', () => {
    it('returns body from role=document when Message body fails', () => {
      mockContainer.innerHTML = `
        <div role="document">
          This is email body content from a document role element with enough text to pass the length check.
        </div>
      `;

      const result = getEmailBody();
      expect(result).toBe(
        'This is email body content from a document role element with enough text to pass the length check.'
      );
    });

    it('ignores short document content (under 50 chars)', () => {
      mockContainer.innerHTML = `
        <div role="document">Short text</div>
      `;

      const result = getEmailBody();
      expect(result).toBeUndefined();
    });
  });

  describe('legacy selector ([data-app-section="ConversationReadingPane"])', () => {
    it('returns body from ConversationReadingPane selector', () => {
      mockContainer.innerHTML = `
        <div data-app-section="ConversationReadingPane">
          Legacy email body content from Outlook.
        </div>
      `;

      const result = getEmailBody();
      expect(result).toBe('Legacy email body content from Outlook.');
    });
  });

  describe('selector priority', () => {
    it('uses Message body aria-label over role=document', () => {
      mockContainer.innerHTML = `
        <div aria-label="Message body">Primary content from aria-label.</div>
        <div role="document">This is fallback content from document role element that should not be used.</div>
      `;

      const result = getEmailBody();
      expect(result).toBe('Primary content from aria-label.');
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

    it('returns undefined when all Message body elements are empty', () => {
      mockContainer.innerHTML = `
        <div aria-label="Message body"></div>
        <div aria-label="Message body">   </div>
      `;

      const result = getEmailBody();
      expect(result).toBeUndefined();
    });
  });

  describe('truncation', () => {
    it('truncates at 1000 chars', () => {
      const longContent = 'A'.repeat(1500);
      mockContainer.innerHTML = `
        <div aria-label="Message body">${longContent}</div>
      `;

      const result = getEmailBody();
      expect(result).toBeDefined();
      expect(result!.length).toBe(1000);
      expect(result).toBe('A'.repeat(1000));
    });

    it('does not truncate body under 1000 chars', () => {
      const shortContent = 'B'.repeat(500);
      mockContainer.innerHTML = `
        <div aria-label="Message body">${shortContent}</div>
      `;

      const result = getEmailBody();
      expect(result).toBe(shortContent);
      expect(result!.length).toBe(500);
    });

    it('returns exactly 1000 chars when content is exactly 1000', () => {
      const exactContent = 'C'.repeat(1000);
      mockContainer.innerHTML = `
        <div aria-label="Message body">${exactContent}</div>
      `;

      const result = getEmailBody();
      expect(result).toBe(exactContent);
      expect(result!.length).toBe(1000);
    });
  });

  describe('error handling', () => {
    it('returns undefined on DOM query error', () => {
      // Mock document.querySelectorAll to throw
      const mockQuerySelectorAll = vi
        .spyOn(document, 'querySelectorAll')
        .mockImplementation(() => {
          throw new Error('DOM error');
        });

      const result = getEmailBody();
      expect(result).toBeUndefined();

      mockQuerySelectorAll.mockRestore();
    });
  });
});

// =============================================================================
// getEmailSubject Tests
// =============================================================================

describe('getEmailSubject', () => {
  let mockContainer: HTMLDivElement;

  beforeEach(() => {
    mockContainer = document.createElement('div');
    document.body.appendChild(mockContainer);
  });

  afterEach(() => {
    mockContainer.remove();
    vi.restoreAllMocks();
  });

  describe('primary selector (div[role="heading"].allowTextSelection)', () => {
    it('extracts subject from heading span', () => {
      mockContainer.innerHTML = `
        <div role="heading" class="allowTextSelection">
          <span>Test Email Subject Line</span>
          <button>Summarize</button>
        </div>
      `;

      const result = getEmailSubject();
      expect(result).toBe('Test Email Subject Line');
    });

    it('ignores Summarize button text', () => {
      mockContainer.innerHTML = `
        <div role="heading" class="allowTextSelection">
          <span>Important Meeting Tomorrow</span>
          <span>Summarize</span>
        </div>
      `;

      const result = getEmailSubject();
      expect(result).toBe('Important Meeting Tomorrow');
    });

    it('ignores short spans (5 chars or less)', () => {
      mockContainer.innerHTML = `
        <div role="heading" class="allowTextSelection">
          <span>Hi</span>
          <span>This is the actual subject line</span>
        </div>
      `;

      const result = getEmailSubject();
      expect(result).toBe('This is the actual subject line');
    });

    it('cleans up heading text when no valid span found', () => {
      mockContainer.innerHTML = `
        <div role="heading" class="allowTextSelection">
          Subject Without SpanSummarize
        </div>
      `;

      const result = getEmailSubject();
      expect(result).toBe('Subject Without Span');
    });
  });

  describe('legacy selectors', () => {
    it('falls back to data-app-section selector', () => {
      mockContainer.innerHTML = `
        <div data-app-section="ConversationTopic">
          Legacy Subject Format
        </div>
      `;

      const result = getEmailSubject();
      expect(result).toBe('Legacy Subject Format');
    });

    it('falls back to ms-font-xl class selector', () => {
      mockContainer.innerHTML = `
        <div class="ms-font-xl allowTextSelection">
          Subject from Font Class
        </div>
      `;

      const result = getEmailSubject();
      expect(result).toBe('Subject from Font Class');
    });
  });

  describe('document title fallback', () => {
    it('extracts subject from document title when no DOM elements match', () => {
      // Save original title
      const originalTitle = document.title;
      document.title = 'Email Subject - Outlook';

      mockContainer.innerHTML = '<div class="unrelated">No subject elements</div>';

      const result = getEmailSubject();
      // The function checks if title contains 'Outlook' and skips it
      expect(result).toBeUndefined();

      // Restore title
      document.title = originalTitle;
    });
  });

  describe('edge cases', () => {
    it('returns undefined when no subject found', () => {
      mockContainer.innerHTML = '<div class="unrelated">No subject here</div>';

      const result = getEmailSubject();
      expect(result).toBeUndefined();
    });

    it('rejects subjects over 500 characters', () => {
      const longSubject = 'A'.repeat(501);
      mockContainer.innerHTML = `
        <div role="heading" class="allowTextSelection">
          <span>${longSubject}</span>
        </div>
      `;

      const result = getEmailSubject();
      // Should skip the too-long span and return undefined (no fallback)
      expect(result).toBeUndefined();
    });
  });
});

// =============================================================================
// getSenderInfo Tests
// =============================================================================

describe('getSenderInfo', () => {
  let mockContainer: HTMLDivElement;

  beforeEach(() => {
    mockContainer = document.createElement('div');
    document.body.appendChild(mockContainer);
  });

  afterEach(() => {
    mockContainer.remove();
    vi.restoreAllMocks();
  });

  describe('primary selector (span[aria-label^="From:"] in Email message)', () => {
    it('extracts sender name from From span with email', () => {
      mockContainer.innerHTML = `
        <div aria-label="Email message">
          <span aria-label="From: John Doe">John Doe<john@example.com></span>
        </div>
      `;

      const result = getSenderInfo();
      expect(result).toBe('John Doe');
    });

    it('extracts full text when no email pattern', () => {
      mockContainer.innerHTML = `
        <div aria-label="Email message">
          <span aria-label="From: Support Team">Support Team</span>
        </div>
      `;

      const result = getSenderInfo();
      expect(result).toBe('Support Team');
    });

    it('handles multiple Email message containers', () => {
      mockContainer.innerHTML = `
        <div aria-label="Email message">
          <span aria-label="From: First Sender">First Sender<first@example.com></span>
        </div>
        <div aria-label="Email message">
          <span aria-label="From: Second Sender">Second Sender<second@example.com></span>
        </div>
      `;

      const result = getSenderInfo();
      // Should return the first one found
      expect(result).toBe('First Sender');
    });
  });

  describe('heading pattern fallback', () => {
    it('extracts sender from heading with email pattern', () => {
      // Create DOM manually to avoid HTML parsing issues with < and >
      const emailContainer = document.createElement('div');
      emailContainer.setAttribute('aria-label', 'Email message');
      const headingSpan = document.createElement('span');
      headingSpan.setAttribute('role', 'heading');
      headingSpan.textContent = 'Notifications<notifications@example.com>';
      emailContainer.appendChild(headingSpan);
      mockContainer.appendChild(emailContainer);

      const result = getSenderInfo();
      expect(result).toBe('Notifications');
    });
  });

  describe('legacy selectors', () => {
    it('falls back to data-app-section FromLine', () => {
      mockContainer.innerHTML = `
        <div data-app-section="FromLine">
          <span>Legacy Sender Name</span>
        </div>
      `;

      const result = getSenderInfo();
      expect(result).toBe('Legacy Sender Name');
    });

    it('falls back to PersonaName id selector', () => {
      mockContainer.innerHTML = `
        <span id="PersonaName_123">Persona Sender</span>
      `;

      const result = getSenderInfo();
      expect(result).toBe('Persona Sender');
    });
  });

  describe('email fallback from aria-label', () => {
    it('extracts email from role=img aria-label', () => {
      mockContainer.innerHTML = `
        <div role="img" aria-label="Profile picture of sender@example.com"></div>
      `;

      const result = getSenderInfo();
      expect(result).toBe('sender@example.com');
    });

    it('extracts email from button aria-label', () => {
      mockContainer.innerHTML = `
        <button aria-label="Contact card for user@domain.org"></button>
      `;

      const result = getSenderInfo();
      expect(result).toBe('user@domain.org');
    });
  });

  describe('edge cases', () => {
    it('returns undefined when no sender found', () => {
      mockContainer.innerHTML = '<div class="unrelated">No sender here</div>';

      const result = getSenderInfo();
      expect(result).toBeUndefined();
    });

    it('rejects sender names over 200 characters', () => {
      const longName = 'A'.repeat(201);
      mockContainer.innerHTML = `
        <div aria-label="Email message">
          <span aria-label="From: Long">${longName}</span>
        </div>
      `;

      const result = getSenderInfo();
      expect(result).toBeUndefined();
    });

    it('handles error gracefully', () => {
      const mockQuerySelectorAll = vi
        .spyOn(document, 'querySelectorAll')
        .mockImplementation(() => {
          throw new Error('DOM error');
        });

      const result = getSenderInfo();
      expect(result).toBeUndefined();

      mockQuerySelectorAll.mockRestore();
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

  describe('primary selector (span[aria-label^="From:"] in Email message)', () => {
    it('extracts both name and email from "Name<email>" format', () => {
      // Create DOM manually to avoid HTML parsing issues with < and >
      const emailContainer = document.createElement('div');
      emailContainer.setAttribute('aria-label', 'Email message');
      const fromSpan = document.createElement('span');
      fromSpan.setAttribute('aria-label', 'From: John Doe');
      fromSpan.textContent = 'John Doe<john@example.com>';
      emailContainer.appendChild(fromSpan);
      mockContainer.appendChild(emailContainer);

      const result = getSenderDetails();
      expect(result.name).toBe('John Doe');
      expect(result.email).toBe('john@example.com');
    });

    it('extracts name only when no email pattern', () => {
      mockContainer.innerHTML = `
        <div aria-label="Email message">
          <span aria-label="From: Support Team">Support Team</span>
        </div>
      `;

      const result = getSenderDetails();
      expect(result.name).toBe('Support Team');
      expect(result.email).toBeUndefined();
    });

    it('extracts email with special characters', () => {
      const emailContainer = document.createElement('div');
      emailContainer.setAttribute('aria-label', 'Email message');
      const fromSpan = document.createElement('span');
      fromSpan.setAttribute('aria-label', 'From: John');
      fromSpan.textContent = 'John Smith<john.smith+work@example.co.uk>';
      emailContainer.appendChild(fromSpan);
      mockContainer.appendChild(emailContainer);

      const result = getSenderDetails();
      expect(result.name).toBe('John Smith');
      expect(result.email).toBe('john.smith+work@example.co.uk');
    });

    it('trims whitespace from name', () => {
      const emailContainer = document.createElement('div');
      emailContainer.setAttribute('aria-label', 'Email message');
      const fromSpan = document.createElement('span');
      fromSpan.setAttribute('aria-label', 'From: Test');
      fromSpan.textContent = '  Jane Doe  <jane@example.com>';
      emailContainer.appendChild(fromSpan);
      mockContainer.appendChild(emailContainer);

      const result = getSenderDetails();
      expect(result.name).toBe('Jane Doe');
      expect(result.email).toBe('jane@example.com');
    });

    it('handles multiple Email message containers (returns first)', () => {
      const container1 = document.createElement('div');
      container1.setAttribute('aria-label', 'Email message');
      const span1 = document.createElement('span');
      span1.setAttribute('aria-label', 'From: First Sender');
      span1.textContent = 'First Sender<first@example.com>';
      container1.appendChild(span1);

      const container2 = document.createElement('div');
      container2.setAttribute('aria-label', 'Email message');
      const span2 = document.createElement('span');
      span2.setAttribute('aria-label', 'From: Second Sender');
      span2.textContent = 'Second Sender<second@example.com>';
      container2.appendChild(span2);

      mockContainer.appendChild(container1);
      mockContainer.appendChild(container2);

      const result = getSenderDetails();
      expect(result.name).toBe('First Sender');
      expect(result.email).toBe('first@example.com');
    });
  });

  describe('heading pattern fallback', () => {
    it('extracts sender from heading with email pattern', () => {
      const emailContainer = document.createElement('div');
      emailContainer.setAttribute('aria-label', 'Email message');
      const headingSpan = document.createElement('span');
      headingSpan.setAttribute('role', 'heading');
      headingSpan.textContent = 'Notifications<notifications@example.com>';
      emailContainer.appendChild(headingSpan);
      mockContainer.appendChild(emailContainer);

      const result = getSenderDetails();
      expect(result.name).toBe('Notifications');
      expect(result.email).toBe('notifications@example.com');
    });
  });

  describe('legacy selectors', () => {
    it('falls back to data-app-section FromLine with name<email> format', () => {
      const fromLine = document.createElement('div');
      fromLine.setAttribute('data-app-section', 'FromLine');
      const span = document.createElement('span');
      span.textContent = 'Legacy User<legacy@example.com>';
      fromLine.appendChild(span);
      mockContainer.appendChild(fromLine);

      const result = getSenderDetails();
      expect(result.name).toBe('Legacy User');
      expect(result.email).toBe('legacy@example.com');
    });

    it('falls back to data-app-section FromLine with name only', () => {
      mockContainer.innerHTML = `
        <div data-app-section="FromLine">
          <span>Legacy Sender Name</span>
        </div>
      `;

      const result = getSenderDetails();
      expect(result.name).toBe('Legacy Sender Name');
      expect(result.email).toBeUndefined();
    });

    it('falls back to PersonaName id selector', () => {
      mockContainer.innerHTML = `
        <span id="PersonaName_123">Persona Sender</span>
      `;

      const result = getSenderDetails();
      expect(result.name).toBe('Persona Sender');
      expect(result.email).toBeUndefined();
    });
  });

  describe('email fallback from aria-label', () => {
    it('extracts email only from role=img aria-label', () => {
      mockContainer.innerHTML = `
        <div role="img" aria-label="Profile picture of sender@example.com"></div>
      `;

      const result = getSenderDetails();
      expect(result.name).toBeUndefined();
      expect(result.email).toBe('sender@example.com');
    });

    it('extracts email only from button aria-label', () => {
      mockContainer.innerHTML = `
        <button aria-label="Contact card for user@domain.org"></button>
      `;

      const result = getSenderDetails();
      expect(result.name).toBeUndefined();
      expect(result.email).toBe('user@domain.org');
    });
  });

  describe('edge cases', () => {
    it('returns empty object when no sender found', () => {
      mockContainer.innerHTML = '<div class="unrelated">No sender here</div>';

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

    it('rejects sender over 200 characters', () => {
      const longName = 'A'.repeat(201);
      mockContainer.innerHTML = `
        <div aria-label="Email message">
          <span aria-label="From: Long">${longName}</span>
        </div>
      `;

      const result = getSenderDetails();
      expect(result.name).toBeUndefined();
      expect(result.email).toBeUndefined();
    });

    it('handles error gracefully', () => {
      const mockQuerySelectorAll = vi
        .spyOn(document, 'querySelectorAll')
        .mockImplementation(() => {
          throw new Error('DOM error');
        });

      const result = getSenderDetails();
      expect(result.name).toBeUndefined();
      expect(result.email).toBeUndefined();

      mockQuerySelectorAll.mockRestore();
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

  describe('primary selector (time[datetime] in Email message container)', () => {
    it('extracts date from time element datetime attribute', () => {
      mockContainer.innerHTML = `
        <div aria-label="Email message">
          <time datetime="2024-01-15T10:30:00Z">Jan 15, 2024</time>
        </div>
      `;

      const result = getEmailDate();
      expect(result).toBe('2024-01-15');
    });

    it('extracts date from ISO datetime format', () => {
      mockContainer.innerHTML = `
        <div aria-label="Email message">
          <time datetime="2024-03-22T14:45:00.000Z">March 22</time>
        </div>
      `;

      const result = getEmailDate();
      expect(result).toBe('2024-03-22');
    });
  });

  describe('span text parsing in Email message container', () => {
    it('extracts date from span with MMM DD, YYYY format', () => {
      mockContainer.innerHTML = `
        <div aria-label="Email message">
          <span>Jan 15, 2024</span>
        </div>
      `;

      const result = getEmailDate();
      expect(result).toBe('2024-01-15');
    });

    it('extracts date from span with DD MMM YYYY format', () => {
      mockContainer.innerHTML = `
        <div aria-label="Email message">
          <span>15 Jan 2024</span>
        </div>
      `;

      const result = getEmailDate();
      expect(result).toBe('2024-01-15');
    });

    it('extracts date from span with full month name', () => {
      mockContainer.innerHTML = `
        <div aria-label="Email message">
          <span>January 15, 2024</span>
        </div>
      `;

      const result = getEmailDate();
      expect(result).toBe('2024-01-15');
    });
  });

  describe('fallback selectors (data-app-section)', () => {
    it('extracts date from DateTimeLine selector', () => {
      mockContainer.innerHTML = `
        <div data-app-section="DateTimeLine">March 20, 2024</div>
      `;

      const result = getEmailDate();
      expect(result).toBe('2024-03-20');
    });

    it('extracts date from ReceivedTimeLine selector', () => {
      mockContainer.innerHTML = `
        <div data-app-section="ReceivedTimeLine">April 5, 2024</div>
      `;

      const result = getEmailDate();
      expect(result).toBe('2024-04-05');
    });

    it('extracts date from span with DateTimeLine id', () => {
      mockContainer.innerHTML = `
        <span id="DateTimeLine_123">May 10, 2024</span>
      `;

      const result = getEmailDate();
      expect(result).toBe('2024-05-10');
    });

    it('extracts date from textContent when no datetime attribute on parent', () => {
      mockContainer.innerHTML = `
        <div data-app-section="DateTimeLine">June 15, 2024</div>
      `;

      // The selector finds the div, checks for datetime attr (not present on div),
      // then falls back to textContent parsing
      const result = getEmailDate();
      expect(result).toBe('2024-06-15');
    });
  });

  describe('aria-label selectors', () => {
    it('extracts date from aria-label containing "sent"', () => {
      mockContainer.innerHTML = `
        <span aria-label="sent July 20, 2024">Sent</span>
      `;

      const result = getEmailDate();
      expect(result).toBe('2024-07-20');
    });

    it('extracts date from aria-label containing "received"', () => {
      mockContainer.innerHTML = `
        <span aria-label="received August 12, 2024">Received</span>
      `;

      const result = getEmailDate();
      expect(result).toBe('2024-08-12');
    });

    it('extracts date from aria-label with "Sent:" prefix', () => {
      mockContainer.innerHTML = `
        <span aria-label="Sent: September 5, 2024">Sep 5</span>
      `;

      const result = getEmailDate();
      expect(result).toBe('2024-09-05');
    });
  });

  describe('title attribute selectors', () => {
    it('extracts date from title with "Sent:" prefix', () => {
      mockContainer.innerHTML = `
        <span title="Sent: October 10, 2024">Oct 10</span>
      `;

      const result = getEmailDate();
      expect(result).toBe('2024-10-10');
    });

    it('extracts date from title with "Received:" prefix', () => {
      mockContainer.innerHTML = `
        <span title="Received: November 22, 2024">Nov 22</span>
      `;

      const result = getEmailDate();
      expect(result).toBe('2024-11-22');
    });

    it('extracts date from span title with date-like content', () => {
      mockContainer.innerHTML = `
        <span title="Dec 25, 2024">Dec 25</span>
      `;

      const result = getEmailDate();
      expect(result).toBe('2024-12-25');
    });
  });

  describe('special date strings', () => {
    it('parses "Today" to current date', () => {
      mockContainer.innerHTML = `
        <div aria-label="Email message">
          <span>Today at 3:30 PM</span>
        </div>
      `;

      const result = getEmailDate();
      const today = new Date().toISOString().split('T')[0];
      expect(result).toBe(today);
    });

    it('parses "Yesterday" to yesterday date', () => {
      mockContainer.innerHTML = `
        <div aria-label="Email message">
          <span>Yesterday at 10:00 AM</span>
        </div>
      `;

      const result = getEmailDate();
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const expectedDate = yesterday.toISOString().split('T')[0];
      expect(result).toBe(expectedDate);
    });
  });

  describe('date format parsing', () => {
    it('parses MM/DD/YYYY format', () => {
      mockContainer.innerHTML = `
        <div data-app-section="DateTimeLine">01/15/2024</div>
      `;

      const result = getEmailDate();
      expect(result).toBe('2024-01-15');
    });

    it('parses YYYY-MM-DD ISO format', () => {
      mockContainer.innerHTML = `
        <div data-app-section="DateTimeLine">2024-02-28</div>
      `;

      const result = getEmailDate();
      expect(result).toBe('2024-02-28');
    });
  });

  describe('edge cases', () => {
    it('returns undefined when no date found', () => {
      mockContainer.innerHTML = '<div class="unrelated">No date here</div>';

      const result = getEmailDate();
      expect(result).toBeUndefined();
    });

    it('returns undefined when container is empty', () => {
      mockContainer.innerHTML = '';

      const result = getEmailDate();
      expect(result).toBeUndefined();
    });

    it('skips spans with text too short to be dates', () => {
      mockContainer.innerHTML = `
        <div aria-label="Email message">
          <span>Hi</span>
        </div>
      `;

      const result = getEmailDate();
      expect(result).toBeUndefined();
    });

    it('skips spans with text too long to be dates', () => {
      const longText = 'A'.repeat(60);
      mockContainer.innerHTML = `
        <div aria-label="Email message">
          <span>${longText}</span>
        </div>
      `;

      const result = getEmailDate();
      expect(result).toBeUndefined();
    });

    it('handles invalid date strings gracefully', () => {
      mockContainer.innerHTML = `
        <div aria-label="Email message">
          <span>Not a valid date format at all</span>
        </div>
      `;

      const result = getEmailDate();
      expect(result).toBeUndefined();
    });

    it('handles error gracefully', () => {
      const mockQuerySelectorAll = vi
        .spyOn(document, 'querySelectorAll')
        .mockImplementation(() => {
          throw new Error('DOM error');
        });

      const result = getEmailDate();
      expect(result).toBeUndefined();

      mockQuerySelectorAll.mockRestore();
    });
  });

  describe('selector priority', () => {
    it('prefers time[datetime] over span text', () => {
      mockContainer.innerHTML = `
        <div aria-label="Email message">
          <time datetime="2024-01-01T00:00:00Z">Jan 1</time>
          <span>Feb 15, 2024</span>
        </div>
      `;

      const result = getEmailDate();
      expect(result).toBe('2024-01-01');
    });

    it('uses Email message container before data-app-section selectors', () => {
      mockContainer.innerHTML = `
        <div aria-label="Email message">
          <span>Jan 10, 2024</span>
        </div>
        <div data-app-section="DateTimeLine">Feb 20, 2024</div>
      `;

      const result = getEmailDate();
      expect(result).toBe('2024-01-10');
    });
  });
});

// =============================================================================
// URL Parsing Tests
// =============================================================================

describe('detectOutlookVariant', () => {
  it('detects personal variant from live.com', () => {
    expect(detectOutlookVariant('outlook.live.com')).toBe('personal');
  });

  it('detects business variant from office.com', () => {
    expect(detectOutlookVariant('outlook.office.com')).toBe('business');
  });

  it('detects office365 variant from office365.com', () => {
    expect(detectOutlookVariant('outlook.office365.com')).toBe('office365');
  });

  it('defaults to business for unknown outlook domains', () => {
    expect(detectOutlookVariant('outlook.com')).toBe('business');
  });
});

describe('parseOutlookUrl', () => {
  describe('live.com (personal)', () => {
    it('extracts itemId from inbox URL', () => {
      const url =
        'https://outlook.live.com/mail/0/inbox/id/AQMkADAwATM0MDAAMS0wNGFmLTgzNzUtMDACLTAwCgBGAAAD';
      const result = parseOutlookUrl(url);

      expect(result.variant).toBe('personal');
      expect(result.itemId).toBe(
        'AQMkADAwATM0MDAAMS0wNGFmLTgzNzUtMDACLTAwCgBGAAAD'
      );
      expect(result.permanentUrl).toContain(
        'AQMkADAwATM0MDAAMS0wNGFmLTgzNzUtMDACLTAwCgBGAAAD'
      );
    });

    it('extracts itemId from sentitems URL', () => {
      const url = 'https://outlook.live.com/mail/0/sentitems/id/ABC123xyz';
      const result = parseOutlookUrl(url);

      expect(result.variant).toBe('personal');
      expect(result.itemId).toBe('ABC123xyz');
    });

    it('extracts itemId from drafts URL', () => {
      const url = 'https://outlook.live.com/mail/0/drafts/id/DraftItem456';
      const result = parseOutlookUrl(url);

      expect(result.variant).toBe('personal');
      expect(result.itemId).toBe('DraftItem456');
    });

    it('handles URL-encoded itemId', () => {
      const url =
        'https://outlook.live.com/mail/0/inbox/id/AQMkADAwATM0MDAAMS0%2B';
      const result = parseOutlookUrl(url);

      expect(result.itemId).toBe('AQMkADAwATM0MDAAMS0+');
    });
  });

  describe('office.com (business)', () => {
    it('extracts itemId from inbox URL', () => {
      const url =
        'https://outlook.office.com/mail/inbox/id/AAMkAGI2THVSAAA%3D';
      const result = parseOutlookUrl(url);

      expect(result.variant).toBe('business');
      expect(result.itemId).toBe('AAMkAGI2THVSAAA=');
      expect(result.permanentUrl).toContain('AAMkAGI2THVSAAA%3D');
    });

    it('extracts itemId from archive URL', () => {
      const url =
        'https://outlook.office.com/mail/archive/id/BusinessArchive123';
      const result = parseOutlookUrl(url);

      expect(result.variant).toBe('business');
      expect(result.itemId).toBe('BusinessArchive123');
    });

    it('handles itemId with special characters', () => {
      const url =
        'https://outlook.office.com/mail/inbox/id/AAMkAGI2%2FTHVSAAA%3D';
      const result = parseOutlookUrl(url);

      expect(result.itemId).toBe('AAMkAGI2/THVSAAA=');
    });
  });

  describe('office365.com', () => {
    it('extracts itemId from inbox URL', () => {
      const url =
        'https://outlook.office365.com/mail/inbox/id/O365ItemId789';
      const result = parseOutlookUrl(url);

      expect(result.variant).toBe('office365');
      expect(result.itemId).toBe('O365ItemId789');
    });

    it('extracts itemId from folder URL', () => {
      const url =
        'https://outlook.office365.com/mail/folder/id/CustomFolderItem';
      const result = parseOutlookUrl(url);

      expect(result.variant).toBe('office365');
      expect(result.itemId).toBe('CustomFolderItem');
    });

    it('handles complex Base64-like itemId', () => {
      const url =
        'https://outlook.office365.com/mail/inbox/id/AAMkAGRhNmFlNWUyLTIzMTAtNGY4Ny05MTBkLWY4NzdhYTU0ZTUxYgBGAAAAAAC';
      const result = parseOutlookUrl(url);

      expect(result.itemId).toBe(
        'AAMkAGRhNmFlNWUyLTIzMTAtNGY4Ny05MTBkLWY4NzdhYTU0ZTUxYgBGAAAAAAC'
      );
    });
  });

  describe('permanent link generation', () => {
    it('generates office365.com/owa format link for personal', () => {
      const url =
        'https://outlook.live.com/mail/0/inbox/id/PersonalItem123';
      const result = parseOutlookUrl(url);

      expect(result.permanentUrl).toBe(
        'https://outlook.office365.com/owa/?ItemID=PersonalItem123&exvsurl=1&viewmodel=ReadMessageItem'
      );
    });

    it('generates office365.com/owa format link for business', () => {
      const url =
        'https://outlook.office.com/mail/inbox/id/BusinessItem456';
      const result = parseOutlookUrl(url);

      expect(result.permanentUrl).toBe(
        'https://outlook.office365.com/owa/?ItemID=BusinessItem456&exvsurl=1&viewmodel=ReadMessageItem'
      );
    });

    it('generates office365.com/owa format link for office365', () => {
      const url =
        'https://outlook.office365.com/mail/inbox/id/O365Item789';
      const result = parseOutlookUrl(url);

      expect(result.permanentUrl).toBe(
        'https://outlook.office365.com/owa/?ItemID=O365Item789&exvsurl=1&viewmodel=ReadMessageItem'
      );
    });

    it('encodes itemId in permanent URL', () => {
      const url =
        'https://outlook.office.com/mail/inbox/id/Item%2BWith%2FSpecial%3D';
      const result = parseOutlookUrl(url);

      expect(result.permanentUrl).toContain(
        'ItemID=Item%2BWith%2FSpecial%3D'
      );
    });
  });

  describe('ItemID query parameter pattern', () => {
    it('extracts itemId from ItemID query parameter', () => {
      const url =
        'https://outlook.office365.com/owa/?ItemID=QueryParamItem123&exvsurl=1';
      const result = parseOutlookUrl(url);

      expect(result.itemId).toBe('QueryParamItem123');
    });

    it('extracts itemId from encoded ItemID query parameter', () => {
      const url =
        'https://outlook.office365.com/owa/?ItemID=AAMkAGI2%3D&viewmodel=ReadMessageItem';
      const result = parseOutlookUrl(url);

      expect(result.itemId).toBe('AAMkAGI2=');
    });
  });

  describe('exvsurl pattern', () => {
    it('extracts itemId from exvsurl parameter', () => {
      const encodedUrl = encodeURIComponent(
        'https://outlook.office365.com/owa/?ItemID=ExvsItem789'
      );
      const url = `https://outlook.office.com/mail/?exvsurl=${encodedUrl}`;
      const result = parseOutlookUrl(url);

      expect(result.itemId).toBe('ExvsItem789');
    });
  });

  describe('fallback when no ItemID found', () => {
    it('returns null itemId for inbox list view', () => {
      const url = 'https://outlook.live.com/mail/0/inbox';
      const result = parseOutlookUrl(url);

      expect(result.variant).toBe('personal');
      expect(result.itemId).toBeNull();
      expect(result.permanentUrl).toBe(url);
    });

    it('returns null itemId for all mail list view', () => {
      const url = 'https://outlook.office.com/mail/all';
      const result = parseOutlookUrl(url);

      expect(result.itemId).toBeNull();
      expect(result.permanentUrl).toBe(url);
    });

    it('returns null itemId for search results without selected email', () => {
      const url = 'https://outlook.office365.com/mail/search/meeting';
      const result = parseOutlookUrl(url);

      expect(result.itemId).toBeNull();
      expect(result.permanentUrl).toBe(url);
    });

    it('returns null itemId for compose view', () => {
      const url = 'https://outlook.live.com/mail/0/deeplink/compose';
      const result = parseOutlookUrl(url);

      expect(result.itemId).toBeNull();
      expect(result.permanentUrl).toBe(url);
    });

    it('returns null itemId for settings view', () => {
      const url = 'https://outlook.office.com/mail/options/general';
      const result = parseOutlookUrl(url);

      expect(result.itemId).toBeNull();
      expect(result.permanentUrl).toBe(url);
    });

    it('returns original URL as permanentUrl when no itemId', () => {
      const url = 'https://outlook.live.com/mail/0/inbox';
      const result = parseOutlookUrl(url);

      expect(result.permanentUrl).toBe(url);
    });
  });

  describe('edge cases', () => {
    it('handles itemId with underscores and hyphens', () => {
      const url =
        'https://outlook.office.com/mail/inbox/id/AAMk_AGI2-THVSAAA';
      const result = parseOutlookUrl(url);

      expect(result.itemId).toBe('AAMk_AGI2-THVSAAA');
    });

    it('handles very long itemId', () => {
      const longId = 'A'.repeat(100);
      const url = `https://outlook.office.com/mail/inbox/id/${longId}`;
      const result = parseOutlookUrl(url);

      expect(result.itemId).toBe(longId);
    });

    it('handles URL with query parameters after path', () => {
      const url =
        'https://outlook.live.com/mail/0/inbox/id/ABC123?compose=new';
      const result = parseOutlookUrl(url);

      expect(result.itemId).toBe('ABC123');
    });

    it('handles different folder depths', () => {
      const url =
        'https://outlook.office.com/mail/subfolder/nested/id/DeepFolderItem';
      const result = parseOutlookUrl(url);

      expect(result.itemId).toBe('DeepFolderItem');
    });
  });
});
