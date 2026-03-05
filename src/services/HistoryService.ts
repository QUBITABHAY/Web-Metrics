/**
 * HistoryService.ts
 *
 * Single responsibility: persist and retrieve the list of
 * recently tested URLs using Raycast's LocalStorage API.
 *
 * URLs are stored as a JSON-serialised string[] under a
 * single storage key. The list is capped at MAX_HISTORY
 * entries (most-recent first, duplicates removed).
 */

import { LocalStorage } from "@raycast/api";

export class HistoryService {
  /** Maximum number of URLs to keep in history. */
  private readonly MAX_HISTORY = 5;

  /** LocalStorage key for the history array. */
  private readonly STORAGE_KEY = "url_history";

  // ── Public API ──────────────────────────────────────────────────

  /**
   * Saves a URL to history.
   * - Deduplicates: if the URL already exists it is moved to the top.
   * - Trims: keeps only the most recent MAX_HISTORY entries.
   */
  async save(url: string): Promise<void> {
    const history = await this.getAll();

    // Remove duplicate if it already exists
    const filtered = history.filter((item) => item !== url);

    // Prepend the new URL and cap the length
    const updated = [url, ...filtered].slice(0, this.MAX_HISTORY);

    await LocalStorage.setItem(this.STORAGE_KEY, JSON.stringify(updated));
  }

  /** Returns the full history array (most-recent first). */
  async getAll(): Promise<string[]> {
    const raw = await LocalStorage.getItem<string>(this.STORAGE_KEY);
    if (!raw) return [];

    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as string[]) : [];
    } catch {
      // Corrupted storage — start fresh
      return [];
    }
  }

  /** Wipes all stored history. */
  async clear(): Promise<void> {
    await LocalStorage.removeItem(this.STORAGE_KEY);
  }
}
