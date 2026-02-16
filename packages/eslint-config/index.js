import { includeIgnoreFile } from '@eslint/compat';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-plugin-prettier';

export const baseIgnores = {
  ignores: [
    '**/node_modules/**',
    '**/.next/**',
    '**/dist/**',
    '**/build/**',
    '**/.turbo/**',
    '**/coverage/**',
    '**/*.min.js',
    '**/*.generated.*',
  ],
};

export const baseRules = {
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

    // General code quality
    'no-console': ['error', { allow: ['warn', 'error'] }],
    'prefer-const': 'error',
    'no-var': 'error',
    eqeqeq: ['error', 'always'],
    curly: 'off',
  },
};

export const prettierConfig = {
  plugins: {
    prettier,
  },
  rules: {
    'prettier/prettier': 'error',
  },
};

export const baseConfig = [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettierConfig,
  baseIgnores,
  baseRules,
];

export { includeIgnoreFile };
