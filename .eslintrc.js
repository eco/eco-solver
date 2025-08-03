module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint/eslint-plugin', 'simple-import-sort'],
  extends: [
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
  ],
  root: true,
  env: {
    node: true,
    jest: true,
  },
  ignorePatterns: ['.eslintrc.js'],
  rules: {
    '@typescript-eslint/interface-name-prefix': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      },
    ],
    // Import sorting rule
    'sort-imports': [
      'error',
      {
        ignoreCase: false,
        ignoreDeclarationSort: true,
        ignoreMemberSort: false,
        memberSyntaxSortOrder: ['none', 'all', 'multiple', 'single'],
        allowSeparatedGroups: true,
      },
    ],
    // Disable member ordering rule as we only want import sorting
    '@typescript-eslint/member-ordering': 'off',
  },
  overrides: [
    {
      files: ['*.ts', '*.tsx'],
      rules: {
        // Use simple-import-sort plugin for better import sorting
        'simple-import-sort/imports': [
          'error',
          {
            groups: [
              // Node.js builtins
              ['^node:', '^(assert|buffer|child_process|cluster|console|constants|crypto|dgram|dns|domain|events|fs|http|https|module|net|os|path|punycode|querystring|readline|repl|stream|string_decoder|sys|timers|tls|tty|url|util|vm|zlib)(/.*)?$'],
              // Packages starting with @nestjs
              ['^@nestjs'],
              // Other packages
              ['^@?\\w'],
              // Internal packages starting with @/
              ['^@/'],
              // Side effect imports
              ['^\\u0000'],
              // Parent imports
              ['^\\.\\.(?!/?$)', '^\\.\\./?$'],
              // Other relative imports
              ['^\\./(?=.*/)(?!/?$)', '^\\.(?!/?$)', '^\\./?$'],
            ],
          },
        ],
        'simple-import-sort/exports': 'error',
        'sort-imports': 'off',
        'import/order': 'off',
      },
    },
  ],
};