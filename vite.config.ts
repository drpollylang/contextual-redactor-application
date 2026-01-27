import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  // Make the Vite project root the /app folder (where index.html lives)
  root: path.resolve(__dirname, 'app'),

  // Where to write the build output; default is 'dist' relative to root, so this is still /app/dist
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },

  // Asset base path in the built index.html; use '/' for SWA root hosting
  base: '/',

  plugins: [react()],

  // Allow importing from the repo root src/ (outside the Vite root)
  server: {
    fs: {
      allow: [
        path.resolve(__dirname),      // repo root
        path.resolve(__dirname, 'src') // the shared code
      ],
    },
  },

  resolve: {
    alias: {
      // Nice aliases for your shared modules (adjust as needed)
      '@components': path.resolve(__dirname, 'src/components'),
      '@contexts': path.resolve(__dirname, 'src/contexts'),
      '@lib': path.resolve(__dirname, 'src/lib'),
      '@style': path.resolve(__dirname, 'src/style'),
      '@types': path.resolve(__dirname, 'src/types.ts'),
    },
  },
});
