import { describe, it, expect } from 'vitest';
import { pruneReplayStorage } from '../vanilla/FeedbackManager.js';

interface TestItem {
  id: string;
  timestamp: number;
  comment?: string;
  element?: { selector: string };
  sessionReplayEvents?: Array<{ type: number; timestamp: number }>;
}

describe('pruneReplayStorage', () => {
  it('keeps maximum 15 items with sessionReplayEvents, trimming older ones', () => {
    const items: TestItem[] = Array.from({ length: 20 }, (_, i) => ({
      id: `pin-${i}`,
      timestamp: 1000 + i * 100,
      comment: `Comment for pin ${i}`,
      element: { selector: `.btn-${i}` },
      sessionReplayEvents: [{ type: 1, timestamp: 1000 + i * 100 }],
    }));

    const pruned = pruneReplayStorage(items, 15);
    const withReplay = pruned.filter(
      (item) => item.sessionReplayEvents && item.sessionReplayEvents.length > 0
    );

    expect(withReplay.length).toBe(15);
    // Oldest 5 items (index 0 to 4) should have sessionReplayEvents stripped
    for (let i = 0; i < 5; i++) {
      expect(pruned[i].sessionReplayEvents).toBeUndefined();
      expect(pruned[i].comment).toBe(`Comment for pin ${i}`);
      expect(pruned[i].element?.selector).toBe(`.btn-${i}`);
    }

    // Newest 15 items (index 5 to 19) should retain sessionReplayEvents
    for (let i = 5; i < 20; i++) {
      expect(pruned[i].sessionReplayEvents?.length).toBe(1);
      expect(pruned[i].comment).toBe(`Comment for pin ${i}`);
    }
  });

  it('preserves items intact when count of replay items is less than or equal to maxReplays', () => {
    const items: TestItem[] = Array.from({ length: 10 }, (_, i) => ({
      id: `pin-${i}`,
      timestamp: 1000 + i * 100,
      sessionReplayEvents: [{ type: 1, timestamp: 1000 + i * 100 }],
    }));

    const pruned = pruneReplayStorage(items, 15);
    const withReplay = pruned.filter(
      (item) => item.sessionReplayEvents && item.sessionReplayEvents.length > 0
    );
    expect(withReplay.length).toBe(10);
    expect(pruned[0].sessionReplayEvents?.length).toBe(1);
    expect(pruned[9].sessionReplayEvents?.length).toBe(1);
  });

  it('correctly handles unordered items by sorting descending timestamps', () => {
    // Timestamps shuffled
    const timestamps = [5000, 1000, 4000, 2000, 3000];
    const items: TestItem[] = timestamps.map((ts, index) => ({
      id: `pin-${index}`,
      timestamp: ts,
      sessionReplayEvents: [{ type: 1, timestamp: ts }],
    }));

    // Keep only top 2: should keep ts=5000 (id pin-0) and ts=4000 (id pin-2)
    const pruned = pruneReplayStorage(items, 2);
    const withReplay = pruned.filter(
      (item) => item.sessionReplayEvents && item.sessionReplayEvents.length > 0
    );
    expect(withReplay.length).toBe(2);

    expect(pruned[0].sessionReplayEvents?.length).toBe(1); // ts: 5000 -> kept
    expect(pruned[1].sessionReplayEvents).toBeUndefined(); // ts: 1000 -> pruned
    expect(pruned[2].sessionReplayEvents?.length).toBe(1); // ts: 4000 -> kept
    expect(pruned[3].sessionReplayEvents).toBeUndefined(); // ts: 2000 -> pruned
    expect(pruned[4].sessionReplayEvents).toBeUndefined(); // ts: 3000 -> pruned
  });

  it('does not count items without replay events toward the maxReplays limit', () => {
    const items: TestItem[] = [
      { id: 'no-replay-1', timestamp: 500 },
      { id: 'empty-replay-2', timestamp: 600, sessionReplayEvents: [] },
      { id: 'with-replay-1', timestamp: 700, sessionReplayEvents: [{ type: 1, timestamp: 700 }] },
      { id: 'with-replay-2', timestamp: 800, sessionReplayEvents: [{ type: 1, timestamp: 800 }] },
    ];

    const pruned = pruneReplayStorage(items, 1);
    // Only with-replay-2 (timestamp 800) is kept as the 1 allowed replay
    expect(pruned[0].sessionReplayEvents).toBeUndefined();
    expect(pruned[1].sessionReplayEvents).toBeUndefined();
    expect(pruned[2].sessionReplayEvents).toBeUndefined();
    expect(pruned[3].sessionReplayEvents?.length).toBe(1);
  });
});
