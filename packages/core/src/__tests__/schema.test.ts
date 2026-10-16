import { describe, it, expect } from 'vitest';
import {
  ReplayActionStepSchema,
  ReplayTrailSummarySchema,
} from '../schema.js';
import {
  ReplayActionStepSchema as ReplayActionStepSchemaFromIndex,
  ReplayTrailSummarySchema as ReplayTrailSummarySchemaFromIndex,
} from '../index.js';

describe('ReplayActionStepSchema & ReplayTrailSummarySchema', () => {
  it('exports schemas from index.js', () => {
    expect(ReplayActionStepSchemaFromIndex).toBeDefined();
    expect(ReplayTrailSummarySchemaFromIndex).toBeDefined();
    expect(ReplayActionStepSchemaFromIndex).toBe(ReplayActionStepSchema);
    expect(ReplayTrailSummarySchemaFromIndex).toBe(ReplayTrailSummarySchema);
  });

  describe('ReplayActionStepSchema', () => {
    it('validates a minimal correct replay action step', () => {
      const step = {
        timeMs: 1400,
        timeOffset: '1.4s',
        type: 'click',
      };
      const parsed = ReplayActionStepSchema.safeParse(step);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.timeMs).toBe(1400);
        expect(parsed.data.timeOffset).toBe('1.4s');
        expect(parsed.data.type).toBe('click');
      }
    });

    it('validates a complete replay action step with all optional fields', () => {
      const step = {
        timeMs: 2500,
        timeOffset: '2.5s',
        type: 'network_error',
        selector: 'button#submit-form',
        targetText: 'Submit',
        value: 'input value',
        method: 'POST',
        url: 'https://example.com/api/submit',
        status: 500,
        errorMessage: 'Internal Server Error',
        metadata: {
          requestId: 'req-abc-123',
          retries: 2,
        },
      };
      const parsed = ReplayActionStepSchema.safeParse(step);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.selector).toBe('button#submit-form');
        expect(parsed.data.method).toBe('POST');
        expect(parsed.data.status).toBe(500);
        expect(parsed.data.metadata).toEqual({ requestId: 'req-abc-123', retries: 2 });
      }
    });

    it('accepts all valid step types', () => {
      const validTypes = [
        'click',
        'input',
        'scroll',
        'navigation',
        'network_call',
        'network_error',
        'runtime_error',
        'pin_dropped',
      ] as const;

      for (const type of validTypes) {
        const step = {
          timeMs: 100,
          timeOffset: '0.1s',
          type,
        };
        const parsed = ReplayActionStepSchema.safeParse(step);
        expect(parsed.success).toBe(true);
      }
    });

    it('rejects an invalid step type', () => {
      const step = {
        timeMs: 100,
        timeOffset: '0.1s',
        type: 'invalid_type',
      };
      const parsed = ReplayActionStepSchema.safeParse(step);
      expect(parsed.success).toBe(false);
    });

    it('rejects missing timeMs', () => {
      const step = {
        timeOffset: '0.1s',
        type: 'click',
      };
      const parsed = ReplayActionStepSchema.safeParse(step);
      expect(parsed.success).toBe(false);
    });

    it('rejects missing timeOffset', () => {
      const step = {
        timeMs: 100,
        type: 'click',
      };
      const parsed = ReplayActionStepSchema.safeParse(step);
      expect(parsed.success).toBe(false);
    });

    it('rejects invalid types for fields', () => {
      const stepWithStringTime = {
        timeMs: '100',
        timeOffset: '0.1s',
        type: 'click',
      };
      expect(ReplayActionStepSchema.safeParse(stepWithStringTime).success).toBe(false);

      const stepWithStringStatus = {
        timeMs: 100,
        timeOffset: '0.1s',
        type: 'network_call',
        status: '200',
      };
      expect(ReplayActionStepSchema.safeParse(stepWithStringStatus).success).toBe(false);
    });
  });

  describe('ReplayTrailSummarySchema', () => {
    it('validates a full replay trail summary', () => {
      const trail = {
        annotationId: 'ann-123',
        url: 'http://localhost:3000/cart',
        totalDurationMs: 15000,
        eventCount: 42,
        steps: [
          { timeMs: 1200, timeOffset: '1.2s', type: 'click', selector: 'button#pay' },
          { timeMs: 2400, timeOffset: '2.4s', type: 'network_error', method: 'POST', url: '/api/charge', status: 500 },
        ],
        networkFailuresCount: 1,
        runtimeErrorsCount: 0,
      };
      const parsed = ReplayTrailSummarySchema.safeParse(trail);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.annotationId).toBe('ann-123');
        expect(parsed.data.steps).toHaveLength(2);
        expect(parsed.data.networkFailuresCount).toBe(1);
        expect(parsed.data.runtimeErrorsCount).toBe(0);
      }
    });

    it('validates a trail summary with empty steps array', () => {
      const trail = {
        annotationId: 'ann-456',
        url: 'http://localhost:3000',
        totalDurationMs: 0,
        eventCount: 0,
        steps: [],
        networkFailuresCount: 0,
        runtimeErrorsCount: 0,
      };
      const parsed = ReplayTrailSummarySchema.safeParse(trail);
      expect(parsed.success).toBe(true);
    });

    it('rejects missing required fields', () => {
      const requiredFields = [
        'annotationId',
        'url',
        'totalDurationMs',
        'eventCount',
        'steps',
        'networkFailuresCount',
        'runtimeErrorsCount',
      ] as const;

      const baseTrail = {
        annotationId: 'ann-123',
        url: 'http://localhost:3000/cart',
        totalDurationMs: 15000,
        eventCount: 42,
        steps: [],
        networkFailuresCount: 0,
        runtimeErrorsCount: 0,
      };

      for (const field of requiredFields) {
        const copy = { ...baseTrail };
        delete (copy as Record<string, unknown>)[field];
        const parsed = ReplayTrailSummarySchema.safeParse(copy);
        expect(parsed.success).toBe(false);
      }
    });

    it('rejects if any step inside steps array is invalid', () => {
      const trail = {
        annotationId: 'ann-123',
        url: 'http://localhost:3000/cart',
        totalDurationMs: 15000,
        eventCount: 1,
        steps: [
          {
            timeMs: 1200,
            // missing timeOffset
            type: 'click',
          },
        ],
        networkFailuresCount: 0,
        runtimeErrorsCount: 0,
      };
      const parsed = ReplayTrailSummarySchema.safeParse(trail);
      expect(parsed.success).toBe(false);
    });
  });
});
