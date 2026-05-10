import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.d.ts',
        'src/types/**',
        'src/__tests__/**',
        'src/vite-env.d.ts',
        'src/index.tsx',
        'src/App.tsx',
      ],
    },
  },
});
