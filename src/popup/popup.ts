/**
 * Popup logic for Asana Chrome Extension
 * Handles authentication, data loading, and form interactions
 */

import type {
  ExtensionMessage,
  AsanaWorkspace,
  AsanaProject,
  AsanaSection,
  AsanaTag,
  AsanaTask,
  AsanaUser,
  LastUsedSelections,
  GmailEmailInfo,
  OutlookEmailInfo,
  AIConfig,
  AIInput,
  CreateTaskPayload,
  Warning,
} from '../shared/types';
import { STORAGE_KEYS } from '../shared/constants';
import { get, set } from '../shared/storage';
import { generateTaskName } from '../shared/ai';
import { isOffline } from '../shared/errors';
import type { MessageErrorCode } from '../shared/messaging';

// =============================================================================
// DOM Elements
// =============================================================================

const elements = {
  // Sections
  authSection: document.getElementById('auth-section') as HTMLElement,
  loadingSection: document.getElementById('loading-section') as HTMLElement,
  taskForm: document.getElementById('task-form') as HTMLFormElement,
  successSection: document.getElementById('success-section') as HTMLElement,

  // Auth
  loginButton: document.getElementById('login-button') as HTMLButtonElement,

  // Error/Warning
  errorMessage: document.getElementById('error-message') as HTMLElement,
  warningsContainer: document.getElementById('warnings-container') as HTMLElement,

  // Form fields
  taskNameInput: document.getElementById('task-name') as HTMLInputElement,
  taskNotesTextarea: document.getElementById('task-notes') as HTMLTextAreaElement,
  taskUrlInput: document.getElementById('task-url') as HTMLInputElement,

  // Dropdowns
  workspaceSelect: document.getElementById('workspace-select') as HTMLSelectElement,
  projectSelect: document.getElementById('project-select') as HTMLSelectElement,
  sectionSelect: document.getElementById('section-select') as HTMLSelectElement,
  assigneeSelect: document.getElementById('assignee-select') as HTMLSelectElement,
  tagsSelect: document.getElementById('tags-select') as HTMLSelectElement,
  selectedTagsContainer: document.getElementById('selected-tags') as HTMLElement,

  // Due date inputs
  dueDateInput: document.getElementById('due-date') as HTMLInputElement,
  btnToday: document.getElementById('btn-today') as HTMLButtonElement,
  btnTomorrow: document.getElementById('btn-tomorrow') as HTMLButtonElement,
  includeTimeCheckbox: document.getElementById('include-time') as HTMLInputElement,
  dueTimeInput: document.getElementById('due-time') as HTMLInputElement,

  // Buttons
  refreshCacheButton: document.getElementById('refresh-cache') as HTMLButtonElement,
  submitButton: document.getElementById('submit-button') as HTMLButtonElement,
  createAnotherButton: document.getElementById('create-another') as HTMLButtonElement,

  // AI
  aiIndicator: document.getElementById('ai-indicator') as HTMLElement,
  aiBadge: document.getElementById('ai-badge') as HTMLElement,
  cancelAiButton: document.getElementById('cancel-ai') as HTMLButtonElement,

  // Success
  taskLink: document.getElementById('task-link') as HTMLAnchorElement,
};

// =============================================================================
// State
// =============================================================================

interface PopupLocalState {
  workspaces: AsanaWorkspace[];
  projects: AsanaProject[];
  sections: AsanaSection[];
  tags: AsanaTag[];
  users: AsanaUser[];
  currentUserGid: string | null;
  selectedAssigneeGid: string | null;
  selectedTagGids: string[];
  isAuthenticated: boolean;
  // AI state
  aiAbortController: AbortController | null;
  aiGenerating: boolean;
  aiSuggestionUsed: boolean;
  // Page info
  pageUrl: string;
  emailSubject?: string;
  accountEmail?: string; // Gmail account email (for task notes)
  emailBody?: string;
  emailSender?: string;
  senderName?: string;
  senderEmail?: string;
  emailDate?: string;
  contentType?: 'email' | 'webpage';
  pageContent?: string; // For non-email pages (up to 2000 chars)
  // Due date
  dueDate: string | null;
  dueTime: string | null;
  // Warnings
  warnings: Warning[];
}

const state: PopupLocalState = {
  workspaces: [],
  projects: [],
  sections: [],
  tags: [],
  users: [],
  currentUserGid: null,
  selectedAssigneeGid: null,
  selectedTagGids: [],
  isAuthenticated: false,
  // AI state
  aiAbortController: null,
  aiGenerating: false,
  aiSuggestionUsed: false,
  // Page info
  pageUrl: '',
  emailSubject: undefined,
  accountEmail: undefined,
  emailBody: undefined,
  emailSender: undefined,
  senderName: undefined,
  senderEmail: undefined,
  emailDate: undefined,
  contentType: undefined,
  pageContent: undefined,
  // Due date
  dueDate: null,
  dueTime: null,
  // Warnings
  warnings: [],
};

// =============================================================================
// UI Helpers
// =============================================================================

function showSection(section: 'auth' | 'loading' | 'form' | 'success'): void {
  elements.authSection.classList.toggle('hidden', section !== 'auth');
  elements.loadingSection.classList.toggle('hidden', section !== 'loading');
  elements.taskForm.classList.toggle('hidden', section !== 'form');
  elements.successSection.classList.toggle('hidden', section !== 'success');
}

function showError(message: string): void {
  elements.errorMessage.textContent = message;
  elements.errorMessage.classList.remove('hidden');
}

function hideError(): void {
  elements.errorMessage.classList.add('hidden');
  elements.errorMessage.textContent = '';
}

/**
 * Get a user-friendly error message based on error code and context
 */
function getErrorMessage(error: string | undefined, errorCode: MessageErrorCode | undefined, context: string): string {
  // Handle specific error codes with user-friendly messages
  switch (errorCode) {
    case 'NETWORK_ERROR':
      return 'You appear to be offline. Please check your internet connection.';
    case 'AUTH_REQUIRED':
      return 'Your session has expired. Please log in again.';
    case 'AUTH_FAILED':
      return 'Authentication failed. Please try again.';
    case 'RATE_LIMITED':
      return 'Too many requests. Please wait a moment and try again.';
    case 'NOT_FOUND':
      return `${context} not found. It may have been deleted.`;
    case 'INVALID_REQUEST':
      return error || 'Invalid request. Please check your input.';
    case 'API_ERROR':
      return error || `Failed to ${context.toLowerCase()}. Please try again.`;
    default:
      // Use the error message if available, otherwise generic message
      return error || `Failed to ${context.toLowerCase()}. Please try again.`;
  }
}

function setLoadingText(text: string): void {
  const loadingText = elements.loadingSection.querySelector('.loading-text');
  if (loadingText) {
    loadingText.textContent = text;
  }
}

// =============================================================================
// Warning Display Helpers
// =============================================================================

/**
 * Display warnings in the warnings container
 */
function displayWarnings(warnings: Warning[]): void {
  // Clear existing warnings
  elements.warningsContainer.innerHTML = '';

  if (warnings.length === 0) {
    elements.warningsContainer.classList.add('hidden');
    return;
  }

  // Show warnings container
  elements.warningsContainer.classList.remove('hidden');

  // Add each warning
  for (const warning of warnings) {
    const warningElement = document.createElement('div');
    warningElement.className = `warning warning-${warning.type}`;

    // Add icon based on warning type
    const icon = warning.type === 'gmail_confidential' ? '🔒' : '⚠️';

    warningElement.innerHTML = `
      <span class="warning-icon">${icon}</span>
      <span class="warning-message">${escapeHtml(warning.message)}</span>
    `;

    elements.warningsContainer.appendChild(warningElement);
  }
}

/**
 * Simple HTML escape function for warning messages
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Clear all warnings from display
 */
function clearWarnings(): void {
  state.warnings = [];
  elements.warningsContainer.innerHTML = '';
  elements.warningsContainer.classList.add('hidden');
}

// =============================================================================
// AI UI Helpers
// =============================================================================

function showAiLoading(): void {
  state.aiGenerating = true;
  elements.aiIndicator.classList.remove('hidden');
  elements.cancelAiButton.classList.remove('hidden');
  elements.aiBadge.classList.add('hidden');
}

function hideAiLoading(): void {
  state.aiGenerating = false;
  elements.aiIndicator.classList.add('hidden');
  elements.cancelAiButton.classList.add('hidden');
}

function showAiBadge(): void {
  elements.aiBadge.classList.remove('hidden');
}

function cancelAiGeneration(): void {
  if (state.aiAbortController) {
    state.aiAbortController.abort();
    state.aiAbortController = null;
  }
  hideAiLoading();
}

// =============================================================================
// Page Info Functions
// =============================================================================

/**
 * Check if current page is Gmail
 */
function isGmailPage(url: string): boolean {
  return url.includes('mail.google.com');
}

/**
 * Check if current page is Outlook
 */
function isOutlookPage(url: string): boolean {
  return (
    url.includes('outlook.live.com') ||
    url.includes('outlook.office.com') ||
    url.includes('outlook.office365.com')
  );
}

/**
 * Extract page content from non-email pages using chrome.scripting.executeScript
 * Truncates to 2000 chars, returns undefined on failure
 */
async function extractPageContent(tabId: number): Promise<string | undefined> {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => document.body.innerText,
    });

    if (results && results.length > 0 && results[0].result) {
      const content = results[0].result as string;
      // Truncate to 2000 chars
      return content.length > 2000 ? content.substring(0, 2000) : content;
    }
    return undefined;
  } catch (error) {
    console.debug('Failed to extract page content:', error);
    return undefined;
  }
}

/**
 * Request page info from the content script
 */
async function requestPageInfo(): Promise<void> {
  try {
    // Get the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url) {
      // No tab or URL, use empty values
      state.pageUrl = '';
      return;
    }

    const currentUrl = tab.url;

    // Check if this is an email page (Gmail or Outlook)
    if (isGmailPage(currentUrl) || isOutlookPage(currentUrl)) {
      // Request page info from content script
      try {
        const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_INFO' });

        if (response) {
          if (isGmailPage(currentUrl)) {
            const gmailInfo = response as GmailEmailInfo;
            state.pageUrl = gmailInfo.permanentUrl;
            state.emailSubject = gmailInfo.subject;
            state.accountEmail = gmailInfo.accountEmail || undefined;
            state.emailBody = gmailInfo.emailBody;
            state.emailSender = gmailInfo.emailSender;
            state.senderName = gmailInfo.senderName;
            state.senderEmail = gmailInfo.senderEmail;
            state.emailDate = gmailInfo.emailDate;
            state.contentType = 'email';

            // Handle warnings from Gmail content script
            if (gmailInfo.warnings && gmailInfo.warnings.length > 0) {
              state.warnings = gmailInfo.warnings;
              displayWarnings(state.warnings);
            }
          } else {
            const outlookInfo = response as OutlookEmailInfo;
            state.pageUrl = outlookInfo.permanentUrl;
            state.emailSubject = outlookInfo.subject;
            state.emailBody = outlookInfo.emailBody;
            state.emailSender = outlookInfo.emailSender;
            state.senderName = outlookInfo.senderName;
            state.senderEmail = outlookInfo.senderEmail;
            state.emailDate = outlookInfo.emailDate;
            state.contentType = 'email';
          }
        } else {
          // Content script didn't respond, use current URL
          state.pageUrl = currentUrl;
        }
      } catch {
        // Content script not available, use current URL
        state.pageUrl = currentUrl;
      }
    } else {
      // Not an email page, use current URL and document title
      state.pageUrl = currentUrl;
      state.contentType = 'webpage';

      // Extract page content for non-email pages
      state.pageContent = await extractPageContent(tab.id);
    }

    // Populate URL field
    elements.taskUrlInput.value = state.pageUrl;
  } catch (error) {
    console.error('Failed to get page info:', error);
    state.pageUrl = '';
  }
}

// =============================================================================
// AI Generation
// =============================================================================

/**
 * Trigger AI task name generation
 */
async function generateAiSuggestion(): Promise<void> {
  // Check if API key is configured
  const apiKey = await get<string>(STORAGE_KEYS.CLAUDE_API_KEY);
  if (!apiKey) {
    // No API key configured, skip AI generation
    return;
  }

  // Get active tab to get the actual page title (not popup's document.title)
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const pageTitle = tab?.title || '';

  // Build AI input from page context
  const aiInput: AIInput = {
    pageUrl: state.pageUrl,
    emailSubject: state.emailSubject,
    pageTitle,
    emailBody: state.emailBody,
    emailSender: state.emailSender,
    pageContent: state.pageContent,
    contentType: state.contentType,
  };

  // Check if we have enough context
  if (!aiInput.pageUrl && !aiInput.emailSubject && !aiInput.pageTitle) {
    return;
  }

  // Create AbortController for cancellation
  state.aiAbortController = new AbortController();

  const aiConfig: AIConfig = {
    apiKey,
    model: 'claude-haiku-4-5',
  };

  showAiLoading();

  try {
    const result = await generateTaskName(aiInput, aiConfig, state.aiAbortController.signal);

    if (result && result.suggestedName) {
      // Fill task name with suggestion
      elements.taskNameInput.value = result.suggestedName;
      state.aiSuggestionUsed = true;
      showAiBadge();
      updateSubmitButtonState();
    }
  } catch (error) {
    // Ignore abort errors
    if (error instanceof Error && error.name !== 'AbortError') {
      console.error('AI generation failed:', error);
    }
  } finally {
    hideAiLoading();
    state.aiAbortController = null;
  }
}

// =============================================================================
// Message Sending
// =============================================================================

interface MessageResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: MessageErrorCode;
}

function sendMessage<T>(message: ExtensionMessage): Promise<MessageResult<T>> {
  return chrome.runtime.sendMessage(message);
}

// =============================================================================
// Auth Flow
// =============================================================================

async function checkAuthStatus(): Promise<boolean> {
  try {
    const response = await sendMessage<{ isAuthenticated: boolean }>({ type: 'GET_AUTH_STATUS' });
    return response.success && response.data?.isAuthenticated === true;
  } catch (error) {
    console.error('Failed to check auth status:', error);
    return false;
  }
}

async function handleLogin(): Promise<void> {
  // Check offline status first
  if (isOffline()) {
    showError('You appear to be offline. Please check your internet connection.');
    return;
  }

  showSection('loading');
  setLoadingText('Connecting to Asana...');
  hideError();

  try {
    const response = await sendMessage<{ isAuthenticated: boolean }>({ type: 'START_AUTH' });

    if (response.success && response.data?.isAuthenticated) {
      state.isAuthenticated = true;
      await loadWorkspaces();
    } else {
      showSection('auth');
      const errorMessage = getErrorMessage(response.error, response.errorCode, 'authenticate');
      showError(errorMessage);
    }
  } catch (error) {
    showSection('auth');
    showError('Failed to connect to Asana. Please try again.');
    console.error('Auth error:', error);
  }
}

// =============================================================================
// Data Loading
// =============================================================================

async function loadWorkspaces(): Promise<void> {
  showSection('loading');
  setLoadingText('Loading workspaces...');
  hideError();

  try {
    const response = await sendMessage<AsanaWorkspace[]>({ type: 'GET_WORKSPACES' });

    if (response.success && response.data) {
      state.workspaces = response.data;
      populateWorkspaceDropdown();

      // Restore last-used selections
      const lastUsed = await get<LastUsedSelections>(STORAGE_KEYS.LAST_USED_SELECTIONS);
      if (lastUsed?.workspaceGid) {
        const savedWorkspace = state.workspaces.find(w => w.gid === lastUsed.workspaceGid);
        if (savedWorkspace) {
          elements.workspaceSelect.value = lastUsed.workspaceGid;
          // Load projects and users in parallel
          await Promise.all([
            loadProjects(lastUsed.workspaceGid, lastUsed),
            loadUsers(lastUsed.workspaceGid, lastUsed),
          ]);
        } else {
          showSection('form');
        }
      } else {
        showSection('form');
      }
    } else {
      showSection('form');
      const errorMessage = getErrorMessage(response.error, response.errorCode, 'load workspaces');
      showError(errorMessage);

      // If auth error, redirect to auth screen
      if (response.errorCode === 'AUTH_REQUIRED') {
        showSection('auth');
      }
    }
  } catch (error) {
    showSection('form');
    showError('Failed to load workspaces. Please try again.');
    console.error('Load workspaces error:', error);
  }
}

async function loadProjects(workspaceGid: string, lastUsed?: LastUsedSelections): Promise<void> {
  // Reset dependent dropdowns
  resetProjectDropdown();
  resetSectionDropdown();
  resetTagsDropdown();
  // Note: resetAssigneeDropdown is called separately in loadUsers

  if (!workspaceGid) return;

  elements.projectSelect.disabled = true;

  try {
    const response = await sendMessage<AsanaProject[]>({
      type: 'GET_PROJECTS',
      workspaceGid,
    });

    if (response.success && response.data) {
      state.projects = response.data;
      populateProjectDropdown();

      // Also load tags for this workspace
      await loadTags(workspaceGid);

      // Restore last-used project if applicable
      if (lastUsed?.projectGid) {
        const savedProject = state.projects.find(p => p.gid === lastUsed.projectGid);
        if (savedProject) {
          elements.projectSelect.value = lastUsed.projectGid;
          await loadSections(lastUsed.projectGid, lastUsed);
        }
      }
    } else {
      const errorMessage = getErrorMessage(response.error, response.errorCode, 'load projects');
      showError(errorMessage);
    }
  } catch (error) {
    showError('Failed to load projects. Please try again.');
    console.error('Load projects error:', error);
  } finally {
    elements.projectSelect.disabled = false;
    showSection('form');
    updateSubmitButtonState();
  }
}

async function loadSections(projectGid: string, lastUsed?: LastUsedSelections): Promise<void> {
  resetSectionDropdown();

  if (!projectGid) return;

  elements.sectionSelect.disabled = true;

  try {
    const response = await sendMessage<AsanaSection[]>({
      type: 'GET_SECTIONS',
      projectGid,
    });

    if (response.success && response.data) {
      state.sections = response.data;
      populateSectionDropdown();

      // Restore last-used section if applicable
      if (lastUsed?.sectionGid) {
        const savedSection = state.sections.find(s => s.gid === lastUsed.sectionGid);
        if (savedSection) {
          elements.sectionSelect.value = lastUsed.sectionGid;
        }
      }
    } else {
      console.warn('Failed to load sections:', response.error);
    }
  } catch (error) {
    console.error('Load sections error:', error);
  } finally {
    elements.sectionSelect.disabled = false;
  }
}

async function loadTags(workspaceGid: string): Promise<void> {
  resetTagsDropdown();

  if (!workspaceGid) return;

  elements.tagsSelect.disabled = true;

  try {
    const response = await sendMessage<AsanaTag[]>({
      type: 'GET_TAGS',
      workspaceGid,
    });

    if (response.success && response.data) {
      state.tags = response.data;
      populateTagsDropdown();
    } else {
      console.warn('Failed to load tags:', response.error);
    }
  } catch (error) {
    console.error('Load tags error:', error);
  } finally {
    elements.tagsSelect.disabled = false;
  }
}

async function loadUsers(workspaceGid: string, lastUsed?: LastUsedSelections): Promise<void> {
  resetAssigneeDropdown();

  if (!workspaceGid) return;

  elements.assigneeSelect.disabled = true;

  try {
    const response = await sendMessage<AsanaUser[]>({
      type: 'GET_USERS',
      workspaceGid,
    });

    if (response.success && response.data) {
      state.users = response.data;
      populateAssigneeDropdown(state.users, state.currentUserGid);

      // Restore last-used assignee or default to current user
      if (lastUsed?.assigneeGid) {
        const savedAssignee = state.users.find(u => u.gid === lastUsed.assigneeGid);
        if (savedAssignee) {
          elements.assigneeSelect.value = lastUsed.assigneeGid;
          state.selectedAssigneeGid = lastUsed.assigneeGid;
        }
      } else if (state.currentUserGid) {
        // Default to current user
        elements.assigneeSelect.value = state.currentUserGid;
        state.selectedAssigneeGid = state.currentUserGid;
      }
    } else {
      console.warn('Failed to load users:', response.error);
    }
  } catch (error) {
    console.error('Load users error:', error);
  } finally {
    elements.assigneeSelect.disabled = false;
  }
}


// =============================================================================
// Dropdown Population
// =============================================================================

function populateWorkspaceDropdown(): void {
  // Clear existing options (keep first placeholder)
  while (elements.workspaceSelect.options.length > 1) {
    elements.workspaceSelect.remove(1);
  }

  for (const workspace of state.workspaces) {
    const option = document.createElement('option');
    option.value = workspace.gid;
    option.textContent = workspace.name;
    elements.workspaceSelect.appendChild(option);
  }
}

function populateProjectDropdown(): void {
  // Clear existing options (keep first placeholder)
  while (elements.projectSelect.options.length > 1) {
    elements.projectSelect.remove(1);
  }

  for (const project of state.projects) {
    const option = document.createElement('option');
    option.value = project.gid;
    option.textContent = project.name;
    elements.projectSelect.appendChild(option);
  }
}

function populateSectionDropdown(): void {
  // Clear existing options (keep first placeholder)
  while (elements.sectionSelect.options.length > 1) {
    elements.sectionSelect.remove(1);
  }

  for (const section of state.sections) {
    const option = document.createElement('option');
    option.value = section.gid;
    option.textContent = section.name;
    elements.sectionSelect.appendChild(option);
  }
}

function populateAssigneeDropdown(users: AsanaUser[], currentUserGid: string | null): void {
  // Clear existing options (keep first placeholder - "Unassigned")
  while (elements.assigneeSelect.options.length > 1) {
    elements.assigneeSelect.remove(1);
  }

  for (const user of users) {
    const option = document.createElement('option');
    option.value = user.gid;
    // Mark current user with "(me)" suffix
    option.textContent = user.gid === currentUserGid ? `${user.name} (me)` : user.name;
    elements.assigneeSelect.appendChild(option);
  }
}

function populateTagsDropdown(): void {
  // Clear existing options (keep first placeholder)
  while (elements.tagsSelect.options.length > 1) {
    elements.tagsSelect.remove(1);
  }

  for (const tag of state.tags) {
    // Skip tags that are already selected
    if (state.selectedTagGids.includes(tag.gid)) continue;

    const option = document.createElement('option');
    option.value = tag.gid;
    option.textContent = tag.name;
    elements.tagsSelect.appendChild(option);
  }
}

// =============================================================================
// Dropdown Reset
// =============================================================================

function resetProjectDropdown(): void {
  state.projects = [];
  while (elements.projectSelect.options.length > 1) {
    elements.projectSelect.remove(1);
  }
  elements.projectSelect.value = '';
  elements.projectSelect.disabled = true;
}

function resetSectionDropdown(): void {
  state.sections = [];
  while (elements.sectionSelect.options.length > 1) {
    elements.sectionSelect.remove(1);
  }
  elements.sectionSelect.value = '';
  elements.sectionSelect.disabled = true;
}

function resetTagsDropdown(): void {
  state.tags = [];
  state.selectedTagGids = [];
  elements.selectedTagsContainer.innerHTML = '';
  while (elements.tagsSelect.options.length > 1) {
    elements.tagsSelect.remove(1);
  }
  elements.tagsSelect.disabled = true;
}

function resetAssigneeDropdown(): void {
  state.users = [];
  state.selectedAssigneeGid = null;
  while (elements.assigneeSelect.options.length > 1) {
    elements.assigneeSelect.remove(1);
  }
  elements.assigneeSelect.value = '';
  elements.assigneeSelect.disabled = true;
}

function resetDueDateInputs(): void {
  state.dueDate = null;
  state.dueTime = null;
  elements.dueDateInput.value = '';
  elements.dueTimeInput.value = '';
  elements.includeTimeCheckbox.checked = false;
  elements.dueTimeInput.disabled = true;
}

// =============================================================================
// Tag Selection Management
// =============================================================================

function addTag(tagGid: string): void {
  const tag = state.tags.find(t => t.gid === tagGid);
  if (!tag || state.selectedTagGids.includes(tagGid)) return;

  state.selectedTagGids.push(tagGid);

  // Create tag chip
  const chip = document.createElement('span');
  chip.className = 'tag-chip';
  chip.dataset.gid = tagGid;
  chip.innerHTML = `
    ${tag.name}
    <button type="button" class="remove-tag" data-gid="${tagGid}">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"/>
        <line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
  `;
  elements.selectedTagsContainer.appendChild(chip);

  // Reset dropdown selection and refresh options
  elements.tagsSelect.value = '';
  populateTagsDropdown();
}

function removeTag(tagGid: string): void {
  const index = state.selectedTagGids.indexOf(tagGid);
  if (index === -1) return;

  state.selectedTagGids.splice(index, 1);

  // Remove tag chip
  const chip = elements.selectedTagsContainer.querySelector(`[data-gid="${tagGid}"]`);
  if (chip) {
    chip.remove();
  }

  // Refresh dropdown to show removed tag
  populateTagsDropdown();
}

// =============================================================================
// Selection Persistence
// =============================================================================

async function saveLastUsedSelections(): Promise<void> {
  const workspaceGid = elements.workspaceSelect.value;
  const projectGid = elements.projectSelect.value;
  const sectionGid = elements.sectionSelect.value;
  const assigneeGid = state.selectedAssigneeGid;

  if (workspaceGid && projectGid) {
    const lastUsed: LastUsedSelections = {
      workspaceGid,
      projectGid,
      sectionGid: sectionGid || undefined,
      assigneeGid: assigneeGid || undefined,
    };
    await set(STORAGE_KEYS.LAST_USED_SELECTIONS, lastUsed);
  }
}

// =============================================================================
// Form Validation
// =============================================================================

function updateSubmitButtonState(): void {
  const hasTaskName = elements.taskNameInput.value.trim().length > 0;
  const hasWorkspace = elements.workspaceSelect.value !== '';
  const hasProject = elements.projectSelect.value !== '';

  elements.submitButton.disabled = !(hasTaskName && hasWorkspace && hasProject);
}

function validateForm(): { valid: boolean; error?: string } {
  const taskName = elements.taskNameInput.value.trim();
  const projectGid = elements.projectSelect.value;

  if (!taskName) {
    return { valid: false, error: 'Task name is required' };
  }

  if (!projectGid) {
    return { valid: false, error: 'Project is required' };
  }

  return { valid: true };
}

// =============================================================================
// Task Submission
// =============================================================================

function setSubmitting(isSubmitting: boolean): void {
  elements.submitButton.disabled = isSubmitting;

  if (isSubmitting) {
    elements.submitButton.textContent = 'Creating...';
    elements.submitButton.classList.add('loading');
  } else {
    elements.submitButton.textContent = 'Create Task';
    elements.submitButton.classList.remove('loading');
  }
}

async function handleSubmitTask(): Promise<void> {
  hideError();

  // Check offline status first
  if (isOffline()) {
    showError('You appear to be offline. Please check your internet connection.');
    return;
  }

  // Validate form
  const validation = validateForm();
  if (!validation.valid) {
    showError(validation.error || 'Please fill in required fields');
    return;
  }

  setSubmitting(true);

  try {
    // Build task payload
    const payload: CreateTaskPayload = {
      name: elements.taskNameInput.value.trim(),
      projectGid: elements.projectSelect.value,
      workspaceGid: elements.workspaceSelect.value,
    };

    // Add optional fields
    const notes = elements.taskNotesTextarea.value.trim();
    const url = elements.taskUrlInput.value.trim();
    if (notes || url || state.accountEmail) {
      // Combine notes with URL and email info
      const noteParts: string[] = [];
      if (notes) noteParts.push(notes);
      if (url) noteParts.push(`Source: ${url}`);
      // Include email address for Gmail tasks (helps identify the account)
      if (state.accountEmail) {
        noteParts.push(`Email account: ${state.accountEmail}`);
      }
      payload.notes = noteParts.join('\n\n');
    }

    const sectionGid = elements.sectionSelect.value;
    if (sectionGid) {
      payload.sectionGid = sectionGid;
    }

    if (state.selectedTagGids.length > 0) {
      payload.tagGids = state.selectedTagGids;
    }

    // Add assignee if selected
    if (state.selectedAssigneeGid) {
      payload.assignee = state.selectedAssigneeGid;
    }

    // Add due date/time
    if (state.dueDate) {
      if (state.dueTime && elements.includeTimeCheckbox.checked) {
        // Use due_at for datetime (ISO format with timezone)
        const dateTime = new Date(`${state.dueDate}T${state.dueTime}`);
        payload.due_at = dateTime.toISOString();
      } else {
        // Use due_on for date only (YYYY-MM-DD format)
        payload.due_on = state.dueDate;
      }
    }

    // Send to service worker
    const response = await sendMessage<AsanaTask>({
      type: 'CREATE_TASK',
      payload,
    });

    if (response.success && response.data) {
      // Save selections for next time
      await saveLastUsedSelections();

      // Show success
      elements.taskLink.href = response.data.permalink_url;
      elements.taskLink.textContent = response.data.name;
      showSection('success');
    } else {
      const errorMessage = getErrorMessage(response.error, response.errorCode, 'create task');
      showError(errorMessage);
    }
  } catch (error) {
    console.error('Task creation error:', error);
    showError('Failed to create task. Please try again.');
  } finally {
    setSubmitting(false);
  }
}

// =============================================================================
// Cache Refresh
// =============================================================================

async function handleRefreshCache(): Promise<void> {
  showSection('loading');
  setLoadingText('Refreshing data...');
  hideError();

  try {
    await sendMessage({ type: 'REFRESH_CACHE' });
    await loadWorkspaces();
  } catch (error) {
    showSection('form');
    showError('Failed to refresh data. Please try again.');
    console.error('Refresh cache error:', error);
  }
}

// =============================================================================
// Event Listeners
// =============================================================================

function setupEventListeners(): void {
  // Login button
  elements.loginButton.addEventListener('click', handleLogin);

  // Workspace change
  elements.workspaceSelect.addEventListener('change', async () => {
    const workspaceGid = elements.workspaceSelect.value;
    // Load projects and users in parallel
    await Promise.all([
      loadProjects(workspaceGid),
      loadUsers(workspaceGid),
    ]);
    updateSubmitButtonState();
  });

  // Project change
  elements.projectSelect.addEventListener('change', async () => {
    const projectGid = elements.projectSelect.value;
    await loadSections(projectGid);
    updateSubmitButtonState();
  });

  // Section change (save selection)
  elements.sectionSelect.addEventListener('change', () => {
    saveLastUsedSelections();
  });

  // Tag selection
  elements.tagsSelect.addEventListener('change', () => {
    const tagGid = elements.tagsSelect.value;
    if (tagGid) {
      addTag(tagGid);
    }
  });

  // Tag removal (event delegation)
  elements.selectedTagsContainer.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const removeButton = target.closest('.remove-tag') as HTMLElement;
    if (removeButton) {
      const tagGid = removeButton.dataset.gid;
      if (tagGid) {
        removeTag(tagGid);
      }
    }
  });

  // Assignee change
  elements.assigneeSelect.addEventListener('change', () => {
    state.selectedAssigneeGid = elements.assigneeSelect.value || null;
  });

  // Due date input change
  elements.dueDateInput.addEventListener('change', () => {
    state.dueDate = elements.dueDateInput.value || null;
  });

  // Due time input change
  elements.dueTimeInput.addEventListener('change', () => {
    state.dueTime = elements.dueTimeInput.value || null;
  });

  // Today button
  elements.btnToday.addEventListener('click', () => {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    elements.dueDateInput.value = dateStr;
    state.dueDate = dateStr;
  });

  // Tomorrow button
  elements.btnTomorrow.addEventListener('click', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];
    elements.dueDateInput.value = dateStr;
    state.dueDate = dateStr;
  });

  // Include time checkbox
  elements.includeTimeCheckbox.addEventListener('change', () => {
    const includeTime = elements.includeTimeCheckbox.checked;
    elements.dueTimeInput.disabled = !includeTime;
    if (!includeTime) {
      elements.dueTimeInput.value = '';
      state.dueTime = null;
    }
  });

  // Task name input
  elements.taskNameInput.addEventListener('input', updateSubmitButtonState);

  // Refresh cache button
  elements.refreshCacheButton.addEventListener('click', handleRefreshCache);

  // Cancel AI button
  elements.cancelAiButton.addEventListener('click', cancelAiGeneration);

  // Create another button
  elements.createAnotherButton.addEventListener('click', () => {
    showSection('form');
    elements.taskNameInput.value = '';
    elements.taskNotesTextarea.value = '';
    elements.aiBadge.classList.add('hidden');
    state.aiSuggestionUsed = false;
    clearWarnings(); // Clear any previous warnings
    resetDueDateInputs(); // Reset due date for new task
    updateSubmitButtonState();

    // Re-trigger AI generation for new task
    generateAiSuggestion();
  });

  // Submit button click
  elements.submitButton.addEventListener('click', handleSubmitTask);

  // Form submit (prevents default form behavior)
  elements.taskForm.addEventListener('submit', (e) => {
    e.preventDefault();
    handleSubmitTask();
  });

  // Ctrl+Enter to submit from any field
  elements.taskForm.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (!elements.submitButton.disabled) {
        handleSubmitTask();
      }
    }
  });
}

// =============================================================================
// Initialization
// =============================================================================

async function init(): Promise<void> {
  setupEventListeners();

  showSection('loading');
  setLoadingText('Checking authentication...');

  // Request page info in parallel with auth check
  const pageInfoPromise = requestPageInfo();

  try {
    const isAuth = await checkAuthStatus();
    state.isAuthenticated = isAuth;

    if (isAuth) {
      await loadWorkspaces();

      // Ensure page info is loaded before triggering AI
      await pageInfoPromise;

      // Trigger AI generation (async, don't await - let it run in background)
      generateAiSuggestion();
    } else {
      showSection('auth');
    }
  } catch (error) {
    showSection('auth');
    showError('Failed to initialize. Please try again.');
    console.error('Init error:', error);
  }
}

// Start initialization when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
