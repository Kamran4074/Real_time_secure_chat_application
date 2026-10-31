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
])
