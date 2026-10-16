import { describe, it, expect } from 'vitest';
import { generateStandaloneReplayHtml, type ReplayAnnotationLike } from '../vanilla/ReplayExporter.js';

describe('generateStandaloneReplayHtml', () => {
  it('generates a self-contained HTML file containing embedded events and player controls', () => {
    const mockAnnotation: ReplayAnnotationLike = {
      id: 'ann-test-1',
      index: 1,
      comment: 'Button click triggers error',
      url: 'http://localhost:3000/app',
      timestamp: 1700000000000,
      element: { selector: 'button.submit', tagName: 'BUTTON', classes: ['submit'] },
      sessionReplayEvents: [
        { type: 4, data: { href: 'http://localhost:3000/app', width: 1280, height: 720 }, timestamp: 1700000000000 },
        { type: 2, data: { node: { id: 1, type: 0 } }, timestamp: 1700000000050 }
      ],
      networkRequests: [
        { method: 'POST', url: '/api/submit', status: 500, timestamp: 1700000000200 }
      ],
      consoleLogs: [
        { type: 'error', message: 'Network request failed', timestamp: 1700000000210 }
      ]
    };

    const html = generateStandaloneReplayHtml(mockAnnotation);

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('pinmark-player-viewport');
    expect(html).toContain('ann-test-1');
    expect(html).toContain('Button click triggers error');
    expect(html).toContain('pinmark-scrubber');
    expect(html).toContain('pinmark-time');
    expect(html).toContain('rrweb.Replayer');
    expect(html).toContain('/api/submit');
    expect(html).toContain('Network request failed');
  });

  it('handles empty or missing diagnostic fields safely without throwing', () => {
    const emptyAnnotation: ReplayAnnotationLike = {
      id: 'ann-empty',
      comment: 'No diagnostics here'
    };

    const html = generateStandaloneReplayHtml(emptyAnnotation);

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('pinmark-player-viewport');
    expect(html).toContain('ann-empty');
    expect(html).toContain('No diagnostics here');
    expect(html).toContain('pinmark-scrubber');
  });

  it('escapes user strings in HTML markup to prevent XSS injection', () => {
    const maliciousAnnotation: ReplayAnnotationLike = {
      id: 'ann-xss',
      comment: '<script>alert("xss-comment")</script>',
      url: 'javascript:alert("xss-url")',
      sessionReplayEvents: [
        { type: 4, data: { href: 'http://localhost/test' }, timestamp: 1000 }
      ]
    };

    const html = generateStandaloneReplayHtml(maliciousAnnotation);

    // Comment rendered in DOM should be escaped
    expect(html).toContain('&lt;script&gt;alert(&quot;xss-comment&quot;)&lt;/script&gt;');
    // Literal unescaped script tag with payload should not exist
    expect(html).not.toContain('<script>alert("xss-comment")</script>');
  });

  it('includes playback speed selectors and restart control', () => {
    const mockAnnotation: ReplayAnnotationLike = {
      id: 'ann-controls',
      comment: 'Testing controls',
      sessionReplayEvents: [
        { type: 4, data: {}, timestamp: 1000 },
        { type: 2, data: {}, timestamp: 2000 }
      ]
    };

    const html = generateStandaloneReplayHtml(mockAnnotation);

    expect(html).toContain('id="pinmark-restart"');
    expect(html).toContain('id="pinmark-play-pause"');
    expect(html).toContain('data-speed="1"');
    expect(html).toContain('data-speed="1.5"');
    expect(html).toContain('data-speed="2"');
  });
});
