import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json';

export default defineConfig({
  plugins: [
    crx({ manifest }),
  ],
  base: './',
  build: {
    outDir: 'dist',
  },
  publicDir: 'assets',
  server: {
    watch: {
      ignored: [
        '**/dist/**',
        '**/dist-firefox/**',
        '**/.git/**',
        '**/node_modules/**',
      ],
    },
  },
});
