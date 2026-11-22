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

  /*
   * Uma só fonte de `cn` (T95), também fora de `apps/web`: este config é o que
   * linta `packages/*`, e sem a regra aqui alguém podia repor o shim em
   * `packages/shared/src/utils/` sem o lint dizer nada. O especificador `'cn'`
   * é o único restringido — `'cn/config'` é outro nome e continua permitido
   * (é o que `apps/web/src/lib/utils.ts` usa para construir o `createCn`).
   */
  {
    files: ['**/*.{ts,tsx,mjs,js}'],
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

  // Must stay last so formatting-related rules never fight Prettier.
  prettier,
]);
