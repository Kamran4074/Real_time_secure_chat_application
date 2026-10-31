import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [js.configs.recommended],
    plugins: {
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
    rules: {
      ...reactHooks.configs.recommended.rules,
      // context files export their hook next to the provider (useAuth, useSocketContext)
      'react-refresh/only-export-components': ['warn', {
        allowConstantExport: true,
        allowExportNames: ['AuthContext', 'useAuth', 'useSocketContext'],
      }],
      // core ESLint can't see JSX usage, so capitalised (component) names are ignored;
      // "_" marks values that are intentionally unused (e.g. destructuring a field away)
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^[A-Z_]', ignoreRestSiblings: true }],
    },
  },
  {
    // build tool configs run in Node
    files: ['*.config.js'],
    languageOptions: { globals: globals.node },
  },
])
