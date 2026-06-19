import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    // SWC transforms NestJS decorators + emitDecoratorMetadata for the test run.
    swc.vite({ module: { type: 'es6' } }),
  ],
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'test/**/*.e2e-spec.ts'],
    env: {
      NODE_ENV: 'test',
      PROVIDER: 'fake',
      LOG_LEVEL: 'silent',
      // Large limit so the throttler never trips across the shared test IP.
      RATE_LIMIT_LIMIT: '100000',
      // The shared-state limiter has its own unit tests; keep it off for the broad
      // e2e suite (which fires many requests from one identity).
      RATE_LIMIT_ENABLED: 'false',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/main.ts',
        'src/**/*.module.ts',
        'src/**/index.ts',
        'src/**/*.dto.ts',
        'src/**/ports/**',
        'src/**/*.test.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
        // The decision brain is held to a higher bar.
        'src/aggregate/**': {
          branches: 100,
          functions: 100,
          lines: 100,
          statements: 100,
        },
      },
    },
  },
});
