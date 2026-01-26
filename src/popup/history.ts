/**
 * Task history storage functions for popup
 * Stores recently created tasks for quick access (LIFO, max 50 entries)
 */

import type { TaskHistoryEntry } from '../shared/types';
import { STORAGE_KEYS } from '../shared/constants';
import { get, set } from '../shared/storage';

/** Maximum number of history entries to store */
const MAX_HISTORY_ENTRIES = 50;

/**
 * Load task history from storage
 * @returns Promise resolving to array of history entries (empty if none stored)
 */
export async function loadHistory(): Promise<TaskHistoryEntry[]> {
  const history = await get<TaskHistoryEntry[]>(STORAGE_KEYS.TASK_HISTORY);
  return history ?? [];
}

/**
 * Save a task to history
 * Prepends to array (LIFO) and caps at MAX_HISTORY_ENTRIES
 * @param task - Task history entry to save
 */
export async function saveToHistory(task: TaskHistoryEntry): Promise<void> {
  const history = await loadHistory();
  const updated = [task, ...history].slice(0, MAX_HISTORY_ENTRIES);
  await set(STORAGE_KEYS.TASK_HISTORY, updated);
}

/**
 * Format a timestamp as relative time
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Human-readable relative time string
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) {
    return 'Just now';
  }
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  if (diffDays === 1) {
    return 'Yesterday';
  }
  // "Mon DD" format for older dates
  const date = new Date(timestamp);
  const month = date.toLocaleDateString('en-US', { month: 'short' });
  const day = date.getDate();
  return `${month} ${day}`;
}

/**
 * Render history list into container element
 * @param container - DOM element to render into
 * @param entries - Array of history entries to display
 */
export function renderHistoryList(
  container: HTMLElement,
  entries: TaskHistoryEntry[]
): void {
  // Clear container
  container.innerHTML = '';

  // Show empty state if no entries
  if (entries.length === 0) {
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'history-empty';
    emptyDiv.textContent = 'No tasks created yet';
    container.appendChild(emptyDiv);
    return;
  }

  // Create list
  const ul = document.createElement('ul');
  ul.className = 'history-list';

  for (const entry of entries) {
    const li = document.createElement('li');
    li.className = 'history-item';
    li.dataset.url = entry.permalink_url;

    const nameSpan = document.createElement('span');
    nameSpan.className = 'history-name';
    nameSpan.textContent = entry.name;

    const timeSpan = document.createElement('span');
    timeSpan.className = 'history-time';
    timeSpan.textContent = formatRelativeTime(entry.createdAt);

    li.appendChild(nameSpan);
    li.appendChild(timeSpan);
    ul.appendChild(li);
  }

  container.appendChild(ul);
}
