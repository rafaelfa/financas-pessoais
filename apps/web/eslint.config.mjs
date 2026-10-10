import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

/**
 * ESLint config for the Next.js app.
 *
 * `eslint-config-next` v16 exports ESLint flat-config arrays, so they are
 * spread directly. `next lint` was removed in Next.js 16 — linting runs through
 * the ESLint CLI, driven by `pnpm lint` at the workspace root.
 */
export default defineConfig([
  ...nextVitals,
  ...nextTs,

  ...tseslint.configs.recommended,

  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },

  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts', 'dist/**']),

  // Must stay last so formatting-related rules never fight Prettier.
  prettier,
]);
