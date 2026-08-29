import type { Plugin } from 'vite';

export interface PinmarkPluginOptions {
  /**
   * Pinmark MCP / HTTP bridge server endpoint
   * @default 'http://localhost:4747'
   */
  endpoint?: string;
  /**
   * Whether Pinmark is enabled in dev mode
   * @default true
   */
  enabled?: boolean;
}

export function pinmark(options: PinmarkPluginOptions = {}): Plugin {
  const { endpoint = 'http://localhost:4747', enabled = true } = options;

  return {
    name: 'vite-plugin-pinmark',
    apply: 'serve', // only inject during local `vite dev`
    transformIndexHtml(html) {
      if (!enabled) return html;
      return [
        {
          tag: 'script',
          attrs: {
            type: 'module',
          },
          children: `
            import { Pinmark } from '@pinmark/pinmark';
            if (typeof window !== 'undefined') {
              window.addEventListener('DOMContentLoaded', () => {
                try {
                  const p = new Pinmark({ endpoint: '${endpoint}' });
                  (window as any).__PINMARK_INSTANCE__ = p;
                } catch (e) {
                  console.warn('[Pinmark] Dev plugin initialization note:', e);
                }
              });
            }
          `,
        },
      ];
    },
  };
}

export default pinmark;
