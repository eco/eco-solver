module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint/eslint-plugin', '@nx'],
  extends: [
    'plugin:@typescript-eslint/recommended', 
    'plugin:prettier/recommended',
    'plugin:@nx/typescript'
  ],
  root: true,
  env: {
    node: true,
    jest: true,
  },
  ignorePatterns: ['.eslintrc.js', '**/.pnpm-store/**', 'pnpm-lock.yaml'],
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
              'type:foundation-adapters'
            ]
          },
          {
            sourceTag: 'type:feature',
            onlyDependOnLibsWithTags: [
              'type:core',
              'type:infrastructure', 
              'type:shared',
              'type:events',
              'type:foundation-adapters'
            ]
          },
          {
            sourceTag: 'type:core',
            onlyDependOnLibsWithTags: [
              'type:shared',
              'type:foundation-adapters'
            ]
          },
          {
            sourceTag: 'type:infrastructure',
            onlyDependOnLibsWithTags: [
              'type:shared',
              'type:foundation-adapters'
            ]
          },
          {
            sourceTag: 'type:foundation-adapters',
            onlyDependOnLibsWithTags: [
              'type:shared'
            ]
          },
          {
            sourceTag: 'type:events',
            onlyDependOnLibsWithTags: [
              'type:shared',
              'type:core',
              'type:foundation-adapters'
            ]
          }
        ]
      }
    ]
  },
}
