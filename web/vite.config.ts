import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const merlinRoot = path.resolve(__dirname, 'merlin-vendor/src');

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  resolve: {
    dedupe: ['react', 'react-dom', '@tanstack/react-query'],
    alias: {
      '@merlin': merlinRoot,
    },
  },
});
