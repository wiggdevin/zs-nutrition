import { includeIgnoreFile } from '@eslint/compat';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const gitignorePath = path.join(__dirname, '../../.gitignore');

export default [
  // Base JavaScript/TypeScript rules
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Global ignores
  includeIgnoreFile(gitignorePath),

  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.turbo/**', '**/coverage/**'],
  },

  // Base rules for all files
  {
    rules: {
      // TypeScript specific
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-non-null-assertion': 'warn',

      // General code quality — workers need console.log for operational logging
      'no-console': ['error', { allow: ['log', 'warn', 'error', 'info'] }],
      'prefer-const': 'error',
      'no-var': 'error',
      eqeqeq: ['error', 'always'],
      curly: 'off',
    },
  },

  // Relaxed rules for test files
  {
    files: ['**/test-*.{ts,mjs,js}', '**/*.test.{ts,tsx,js,mjs}'],
    rules: {
      'no-console': 'off',
      'no-undef': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
];
