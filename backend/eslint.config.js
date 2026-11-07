import js from '@eslint/js'
import globals from 'globals'
import { defineConfig, globalIgnores } from 'eslint/config'

// Static code analysis: catches unused / undefined variables, dead code and risky patterns
// without running anything. Run with: npm run lint
export default defineConfig([
  globalIgnores(['node_modules', 'coverage']),
  {
    files: ['**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.node,
    },
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    rules: {
      // "_" marks values that are intentionally unused (e.g. destructuring a field away)
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none', ignoreRestSiblings: true }],
      'no-use-before-define': ['error', { functions: false }],
      'no-unused-expressions': 'error',
      'no-useless-return': 'error',
      'no-unreachable-loop': 'error',
      'no-self-compare': 'error',
      'no-template-curly-in-string': 'error',
      'no-shadow': 'error',
      'prefer-const': 'error',
      'no-var': 'error',
      eqeqeq: ['error', 'always'],
      // use the Winston logger (utils/logger.js) instead
      'no-console': 'error',
    },
  },
  {
    files: ['tests/**/*.js'],
    languageOptions: { globals: globals.jest },
  },

  // ---- architecture boundaries (see docs/ARCHITECTURE.md, "Dependency rules") ----
  {
    // shared/ is feature-agnostic
    files: ['src/shared/**/*.js'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [
        { regex: '/(modules|realtime)/', message: 'shared/ must not depend on modules/ or realtime/.' },
      ] }],
    },
  },
  {
    // realtime/ gets what it needs from modules through hooks wired in server.js
    files: ['src/realtime/**/*.js'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [
        { regex: '/modules/', message: 'realtime/ must not import modules/; pass a hook from server.js instead.' },
      ] }],
    },
  },
  {
    files: ['src/modules/**/*.js'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [{ name: 'socket.io', message: 'Modules use realtime/notifier.js, never socket.io directly.' }],
        patterns: [
          { regex: '^\\.\\./(?!\\.\\.)[^/]+/(?!index\\.js$)', message: "Import another module only through its index.js." },
          { regex: '/realtime/(?!notifier\\.js$)', message: 'Modules use realtime/notifier.js only.' },
        ],
      }],
    },
  },
])
