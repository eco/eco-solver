module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    sourceType: 'module',
    ecmaVersion: 2020,
  },
  plugins: ['@typescript-eslint/eslint-plugin', '@nx', 'import'],
  extends: [
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
    'plugin:@nx/typescript',
    'plugin:import/recommended',
    'plugin:import/typescript',
  ],
  root: true,
  env: {
    node: true,
    jest: true,
  },
  ignorePatterns: ['.eslintrc.js', '**/.pnpm-store/**', 'pnpm-lock.yaml'],
  settings: {
    'import/resolver': {
      typescript: {
        alwaysTryTypes: true,
        project: './tsconfig.base.json',
      },
      node: {
        extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
      },
    },
    'import/extensions': ['.js', '.jsx', '.ts', '.tsx'],
    'import/parsers': {
      '@typescript-eslint/parser': ['.ts', '.tsx'],
    },
  },
  rules: {
    '@typescript-eslint/interface-name-prefix': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/ban-ts-comment': 'warn',
    'no-console': 'error',
    '@nx/enforce-module-boundaries': [
      'error',
      {
        enforceBuildableLibDependency: true,
        depConstraints: [
          {
            sourceTag: 'type:app',
            onlyDependOnLibsWithTags: [
              'type:feature',
              'type:infrastructure',
              'type:shared',
              'type:events',
              'type:foundation-adapters',
            ],
          },
          {
            sourceTag: 'type:feature',
            onlyDependOnLibsWithTags: [
              'type:core',
              'type:infrastructure',
              'type:shared',
              'type:events',
              'type:foundation-adapters',
            ],
          },
          {
            sourceTag: 'type:core',
            onlyDependOnLibsWithTags: ['type:shared', 'type:foundation-adapters'],
          },
          {
            sourceTag: 'type:infrastructure',
            onlyDependOnLibsWithTags: ['type:shared', 'type:foundation-adapters'],
          },
          {
            sourceTag: 'type:foundation-adapters',
            onlyDependOnLibsWithTags: ['type:shared'],
          },
          {
            sourceTag: 'type:events',
            onlyDependOnLibsWithTags: ['type:shared', 'type:core', 'type:foundation-adapters'],
          },
        ],
      },
    ],
    // Import rules for preventing circular dependencies
    // These rules help detect and prevent circular dependency patterns that can cause
    // runtime issues, build problems, and make the codebase harder to maintain.
    'import/no-cycle': [
      'error',
      {
        maxDepth: 20,
        ignoreExternal: true,
        allowUnsafeDynamicCyclicDependency: false,
      },
    ],
    'import/no-self-import': 'error',
    'import/no-useless-path-segments': [
      'error',
      {
        noUselessIndex: true,
      },
    ],
    'import/order': [
      'warn',
      {
        groups: [
          'builtin',
          'external',
          'internal',
          'parent',
          'sibling',
          'index',
        ],
        'newlines-between': 'never',
        alphabetize: {
          order: 'asc',
          caseInsensitive: true,
        },
      },
    ],
    'import/no-duplicates': 'warn',
    'import/first': 'warn',
    'import/newline-after-import': 'warn',
    'import/no-absolute-path': 'error',
    'import/no-relative-packages': 'warn',
  },
}
