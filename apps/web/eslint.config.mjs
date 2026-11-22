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

  /*
   * Uma só fonte de `cn` (T90/T95): o da app é o de `@/lib/utils`, que traz a
   * escala de texto do tema (`createCn`, `classGroups['font-size']`). O pacote
   * nu (`'cn'`) continua a ser o motor, mas só lá dentro — via `'cn/config'`,
   * que é outro especificador e **não** é restringido por esta regra.
   */
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'cn',
              message:
                "Importa `cn` de '@/lib/utils' — é o que tem a escala de texto do tema. O motor `'cn'` só se toca em `lib/utils.ts`, por `'cn/config'`.",
            },
          ],
        },
      ],
    },
  },

  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts', 'dist/**']),

  // Must stay last so formatting-related rules never fight Prettier.
  prettier,
]);
