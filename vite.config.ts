/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Relative base so the build works from any GitHub Pages path.
  base: './',
  plugins: [react()],
  test: {
    include: ['src/**/*.test.ts'],
    testTimeout: 30000,
  },
});
