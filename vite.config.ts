import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: '/doors/1/',
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 3000,
    open: true,
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
  },
});
