import { StateStorage } from 'zustand/middleware';
import { logger } from '@/lib/safe-logger';

function isLocalStorageAvailable(): boolean {
  try {
    const testKey = '__zsn_storage_test__';
    localStorage.setItem(testKey, 'test');
    localStorage.removeItem(testKey);
    return true;
  } catch (err) {
    logger.warn('[Storage] localStorage unavailable:', err);
    return false;
  }
}

export const safeStorage: StateStorage = {
  getItem: (name) => {
    if (!isLocalStorageAvailable()) return null;
    try {
      return localStorage.getItem(name);
    } catch (err) {
      logger.warn('[Storage] Failed to get item from localStorage:', err);
      return null;
    }
  },
  setItem: (name, value) => {
    if (!isLocalStorageAvailable()) return;
    try {
      localStorage.setItem(name, value);
    } catch (e) {
      logger.warn('[Storage] Failed to save state:', e);
    }
  },
  removeItem: (name) => {
    if (!isLocalStorageAvailable()) return;
    try {
      localStorage.removeItem(name);
    } catch (err) {
      logger.warn('[Storage] Failed to remove item from localStorage:', err);
    }
  },
};
