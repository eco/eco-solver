import nx from '@nx/eslint-plugin'
import prettier from 'eslint-plugin-prettier'

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: [
      '**/node_modules',
      '**/artifacts',
      '**/cache',
      '**/coverage',
      '**/typechain-types',
      '**/dist',
      '**/templates',
      '**/*.spec.ts',
      '**/*.spec.js',
      '**/*.spec.tsx',
      '**/*.spec.jsx',
      '**/test-utils/**',
      '**/*test-utils*',
      '.nx/**',
      '**/.nx/**',
    ],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          // Allow @eco-solver/* imports within the eco-solver app
          allow: ['^@eco-solver/.*'],
          depConstraints: [
            {
              sourceTag: 'scope:eco-solver',
              onlyDependOnLibsWithTags: ['scope:eco-solver'],
            },
            {
              sourceTag: 'type:app',
              onlyDependOnLibsWithTags: ['type:lib', 'type:util'],
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      '**/*.ts',
      '**/*.tsx',
      '**/*.cts',
      '**/*.mts',
      '**/*.js',
      '**/*.jsx',
      '**/*.cjs',
      '**/*.mjs',
    ],
    plugins: {
      prettier,
    },
    rules: {
      'prettier/prettier': 'error',
      'no-case-declarations': 'off',
    },
  },
]
