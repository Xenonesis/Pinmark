export { FeedbackManager } from '../core/FeedbackManager.js';

/**
 * Prunes sessionReplayEvents from older feedback items to conserve storage space.
 * Retains sessionReplayEvents on the newest `maxReplays` items (sorted by descending timestamp).
 * Older items beyond `maxReplays` have sessionReplayEvents stripped while keeping all other metadata.
 */
export function pruneReplayStorage<T extends { timestamp?: number; sessionReplayEvents?: unknown[] }>(
  items: T[],
  maxReplays: number = 15
): T[] {
  const withReplay = items
    .filter((item) => item.sessionReplayEvents && item.sessionReplayEvents.length > 0)
    .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));

  if (withReplay.length <= maxReplays) {
    return items;
  }

  const allowedItems = new Set(withReplay.slice(0, Math.max(0, maxReplays)));

  return items.map((item) => {
    if (item.sessionReplayEvents && !allowedItems.has(item)) {
      const rest = { ...item };
      delete rest.sessionReplayEvents;
      return rest;
    }
    return item;
  });
}
