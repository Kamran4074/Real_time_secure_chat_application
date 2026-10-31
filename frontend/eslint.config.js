import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

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
      // use utils/logger.js, which stays quiet in production
      'no-console': 'error',
    },
  },
  {
    files: ['src/utils/logger.js'],
    rules: { 'no-console': 'off' },
  },
  {
    // build tool configs and Playwright tests run in Node
    files: ['*.config.js', 'e2e/**/*.js'],
    languageOptions: { globals: globals.node },
  },
])
