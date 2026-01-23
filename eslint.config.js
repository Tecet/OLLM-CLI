import js from '@eslint/js';
import importPlugin from 'eslint-plugin-import';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default [
  // Ignore patterns
  {
    ignores: ['dist/', '**/dist/**', 'node_modules/', 'coverage/'],
  },

  // Base JavaScript recommended rules
  js.configs.recommended,

  // TypeScript configuration - spread the recommended configs first
  ...tseslint.configs.recommended,

  // React and TypeScript files - override with our custom rules
  {
    files: ['**/*.{ts,tsx,js,jsx,mjs,cjs}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.node,
      },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
      import: importPlugin,
    },
    rules: {
      // React rules
      'react/jsx-uses-react': 'error',
      'react/jsx-uses-vars': 'error',

      // React Hooks rules
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // TypeScript strict rules - override the recommended config
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],

      // Import ordering rules
      'import/order': ['error', {
        'groups': [
          'builtin',      // Node built-ins
          'external',     // npm packages
          'internal',     // @ollm/* packages
          ['parent', 'sibling'],  // ../ and ./
          'type',         // import type
        ],
        'pathGroups': [
          {
            'pattern': 'react',
            'group': 'external',
            'position': 'before',
          },
          {
            'pattern': 'react-**',
            'group': 'external',
            'position': 'before',
          },
          {
            'pattern': 'ink',
            'group': 'external',
            'position': 'before',
          },
          {
            'pattern': 'ink-**',
            'group': 'external',
            'position': 'before',
          },
          {
            'pattern': '@ollm/**',
            'group': 'internal',
          },
        ],
        'pathGroupsExcludedImportTypes': ['builtin', 'type'],
        'newlines-between': 'always',
        'alphabetize': {
          'order': 'asc',
          'caseInsensitive': true,
        },
        'distinctGroup': false,
      }],
      'import/no-duplicates': 'error',
      'import/first': 'error',
      'import/newline-after-import': 'error',
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
  {
    files: [
      '**/*.test.{ts,tsx,js,jsx}',
      '**/*.property.test.{ts,tsx,js,jsx}',
      '**/*.stage08.test.{ts,tsx,js,jsx}',
    ],
    rules: {
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    files: ['scripts/**/*.{js,mjs,cjs}', '*.{js,mjs,cjs}'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'warn',
    },
  },
];
