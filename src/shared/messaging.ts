/**
 * Message Handler Utilities for Asana Chrome Extension
 *
 * Provides typed message sending/receiving functions and consistent
 * error response format for communication between extension components.
 */

import type {
  ExtensionMessage,
  AsanaWorkspace,
  AsanaProject,
  AsanaSection,
  AsanaTag,
  AsanaUser,
  CreateTaskResponse,
  GmailEmailInfo,
  OutlookEmailInfo,
} from './types';

// =============================================================================
// Response Types
// =============================================================================

/**
 * Standard response format for all message handlers
 * Ensures consistent error handling across the extension
 */
export interface MessageResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: MessageErrorCode;
}

/**
 * Error codes for categorizing message failures
 */
export type MessageErrorCode =
  | 'AUTH_REQUIRED'
  | 'AUTH_FAILED'
  | 'NETWORK_ERROR'
  | 'API_ERROR'
  | 'RATE_LIMITED'
  | 'INVALID_REQUEST'
  | 'NOT_FOUND'
  | 'UNKNOWN_ERROR';

// =============================================================================
// Message Type Mappings
// =============================================================================

/**
 * Maps message types to their expected response data types
 * Used for type-safe message sending
 */
export interface MessageResponseMap {
  GET_AUTH_STATUS: { isAuthenticated: boolean };
  START_AUTH: { isAuthenticated: boolean };
  LOGOUT: void;
  GET_WORKSPACES: AsanaWorkspace[];
  GET_PROJECTS: AsanaProject[];
  GET_SECTIONS: AsanaSection[];
  GET_TAGS: AsanaTag[];
  GET_USERS: AsanaUser[];
  CREATE_TASK: CreateTaskResponse;
  REFRESH_CACHE: void;
  GET_PAGE_INFO: GmailEmailInfo | OutlookEmailInfo | null;
}

/**
 * Message type literal union for type guards
 */
export type MessageType = ExtensionMessage['type'];

// =============================================================================
// Message Sending Utilities
// =============================================================================

/**
 * Send a typed message to the service worker
 *
 * @param message The message to send
 * @returns Promise resolving to the typed response
 *
 * @example
 * const response = await sendMessage({ type: 'GET_WORKSPACES' });
 * if (response.success) {
 *   const workspaces = response.data; // Typed as AsanaWorkspace[]
 * }
 */
export function sendMessage<T extends ExtensionMessage>(
  message: T
): Promise<MessageResponse<MessageResponseMap[T['type']]>> {
  return chrome.runtime.sendMessage(message);
}

/**
 * Send a message to a specific tab's content script
 *
 * @param tabId The ID of the tab to send the message to
 * @param message The message to send
 * @returns Promise resolving to the response from the content script
 *
 * @example
 * const info = await sendTabMessage(tabId, { type: 'GET_PAGE_INFO' });
 */
export async function sendTabMessage<T = unknown>(
  tabId: number,
  message: { type: string; [key: string]: unknown }
): Promise<T | null> {
  try {
    const response = await chrome.tabs.sendMessage(tabId, message);
    return response as T;
  } catch {
    // Content script may not be loaded or tab may not exist
    return null;
  }
}

// =============================================================================
// Response Creation Utilities
// =============================================================================

/**
 * Create a successful response with optional data
 *
 * @param data Optional data to include in the response
 * @returns A success response object
 *
 * @example
 * return createSuccessResponse(workspaces);
 * return createSuccessResponse(); // For void responses
 */
export function createSuccessResponse<T>(data?: T): MessageResponse<T> {
  const response: MessageResponse<T> = { success: true };
  if (data !== undefined) {
    response.data = data;
  }
  return response;
}

/**
 * Create an error response with message and optional error code
 *
 * @param error The error message or Error object
 * @param errorCode Optional error code for categorization
 * @returns An error response object
 *
 * @example
 * return createErrorResponse('Authentication required', 'AUTH_REQUIRED');
 * return createErrorResponse(error); // Converts Error to string
 */
export function createErrorResponse(
  error: string | Error,
  errorCode?: MessageErrorCode
): MessageResponse<never> {
  const response: MessageResponse<never> = {
    success: false,
    error: error instanceof Error ? error.message : error,
  };
  if (errorCode) {
    response.errorCode = errorCode;
  }
  return response;
}

// =============================================================================
// Message Handler Type Definitions
// =============================================================================

/**
 * Type for a message handler function
 * Handlers receive a message and return a promise of a MessageResponse
 */
export type MessageHandler<T extends ExtensionMessage> = (
  message: T,
  sender: chrome.runtime.MessageSender
) => Promise<MessageResponse<MessageResponseMap[T['type']]>>;

/**
 * Registry of message handlers keyed by message type
 */
export type MessageHandlerRegistry = {
  [K in MessageType]?: MessageHandler<Extract<ExtensionMessage, { type: K }>>;
};

// =============================================================================
// Message Router
// =============================================================================

/**
 * Create a message router that dispatches messages to registered handlers
 *
 * @param handlers Registry of message handlers
 * @returns A function to use with chrome.runtime.onMessage.addListener
 *
 * @example
 * const router = createMessageRouter({
 *   GET_AUTH_STATUS: handleGetAuthStatus,
 *   GET_WORKSPACES: handleGetWorkspaces,
 *   // ... other handlers
 * });
 *
 * chrome.runtime.onMessage.addListener(router);
 */
export function createMessageRouter(
  handlers: MessageHandlerRegistry
): (
  message: ExtensionMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: MessageResponse) => void
) => boolean {
  return (message, sender, sendResponse) => {
    const handler = handlers[message.type] as
      | MessageHandler<ExtensionMessage>
      | undefined;

    if (!handler) {
      sendResponse(
        createErrorResponse(
          `Unknown message type: ${message.type}`,
          'INVALID_REQUEST'
        )
      );
      return false;
    }

    // Execute handler asynchronously
    handler(message, sender)
      .then(sendResponse)
      .catch((error) => {
        console.error(`Error handling message ${message.type}:`, error);
        sendResponse(
          createErrorResponse(
            error instanceof Error ? error.message : String(error),
            'UNKNOWN_ERROR'
          )
        );
      });

    // Return true to indicate async response
    return true;
  };
}

// =============================================================================
// Error Classification Utilities
// =============================================================================

/**
 * Classify an error into an error code based on its characteristics
 *
 * @param error The error to classify
 * @returns The appropriate error code
 */
export function classifyError(error: unknown): MessageErrorCode {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes('auth') || message.includes('token')) {
      return 'AUTH_REQUIRED';
    }
    if (message.includes('network') || message.includes('fetch')) {
      return 'NETWORK_ERROR';
    }
    if (message.includes('rate') || message.includes('429')) {
      return 'RATE_LIMITED';
    }
    if (message.includes('not found') || message.includes('404')) {
      return 'NOT_FOUND';
    }
  }

  return 'UNKNOWN_ERROR';
}

/**
 * Wrap an async function to automatically classify and format errors
 *
 * @param fn The async function to wrap
 * @returns A wrapped function that returns MessageResponse
 *
 * @example
 * const handleGetWorkspaces = withErrorHandling(async () => {
 *   const workspaces = await getWorkspaces();
 *   return createSuccessResponse(workspaces);
 * });
 */
export function withErrorHandling<T, Args extends unknown[]>(
  fn: (...args: Args) => Promise<MessageResponse<T>>
): (...args: Args) => Promise<MessageResponse<T>> {
  return async (...args: Args) => {
    try {
      return await fn(...args);
    } catch (error) {
      const errorCode = classifyError(error);
      return createErrorResponse(
        error instanceof Error ? error : String(error),
        errorCode
      );
    }
  };
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Check if a message is of a specific type
 *
 * @param message The message to check
 * @param type The type to check against
 * @returns true if the message is of the specified type
 *
 * @example
 * if (isMessageType(message, 'GET_PROJECTS')) {
 *   const workspaceGid = message.workspaceGid; // Type-safe access
 * }
 */
export function isMessageType<T extends MessageType>(
  message: ExtensionMessage,
  type: T
): message is Extract<ExtensionMessage, { type: T }> {
  return message.type === type;
}

/**
 * Check if a response is successful with type narrowing
 *
 * @param response The response to check
 * @returns true if the response is successful
 *
 * @example
 * const response = await sendMessage({ type: 'GET_WORKSPACES' });
 * if (isSuccessResponse(response)) {
 *   // response.data is now typed and guaranteed to exist
 * }
 */
export function isSuccessResponse<T>(
  response: MessageResponse<T>
): response is MessageResponse<T> & { success: true; data: T } {
  return response.success === true && response.data !== undefined;
}

/**
 * Check if a response is an error
 *
 * @param response The response to check
 * @returns true if the response is an error
 */
export function isErrorResponse<T>(
  response: MessageResponse<T>
): response is MessageResponse<T> & { success: false; error: string } {
  return response.success === false;
}
