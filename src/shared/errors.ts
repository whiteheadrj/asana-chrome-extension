/**
 * Error Handling Module for Asana Chrome Extension
 *
 * Provides custom error types, error classification, network detection,
 * and user-friendly error message generation.
 */

// =============================================================================
// Custom Error Types
// =============================================================================

/**
 * Base error class for all extension errors
 * Provides common functionality for error classification and messaging
 */
export abstract class ExtensionError extends Error {
  abstract readonly code: ErrorCode;
  abstract readonly userMessage: string;

  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = this.constructor.name;

    // Maintains proper stack trace for where our error was thrown (only in V8)
    // Type assertion needed since captureStackTrace is V8-specific
    const ErrorConstructor = Error as typeof Error & {
      captureStackTrace?: (targetObject: object, constructorOpt?: unknown) => void;
    };
    if (typeof ErrorConstructor.captureStackTrace === 'function') {
      ErrorConstructor.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Get the original error if this error wraps another
   */
  getCause(): Error | undefined {
    return this.cause instanceof Error ? this.cause : undefined;
  }
}

/**
 * Error codes for categorizing errors throughout the extension
 */
export type ErrorCode =
  | 'AUTH_REQUIRED'
  | 'AUTH_FAILED'
  | 'AUTH_EXPIRED'
  | 'NETWORK_OFFLINE'
  | 'NETWORK_ERROR'
  | 'API_ERROR'
  | 'RATE_LIMITED'
  | 'INVALID_REQUEST'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'STORAGE_ERROR'
  | 'UNKNOWN_ERROR';

// =============================================================================
// Authentication Errors
// =============================================================================

/**
 * Error thrown when authentication is required but user is not authenticated
 */
export class AuthRequiredError extends ExtensionError {
  readonly code = 'AUTH_REQUIRED' as const;
  readonly userMessage = 'Please log in to continue.';

  constructor(message = 'Authentication required', cause?: unknown) {
    super(message, cause);
  }
}

/**
 * Error thrown when authentication fails (wrong credentials, denied access, etc.)
 */
export class AuthFailedError extends ExtensionError {
  readonly code = 'AUTH_FAILED' as const;
  readonly userMessage = 'Authentication failed. Please try again.';

  constructor(message = 'Authentication failed', cause?: unknown) {
    super(message, cause);
  }
}

/**
 * Get user-friendly message for Asana OAuth error codes
 */
function getMessageForErrorCode(errorCode?: string): string {
  switch (errorCode) {
    case 'invalid_grant':
      return 'Your session has expired. Please log in again.';
    case 'invalid_client':
      return 'Configuration error. Please reinstall the extension.';
    case 'unauthorized_client':
      return 'Configuration error. Please reinstall the extension.';
    default:
      return 'Your session has expired. Please log in again.';
  }
}

/**
 * Error thrown when tokens have expired and cannot be refreshed
 */
export class AuthExpiredError extends ExtensionError {
  readonly code = 'AUTH_EXPIRED' as const;
  readonly asanaErrorCode?: string;

  constructor(message = 'Session expired', cause?: unknown, asanaErrorCode?: string) {
    super(message, cause);
    this.asanaErrorCode = asanaErrorCode;
  }

  get userMessage(): string {
    return getMessageForErrorCode(this.asanaErrorCode);
  }
}

// =============================================================================
// Network Errors
// =============================================================================

/**
 * Error thrown when the device appears to be offline
 */
export class NetworkOfflineError extends ExtensionError {
  readonly code = 'NETWORK_OFFLINE' as const;
  readonly userMessage = 'You appear to be offline. Please check your internet connection.';

  constructor(message = 'Network offline', cause?: unknown) {
    super(message, cause);
  }
}

/**
 * Error thrown for general network failures (DNS, connection refused, etc.)
 */
export class NetworkError extends ExtensionError {
  readonly code = 'NETWORK_ERROR' as const;
  readonly userMessage = 'Network error. Please check your connection and try again.';

  constructor(message = 'Network error', cause?: unknown) {
    super(message, cause);
  }
}

// =============================================================================
// API Errors
// =============================================================================

/**
 * Error thrown when an API returns an error response
 */
export class ApiError extends ExtensionError {
  readonly code = 'API_ERROR' as const;

  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly apiMessage?: string,
    cause?: unknown
  ) {
    super(message, cause);
  }

  get userMessage(): string {
    if (this.apiMessage) {
      return this.apiMessage;
    }
    if (this.statusCode) {
      return `API error (${this.statusCode}). Please try again.`;
    }
    return 'An error occurred while communicating with the server.';
  }
}

/**
 * Error thrown when API rate limit is exceeded
 */
export class RateLimitError extends ExtensionError {
  readonly code = 'RATE_LIMITED' as const;
  readonly userMessage = 'Too many requests. Please wait a moment and try again.';

  constructor(
    message = 'Rate limit exceeded',
    public readonly retryAfterSeconds?: number,
    cause?: unknown
  ) {
    super(message, cause);
  }
}

// =============================================================================
// Validation Errors
// =============================================================================

/**
 * Error thrown when request/input validation fails
 */
export class ValidationError extends ExtensionError {
  readonly code = 'VALIDATION_ERROR' as const;

  constructor(
    message: string,
    public readonly field?: string,
    cause?: unknown
  ) {
    super(message, cause);
  }

  get userMessage(): string {
    if (this.field) {
      return `Invalid ${this.field}: ${this.message}`;
    }
    return this.message;
  }
}

// =============================================================================
// Storage Errors
// =============================================================================

/**
 * Error thrown when storage operations fail
 */
export class StorageError extends ExtensionError {
  readonly code = 'STORAGE_ERROR' as const;
  readonly userMessage = 'Failed to access local storage. Please try again.';

  constructor(message = 'Storage operation failed', cause?: unknown) {
    super(message, cause);
  }
}

// =============================================================================
// Network Status Detection
// =============================================================================

/**
 * Check if the browser reports being offline
 * Note: navigator.onLine is not always reliable, but it's a good first check
 */
export function isOffline(): boolean {
  return typeof navigator !== 'undefined' && !navigator.onLine;
}

/**
 * Check if an error indicates a network failure
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof NetworkError || error instanceof NetworkOfflineError) {
    return true;
  }

  if (error instanceof TypeError) {
    const message = error.message.toLowerCase();
    return (
      message.includes('failed to fetch') ||
      message.includes('network') ||
      message.includes('load failed') ||
      message.includes('networkerror')
    );
  }

  return false;
}

// =============================================================================
// Error Classification and Wrapping
// =============================================================================

/**
 * Wrap a fetch error into an appropriate ExtensionError
 * Detects network issues, authentication problems, and API errors
 */
export function wrapFetchError(error: unknown, context?: string): ExtensionError {
  // Check if offline first
  if (isOffline()) {
    return new NetworkOfflineError(context ? `${context}: offline` : 'Network offline', error);
  }

  // Check for abort/cancellation
  if (error instanceof Error && error.name === 'AbortError') {
    // Re-throw abort errors as-is, they're expected for cancellation
    throw error;
  }

  // Check for network errors
  if (isNetworkError(error)) {
    return new NetworkError(
      context ? `${context}: network error` : 'Network request failed',
      error
    );
  }

  // If it's already an ExtensionError, return it
  if (error instanceof ExtensionError) {
    return error;
  }

  // Wrap unknown errors
  const message = error instanceof Error ? error.message : String(error);
  return new ApiError(context ? `${context}: ${message}` : message, undefined, undefined, error);
}

/**
 * Wrap an HTTP response error into an appropriate ExtensionError
 * @param response - The fetch Response object
 * @param context - Optional context string for error messages
 * @param apiMessage - Optional error message from the API
 */
export function wrapResponseError(
  response: Response,
  context?: string,
  apiMessage?: string
): ExtensionError {
  const status = response.status;

  // Authentication errors
  if (status === 401) {
    return new AuthExpiredError(
      context ? `${context}: unauthorized` : 'Unauthorized',
      undefined
    );
  }

  if (status === 403) {
    return new AuthFailedError(
      context ? `${context}: forbidden` : 'Access denied',
      undefined
    );
  }

  // Rate limiting
  if (status === 429) {
    const retryAfter = response.headers.get('Retry-After');
    const retrySeconds = retryAfter ? parseInt(retryAfter, 10) : undefined;
    return new RateLimitError(
      context ? `${context}: rate limited` : 'Rate limit exceeded',
      retrySeconds,
      undefined
    );
  }

  // Not found
  if (status === 404) {
    return new ApiError(
      context ? `${context}: not found` : 'Resource not found',
      status,
      apiMessage || 'The requested resource was not found.',
      undefined
    );
  }

  // Client errors
  if (status >= 400 && status < 500) {
    return new ApiError(
      context ? `${context}: client error ${status}` : `Client error ${status}`,
      status,
      apiMessage,
      undefined
    );
  }

  // Server errors
  if (status >= 500) {
    return new ApiError(
      context ? `${context}: server error ${status}` : `Server error ${status}`,
      status,
      apiMessage || 'The server encountered an error. Please try again later.',
      undefined
    );
  }

  // Unknown status
  return new ApiError(
    context ? `${context}: HTTP ${status}` : `HTTP error ${status}`,
    status,
    apiMessage,
    undefined
  );
}

/**
 * Get the error code from any error (including non-ExtensionErrors)
 */
export function getErrorCode(error: unknown): ErrorCode {
  if (error instanceof ExtensionError) {
    return error.code;
  }

  if (isNetworkError(error)) {
    return isOffline() ? 'NETWORK_OFFLINE' : 'NETWORK_ERROR';
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes('auth') || message.includes('token')) {
      return 'AUTH_REQUIRED';
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
 * Get a user-friendly error message from any error
 */
export function getUserMessage(error: unknown): string {
  if (error instanceof ExtensionError) {
    return error.userMessage;
  }

  if (isOffline()) {
    return 'You appear to be offline. Please check your internet connection.';
  }

  if (isNetworkError(error)) {
    return 'Network error. Please check your connection and try again.';
  }

  if (error instanceof Error) {
    // Sanitize technical error messages for users
    const message = error.message;

    // Keep messages that are already user-friendly
    if (message.length < 100 && !message.includes('Error:') && !message.includes('at ')) {
      return message;
    }
  }

  return 'An unexpected error occurred. Please try again.';
}

// =============================================================================
// Error Handling Utilities
// =============================================================================

/**
 * Safely execute an async function and wrap any errors
 * Returns a tuple of [result, error] for easier error handling
 */
export async function tryCatch<T>(
  fn: () => Promise<T>,
  context?: string
): Promise<[T, null] | [null, ExtensionError]> {
  try {
    const result = await fn();
    return [result, null];
  } catch (error) {
    if (error instanceof ExtensionError) {
      return [null, error];
    }
    return [null, wrapFetchError(error, context)];
  }
}

/**
 * Create an error handler that logs and wraps errors with context
 */
export function createErrorHandler(context: string) {
  return (error: unknown): ExtensionError => {
    const wrappedError =
      error instanceof ExtensionError ? error : wrapFetchError(error, context);

    // Log the error with context
    console.error(`[${context}]`, wrappedError.message, wrappedError.cause || '');

    return wrappedError;
  };
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Check if an error is an authentication error
 */
export function isAuthError(error: unknown): error is AuthRequiredError | AuthFailedError | AuthExpiredError {
  return (
    error instanceof AuthRequiredError ||
    error instanceof AuthFailedError ||
    error instanceof AuthExpiredError
  );
}

/**
 * Check if an error is a rate limit error
 */
export function isRateLimitError(error: unknown): error is RateLimitError {
  return error instanceof RateLimitError;
}

/**
 * Check if an error is recoverable (can be retried)
 */
export function isRecoverableError(error: unknown): boolean {
  // Network errors are usually transient
  if (error instanceof NetworkError || error instanceof NetworkOfflineError) {
    return true;
  }

  // Rate limits are recoverable after waiting
  if (error instanceof RateLimitError) {
    return true;
  }

  // Server errors (5xx) are often transient
  if (error instanceof ApiError && error.statusCode && error.statusCode >= 500) {
    return true;
  }

  return false;
}
