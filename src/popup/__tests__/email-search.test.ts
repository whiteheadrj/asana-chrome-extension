/**
 * Unit tests for email search string builders
 * Tests buildGmailSearchString and buildOutlookSearchString functions
 */

import { describe, it, expect } from 'vitest';
import {
  buildGmailSearchString,
  buildOutlookSearchString,
  type EmailSearchParams,
} from '../email-search.js';

// =============================================================================
// buildGmailSearchString Tests
// =============================================================================

describe('buildGmailSearchString', () => {
  describe('with all params', () => {
    it('builds search string with all parameters', () => {
      const params: EmailSearchParams = {
        senderEmail: 'john@example.com',
        subject: 'Q4 Budget Review',
        date: '2026-01-15',
      };

      const result = buildGmailSearchString(params);

      expect(result).toContain('from:john@example.com');
      expect(result).toContain('subject:"Q4 Budget Review"');
      expect(result).toContain('after:2026/01/15');
      expect(result).toContain('before:2026/01/16');
    });

    it('joins parts with spaces', () => {
      const params: EmailSearchParams = {
        senderEmail: 'test@example.com',
        subject: 'TestSubject', // No spaces in subject for clean split test
        date: '2026-03-20',
      };

      const result = buildGmailSearchString(params);

      // Should be space-separated: from:, subject:"", after:, before:
      const parts = result.split(' ');
      expect(parts.length).toBe(4); // from, subject (quoted), after, before
    });
  });

  describe('with missing params', () => {
    it('returns empty string when no params provided', () => {
      const result = buildGmailSearchString({});
      expect(result).toBe('');
    });

    it('builds search string with only senderEmail', () => {
      const params: EmailSearchParams = {
        senderEmail: 'sender@example.com',
      };

      const result = buildGmailSearchString(params);

      expect(result).toBe('from:sender@example.com');
    });

    it('builds search string with only subject', () => {
      const params: EmailSearchParams = {
        subject: 'Important Meeting',
      };

      const result = buildGmailSearchString(params);

      expect(result).toBe('subject:"Important Meeting"');
    });

    it('builds search string with only date', () => {
      const params: EmailSearchParams = {
        date: '2026-06-15',
      };

      const result = buildGmailSearchString(params);

      expect(result).toContain('after:2026/06/15');
      expect(result).toContain('before:2026/06/16');
    });

    it('builds search string with senderEmail and subject (no date)', () => {
      const params: EmailSearchParams = {
        senderEmail: 'alice@example.com',
        subject: 'Project Update',
      };

      const result = buildGmailSearchString(params);

      expect(result).toBe('from:alice@example.com subject:"Project Update"');
      expect(result).not.toContain('after:');
      expect(result).not.toContain('before:');
    });

    it('builds search string with senderEmail and date (no subject)', () => {
      const params: EmailSearchParams = {
        senderEmail: 'bob@example.com',
        date: '2026-02-28',
      };

      const result = buildGmailSearchString(params);

      expect(result).toContain('from:bob@example.com');
      expect(result).toContain('after:2026/02/28');
      expect(result).not.toContain('subject:');
    });

    it('builds search string with subject and date (no senderEmail)', () => {
      const params: EmailSearchParams = {
        subject: 'Weekly Report',
        date: '2026-12-01',
      };

      const result = buildGmailSearchString(params);

      expect(result).toContain('subject:"Weekly Report"');
      expect(result).toContain('after:2026/12/01');
      expect(result).not.toContain('from:');
    });
  });

  describe('date format conversion (ISO to Gmail YYYY/MM/DD)', () => {
    it('converts ISO date format to Gmail format', () => {
      const params: EmailSearchParams = {
        date: '2026-01-15',
      };

      const result = buildGmailSearchString(params);

      // Gmail uses YYYY/MM/DD format
      expect(result).toContain('after:2026/01/15');
    });

    it('preserves leading zeros in month and day', () => {
      const params: EmailSearchParams = {
        date: '2026-03-05',
      };

      const result = buildGmailSearchString(params);

      expect(result).toContain('after:2026/03/05');
      expect(result).toContain('before:2026/03/06');
    });

    it('handles year-end dates correctly', () => {
      const params: EmailSearchParams = {
        date: '2026-12-31',
      };

      const result = buildGmailSearchString(params);

      expect(result).toContain('after:2026/12/31');
      // before should be next day (2027-01-01)
      expect(result).toContain('before:2027/01/01');
    });

    it('handles month-end dates correctly', () => {
      const params: EmailSearchParams = {
        date: '2026-01-31',
      };

      const result = buildGmailSearchString(params);

      expect(result).toContain('after:2026/01/31');
      expect(result).toContain('before:2026/02/01');
    });

    it('handles February dates correctly', () => {
      const params: EmailSearchParams = {
        date: '2026-02-28',
      };

      const result = buildGmailSearchString(params);

      expect(result).toContain('after:2026/02/28');
      expect(result).toContain('before:2026/03/01');
    });
  });

  describe('special character escaping in subject', () => {
    it('escapes double quotes in subject', () => {
      const params: EmailSearchParams = {
        subject: 'Re: "Important" Meeting',
      };

      const result = buildGmailSearchString(params);

      expect(result).toBe('subject:"Re: \\"Important\\" Meeting"');
    });

    it('handles multiple double quotes', () => {
      const params: EmailSearchParams = {
        subject: '"Hello" and "World"',
      };

      const result = buildGmailSearchString(params);

      expect(result).toBe('subject:"\\"Hello\\" and \\"World\\""');
    });

    it('handles subject with no special characters', () => {
      const params: EmailSearchParams = {
        subject: 'Simple Subject Line',
      };

      const result = buildGmailSearchString(params);

      expect(result).toBe('subject:"Simple Subject Line"');
    });

    it('handles subject with colons and brackets', () => {
      const params: EmailSearchParams = {
        subject: 'Re: [URGENT] Action Required!',
      };

      const result = buildGmailSearchString(params);

      expect(result).toBe('subject:"Re: [URGENT] Action Required!"');
    });

    it('handles subject with apostrophes', () => {
      const params: EmailSearchParams = {
        subject: "John's Project Update",
      };

      const result = buildGmailSearchString(params);

      expect(result).toBe('subject:"John\'s Project Update"');
    });
  });
});

// =============================================================================
// buildOutlookSearchString Tests
// =============================================================================

describe('buildOutlookSearchString', () => {
  describe('with all params', () => {
    it('builds search string with from and subject (date intentionally excluded)', () => {
      const params: EmailSearchParams = {
        senderEmail: 'jane@company.com',
        subject: 'Monthly Report',
        date: '2026-01-20',
      };

      const result = buildOutlookSearchString(params);

      expect(result).toContain('from:"jane@company.com"');
      expect(result).toContain('subject:"Monthly Report"');
      // Date is intentionally excluded as it's unreliable in Outlook search
      expect(result).not.toContain('received:');
    });

    it('joins parts with spaces', () => {
      const params: EmailSearchParams = {
        senderEmail: 'test@example.com',
        subject: 'Test',
        date: '2026-05-10',
      };

      const result = buildOutlookSearchString(params);

      const parts = result.split(' ');
      expect(parts.length).toBe(2); // from, subject (date excluded)
    });
  });

  describe('with missing params', () => {
    it('returns empty string when no params provided', () => {
      const result = buildOutlookSearchString({});
      expect(result).toBe('');
    });

    it('builds search string with only senderEmail', () => {
      const params: EmailSearchParams = {
        senderEmail: 'contact@example.com',
      };

      const result = buildOutlookSearchString(params);

      expect(result).toBe('from:"contact@example.com"');
    });

    it('builds search string with only subject', () => {
      const params: EmailSearchParams = {
        subject: 'Quarterly Review',
      };

      const result = buildOutlookSearchString(params);

      expect(result).toBe('subject:"Quarterly Review"');
    });

    it('returns empty string when only date provided (date is excluded)', () => {
      const params: EmailSearchParams = {
        date: '2026-07-04',
      };

      const result = buildOutlookSearchString(params);

      // Date is intentionally excluded as it's unreliable in Outlook search
      expect(result).toBe('');
    });

    it('builds search string with senderEmail and subject (no date)', () => {
      const params: EmailSearchParams = {
        senderEmail: 'manager@work.com',
        subject: 'Performance Review',
      };

      const result = buildOutlookSearchString(params);

      expect(result).toBe('from:"manager@work.com" subject:"Performance Review"');
      expect(result).not.toContain('received:');
    });

    it('builds search string with senderEmail only when date also provided', () => {
      const params: EmailSearchParams = {
        senderEmail: 'hr@company.com',
        date: '2026-09-15',
      };

      const result = buildOutlookSearchString(params);

      expect(result).toBe('from:"hr@company.com"');
      // Date is intentionally excluded
      expect(result).not.toContain('received:');
      expect(result).not.toContain('subject:');
    });

    it('builds search string with subject only when date also provided', () => {
      const params: EmailSearchParams = {
        subject: 'Invoice Attached',
        date: '2026-11-30',
      };

      const result = buildOutlookSearchString(params);

      expect(result).toBe('subject:"Invoice Attached"');
      // Date is intentionally excluded
      expect(result).not.toContain('received:');
      expect(result).not.toContain('from:');
    });
  });

  describe('special character escaping in subject', () => {
    it('escapes double quotes in subject', () => {
      const params: EmailSearchParams = {
        subject: 'FW: "Urgent" Request',
      };

      const result = buildOutlookSearchString(params);

      expect(result).toBe('subject:"FW: \\"Urgent\\" Request"');
    });

    it('handles multiple double quotes', () => {
      const params: EmailSearchParams = {
        subject: 'About "Project" and "Budget"',
      };

      const result = buildOutlookSearchString(params);

      expect(result).toBe('subject:"About \\"Project\\" and \\"Budget\\""');
    });

    it('handles subject with no special characters', () => {
      const params: EmailSearchParams = {
        subject: 'Team Meeting Notes',
      };

      const result = buildOutlookSearchString(params);

      expect(result).toBe('subject:"Team Meeting Notes"');
    });

    it('handles subject with colons and brackets', () => {
      const params: EmailSearchParams = {
        subject: 'RE: [External] Follow-up Required',
      };

      const result = buildOutlookSearchString(params);

      expect(result).toBe('subject:"RE: [External] Follow-up Required"');
    });

    it('handles subject with apostrophes', () => {
      const params: EmailSearchParams = {
        subject: "Sarah's Meeting Request",
      };

      const result = buildOutlookSearchString(params);

      expect(result).toBe('subject:"Sarah\'s Meeting Request"');
    });
  });
});

// =============================================================================
// Cross-function Comparison Tests
// =============================================================================

describe('Gmail vs Outlook format differences', () => {
  const commonParams: EmailSearchParams = {
    senderEmail: 'test@example.com',
    subject: 'Test Subject',
    date: '2026-01-05',
  };

  it('Gmail uses from: without quotes, Outlook uses from: with quotes', () => {
    const gmail = buildGmailSearchString(commonParams);
    const outlook = buildOutlookSearchString(commonParams);

    expect(gmail).toContain('from:test@example.com');
    expect(outlook).toContain('from:"test@example.com"');
  });

  it('Gmail includes date, Outlook excludes date (unreliable in Outlook search)', () => {
    const gmail = buildGmailSearchString(commonParams);
    const outlook = buildOutlookSearchString(commonParams);

    expect(gmail).toContain('after:');
    expect(gmail).toContain('before:');
    // Outlook intentionally excludes date as it's unreliable
    expect(outlook).not.toContain('received:');
    expect(outlook).not.toContain('after:');
    expect(outlook).not.toContain('before:');
  });

  it('Gmail includes date format YYYY/MM/DD, Outlook has no date', () => {
    const gmail = buildGmailSearchString(commonParams);
    const outlook = buildOutlookSearchString(commonParams);

    // Gmail format: 2026/01/05
    expect(gmail).toContain('2026/01/05');
    // Outlook excludes date entirely
    expect(outlook).not.toContain('2026');
  });
});
