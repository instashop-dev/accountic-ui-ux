import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Explicitly avoid inheriting Astro's SSR Vite config
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    // Inline all deps to avoid SSR transform issues from Astro's Vite config
    server: {
      deps: {
        inline: [/./],
      },
    },
    coverage: {
      provider: 'istanbul',
      include: ['src/lib/**'],
      exclude: [
        'src/lib/**/*.test.ts',
        'src/lib/ai.ts',   // Anthropic SDK wrapper — retry logic tested via integration tests
        'src/lib/queue.ts', // Pure message constructors and crypto helpers, no branch logic
      ],
      thresholds: {
        branches: 80,
      },
    },
  },
  resolve: {
    conditions: ['node', 'import', 'module', 'default'],
  },
});
