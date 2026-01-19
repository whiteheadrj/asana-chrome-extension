/**
 * Context Menu Module
 * Handles right-click context menu for creating Asana tasks
 */

// =============================================================================
// Context Menu Registration
// =============================================================================

/**
 * Register the "Create Asana Task" context menu item
 * Called on extension install/startup
 */
export function registerContextMenu(): void {
  // Remove existing menu items to avoid duplicates
  chrome.contextMenus.removeAll(() => {
    // Create context menu for all contexts (page, selection, link, etc.)
    chrome.contextMenus.create({
      id: 'create-asana-task',
      title: 'Create Asana Task',
      contexts: ['page', 'selection', 'link'],
    });

    // Create context menu specifically for text selection with selected text in title
    chrome.contextMenus.create({
      id: 'create-asana-task-selection',
      title: 'Create Asana Task from "%s"',
      contexts: ['selection'],
    });

    console.log('Context menu registered');
  });
}

// =============================================================================
// Context Menu Click Handler
// =============================================================================

/**
 * Handle context menu clicks
 * Opens popup with selected text (if any) pre-filled
 */
export function handleContextMenuClick(
  info: chrome.contextMenus.OnClickData,
  tab?: chrome.tabs.Tab
): void {
  const menuItemId = info.menuItemId;

  if (
    menuItemId === 'create-asana-task' ||
    menuItemId === 'create-asana-task-selection'
  ) {
    // Get selected text if available
    const selectedText = info.selectionText || '';
    const pageUrl = info.pageUrl || tab?.url || '';
    const pageTitle = tab?.title || '';

    // Store context data for popup to retrieve
    chrome.storage.local.set({
      contextMenuData: {
        selectedText,
        pageUrl,
        pageTitle,
        timestamp: Date.now(),
      },
    });

    // Open popup by triggering the action
    // Note: Can't directly open popup from context menu in MV3
    // Instead, we notify the user to click the extension icon
    // or open a new popup window
    if (tab?.id) {
      // Send message to content script if it exists
      chrome.tabs.sendMessage(
        tab.id,
        {
          type: 'CONTEXT_MENU_TRIGGERED',
          data: {
            selectedText,
            pageUrl,
            pageTitle,
          },
        },
        () => {
          // Ignore errors if content script not loaded
          if (chrome.runtime.lastError) {
            // Content script not available, that's okay
          }
        }
      );
    }

    // Open popup in a new window since we can't programmatically open the action popup
    chrome.action.openPopup().catch(() => {
      // openPopup may not be available or may fail
      // Fall back to opening popup.html in a new window
      chrome.windows.create({
        url: chrome.runtime.getURL('popup/popup.html'),
        type: 'popup',
        width: 400,
        height: 550,
      });
    });
  }
}

// =============================================================================
// Setup Function
// =============================================================================

/**
 * Initialize context menu functionality
 * Should be called from service worker on startup
 */
export function setupContextMenu(): void {
  // Register context menu
  registerContextMenu();

  // Listen for context menu clicks
  chrome.contextMenus.onClicked.addListener(handleContextMenuClick);
}
