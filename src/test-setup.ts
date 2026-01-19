import { vi } from 'vitest';

// Mock chrome APIs for testing
const mockStorage: Record<string, unknown> = {};

const mockChromeStorage = {
  local: {
    get: vi.fn((keys: string | string[] | null) => {
      if (keys === null) {
        return Promise.resolve(mockStorage);
      }
      if (typeof keys === 'string') {
        return Promise.resolve({ [keys]: mockStorage[keys] });
      }
      const result: Record<string, unknown> = {};
      for (const key of keys) {
        if (key in mockStorage) {
          result[key] = mockStorage[key];
        }
      }
      return Promise.resolve(result);
    }),
    set: vi.fn((items: Record<string, unknown>) => {
      Object.assign(mockStorage, items);
      return Promise.resolve();
    }),
    remove: vi.fn((keys: string | string[]) => {
      const keysArray = typeof keys === 'string' ? [keys] : keys;
      for (const key of keysArray) {
        delete mockStorage[key];
      }
      return Promise.resolve();
    }),
    clear: vi.fn(() => {
      for (const key of Object.keys(mockStorage)) {
        delete mockStorage[key];
      }
      return Promise.resolve();
    }),
  },
  sync: {
    get: vi.fn(() => Promise.resolve({})),
    set: vi.fn(() => Promise.resolve()),
    remove: vi.fn(() => Promise.resolve()),
    clear: vi.fn(() => Promise.resolve()),
  },
};

const mockChromeRuntime = {
  sendMessage: vi.fn(() => Promise.resolve()),
  onMessage: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
    hasListener: vi.fn(() => false),
  },
  onInstalled: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
  },
  getURL: vi.fn((path: string) => `chrome-extension://mock-id/${path}`),
  getManifest: vi.fn(() => ({ version: '1.0.0' })),
  id: 'mock-extension-id',
  lastError: undefined as chrome.runtime.LastError | undefined,
};

const mockChromeIdentity = {
  launchWebAuthFlow: vi.fn((_details: { url: string; interactive?: boolean }) =>
    Promise.resolve('https://redirect.url')
  ),
  getRedirectURL: vi.fn(() => 'https://mock-id.chromiumapp.org/'),
};

const mockChromeTabs = {
  query: vi.fn(() => Promise.resolve([])),
  sendMessage: vi.fn(() => Promise.resolve()),
  get: vi.fn(() => Promise.resolve({ id: 1, url: 'https://example.com' })),
  create: vi.fn((_createProperties: chrome.tabs.CreateProperties, callback?: (tab: chrome.tabs.Tab) => void) => {
    const mockTab = { id: 123, url: _createProperties.url };
    if (callback) {
      callback(mockTab as chrome.tabs.Tab);
    }
    return mockTab;
  }),
  remove: vi.fn(() => Promise.resolve()),
  onUpdated: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
  },
  onRemoved: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
  },
};

const mockChromeContextMenus = {
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  removeAll: vi.fn(),
  onClicked: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
  },
};

const mockChromeCommands = {
  getAll: vi.fn(() => Promise.resolve([])),
  onCommand: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
  },
};

// Create the global chrome mock
const chromeMock = {
  storage: mockChromeStorage,
  runtime: mockChromeRuntime,
  identity: mockChromeIdentity,
  tabs: mockChromeTabs,
  contextMenus: mockChromeContextMenus,
  commands: mockChromeCommands,
};

// Assign to global
(globalThis as unknown as { chrome: typeof chromeMock }).chrome = chromeMock;

// Export mock storage for tests to manipulate
export { mockStorage, chromeMock };
