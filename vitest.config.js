import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 15000,
    hookTimeout: 15000,
    include: ['tests/**/*.test.{js,mjs}'],
    sequence: {
      // Run test files sequentially to avoid SQLite lock conflicts
      concurrent: false,
    },
  },
});
