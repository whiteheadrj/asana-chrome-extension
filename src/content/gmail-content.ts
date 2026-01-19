/**
 * Gmail Content Script
 *
 * Extracts email information from Gmail pages for creating Asana tasks.
 * Handles URL parsing for inbox, all, sent, and search views.
 * Includes warning detection for account reorder and confidential mode.
 */

import type { GmailEmailInfo, EmailAccountMapping, WarningType } from '../shared/types.js';
import { STORAGE_KEYS } from '../shared/constants.js';

// =============================================================================
// Types
// =============================================================================

export interface GmailWarning {
  type: WarningType;
  message: string;
}

export interface GmailEmailInfoWithWarnings extends GmailEmailInfo {
  warnings: GmailWarning[];
}

// =============================================================================
// URL Parsing
// =============================================================================

/**
 * Parse a Gmail URL to extract userId and messageId
 *
 * Handles these URL patterns:
 * - #inbox/{messageId}
 * - #all/{messageId}
 * - #sent/{messageId}
 * - #drafts/{messageId}
 * - #search/{query}/{messageId}
 * - #label/{label}/{messageId}
 * - #starred/{messageId}
 * - #snoozed/{messageId}
 * - #scheduled/{messageId}
 * - #category/{category}/{messageId}
 *
 * @param url The Gmail URL to parse
 * @returns Object containing userId, messageId, and permanent URL
 */
export function parseGmailUrl(url: string): {
  userId: string;
  messageId: string | null;
  permanentUrl: string;
} {
  const urlObj = new URL(url);

  // Extract userId from path: /mail/u/{userId}/
  const pathMatch = urlObj.pathname.match(/\/mail\/u\/(\d+)/);
  const userId = pathMatch ? pathMatch[1] : '0';

  // Extract messageId from hash
  // Pattern covers: #inbox/, #all/, #sent/, #drafts/, #search/query/, #label/name/, etc.
  const hash = urlObj.hash;
  let messageId: string | null = null;

  // Try different hash patterns
  // 1. Standard views: #inbox/{messageId}, #all/{messageId}, #sent/{messageId}, etc.
  // 2. Search view: #search/{query}/{messageId}
  // 3. Label view: #label/{labelName}/{messageId}
  // 4. Category view: #category/{categoryName}/{messageId}

  // Pattern for standard views (inbox, all, sent, drafts, starred, snoozed, scheduled)
  const standardMatch = hash.match(
    /#(?:inbox|all|sent|drafts|starred|snoozed|scheduled)\/([A-Za-z0-9_-]+)(?:[?&]|$)/
  );

  // Pattern for search view: #search/{query}/{messageId}
  const searchMatch = hash.match(
    /#search\/[^/]+\/([A-Za-z0-9_-]+)(?:[?&]|$)/
  );

  // Pattern for label view: #label/{labelName}/{messageId}
  const labelMatch = hash.match(
    /#label\/[^/]+\/([A-Za-z0-9_-]+)(?:[?&]|$)/
  );

  // Pattern for category view: #category/{categoryName}/{messageId}
  const categoryMatch = hash.match(
    /#category\/[^/]+\/([A-Za-z0-9_-]+)(?:[?&]|$)/
  );

  if (standardMatch) {
    messageId = standardMatch[1];
  } else if (searchMatch) {
    messageId = searchMatch[1];
  } else if (labelMatch) {
    messageId = labelMatch[1];
  } else if (categoryMatch) {
    messageId = categoryMatch[1];
  }

  // Build permanent URL using #all/{messageId} for stability
  // #all/ view works regardless of which folder the email is in
  const permanentUrl = messageId
    ? `https://mail.google.com/mail/u/${userId}/#all/${messageId}`
    : url;

  return { userId, messageId, permanentUrl };
}

// =============================================================================
// DOM Detection Functions
// =============================================================================

/**
 * Detect the current account email from Gmail's DOM
 * Looks for the profile/account element that shows the logged-in email
 *
 * @returns The email address or null if not found
 */
export function detectAccountEmail(): string | null {
  // Try multiple selectors as Gmail DOM may vary

  // Method 1: Account chooser button (most reliable)
  const accountButton = document.querySelector(
    'a[aria-label*="@"][href*="accounts.google.com"]'
  );
  if (accountButton) {
    const ariaLabel = accountButton.getAttribute('aria-label');
    if (ariaLabel) {
      const emailMatch = ariaLabel.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      if (emailMatch) {
        return emailMatch[0];
      }
    }
  }

  // Method 2: Profile image with data-email attribute
  const profileImg = document.querySelector('img[data-email]');
  if (profileImg) {
    const email = profileImg.getAttribute('data-email');
    if (email) {
      return email;
    }
  }

  // Method 3: GB_Ca class element (Gmail specific)
  const gbElement = document.querySelector('.gb_Ca, .gb_Da, .gb_Ea');
  if (gbElement && gbElement.textContent) {
    const emailMatch = gbElement.textContent.match(
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
    );
    if (emailMatch) {
      return emailMatch[0];
    }
  }

  // Method 4: Check the header account area
  const headerAccount = document.querySelector('[data-email]');
  if (headerAccount) {
    const email = headerAccount.getAttribute('data-email');
    if (email) {
      return email;
    }
  }

  return null;
}

/**
 * Check if the current email is in confidential mode
 * Gmail confidential mode emails have specific UI indicators
 *
 * @returns true if confidential mode is detected
 */
export function checkConfidentialMode(): boolean {
  // Look for confidential mode indicators in the email view

  // Method 1: Look for the confidential mode banner/icon
  const confidentialBanner = document.querySelector(
    '[data-tooltip*="confidential"], [aria-label*="confidential"], [title*="confidential"]'
  );
  if (confidentialBanner) {
    return true;
  }

  // Method 2: Look for the "Expires" text that appears in confidential emails
  const expiresText = document.querySelector('.aQH');
  if (expiresText && expiresText.textContent?.toLowerCase().includes('expires')) {
    return true;
  }

  // Method 3: Look for the lock icon with confidential styling
  const lockIcon = document.querySelector('.aQG');
  if (lockIcon) {
    return true;
  }

  // Method 4: Check for confidential mode container
  const confidentialContainer = document.querySelector(
    '[data-message-id] .aHU, .a3s.aiL'
  );
  if (confidentialContainer) {
    const text = confidentialContainer.textContent?.toLowerCase() || '';
    if (
      text.includes('confidential mode') ||
      text.includes('content expires') ||
      text.includes('passcode required')
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Try to extract the email body from the DOM
 *
 * @returns The email body text truncated to 1000 chars, or undefined if not found
 */
export function getEmailBody(): string | undefined {
  // Selectors for Gmail email body, in order of preference
  const selectors = [
    '.a3s.aiL',                    // Standard email body container
    '[data-message-id] .ii.gt',   // Alternative email body selector
    '.adn.ads',                    // Another email body container
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element && element.textContent) {
      const bodyText = element.textContent.trim();
      if (bodyText) {
        // Truncate to 1000 characters
        return bodyText.length > 1000 ? bodyText.substring(0, 1000) : bodyText;
      }
    }
  }

  console.debug('[Asana Extension] Could not extract email body from Gmail DOM');
  return undefined;
}

/**
 * Try to extract the email subject from the DOM
 *
 * @returns The subject or undefined if not found
 */
export function getEmailSubject(): string | undefined {
  // Method 1: Look for the subject in the conversation view header
  const subjectElement = document.querySelector(
    'h2.hP, .ha h2, [data-legacy-thread-id] h2'
  );
  if (subjectElement && subjectElement.textContent) {
    return subjectElement.textContent.trim();
  }

  // Method 2: Look for the subject in the email header area
  const subjectHeader = document.querySelector('.aYA h2, .aYp h2');
  if (subjectHeader && subjectHeader.textContent) {
    return subjectHeader.textContent.trim();
  }

  // Method 3: Try document title (often contains subject)
  const title = document.title;
  if (title && !title.startsWith('Gmail') && title !== 'Inbox') {
    // Gmail title format is often "Subject - email@domain - Gmail"
    const parts = title.split(' - ');
    if (parts.length > 1 && parts[0]) {
      return parts[0].trim();
    }
  }

  return undefined;
}

// =============================================================================
// Email-to-UserId Cache Mapping
// =============================================================================

/**
 * Get cached email-to-userId mapping from storage
 */
async function getCachedEmailMapping(): Promise<EmailAccountMapping[]> {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEYS.EMAIL_ACCOUNT_MAPPING], (result) => {
      resolve(result[STORAGE_KEYS.EMAIL_ACCOUNT_MAPPING] || []);
    });
  });
}

/**
 * Save email-to-userId mapping to storage
 */
async function saveCachedEmailMapping(mappings: EmailAccountMapping[]): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEYS.EMAIL_ACCOUNT_MAPPING]: mappings }, () => {
      resolve();
    });
  });
}

/**
 * Update email-to-userId cache with current values
 * Returns true if the mapping already existed with a different userId (reorder detected)
 */
async function updateEmailMapping(email: string, userId: string): Promise<boolean> {
  const mappings = await getCachedEmailMapping();
  const existingIndex = mappings.findIndex(m => m.email === email);

  let reorderDetected = false;

  if (existingIndex >= 0) {
    const existing = mappings[existingIndex];
    // Reorder detected if same email has different userId
    if (existing.userId !== userId) {
      reorderDetected = true;
    }
    // Update the existing entry
    mappings[existingIndex] = {
      email,
      userId,
      timestamp: Date.now(),
    };
  } else {
    // Add new mapping
    mappings.push({
      email,
      userId,
      timestamp: Date.now(),
    });
  }

  // Clean up old mappings (older than 30 days)
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
  const filteredMappings = mappings.filter(m => m.timestamp > thirtyDaysAgo);

  await saveCachedEmailMapping(filteredMappings);

  return reorderDetected;
}

// =============================================================================
// Warning Detection
// =============================================================================

/**
 * Check for Gmail-specific warnings (account reorder, confidential mode)
 */
async function detectWarnings(
  email: string | null,
  userId: string,
  isConfidentialMode: boolean
): Promise<GmailWarning[]> {
  const warnings: GmailWarning[] = [];

  // Check for account reorder
  if (email) {
    const reorderDetected = await updateEmailMapping(email, userId);
    if (reorderDetected) {
      warnings.push({
        type: 'gmail_account_reorder',
        message: `Gmail account order may have changed. The email link uses account index ${userId}. Please verify the link opens the correct email after creating the task.`,
      });
    }
  }

  // Check for confidential mode
  if (isConfidentialMode) {
    warnings.push({
      type: 'gmail_confidential',
      message: 'This email is in confidential mode. The link may not work for other users or may expire.',
    });
  }

  return warnings;
}

// =============================================================================
// Main Gmail Email Info Extraction
// =============================================================================

/**
 * Get complete Gmail email information
 *
 * @returns GmailEmailInfo object with all available data
 */
export function getGmailEmailInfo(): GmailEmailInfo {
  const url = window.location.href;
  const { userId, messageId, permanentUrl } = parseGmailUrl(url);

  return {
    messageId,
    userId,
    accountEmail: detectAccountEmail(),
    permanentUrl,
    isConfidentialMode: checkConfidentialMode(),
    subject: getEmailSubject(),
  };
}

/**
 * Get complete Gmail email information with warnings
 * This is the async version that also checks for edge cases
 *
 * @returns GmailEmailInfoWithWarnings object with all available data and warnings
 */
export async function getGmailEmailInfoWithWarnings(): Promise<GmailEmailInfoWithWarnings> {
  const url = window.location.href;
  const { userId, messageId, permanentUrl } = parseGmailUrl(url);
  const accountEmail = detectAccountEmail();
  const isConfidentialMode = checkConfidentialMode();
  const subject = getEmailSubject();

  // Detect warnings asynchronously
  const warnings = await detectWarnings(accountEmail, userId, isConfidentialMode);

  return {
    messageId,
    userId,
    accountEmail,
    permanentUrl,
    isConfidentialMode,
    subject,
    warnings,
  };
}

// =============================================================================
// Message Listener
// =============================================================================

/**
 * Listen for messages from the popup requesting Gmail info
 */
chrome.runtime.onMessage.addListener(
  (
    message: { type: string },
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: GmailEmailInfoWithWarnings) => void
  ) => {
    if (message.type === 'GET_PAGE_INFO') {
      // Use async version to include warning detection
      getGmailEmailInfoWithWarnings()
        .then((info) => {
          sendResponse(info);
        })
        .catch((error) => {
          console.error('[Asana Extension] Error getting Gmail info:', error);
          // Fall back to sync version without warnings
          const basicInfo = getGmailEmailInfo();
          sendResponse({ ...basicInfo, warnings: [] });
        });
      return true; // Keep the message channel open for async response
    }
    return false;
  }
);

// =============================================================================
// Initialization
// =============================================================================

// Log that content script loaded (for debugging)
console.debug('[Asana Extension] Gmail content script loaded');
