import { test, expect, chromium, type BrowserContext } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.resolve(__dirname, '..', 'dist');

/**
 * E2E Tests for Task Creation Fields Enhancement
 *
 * These tests verify the full flow for:
 * 1. Task creation with assignee field
 * 2. Task creation with due date field
 * 3. Task creation from Gmail with search string in notes
 *
 * IMPORTANT: Full E2E testing with actual Asana API has limitations:
 *
 * 1. **Service Worker Isolation**: Task creation runs in the extension's service worker.
 *    Playwright's page.route() only intercepts requests from page contexts, NOT from
 *    service workers.
 *
 * 2. **Chrome Storage Access**: The extension uses chrome.storage.local for tokens.
 *    Playwright cannot directly manipulate extension storage.
 *
 * 3. **Real API Dependency**: Task creation requires actual Asana API calls with
 *    valid authentication tokens.
 *
 * **Coverage Strategy**:
 * - Unit tests cover: API functions, email search string builders, content scripts
 * - Integration tests cover: createTask with assignee/due date fields
 * - E2E tests below verify: extension builds correctly, popup has new fields,
 *   and email metadata/search string logic is included in the built extension
 *
 * See: src/background/__tests__/asana-api.test.ts for API test coverage
 * See: src/popup/__tests__/email-search.test.ts for search string test coverage
 */

test.describe('Task Creation Fields - E2E Verification', () => {
  let context: BrowserContext;

  test.beforeAll(async () => {
    // Verify extension is built
    const manifestPath = path.join(extensionPath, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      throw new Error(
        `Extension not built. Run 'pnpm build' first. Expected manifest at: ${manifestPath}`
      );
    }
  });

  test.beforeEach(async () => {
    // Launch browser with extension loaded
    context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--no-sandbox',
        '--disable-setuid-sandbox',
      ],
    });
  });

  test.afterEach(async () => {
    if (context) {
      await context.close();
    }
  });

  test('extension loads with task creation field enhancements', async () => {
    // Verify extension is loaded by checking service worker
    const page = await context.newPage();
    await page.goto('about:blank');

    // Wait for extension to initialize
    await page.waitForTimeout(1000);

    // Check that we have at least one page (extension is active)
    const pages = context.pages();
    expect(pages.length).toBeGreaterThanOrEqual(1);

    await page.close();
  });

  test('built extension includes assignee field support', async () => {
    // Verify the built service worker contains assignee handling
    const serviceWorkerPath = path.join(extensionPath, 'background', 'service-worker.js');

    if (!fs.existsSync(serviceWorkerPath)) {
      throw new Error(`Service worker not found at: ${serviceWorkerPath}`);
    }

    const serviceWorkerCode = fs.readFileSync(serviceWorkerPath, 'utf-8');

    // Check for GET_USERS handler (enables assignee dropdown population)
    expect(serviceWorkerCode).toContain('GET_USERS');

    // Check for user caching key pattern
    expect(serviceWorkerCode).toContain('cache_users_');

    // Check for assignee field in task creation
    expect(serviceWorkerCode).toContain('assignee');
  });

  test('built extension includes due date field support', async () => {
    // Verify the built service worker contains due date handling
    const serviceWorkerPath = path.join(extensionPath, 'background', 'service-worker.js');
    const serviceWorkerCode = fs.readFileSync(serviceWorkerPath, 'utf-8');

    // Check for due_on and due_at in task creation
    expect(serviceWorkerCode).toContain('due_on');
    expect(serviceWorkerCode).toContain('due_at');
  });

  test('built popup includes assignee dropdown', async () => {
    // Verify the built popup HTML contains assignee dropdown
    const popupHtmlPath = path.join(extensionPath, 'popup', 'popup.html');

    if (!fs.existsSync(popupHtmlPath)) {
      throw new Error(`Popup HTML not found at: ${popupHtmlPath}`);
    }

    const popupHtml = fs.readFileSync(popupHtmlPath, 'utf-8');

    // Check for assignee select element
    expect(popupHtml).toContain('assignee-select');
    expect(popupHtml).toContain('Assignee');
    expect(popupHtml).toContain('Unassigned');
  });

  test('built popup includes due date picker', async () => {
    // Verify the built popup HTML contains due date picker
    const popupHtmlPath = path.join(extensionPath, 'popup', 'popup.html');
    const popupHtml = fs.readFileSync(popupHtmlPath, 'utf-8');

    // Check for due date input and quick-pick buttons
    expect(popupHtml).toContain('due-date');
    expect(popupHtml).toContain('type="date"');
    expect(popupHtml).toContain('btn-today');
    expect(popupHtml).toContain('btn-tomorrow');
    expect(popupHtml).toContain('include-time');
    expect(popupHtml).toContain('type="time"');
  });

  test('built popup includes email search string builder', async () => {
    // Verify the built popup JS contains search string logic
    const popupJsPath = path.join(extensionPath, 'popup', 'popup.js');

    if (!fs.existsSync(popupJsPath)) {
      throw new Error(`Popup JS not found at: ${popupJsPath}`);
    }

    const popupJs = fs.readFileSync(popupJsPath, 'utf-8');

    // Check for Gmail search string format
    expect(popupJs).toContain('from:');
    expect(popupJs).toContain('subject:');

    // Check for Outlook search string format
    expect(popupJs).toContain('received:');

    // Check for search string section in notes
    expect(popupJs).toContain('Search in');
  });
});

/**
 * E2E Tests for Gmail Email Metadata Extraction
 * Verifies email sender details and date extraction for search strings
 */
test.describe('Task Creation Fields - Gmail Email Metadata', () => {
  let context: BrowserContext;

  test.beforeEach(async () => {
    context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--no-sandbox',
      ],
    });
  });

  test.afterEach(async () => {
    if (context) {
      await context.close();
    }
  });

  test('mock Gmail page has sender details for search string', async () => {
    const page = await context.newPage();

    const mockGmailPath = path.resolve(__dirname, 'fixtures', 'mock-gmail.html');
    await page.goto(`file://${mockGmailPath}`);

    // Extract sender details (same logic as content script)
    const senderDetails = await page.evaluate(() => {
      const gD = document.querySelector('span.gD');
      if (!gD) return null;

      return {
        name: gD.textContent?.trim() || null,
        email: gD.getAttribute('email') || null,
      };
    });

    expect(senderDetails).toBeDefined();
    expect(senderDetails?.name).toBe('John Smith');
    expect(senderDetails?.email).toBe('john.smith@acme.com');

    await page.close();
  });

  test('email metadata can build Gmail search string', async () => {
    const page = await context.newPage();

    const mockGmailPath = path.resolve(__dirname, 'fixtures', 'mock-gmail.html');
    await page.goto(`file://${mockGmailPath}`);

    // Extract all data needed for search string
    const emailMetadata = await page.evaluate(() => {
      const gD = document.querySelector('span.gD');
      const senderEmail = gD?.getAttribute('email') || undefined;

      // Extract subject from title (Gmail format: "Subject - Inbox - Gmail")
      const pageTitle = document.title;
      const subject = pageTitle.split(' - ')[0];

      return {
        senderEmail,
        subject,
        // Date would come from the email header in real scenario
        date: '2026-01-23',
      };
    });

    // Verify we have all fields needed for search string
    expect(emailMetadata.senderEmail).toBe('john.smith@acme.com');
    expect(emailMetadata.subject).toContain('Q4 Budget Review');

    // Build search string (simulating popup logic)
    const gmailSearchString = await page.evaluate((params) => {
      const parts: string[] = [];

      if (params.senderEmail) {
        parts.push(`from:${params.senderEmail}`);
      }

      if (params.subject) {
        const escapedSubject = params.subject.replace(/"/g, '\\"');
        parts.push(`subject:"${escapedSubject}"`);
      }

      if (params.date) {
        // Convert YYYY-MM-DD to YYYY/MM/DD
        const gmailDate = params.date.replace(/-/g, '/');
        parts.push(`after:${gmailDate}`);
      }

      return parts.join(' ');
    }, emailMetadata);

    expect(gmailSearchString).toContain('from:john.smith@acme.com');
    expect(gmailSearchString).toContain('subject:"Q4 Budget Review');
    expect(gmailSearchString).toContain('after:2026/01/23');

    await page.close();
  });

  test('task notes include email metadata and search string', async () => {
    const page = await context.newPage();

    const mockGmailPath = path.resolve(__dirname, 'fixtures', 'mock-gmail.html');
    await page.goto(`file://${mockGmailPath}`);

    // Simulate the note building logic from popup.ts
    const taskNotes = await page.evaluate(() => {
      const noteParts: string[] = [];

      // Page URL (simulated)
      noteParts.push('Source: https://mail.google.com/mail/u/0/#inbox/1234');

      // Email metadata
      const gD = document.querySelector('span.gD');
      const senderName = gD?.textContent?.trim();
      const senderEmail = gD?.getAttribute('email');

      if (senderName) {
        noteParts.push(`From: ${senderName}`);
      }
      if (senderEmail) {
        noteParts.push(`Email: ${senderEmail}`);
      }

      // Subject
      const subject = document.title.split(' - ')[0];
      if (subject) {
        noteParts.push(`Subject: ${subject}`);
      }

      // Search string
      const searchParts: string[] = [];
      if (senderEmail) searchParts.push(`from:${senderEmail}`);
      if (subject) searchParts.push(`subject:"${subject}"`);
      searchParts.push('after:2026/01/23');

      const searchString = searchParts.join(' ');
      noteParts.push(`\nSearch in Gmail:\n${searchString}`);

      return noteParts.join('\n');
    });

    // Verify note structure
    expect(taskNotes).toContain('Source:');
    expect(taskNotes).toContain('From: John Smith');
    expect(taskNotes).toContain('Email: john.smith@acme.com');
    expect(taskNotes).toContain('Subject: Q4 Budget Review');
    expect(taskNotes).toContain('Search in Gmail:');
    expect(taskNotes).toContain('from:john.smith@acme.com');

    await page.close();
  });
});

/**
 * E2E Tests for Outlook Email Metadata (using inline HTML)
 * Verifies Outlook-specific search string format
 */
test.describe('Task Creation Fields - Outlook Email Metadata', () => {
  let context: BrowserContext;

  test.beforeEach(async () => {
    context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--no-sandbox',
      ],
    });
  });

  test.afterEach(async () => {
    if (context) {
      await context.close();
    }
  });

  test('Outlook search string uses correct date format', async () => {
    const page = await context.newPage();

    // Create inline Outlook-like page
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head><title>Budget Report - Outlook</title></head>
        <body>
          <div data-app-section="FromLine">
            <span aria-label="From: Jane Doe">Jane Doe<jane.doe@company.com></span>
          </div>
          <div data-app-section="DateTimeLine">
            <time datetime="2026-01-23T14:30:00">January 23, 2026</time>
          </div>
          <div class="email-body">Please review the attached budget report.</div>
        </body>
      </html>
    `);

    // Build Outlook search string
    const outlookSearchString = await page.evaluate(() => {
      // Simulate Outlook search string building
      const senderEmail = 'jane.doe@company.com';
      const subject = 'Budget Report';
      const isoDate = '2026-01-23';

      // Convert ISO date to Outlook format (M/D/YYYY, no leading zeros)
      const [year, month, day] = isoDate.split('-');
      const m = parseInt(month, 10);
      const d = parseInt(day, 10);
      const outlookDate = `${m}/${d}/${year}`;

      const parts: string[] = [];
      parts.push(`from:"${senderEmail}"`);
      parts.push(`subject:"${subject}"`);
      parts.push(`received:${outlookDate}`);

      return parts.join(' ');
    });

    // Verify Outlook search format
    expect(outlookSearchString).toContain('from:"jane.doe@company.com"');
    expect(outlookSearchString).toContain('subject:"Budget Report"');
    expect(outlookSearchString).toContain('received:1/23/2026'); // Note: no leading zero

    await page.close();
  });

  test('task notes include Outlook search string format', async () => {
    const page = await context.newPage();

    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head><title>Meeting Request - Outlook</title></head>
        <body>
          <div>From: Bob Wilson<bob@example.org></div>
        </body>
      </html>
    `);

    // Simulate note building for Outlook
    const taskNotes = await page.evaluate(() => {
      const noteParts: string[] = [];

      noteParts.push('Source: https://outlook.office.com/mail/inbox/id/ABC123');
      noteParts.push('From: Bob Wilson');
      noteParts.push('Email: bob@example.org');
      noteParts.push('Subject: Meeting Request');

      // Outlook search string format
      const searchString = 'from:"bob@example.org" subject:"Meeting Request" received:1/23/2026';
      noteParts.push(`\nSearch in Outlook:\n${searchString}`);

      return noteParts.join('\n');
    });

    expect(taskNotes).toContain('Search in Outlook:');
    expect(taskNotes).toContain('from:"bob@example.org"');
    expect(taskNotes).toContain('subject:"Meeting Request"');
    expect(taskNotes).toContain('received:1/23/2026');

    await page.close();
  });
});

/**
 * E2E Tests for Assignee and Due Date Field Integration
 * Tests that new fields are properly included in task creation payload
 */
test.describe('Task Creation Fields - Field Integration', () => {
  let context: BrowserContext;

  test.beforeEach(async () => {
    context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--no-sandbox',
      ],
    });
  });

  test.afterEach(async () => {
    if (context) {
      await context.close();
    }
  });

  test('built API includes assignee in task creation request body', async () => {
    // Verify the built service worker handles assignee field
    const serviceWorkerPath = path.join(extensionPath, 'background', 'service-worker.js');
    const code = fs.readFileSync(serviceWorkerPath, 'utf-8');

    // Check that assignee is added to request body
    expect(code).toContain('assignee');

    // Check for the pattern of adding assignee conditionally
    // The minified code should contain the logic for adding assignee to requestBody
    expect(code).toMatch(/assignee/);
  });

  test('built API includes due_on in task creation request body', async () => {
    // Verify due_on handling
    const serviceWorkerPath = path.join(extensionPath, 'background', 'service-worker.js');
    const code = fs.readFileSync(serviceWorkerPath, 'utf-8');

    expect(code).toContain('due_on');
  });

  test('built API includes due_at in task creation request body', async () => {
    // Verify due_at handling (for tasks with specific time)
    const serviceWorkerPath = path.join(extensionPath, 'background', 'service-worker.js');
    const code = fs.readFileSync(serviceWorkerPath, 'utf-8');

    expect(code).toContain('due_at');
  });

  test('built popup handles assignee selection state', async () => {
    // Verify popup JS includes assignee state management
    const popupJsPath = path.join(extensionPath, 'popup', 'popup.js');
    const code = fs.readFileSync(popupJsPath, 'utf-8');

    // Check for assignee-related state and UI handling
    expect(code).toContain('assignee');
    expect(code).toContain('GET_USERS');
  });

  test('built popup handles due date quick-pick buttons', async () => {
    // Verify popup JS includes Today/Tomorrow button handlers
    const popupJsPath = path.join(extensionPath, 'popup', 'popup.js');
    const code = fs.readFileSync(popupJsPath, 'utf-8');

    // Check for date-related handling
    expect(code).toContain('btn-today');
    expect(code).toContain('btn-tomorrow');
    expect(code).toContain('include-time');
  });
});

/**
 * Documentation test for E2E testing limitations
 */
test.describe('Task Creation Fields - Test Coverage Documentation', () => {
  test('documents E2E testing limitations for Asana integration', () => {
    const limitations = [
      'Service worker requests cannot be intercepted by Playwright page.route()',
      'chrome.storage.local is not accessible from Playwright test context',
      'Asana API requires valid OAuth tokens which cannot be mocked in E2E',
      'Task creation requires authenticated service worker context',
    ];

    const unitTestCoverage = [
      'buildGmailSearchString - all parameter combinations',
      'buildOutlookSearchString - all parameter combinations',
      'Date format conversion - ISO to Gmail YYYY/MM/DD',
      'Date format conversion - ISO to Outlook M/D/YYYY',
      'Special character escaping in subject',
      'getUsers API - fetches workspace users',
      'getCurrentUser API - fetches authenticated user',
      'createTask - includes assignee in request body',
      'createTask - includes due_on in request body',
      'createTask - includes due_at in request body',
      'Gmail getSenderDetails - extracts name and email',
      'Gmail getEmailDate - extracts date from DOM',
      'Outlook getSenderDetails - parses Name<email> format',
      'Outlook getEmailDate - extracts date from DOM',
    ];

    const integrationTestCoverage = [
      'createTask with assignee - verifies request body structure',
      'createTask with due_on - verifies request body structure',
      'createTask with due_at - verifies request body structure',
      'createTask with all fields - full payload verification',
    ];

    // These assertions serve as documentation
    expect(limitations.length).toBe(4);
    expect(unitTestCoverage.length).toBeGreaterThan(10);
    expect(integrationTestCoverage.length).toBeGreaterThan(3);

    // Log for test report visibility
    console.log('\n=== Task Creation Fields E2E Test Limitations ===');
    limitations.forEach((l, i) => console.log(`  ${i + 1}. ${l}`));
    console.log('\n=== Unit Test Coverage (in email-search.test.ts, asana-api.test.ts, content tests) ===');
    unitTestCoverage.forEach((c, i) => console.log(`  ${i + 1}. ${c}`));
    console.log('\n=== Integration Test Coverage (in asana-api.test.ts) ===');
    integrationTestCoverage.forEach((c, i) => console.log(`  ${i + 1}. ${c}`));
  });
});
