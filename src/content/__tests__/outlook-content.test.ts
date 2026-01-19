/**
 * Unit tests for Outlook URL parsing
 */

import { describe, it, expect } from 'vitest';
import { parseOutlookUrl, detectOutlookVariant } from '../outlook-content.js';

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
      const url =
        'https://outlook.live.com/mail/0/sentitems/id/ABC123xyz';
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
