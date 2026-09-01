import { defineConfig } from 'wxt';
import fs from 'node:fs';
import path from 'node:path';

function escapeNonAsciiInDir(dir: string) {
  if (!fs.existsSync(dir)) return;
  for (const item of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      escapeNonAsciiInDir(fullPath);
    } else if (item.endsWith('.js') || item.endsWith('.mjs')) {
      const code = fs.readFileSync(fullPath, 'utf8');
      if (/[^\x00-\x7F]/.test(code)) {
        const escaped = code.replace(/[^\x00-\x7F]/g, (c) => {
          return '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4);
        });
        fs.writeFileSync(fullPath, escaped, 'utf8');
      }
    }
  }
}

export default defineConfig({
  manifest: {
    name: 'Pinmark',
    version: '1.6.0',
    description: 'Visual feedback annotation tool for developers to place markers on DOM elements and generate AI-optimized Markdown',
    permissions: ['storage', 'activeTab'],
    host_permissions: ['<all_urls>'],
    icons: {
      16: 'icon16.png',
      32: 'icon32.png',
      48: 'icon48.png',
      128: 'icon128.png',
    },
    action: {
      default_title: 'Pinmark',
      default_popup: 'popup.html',
      default_icon: {
        16: 'icon16.png',
        32: 'icon32.png',
        48: 'icon48.png',
        128: 'icon128.png',
      },
    },
    commands: {
      'toggle-pinmark': {
        suggested_key: {
          default: 'Ctrl+Shift+F',
          mac: 'Command+Shift+F',
        },
        description: 'Toggle Pinmark Overlay',
      },
    },
    browser_specific_settings: {
      gecko: {
        id: 'pinmark@agentation.com',
        strict_min_version: '142.0',
        data_collection_permissions: {
          required: ['none'],
        },
      },
    },
  },
  hooks: {
    'build:done': (wxt) => {
      escapeNonAsciiInDir(wxt.config.outDir);
    },
  },
  vite: () => ({
    build: {
      chunkSizeWarningLimit: 1000,
    },
  }),
});
