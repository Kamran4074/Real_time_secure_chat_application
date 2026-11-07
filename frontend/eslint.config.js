import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'
import { readdirSync } from 'node:fs'

// feature folder names, for the "only through index.js" rule below
const FEATURES = readdirSync(new URL('./src/features', import.meta.url))

// Static code analysis: catches unused / undefined variables, dead code and risky patterns
// without running anything. Run with: npm run lint
export default defineConfig([
  globalIgnores(['dist', 'coverage', 'playwright-report', 'test-results']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [js.configs.recommended],
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    languageOptions: {
      ecmaVersion: 'latest',
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    settings: { react: { version: 'detect' } },
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // context files export their hook next to the provider (useAuth, useSocketContext)
      'react-refresh/only-export-components': ['warn', {
        allowConstantExport: true,
        allowExportNames: ['useAuth', 'useSocketContext'],
      }],
      // lets no-unused-vars see components used in JSX, so an unused import is reported
      'react/jsx-uses-vars': 'error',
      'react/jsx-key': 'error',
      'react/jsx-no-undef': 'error',
      'react/jsx-no-duplicate-props': 'error',
      'react/no-danger': 'error', // dangerouslySetInnerHTML would open an XSS hole
      'react/jsx-no-target-blank': 'error',
      'react/no-unescaped-entities': 'error',
      // "_" marks values that are intentionally unused (e.g. destructuring a field away)
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none', ignoreRestSiblings: true }],
      'no-use-before-define': ['error', { functions: false, variables: false }],
      'no-unused-expressions': 'error',
      'no-useless-return': 'error',
      'no-self-compare': 'error',
      'no-template-curly-in-string': 'error',
      'no-shadow': 'error',
      'prefer-const': 'error',
      'no-var': 'error',
      eqeqeq: ['error', 'always'],
      // use shared/lib/logger.js, which stays quiet in production
      'no-console': 'error',
    },
  },
  {
    files: ['src/shared/lib/logger.js'],
    rules: { 'no-console': 'off' },
  },
  // ---- architecture boundaries (see docs/ARCHITECTURE.md, "Frontend rules") ----
  {
    files: ['src/**/*.{js,jsx}'],
    ignores: ['src/test/**', 'src/shared/api/client.js'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [{ name: 'axios', message: "Call the backend from the feature's api.js through shared/api/client.js." }],
        patterns: [{
          regex: String.raw`^(\.\./)+(${FEATURES.join("|")})/`,
          message: "Import another feature only through its index.js.",
        }],
      }],
    },
  },
  {
    files: ['src/**/*.{js,jsx}'],
    ignores: ['src/test/**', 'src/shared/lib/session.js'],
    rules: {
      'no-restricted-globals': ['error', { name: 'localStorage', message: 'Use shared/lib/session.js.' }],
      'no-restricted-properties': ['error', { object: 'window', property: 'localStorage', message: 'Use shared/lib/session.js.' }],
    },
  },
  {
    files: ['src/shared/**/*.{js,jsx}'],
    ignores: ['src/shared/api/client.js'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [{ name: 'axios', message: 'Only shared/api/client.js imports axios.' }],
        patterns: [{ regex: '/features/', message: 'shared/ must not depend on features/.' }],
      }],
    },
  },
  {
    // build tool configs and Playwright tests run in Node
    files: ['*.config.js', 'e2e/**/*.js'],
    languageOptions: { globals: globals.node },
  },
])
