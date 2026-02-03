# ESLint + Prettier Setup for ZS-MAC Monorepo

## Overview
This document describes the ESLint and Prettier configuration for the Zero Sum Nutrition monorepo.

## Configuration Files Created

### Root Level (`zero-sum-nutrition/`)

1. **`.prettierrc`** - Prettier configuration with consistent settings:
   - Semi-colons enabled
   - Single quotes
   - 100 character line width
   - 2-space indentation
   - ES5 trailing commas
   - LF line endings

2. **`.prettierignore`** - Files/directories to exclude from formatting

3. **`eslint.config.js`** - Root ESLint configuration using flat config format:
   - TypeScript support via `typescript-eslint`
   - Prettier integration via `eslint-plugin-prettier`
   - Base JavaScript/TypeScript recommended rules
   - Custom rules for code quality

4. **`.eslintignore`** - Files/directories to exclude from linting

### Apps/Web (`apps/web/`)

5. **`eslint.config.js`** - Next.js-specific ESLint configuration:
   - Extends root configuration
   - Adds `@next/eslint-plugin-next` for Next.js rules
   - Adds React and React Hooks plugins
   - Core Web Vitals rules enabled
   - Prettier integration

### Packages/Nutrition-Engine (`packages/nutrition-engine/`)

6. **`eslint.config.js`** - Package library ESLint configuration:
   - Same as root configuration
   - Focused on TypeScript linting for the library package

## Package.json Changes

### Root (`package.json`)
- Added `lint` script: `turbo run lint`
- Added `format` script: `prettier --write "**/*.{js,jsx,ts,tsx,json,css,scss,md}"`
- Added `format:check` script: `prettier --check "**/*.{js,jsx,ts,tsx,json,css,scss,md}"`
- Added devDependencies: eslint, prettier, typescript-eslint, @eslint/js, @eslint/compat, eslint-plugin-prettier

### Apps/Web (`apps/web/package.json`)
- Changed `lint` script from `next lint` to `eslint .`
- Added devDependencies: @next/eslint-plugin-next, eslint-plugin-react, eslint-plugin-react-hooks

### Packages/Nutrition-Engine (`packages/nutrition-engine/package.json`)
- Kept `lint` script as `eslint src/`
- Added devDependencies: All ESLint-related packages

## Turbo Configuration (`turbo.json`)
- Updated `lint` task to include empty outputs array for proper caching

## Usage

### Run lint across all packages:
```bash
pnpm run lint
```

### Run lint for specific package:
```bash
pnpm --filter @zsn/web lint
pnpm --filter @zero-sum/nutrition-engine lint
```

### Format all files:
```bash
pnpm run format
```

### Check formatting:
```bash
pnpm run format:check
```

## Linting Rules

### TypeScript Rules
- `@typescript-eslint/no-unused-vars`: Error (with _ prefix allowed)
- `@typescript-eslint/no-explicit-any`: Warn
- `@typescript-eslint/explicit-function-return-type`: Off
- `@typescript-eslint/no-non-null-assertion`: Warn

### Code Quality Rules
- `no-console`: Warn (allow warn/error)
- `prefer-const`: Error
- `no-var`: Error
- `eqeqeq`: Error (always)
- `curly`: Error (all)

### React Rules (apps/web only)
- `react/react-in-jsx-scope`: Off (not needed in React 19+)
- `react/prop-types`: Off (using TypeScript)
- `react/display-name`: Off
- `react-hooks/rules-of-hooks`: Error
- `react-hooks/exhaustive-deps`: Warn

### Next.js Rules (apps/web only)
- All recommended Next.js rules enabled
- Core Web Vitals rules enabled

### Prettier
- `prettier/prettier`: Error (ensures code matches Prettier rules)

## Notes

- The setup uses ESLint v9 flat config format (not .eslintrc.json)
- TypeScript support via typescript-eslint v8
- Prettier is integrated as an ESLint rule for unified reporting
- Turbo is configured to run lint across all workspace packages in parallel
- All configurations support both .js and .ts/.tsx files
