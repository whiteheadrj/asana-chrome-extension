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
