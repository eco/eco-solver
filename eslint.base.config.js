const { FlatCompat } = require('@eslint/eslintrc')

const compat = new FlatCompat({
  baseDirectory: __dirname,
})

// Convert legacy config to flat config format
module.exports = [
  ...compat.config({
    parser: '@typescript-eslint/parser',
    parserOptions: {
      sourceType: 'module',
    },
    plugins: ['@typescript-eslint/eslint-plugin', '@nx'],
    extends: ['plugin:@typescript-eslint/recommended', 'plugin:prettier/recommended'],
    env: {
      node: true,
      jest: true,
    },
    rules: {
      '@typescript-eslint/interface-name-prefix': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/ban-ts-comment': 'warn',
      'no-console': 'error',
    },
  }),
  {
    ignores: ['.eslintrc.js', '**/.pnpm-store/**', 'pnpm-lock.yaml', 'node_modules/**'],
  },
]
