/**
 * Shared TypeScript types for Asana Chrome Extension
 */

// =============================================================================
// Extension Message Types
// =============================================================================

export type ExtensionMessage =
  | { type: 'GET_PAGE_INFO' }
  | { type: 'CREATE_TASK'; payload: CreateTaskPayload }
  | { type: 'GET_WORKSPACES' }
  | { type: 'GET_PROJECTS'; workspaceGid: string }
  | { type: 'GET_SECTIONS'; projectGid: string }
  | { type: 'GET_TAGS'; workspaceGid: string }
  | { type: 'REFRESH_CACHE' }
  | { type: 'GET_AUTH_STATUS' }
  | { type: 'START_AUTH' }
  | { type: 'LOGOUT' };

// =============================================================================
// Task Creation Types
// =============================================================================

export interface CreateTaskPayload {
  name: string;
  notes?: string;
  projectGid: string;
  sectionGid?: string;
  tagGids?: string[];
  workspaceGid: string;
}

export interface CreateTaskResponse {
  success: boolean;
  taskGid?: string;
  taskUrl?: string;
  error?: string;
}

// =============================================================================
// Asana API Types
// =============================================================================

export interface AsanaWorkspace {
  gid: string;
  name: string;
}

export interface AsanaProject {
  gid: string;
  name: string;
  workspaceGid: string;
}

export interface AsanaSection {
  gid: string;
  name: string;
}

export interface AsanaTag {
  gid: string;
  name: string;
  workspaceGid: string;
}

export interface AsanaTask {
  gid: string;
  name: string;
  permalink_url: string;
}

// =============================================================================
// OAuth Types
// =============================================================================

export interface OAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp in milliseconds
}

export interface OAuthConfig {
  clientId: string;
  redirectUrl: string; // from chrome.identity.getRedirectURL()
  scopes: string[];
}

// =============================================================================
// Cache Types
// =============================================================================

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // milliseconds
}

export interface CacheConfig {
  defaultTTL: number; // Default: 5 minutes (300000 ms)
}

// =============================================================================
// Gmail Types
// =============================================================================

export interface GmailEmailInfo {
  messageId: string | null;
  userId: string; // e.g., "0", "1"
  accountEmail: string | null;
  permanentUrl: string;
  isConfidentialMode: boolean;
  subject?: string;
  emailBody?: string;
  emailSender?: string;
  warnings?: Warning[]; // Edge case warnings (account reorder, confidential mode)
}

export interface GmailPageInfo {
  type: 'GMAIL_PAGE_INFO';
  payload: GmailEmailInfo;
}

// =============================================================================
// Outlook Types
// =============================================================================

export type OutlookVariant = 'personal' | 'business' | 'office365';

export interface OutlookEmailInfo {
  itemId: string | null;
  variant: OutlookVariant;
  permanentUrl: string;
}

export interface OutlookPageInfo {
  type: 'OUTLOOK_PAGE_INFO';
  payload: OutlookEmailInfo;
}

// =============================================================================
// Page Info Types (union of email info types)
// =============================================================================

export type PageInfo = GmailPageInfo | OutlookPageInfo | GenericPageInfo;

export interface GenericPageInfo {
  type: 'GENERIC_PAGE_INFO';
  payload: {
    url: string;
    title: string;
    selectedText?: string;
  };
}

// =============================================================================
// AI Types
// =============================================================================

export interface AIConfig {
  apiKey: string;
  model: string; // Default: claude-3-haiku-20240307
}

export interface AIInput {
  pageTitle?: string;
  selectedText?: string;
  emailSubject?: string;
  pageUrl?: string;
  emailBody?: string; // truncated to 1000 chars
  emailSender?: string; // sender name or email
  pageContent?: string; // for non-email pages, up to 2000 chars
  contentType?: 'email' | 'webpage'; // helps prompt strategy
}

export interface AIResult {
  suggestedName: string;
  confidence?: 'high' | 'medium' | 'low';
}

// =============================================================================
// Popup State Types
// =============================================================================

export type AIStatus = 'idle' | 'loading' | 'done' | 'error' | 'cancelled';
export type SubmitStatus = 'idle' | 'submitting' | 'success' | 'error';

export interface PopupState {
  // Auth
  isAuthenticated: boolean;

  // Data (from cache)
  workspaces: AsanaWorkspace[];
  projects: AsanaProject[];
  sections: AsanaSection[];
  tags: AsanaTag[];

  // Selections
  selectedWorkspaceGid: string | null;
  selectedProjectGid: string | null;
  selectedSectionGid: string | null;
  selectedTagGids: string[];

  // Task fields
  taskName: string;
  taskNotes: string;
  pageUrl: string;

  // AI
  aiStatus: AIStatus;
  aiSuggestion: string | null;

  // Page info
  pageInfo: PageInfo | null;

  // Warnings
  warnings: Warning[];

  // Submit status
  submitStatus: SubmitStatus;
  createdTaskUrl: string | null;
}

// =============================================================================
// Warning Types
// =============================================================================

export type WarningType = 'gmail_account_reorder' | 'gmail_confidential';

export interface Warning {
  type: WarningType;
  message: string;
}

// =============================================================================
// Storage Types
// =============================================================================

export interface LastUsedSelections {
  workspaceGid: string;
  projectGid: string;
  sectionGid?: string;
}

export interface EmailAccountMapping {
  email: string;
  userId: string;
  timestamp: number;
}
