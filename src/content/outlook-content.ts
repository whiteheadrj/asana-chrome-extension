/**
 * Outlook Content Script
 *
 * Extracts email information from Outlook pages for creating Asana tasks.
 * Handles all 3 Outlook variants: personal (live.com), business (office.com), office365.com
 */

import type { OutlookEmailInfo, OutlookVariant } from '../shared/types.js';

// =============================================================================
// URL Parsing
// =============================================================================

/**
 * Detect Outlook variant from hostname
 *
 * @param hostname The hostname to check
 * @returns The Outlook variant
 */
export function detectOutlookVariant(hostname: string): OutlookVariant {
  if (hostname.includes('live.com')) {
    return 'personal';
  }
  if (hostname.includes('office365.com')) {
    return 'office365';
  }
  // Default to business for office.com and any other outlook domains
  return 'business';
}

/**
 * Parse an Outlook URL to extract ItemID and variant
 *
 * Handles these URL patterns:
 * - Personal: https://outlook.live.com/mail/0/inbox/id/{ItemID}
 * - Business: https://outlook.office.com/mail/inbox/id/{ItemID}
 * - Office 365: https://outlook.office365.com/mail/inbox/id/{ItemID}
 *
 * Also handles:
 * - Different folder paths (inbox, sentitems, drafts, etc.)
 * - URL-encoded ItemIDs
 * - Query parameters
 *
 * @param url The Outlook URL to parse
 * @returns Object containing variant, itemId, and permanent URL
 */
export function parseOutlookUrl(url: string): {
  variant: OutlookVariant;
  itemId: string | null;
  permanentUrl: string;
} {
  const urlObj = new URL(url);
  const hostname = urlObj.hostname;
  const pathname = urlObj.pathname;

  // Determine variant
  const variant = detectOutlookVariant(hostname);

  // Extract ItemID from path after /id/
  // The ItemID is URL-encoded and may contain special characters
  let itemId: string | null = null;

  // Pattern 1: Path contains /id/{ItemID}
  const idPathMatch = pathname.match(/\/id\/([^/]+)/);
  if (idPathMatch) {
    // Decode the ItemID (may be URL-encoded)
    itemId = decodeURIComponent(idPathMatch[1]);
  }

  // Pattern 2: ItemID might be in query parameter
  if (!itemId) {
    const itemIdParam = urlObj.searchParams.get('ItemID');
    if (itemIdParam) {
      itemId = decodeURIComponent(itemIdParam);
    }
  }

  // Pattern 3: Check for viewmodel=ReadMessageItem pattern with ItemID
  if (!itemId) {
    const exvsurl = urlObj.searchParams.get('exvsurl');
    if (exvsurl) {
      try {
        const exvsurlObj = new URL(decodeURIComponent(exvsurl));
        const exvsItemId = exvsurlObj.searchParams.get('ItemID');
        if (exvsItemId) {
          itemId = decodeURIComponent(exvsItemId);
        }
      } catch {
        // Ignore URL parsing errors
      }
    }
  }

  // Build permanent deep link using office365.com/owa format
  // This format is more stable across Outlook variants
  const permanentUrl = itemId
    ? `https://outlook.office365.com/owa/?ItemID=${encodeURIComponent(itemId)}&exvsurl=1&viewmodel=ReadMessageItem`
    : url;

  return { variant, itemId, permanentUrl };
}

// =============================================================================
// DOM Detection Functions
// =============================================================================

/**
 * Try to extract the email subject from the DOM
 *
 * @returns The subject or undefined if not found
 */
export function getEmailSubject(): string | undefined {
  // Method 1: Look for the subject in the reading pane header
  // Outlook uses various class names for the subject line
  const subjectSelectors = [
    '[data-app-section="ConversationTopic"]',
    '[role="heading"][aria-level="2"]',
    '.ms-font-xl.allowTextSelection',
    '.hcptT', // Subject in message list
    'span[id*="SubjectLine"]',
    '[aria-label*="Subject"]',
  ];

  for (const selector of subjectSelectors) {
    const element = document.querySelector(selector);
    if (element && element.textContent) {
      const text = element.textContent.trim();
      if (text && text.length > 0 && text.length < 500) {
        return text;
      }
    }
  }

  // Method 2: Try document title (often contains subject)
  const title = document.title;
  if (title && !title.includes('Outlook') && !title.includes('Mail')) {
    // Outlook title format is often "Subject - Outlook"
    const parts = title.split(' - ');
    if (parts.length > 0 && parts[0]) {
      return parts[0].trim();
    }
  }

  return undefined;
}

/**
 * Try to extract the email body from the DOM
 *
 * @returns The email body text (truncated to 1000 chars) or undefined if not found
 */
export function getEmailBody(): string | undefined {
  try {
    const bodySelectors = [
      '[data-app-section="ConversationReadingPane"]',
      '.XbIp4.jmmB7.GNqVo',
      '[aria-label="Message body"]',
    ];

    for (const selector of bodySelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent) {
        const text = element.textContent.trim();
        if (text && text.length > 0) {
          console.debug(`[Asana Extension] Outlook body extracted using selector: ${selector}`);
          // Truncate to 1000 chars
          return text.length > 1000 ? text.substring(0, 1000) : text;
        }
      }
      console.debug(`[Asana Extension] Outlook body selector failed: ${selector}`);
    }

    console.debug('[Asana Extension] Could not extract email body from Outlook DOM - all selectors failed');
    return undefined;
  } catch (error) {
    console.debug('[Asana Extension] Error extracting email body from Outlook DOM:', error);
    return undefined;
  }
}

/**
 * Try to extract the sender information from the DOM
 *
 * Returns the most specific value available: name is preferred over email.
 *
 * @returns The sender email or name, or undefined if not found
 */
export function getSenderInfo(): string | undefined {
  try {
    // Name selectors (preferred - return name when available)
    const nameSelectors = [
      '[data-app-section="FromLine"] span',
      'span[id*="PersonaName"]',
      '.OZZZK', // Sender name class
      '[aria-label*="From"]',
    ];

    // Email fallback selectors (use when name not available)
    const emailSelectors = [
      '[role="img"][aria-label*="@"]',
      'button[aria-label*="@"]',
    ];

    // Try name selectors first
    for (const selector of nameSelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent) {
        const text = element.textContent.trim();
        if (text && text.length > 0 && text.length < 200) {
          console.debug(`[Asana Extension] Outlook sender extracted using selector: ${selector}`);
          return text;
        }
      }
      console.debug(`[Asana Extension] Outlook sender selector failed: ${selector}`);
    }

    // Fall back to email selectors
    for (const selector of emailSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        // Extract email from aria-label attribute
        const ariaLabel = element.getAttribute('aria-label');
        if (ariaLabel) {
          // Extract email address from aria-label (e.g., "Profile picture of john@example.com")
          const emailMatch = ariaLabel.match(/[\w.+-]+@[\w.-]+\.\w+/);
          if (emailMatch) {
            console.debug(`[Asana Extension] Outlook sender extracted using selector: ${selector} (email match)`);
            return emailMatch[0];
          }
        }
      }
      console.debug(`[Asana Extension] Outlook sender selector failed: ${selector}`);
    }

    console.debug('[Asana Extension] Could not extract sender info from Outlook DOM - all selectors failed');
    return undefined;
  } catch (error) {
    console.debug('[Asana Extension] Error extracting sender info from Outlook DOM:', error);
    return undefined;
  }
}

// =============================================================================
// Main Outlook Email Info Extraction
// =============================================================================

/**
 * Get complete Outlook email information
 *
 * @returns OutlookEmailInfo object with all available data
 */
export function getOutlookEmailInfo(): OutlookEmailInfo {
  const url = window.location.href;
  const { variant, itemId, permanentUrl } = parseOutlookUrl(url);

  // Extract additional email context
  const subject = getEmailSubject();
  const emailBody = getEmailBody();
  const emailSender = getSenderInfo();

  return {
    itemId,
    variant,
    permanentUrl,
    subject,
    emailBody,
    emailSender,
  };
}

// =============================================================================
// Message Listener
// =============================================================================

/**
 * Listen for messages from the popup requesting Outlook info
 */
chrome.runtime.onMessage.addListener(
  (
    message: { type: string },
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: OutlookEmailInfo) => void
  ) => {
    if (message.type === 'GET_PAGE_INFO') {
      const info = getOutlookEmailInfo();
      sendResponse(info);
      return true; // Keep the message channel open for async response
    }
    return false;
  }
);

// =============================================================================
// Initialization
// =============================================================================

// Log that content script loaded (for debugging)
console.debug('[Asana Extension] Outlook content script loaded');
