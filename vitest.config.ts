import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx}'],
    setupFiles: ['./tests/setup.ts'],
    // Full-app jsdom tests can exceed the 5 s default under coverage instrumentation.
    testTimeout: 20_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['shared/**/*.ts', 'server/**/*.ts', 'src/**/*.{ts,tsx}'],
      exclude: [
        'src/main.tsx',
        'server/index.ts',
        'shared/types.ts',
        'server/ai/llmClient.ts',
      ],
    },
  },
});
