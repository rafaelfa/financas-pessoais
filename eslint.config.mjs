import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

/**
 * Flat ESLint config for the workspace packages (`packages/*` and root files).
 *
 * `apps/web` ships its own `eslint.config.mjs` with the Next.js presets; ESLint
 * resolves the nearest config file for each lint run, so `pnpm --filter <pkg>
 * lint` always picks the right one.
 */
export default defineConfig([
  globalIgnores([
    '**/node_modules/**',
    '**/.next/**',
    '**/.turbo/**',
    '**/dist/**',
    '**/build/**',
    '**/coverage/**',
    '**/next-env.d.ts',
    '**/src/generated/**',
  ]),

  ...tseslint.configs.recommended,

  {
    files: ['**/*.{ts,tsx,mjs,js}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
    },
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

  // Must stay last so formatting-related rules never fight Prettier.
  prettier,
]);
