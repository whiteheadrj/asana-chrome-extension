/**
 * Email search string builders for Gmail and Outlook
 * Generates search queries to find original emails in email clients
 */

// =============================================================================
// Types
// =============================================================================

export interface EmailSearchParams {
  senderEmail?: string;
  subject?: string;
  date?: string; // ISO date string (YYYY-MM-DD)
}

// =============================================================================
// Date Conversion Helpers
// =============================================================================

/**
 * Convert ISO date (YYYY-MM-DD) to Gmail format (YYYY/MM/DD)
 */
function toGmailDate(isoDate: string): string {
  // Replace hyphens with slashes
  return isoDate.replace(/-/g, '/');
}

// =============================================================================
// Search String Builders
// =============================================================================

/**
 * Build Gmail search string from email parameters
 * Format: from:email subject:"text" after:YYYY/MM/DD before:YYYY/MM/DD
 *
 * For date matching, we search for emails from the day before to the day after
 * to account for timezone differences.
 */
export function buildGmailSearchString(params: EmailSearchParams): string {
  const parts: string[] = [];

  if (params.senderEmail) {
    parts.push(`from:${params.senderEmail}`);
  }

  if (params.subject) {
    // Escape double quotes in subject
    const escapedSubject = params.subject.replace(/"/g, '\\"');
    parts.push(`subject:"${escapedSubject}"`);
  }

  if (params.date) {
    const gmailDate = toGmailDate(params.date);
    // Use same date for after and before to narrow down to that day
    // Gmail after: is exclusive (after this date), before: is exclusive (before this date)
    // So we use the day itself as the target - Gmail will find emails on that date
    parts.push(`after:${gmailDate}`);
    // Add one day for before: to include the target date
    const dateParts = params.date.split('-').map(Number);
    const nextDay = new Date(dateParts[0], dateParts[1] - 1, dateParts[2] + 1);
    const nextDayStr = `${nextDay.getFullYear()}/${String(nextDay.getMonth() + 1).padStart(2, '0')}/${String(nextDay.getDate()).padStart(2, '0')}`;
    parts.push(`before:${nextDayStr}`);
  }

  return parts.join(' ');
}

/**
 * Build Outlook search string from email parameters
 * Format: from:"email" subject:"text"
 * Note: received date is intentionally excluded as it's unreliable in Outlook search
 */
export function buildOutlookSearchString(params: EmailSearchParams): string {
  const parts: string[] = [];

  if (params.senderEmail) {
    parts.push(`from:"${params.senderEmail}"`);
  }

  if (params.subject) {
    // Escape double quotes in subject
    const escapedSubject = params.subject.replace(/"/g, '\\"');
    parts.push(`subject:"${escapedSubject}"`);
  }

  return parts.join(' ');
}
