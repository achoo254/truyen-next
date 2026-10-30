import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'node',
          include: ['packages/**/*.test.ts', 'scripts/**/*.test.ts'],
          exclude: [...configDefaults.exclude],
        },
      },
      'apps/web/vitest.config.ts',
    ],
  },
});
