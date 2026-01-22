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
  // Method 1: Look for subject in the reading pane header (modern Outlook)
  // The subject is in a div with role="heading" and class containing "allowTextSelection"
  const subjectHeading = document.querySelector('div[role="heading"].allowTextSelection');
  if (subjectHeading) {
    // Get the span children to find the actual subject text (excludes "Summarize" button etc.)
    const spans = subjectHeading.querySelectorAll('span');
    for (const span of spans) {
      const text = span.textContent?.trim();
      // Subject should be reasonably long and not contain UI button text
      if (text && text.length > 5 && text.length < 500 && !text.includes('Summarize')) {
        return text;
      }
    }
    // Fallback: use heading text but clean it up
    const headingText = subjectHeading.textContent?.trim();
    if (headingText) {
      // Remove "Summarize" button text if present
      const cleaned = headingText.replace(/Summarize$/, '').trim();
      if (cleaned.length > 0 && cleaned.length < 500) {
        return cleaned;
      }
    }
  }

  // Method 2: Legacy selectors for older Outlook versions
  const legacySelectors = [
    '[data-app-section="ConversationTopic"]',
    '.ms-font-xl.allowTextSelection',
    'span[id*="SubjectLine"]',
  ];

  for (const selector of legacySelectors) {
    const element = document.querySelector(selector);
    if (element && element.textContent) {
      const text = element.textContent.trim();
      if (text && text.length > 0 && text.length < 500) {
        return text;
      }
    }
  }

  // Method 3: Try document title (often contains subject)
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
    // Primary method: Find all "Message body" elements and return the one with content
    // Outlook often has multiple (e.g., draft + actual email), we need the one with text
    const messageBodies = document.querySelectorAll('[aria-label="Message body"]');
    for (const element of messageBodies) {
      const text = element.textContent?.trim();
      if (text && text.length > 0) {
        console.debug('[Asana Extension] Outlook body extracted using [aria-label="Message body"]');
        return text.length > 1000 ? text.substring(0, 1000) : text;
      }
    }

    // Fallback: Try role="document" elements that might contain email content
    const documents = document.querySelectorAll('[role="document"]');
    for (const element of documents) {
      const text = element.textContent?.trim();
      if (text && text.length > 50) {
        console.debug('[Asana Extension] Outlook body extracted using [role="document"]');
        return text.length > 1000 ? text.substring(0, 1000) : text;
      }
    }

    // Legacy fallback selectors (may work on older Outlook versions)
    const legacySelectors = [
      '[data-app-section="ConversationReadingPane"]',
    ];

    for (const selector of legacySelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent) {
        const text = element.textContent.trim();
        if (text && text.length > 0) {
          console.debug(`[Asana Extension] Outlook body extracted using selector: ${selector}`);
          return text.length > 1000 ? text.substring(0, 1000) : text;
        }
      }
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
    // Method 1: Look for span with aria-label starting with "From:" inside email message
    // This contains the sender in format "Name<email@domain.com>"
    const emailMessageContainers = document.querySelectorAll('[aria-label="Email message"]');
    for (const container of emailMessageContainers) {
      const fromSpan = container.querySelector('span[aria-label^="From:"]');
      if (fromSpan) {
        const text = fromSpan.textContent?.trim();
        if (text && text.length > 0 && text.length < 200) {
          // Extract just the name part before < if present
          if (text.includes('<') && text.includes('@')) {
            const namePart = text.split('<')[0].trim();
            if (namePart && namePart.length > 0) {
              console.debug('[Asana Extension] Outlook sender name extracted from From span');
              return namePart;
            }
          }
          console.debug('[Asana Extension] Outlook sender extracted from From span');
          return text;
        }
      }
    }

    // Method 2: Look for headings containing email pattern (Name<email@domain.com>)
    // within email message containers
    for (const container of emailMessageContainers) {
      const headings = container.querySelectorAll('[role="heading"] span, [role="heading"]');
      for (const heading of headings) {
        const text = heading.textContent?.trim();
        if (text && text.includes('<') && text.includes('@') && text.includes('>')) {
          const namePart = text.split('<')[0].trim();
          if (namePart && namePart.length > 0) {
            console.debug('[Asana Extension] Outlook sender extracted from heading pattern');
            return namePart;
          }
          return text;
        }
      }
    }

    // Method 3: Legacy selectors for older Outlook versions
    const legacySelectors = [
      '[data-app-section="FromLine"] span',
      'span[id*="PersonaName"]',
    ];

    for (const selector of legacySelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent) {
        const text = element.textContent.trim();
        if (text && text.length > 0 && text.length < 200) {
          console.debug(`[Asana Extension] Outlook sender extracted using selector: ${selector}`);
          return text;
        }
      }
    }

    // Method 4: Email fallback - look for any element with email in aria-label
    const emailElements = document.querySelectorAll('[role="img"][aria-label*="@"], button[aria-label*="@"]');
    for (const element of emailElements) {
      const ariaLabel = element.getAttribute('aria-label');
      if (ariaLabel) {
        const emailMatch = ariaLabel.match(/[\w.+-]+@[\w.-]+\.\w+/);
        if (emailMatch) {
          console.debug('[Asana Extension] Outlook sender extracted from aria-label email');
          return emailMatch[0];
        }
      }
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
