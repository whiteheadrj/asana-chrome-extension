/**
 * @vitest-environment happy-dom
 */

/**
 * Unit tests for history module (task history storage and display)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockStorage } from '../../test-setup.js';
import { loadHistory, saveToHistory, formatRelativeTime, renderHistoryList } from '../history.js';
import { STORAGE_KEYS } from '../../shared/constants.js';
import type { TaskHistoryEntry } from '../../shared/types.js';

describe('history module', () => {
  beforeEach(() => {
    // Clear mock storage before each test
    for (const key of Object.keys(mockStorage)) {
      delete mockStorage[key];
    }
    vi.clearAllMocks();
  });

  // ===========================================================================
  // loadHistory
  // ===========================================================================

  describe('loadHistory', () => {
    it('returns empty array for empty storage', async () => {
      const result = await loadHistory();
      expect(result).toEqual([]);
    });

    it('returns stored history entries', async () => {
      const entries: TaskHistoryEntry[] = [
        { gid: '1', name: 'Task 1', permalink_url: 'https://app.asana.com/0/1', createdAt: 1000 },
        { gid: '2', name: 'Task 2', permalink_url: 'https://app.asana.com/0/2', createdAt: 2000 },
      ];
      mockStorage[STORAGE_KEYS.TASK_HISTORY] = entries;

      const result = await loadHistory();

      expect(result).toEqual(entries);
      expect(result).toHaveLength(2);
    });

    it('returns empty array for invalid/null data', async () => {
      mockStorage[STORAGE_KEYS.TASK_HISTORY] = null;

      const result = await loadHistory();

      expect(result).toEqual([]);
    });

    it('returns empty array when storage read fails', async () => {
      // Simulate storage error by making get throw
      const originalGet = chrome.storage.local.get;
      vi.mocked(chrome.storage.local.get).mockRejectedValueOnce(new Error('Storage error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await loadHistory();

      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith('Failed to load task history:', expect.any(Error));

      consoleSpy.mockRestore();
      chrome.storage.local.get = originalGet;
    });
  });

  // ===========================================================================
  // saveToHistory
  // ===========================================================================

  describe('saveToHistory', () => {
    it('saves first entry to empty history', async () => {
      const task: TaskHistoryEntry = {
        gid: '123',
        name: 'New Task',
        permalink_url: 'https://app.asana.com/0/123',
        createdAt: Date.now(),
      };

      await saveToHistory(task);

      const stored = mockStorage[STORAGE_KEYS.TASK_HISTORY] as TaskHistoryEntry[];
      expect(stored).toHaveLength(1);
      expect(stored[0]).toEqual(task);
    });

    it('prepends new entry to existing history (LIFO)', async () => {
      const existingTask: TaskHistoryEntry = {
        gid: '1',
        name: 'Old Task',
        permalink_url: 'https://app.asana.com/0/1',
        createdAt: 1000,
      };
      mockStorage[STORAGE_KEYS.TASK_HISTORY] = [existingTask];

      const newTask: TaskHistoryEntry = {
        gid: '2',
        name: 'New Task',
        permalink_url: 'https://app.asana.com/0/2',
        createdAt: 2000,
      };

      await saveToHistory(newTask);

      const stored = mockStorage[STORAGE_KEYS.TASK_HISTORY] as TaskHistoryEntry[];
      expect(stored).toHaveLength(2);
      expect(stored[0]).toEqual(newTask); // New task is first
      expect(stored[1]).toEqual(existingTask); // Old task is second
    });

    it('keeps history under cap (50 entries)', async () => {
      // Create 50 existing entries - in LIFO order (newest first)
      // Entry at index 0 is newest (Task 49), entry at index 49 is oldest (Task 0)
      const existingEntries: TaskHistoryEntry[] = [];
      for (let i = 49; i >= 0; i--) {
        existingEntries.push({
          gid: `${i}`,
          name: `Task ${i}`,
          permalink_url: `https://app.asana.com/0/${i}`,
          createdAt: i * 1000,
        });
      }
      mockStorage[STORAGE_KEYS.TASK_HISTORY] = existingEntries;

      const newTask: TaskHistoryEntry = {
        gid: 'new',
        name: 'New Task',
        permalink_url: 'https://app.asana.com/0/new',
        createdAt: Date.now(),
      };

      await saveToHistory(newTask);

      const stored = mockStorage[STORAGE_KEYS.TASK_HISTORY] as TaskHistoryEntry[];
      expect(stored).toHaveLength(50); // Cap at 50
      expect(stored[0]).toEqual(newTask); // New task is first
      expect(stored[49].gid).toBe('1'); // Task 0 was removed (oldest, was at index 49)
    });

    it('removes oldest entry when adding 51st entry', async () => {
      // Create 50 existing entries - in LIFO order (newest first)
      // Entry at index 0 is newest (Task 50), entry at index 49 is oldest (Task 1)
      const existingEntries: TaskHistoryEntry[] = [];
      for (let i = 50; i >= 1; i--) {
        existingEntries.push({
          gid: `${i}`,
          name: `Task ${i}`,
          permalink_url: `https://app.asana.com/0/${i}`,
          createdAt: i * 1000,
        });
      }
      mockStorage[STORAGE_KEYS.TASK_HISTORY] = existingEntries;

      // Verify oldest entry exists before save (Task 1 at last position)
      const beforeSave = mockStorage[STORAGE_KEYS.TASK_HISTORY] as TaskHistoryEntry[];
      expect(beforeSave[49].gid).toBe('1'); // Task 1 is at last position (oldest)

      const newTask: TaskHistoryEntry = {
        gid: '51',
        name: 'Task 51',
        permalink_url: 'https://app.asana.com/0/51',
        createdAt: 51000,
      };

      await saveToHistory(newTask);

      const stored = mockStorage[STORAGE_KEYS.TASK_HISTORY] as TaskHistoryEntry[];
      expect(stored).toHaveLength(50);
      expect(stored[0].gid).toBe('51'); // New task is first
      expect(stored.find(e => e.gid === '1')).toBeUndefined(); // Task 1 was removed (oldest, was at index 49)
    });

    it('logs error but does not throw on storage failure', async () => {
      vi.mocked(chrome.storage.local.set).mockRejectedValueOnce(new Error('Storage error'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const task: TaskHistoryEntry = {
        gid: '123',
        name: 'Task',
        permalink_url: 'https://app.asana.com/0/123',
        createdAt: Date.now(),
      };

      // Should not throw
      await expect(saveToHistory(task)).resolves.toBeUndefined();
      expect(consoleSpy).toHaveBeenCalledWith('Failed to save task to history:', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });

  // ===========================================================================
  // formatRelativeTime
  // ===========================================================================

  describe('formatRelativeTime', () => {
    let realDateNow: () => number;

    beforeEach(() => {
      realDateNow = Date.now;
      // Fix "now" to a known timestamp for predictable tests
      Date.now = () => 1700000000000; // Fixed timestamp
    });

    afterEach(() => {
      Date.now = realDateNow;
    });

    it('returns "Just now" for timestamps less than 1 minute ago', () => {
      const timestamp = Date.now() - 30000; // 30 seconds ago
      expect(formatRelativeTime(timestamp)).toBe('Just now');
    });

    it('returns "Just now" for timestamp exactly now', () => {
      expect(formatRelativeTime(Date.now())).toBe('Just now');
    });

    it('returns "Xm ago" for timestamps less than 60 minutes ago', () => {
      expect(formatRelativeTime(Date.now() - 60000)).toBe('1m ago'); // 1 minute
      expect(formatRelativeTime(Date.now() - 300000)).toBe('5m ago'); // 5 minutes
      expect(formatRelativeTime(Date.now() - 3540000)).toBe('59m ago'); // 59 minutes
    });

    it('returns "Xh ago" for timestamps less than 24 hours ago', () => {
      expect(formatRelativeTime(Date.now() - 3600000)).toBe('1h ago'); // 1 hour
      expect(formatRelativeTime(Date.now() - 7200000)).toBe('2h ago'); // 2 hours
      expect(formatRelativeTime(Date.now() - 82800000)).toBe('23h ago'); // 23 hours
    });

    it('returns "Yesterday" for timestamps 1 day ago', () => {
      const oneDayMs = 24 * 60 * 60 * 1000;
      expect(formatRelativeTime(Date.now() - oneDayMs)).toBe('Yesterday');
      // Also test at 1.5 days (should still be "Yesterday" as diffDays rounds down to 1)
      expect(formatRelativeTime(Date.now() - oneDayMs * 1.5)).toBe('Yesterday');
    });

    it('returns "Mon DD" format for timestamps older than yesterday', () => {
      const twoDaysMs = 2 * 24 * 60 * 60 * 1000;
      const result = formatRelativeTime(Date.now() - twoDaysMs);
      // Should be in "Mon DD" format (e.g., "Nov 12")
      expect(result).toMatch(/^[A-Z][a-z]{2} \d{1,2}$/);
    });

    it('formats dates correctly for various months', () => {
      // Test with a specific date: Nov 14, 2023 (fixed Date.now is around Nov 14)
      const timestamp = new Date('2023-10-15T12:00:00Z').getTime();
      const result = formatRelativeTime(timestamp);
      expect(result).toBe('Oct 15');
    });
  });

  // ===========================================================================
  // renderHistoryList
  // ===========================================================================

  describe('renderHistoryList', () => {
    let container: HTMLElement;

    beforeEach(() => {
      container = document.createElement('div');
    });

    it('renders empty state when entries array is empty', () => {
      renderHistoryList(container, []);

      const emptyDiv = container.querySelector('.history-empty');
      expect(emptyDiv).not.toBeNull();
      expect(emptyDiv?.textContent).toBe('No tasks created yet');
    });

    it('clears container before rendering', () => {
      container.innerHTML = '<p>Old content</p>';

      renderHistoryList(container, []);

      expect(container.querySelector('p')).toBeNull();
      expect(container.querySelector('.history-empty')).not.toBeNull();
    });

    it('renders list with entries', () => {
      const entries: TaskHistoryEntry[] = [
        { gid: '1', name: 'Task One', permalink_url: 'https://app.asana.com/0/1', createdAt: Date.now() },
        { gid: '2', name: 'Task Two', permalink_url: 'https://app.asana.com/0/2', createdAt: Date.now() - 3600000 },
      ];

      renderHistoryList(container, entries);

      const list = container.querySelector('.history-list');
      expect(list).not.toBeNull();
      expect(list?.tagName).toBe('UL');

      const items = container.querySelectorAll('.history-item');
      expect(items).toHaveLength(2);
    });

    it('sets data-url attribute on list items', () => {
      const entries: TaskHistoryEntry[] = [
        { gid: '1', name: 'Task', permalink_url: 'https://app.asana.com/0/test/1', createdAt: Date.now() },
      ];

      renderHistoryList(container, entries);

      const item = container.querySelector('.history-item') as HTMLElement;
      expect(item.dataset.url).toBe('https://app.asana.com/0/test/1');
    });

    it('renders task name in span with textContent (not innerHTML for XSS safety)', () => {
      const entries: TaskHistoryEntry[] = [
        { gid: '1', name: '<script>alert("xss")</script>', permalink_url: 'https://app.asana.com/0/1', createdAt: Date.now() },
      ];

      renderHistoryList(container, entries);

      const nameSpan = container.querySelector('.history-name');
      expect(nameSpan?.textContent).toBe('<script>alert("xss")</script>');
      // Verify it's not interpreted as HTML
      expect(container.querySelector('script')).toBeNull();
    });

    it('renders relative time in history-time span', () => {
      const entries: TaskHistoryEntry[] = [
        { gid: '1', name: 'Task', permalink_url: 'https://app.asana.com/0/1', createdAt: Date.now() - 60000 },
      ];

      renderHistoryList(container, entries);

      const timeSpan = container.querySelector('.history-time');
      expect(timeSpan?.textContent).toBe('1m ago');
    });

    it('skips invalid entries gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const entries = [
        { gid: '1', name: 'Valid Task', permalink_url: 'https://app.asana.com/0/1', createdAt: Date.now() },
        { gid: '2', name: null, permalink_url: 'https://app.asana.com/0/2', createdAt: Date.now() } as unknown as TaskHistoryEntry,
        { gid: '3', name: 'Missing URL', permalink_url: '', createdAt: Date.now() } as TaskHistoryEntry,
        null as unknown as TaskHistoryEntry,
        { gid: '4', name: 'Invalid createdAt', permalink_url: 'https://app.asana.com/0/4', createdAt: 'invalid' as unknown as number },
      ];

      renderHistoryList(container, entries);

      const items = container.querySelectorAll('.history-item');
      expect(items).toHaveLength(1); // Only valid entry rendered
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('renders empty state when all entries are invalid', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const entries = [
        null as unknown as TaskHistoryEntry,
        { gid: '1', name: null, permalink_url: 'url', createdAt: 1000 } as unknown as TaskHistoryEntry,
      ];

      renderHistoryList(container, entries);

      // All entries invalid - list should be empty but not show empty state
      // (because we still create the UL element)
      const list = container.querySelector('.history-list');
      expect(list).not.toBeNull();
      const items = container.querySelectorAll('.history-item');
      expect(items).toHaveLength(0);

      consoleSpy.mockRestore();
    });

    it('renders entries with correct structure', () => {
      const entries: TaskHistoryEntry[] = [
        { gid: '1', name: 'My Task', permalink_url: 'https://app.asana.com/0/proj/1', createdAt: Date.now() },
      ];

      renderHistoryList(container, entries);

      const item = container.querySelector('.history-item');
      expect(item?.tagName).toBe('LI');

      const nameSpan = item?.querySelector('.history-name');
      expect(nameSpan?.tagName).toBe('SPAN');
      expect(nameSpan?.textContent).toBe('My Task');

      const timeSpan = item?.querySelector('.history-time');
      expect(timeSpan?.tagName).toBe('SPAN');
    });
  });
});
