/**
 * Settings page logic for Asana Chrome Extension
 * Handles API key management, cache settings, and account connection
 */

import type { ExtensionMessage } from '../shared/types';
import { STORAGE_KEYS, DEFAULT_CACHE_TTL } from '../shared/constants';
import { get, set, remove } from '../shared/storage';

// =============================================================================
// DOM Elements
// =============================================================================

const elements = {
  // Form
  settingsForm: document.getElementById('settings-form') as HTMLFormElement,

  // Status message
  statusMessage: document.getElementById('status-message') as HTMLElement,

  // API Key
  claudeApiKeyInput: document.getElementById('claude-api-key') as HTMLInputElement,
  toggleApiKeyButton: document.getElementById('toggle-api-key') as HTMLButtonElement,

  // Keyboard shortcut
  currentShortcut: document.getElementById('current-shortcut') as HTMLElement,
  openShortcutsLink: document.getElementById('open-shortcuts-link') as HTMLAnchorElement,

  // Cache settings
  cacheTtlSelect: document.getElementById('cache-ttl') as HTMLSelectElement,
  clearCacheButton: document.getElementById('clear-cache-button') as HTMLButtonElement,

  // Account
  connectionStatus: document.getElementById('connection-status') as HTMLElement,
  connectionText: document.getElementById('connection-text') as HTMLElement,
  disconnectButton: document.getElementById('disconnect-button') as HTMLButtonElement,

  // Save button
  saveButton: document.getElementById('save-button') as HTMLButtonElement,
};

// =============================================================================
// Message Sending
// =============================================================================

function sendMessage<T>(message: ExtensionMessage): Promise<{ success: boolean; data?: T; error?: string }> {
  return chrome.runtime.sendMessage(message);
}

// =============================================================================
// UI Helpers
// =============================================================================

function showStatus(message: string, type: 'success' | 'error'): void {
  elements.statusMessage.textContent = message;
  elements.statusMessage.className = `status-message ${type}`;
  elements.statusMessage.classList.remove('hidden');

  // Auto-hide after 3 seconds
  setTimeout(() => {
    elements.statusMessage.classList.add('hidden');
  }, 3000);
}

function hideStatus(): void {
  elements.statusMessage.classList.add('hidden');
}

// =============================================================================
// API Key Visibility Toggle
// =============================================================================

function setupApiKeyToggle(): void {
  elements.toggleApiKeyButton.addEventListener('click', () => {
    const isPassword = elements.claudeApiKeyInput.type === 'password';
    elements.claudeApiKeyInput.type = isPassword ? 'text' : 'password';
    elements.toggleApiKeyButton.classList.toggle('showing', isPassword);
  });
}

// =============================================================================
// Keyboard Shortcut Display
// =============================================================================

async function loadKeyboardShortcut(): Promise<void> {
  try {
    const commands = await chrome.commands.getAll();
    const executeAction = commands.find(cmd => cmd.name === '_execute_action');

    if (executeAction?.shortcut) {
      elements.currentShortcut.textContent = executeAction.shortcut;
    } else {
      elements.currentShortcut.textContent = 'Not set';
    }
  } catch (error) {
    console.error('Failed to load keyboard shortcut:', error);
    elements.currentShortcut.textContent = 'Alt+A';
  }
}

function setupShortcutsLink(): void {
  elements.openShortcutsLink.addEventListener('click', (e) => {
    e.preventDefault();
    // Open Chrome's keyboard shortcuts page for extensions
    chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
  });
}

// =============================================================================
// Settings Loading
// =============================================================================

async function loadSettings(): Promise<void> {
  try {
    // Load Claude API key
    const apiKey = await get<string>(STORAGE_KEYS.CLAUDE_API_KEY);
    if (apiKey) {
      elements.claudeApiKeyInput.value = apiKey;
    }

    // Load cache TTL
    const cacheTtl = await get<number>(STORAGE_KEYS.CACHE_TTL);
    if (cacheTtl) {
      elements.cacheTtlSelect.value = String(cacheTtl);
    } else {
      elements.cacheTtlSelect.value = String(DEFAULT_CACHE_TTL);
    }

    // Check auth status
    await checkAuthStatus();

    // Load keyboard shortcut
    await loadKeyboardShortcut();
  } catch (error) {
    console.error('Failed to load settings:', error);
    showStatus('Failed to load settings', 'error');
  }
}

// =============================================================================
// Auth Status
// =============================================================================

async function checkAuthStatus(): Promise<void> {
  try {
    const response = await sendMessage<{ isAuthenticated: boolean }>({ type: 'GET_AUTH_STATUS' });

    if (response.success && response.data?.isAuthenticated) {
      elements.connectionStatus.className = 'status-dot connected';
      elements.connectionText.textContent = 'Connected to Asana';
      elements.disconnectButton.disabled = false;
    } else {
      elements.connectionStatus.className = 'status-dot disconnected';
      elements.connectionText.textContent = 'Not connected';
      elements.disconnectButton.disabled = true;
    }
  } catch (error) {
    console.error('Failed to check auth status:', error);
    elements.connectionStatus.className = 'status-dot disconnected';
    elements.connectionText.textContent = 'Status unknown';
    elements.disconnectButton.disabled = true;
  }
}

// =============================================================================
// Settings Saving
// =============================================================================

async function saveSettings(): Promise<void> {
  hideStatus();
  elements.saveButton.disabled = true;
  elements.saveButton.textContent = 'Saving...';

  try {
    // Save Claude API key
    const apiKey = elements.claudeApiKeyInput.value.trim();
    if (apiKey) {
      await set(STORAGE_KEYS.CLAUDE_API_KEY, apiKey);
    } else {
      await remove(STORAGE_KEYS.CLAUDE_API_KEY);
    }

    // Save cache TTL
    const cacheTtl = parseInt(elements.cacheTtlSelect.value, 10);
    if (!isNaN(cacheTtl) && cacheTtl > 0) {
      await set(STORAGE_KEYS.CACHE_TTL, cacheTtl);
    }

    showStatus('Settings saved successfully', 'success');
  } catch (error) {
    console.error('Failed to save settings:', error);
    showStatus('Failed to save settings', 'error');
  } finally {
    elements.saveButton.disabled = false;
    elements.saveButton.textContent = 'Save Settings';
  }
}

// =============================================================================
// Cache Clearing
// =============================================================================

async function handleClearCache(): Promise<void> {
  elements.clearCacheButton.disabled = true;
  elements.clearCacheButton.textContent = 'Clearing...';

  try {
    await sendMessage({ type: 'REFRESH_CACHE' });
    showStatus('Cache cleared successfully', 'success');
  } catch (error) {
    console.error('Failed to clear cache:', error);
    showStatus('Failed to clear cache', 'error');
  } finally {
    elements.clearCacheButton.disabled = false;
    elements.clearCacheButton.textContent = 'Clear Cache Now';
  }
}

// =============================================================================
// Account Disconnect
// =============================================================================

async function handleDisconnect(): Promise<void> {
  if (!confirm('Are you sure you want to disconnect your Asana account? This will log you out and clear your saved preferences.')) {
    return;
  }

  elements.disconnectButton.disabled = true;
  elements.disconnectButton.textContent = 'Disconnecting...';

  try {
    await sendMessage({ type: 'LOGOUT' });

    // Clear local preferences
    await remove(STORAGE_KEYS.LAST_USED_SELECTIONS);

    // Update UI
    elements.connectionStatus.className = 'status-dot disconnected';
    elements.connectionText.textContent = 'Not connected';

    showStatus('Account disconnected successfully', 'success');
  } catch (error) {
    console.error('Failed to disconnect:', error);
    showStatus('Failed to disconnect account', 'error');
  } finally {
    elements.disconnectButton.textContent = 'Disconnect Account';
    // Keep button disabled since we're now disconnected
  }
}

// =============================================================================
// Event Listeners
// =============================================================================

function setupEventListeners(): void {
  // Form submit
  elements.settingsForm.addEventListener('submit', (e) => {
    e.preventDefault();
    saveSettings();
  });

  // Clear cache button
  elements.clearCacheButton.addEventListener('click', handleClearCache);

  // Disconnect button
  elements.disconnectButton.addEventListener('click', handleDisconnect);

  // Setup API key visibility toggle
  setupApiKeyToggle();

  // Setup shortcuts link
  setupShortcutsLink();
}

// =============================================================================
// Initialization
// =============================================================================

async function init(): Promise<void> {
  setupEventListeners();
  await loadSettings();
}

// Start initialization when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
