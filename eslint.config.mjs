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
          enforceBuildableLibDependency: true,
          allow: [],
          depConstraints: [
            {
              sourceTag: '*',
              onlyDependOnLibsWithTags: ['*'],
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
