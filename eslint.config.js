import js from '@eslint/js';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

const NO_REACT = { group: ['react', 'react-dom', 'react-dom/*'], message: 'The story package must not depend on React.' };
const NO_NODE = { group: ['node:*'], message: 'The story package runs in the browser too.' };

export default tseslint.config(
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/dist-native/**', 'apps/mobile/ios/**', '**/test-results/**', '**/playwright-report/**', '.work/**', 'brand/generated/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  // The story format is read by the web app and by the Node scripts: plain TypeScript, no UI framework, no Node built-ins.
  {
    files: ['packages/story/src/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: { 'no-restricted-imports': ['error', { patterns: [NO_REACT, NO_NODE] }] },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    files: ['apps/web/**/*.tsx'],
    ...jsxA11y.flatConfigs.recommended,
  },
);
