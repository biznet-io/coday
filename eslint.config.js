const FlatCompat = require('@eslint/eslintrc').FlatCompat
const nxEslintPlugin = require('@nx/eslint-plugin')

const eslintPluginPrettier = require('eslint-plugin-prettier')

const js = require('@eslint/js')
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
})

module.exports = [
  ...compat.extends('prettier'),
  ...compat.config({ parser: 'jsonc-eslint-parser' }).map((config) => ({
    ...config,
    files: ['**/*.json'],
    rules: {
      ...config.rules,
    },
  })),
  {
    plugins: {
      '@nx': nxEslintPlugin,
      prettier: eslintPluginPrettier,
    },
  },
  {
    rules: {
      'prettier/prettier': 'off',
      'arrow-body-style': 'off',
      'prefer-arrow-callback': 'off',
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          allow: [],
          depConstraints: [
            {
              onlyDependOnLibsWithTags: ['*'],
              sourceTag: '*',
            },
          ],
          enforceBuildableLibDependency: false,
        },
      ],
    },
  },
  ...compat
    .config({
      extends: ['plugin:@nx/typescript', 'plugin:@nx/javascript'],
      plugins: ['eslint-plugin-import', 'eslint-plugin-prefer-arrow', '@typescript-eslint'],
    })
    .map((config) => ({
      ...config,
      files: ['**/*.ts', '**/*.js', '**/*.jsx'],
      rules: {
        ...config.rules,
        '@typescript-eslint/adjacent-overload-signatures': 'off',
        '@typescript-eslint/ban-ts-comment': ['warn', { 'ts-ignore': 'allow-with-description' }],
        '@typescript-eslint/consistent-type-definitions': 'off',
        '@typescript-eslint/dot-notation': 'off',
        '@typescript-eslint/member-ordering': 'off',
        '@typescript-eslint/naming-convention': 'off',
        '@typescript-eslint/no-array-constructor': 'off',
        '@typescript-eslint/no-empty-function': 'off',
        '@typescript-eslint/no-empty-interface': 'off',
        '@typescript-eslint/no-empty-object-type': 'warn',
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-extra-non-null-assertion': 'off',
        '@typescript-eslint/no-inferrable-types': 'off',
        '@typescript-eslint/no-loss-of-precision': 'off',
        '@typescript-eslint/no-misused-new': 'off',
        '@typescript-eslint/no-namespace': 'off',
        '@typescript-eslint/no-non-null-asserted-optional-chain': 'off',
        '@typescript-eslint/no-non-null-assertion': 'off',
        '@typescript-eslint/no-require-imports': 'off',
        '@typescript-eslint/no-restricted-types': 'error',
        '@typescript-eslint/no-shadow': 'off',
        '@typescript-eslint/no-this-alias': 'off',
        '@typescript-eslint/no-unnecessary-boolean-literal-compare': 'off',
        '@typescript-eslint/no-unnecessary-type-constraint': 'off',
        '@typescript-eslint/no-unused-expressions': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
        '@typescript-eslint/no-var-requires': 'off',
        '@typescript-eslint/prefer-as-const': 'off',
        '@typescript-eslint/prefer-function-type': 'off',
        '@typescript-eslint/prefer-namespace-keyword': 'off',
        '@typescript-eslint/prefer-readonly': 'off',
        '@typescript-eslint/triple-slash-reference': 'off',
        '@typescript-eslint/unified-signatures': 'off',
        'arrow-body-style': 'off',
        'constructor-super': 'off',
        'for-direction': 'off',
        'getter-return': 'off',
        'guard-for-in': 'off',
        'id-blacklist': [
          'off',
          'any',
          'Number',
          'number',
          'String',
          'string',
          'Boolean',
          'boolean',
          'Undefined',
          'undefined',
        ],
        'id-match': 'off',
        'import/no-default-export': 'off',
        'import/no-deprecated': 'off',
        'import/no-unassigned-import': 'off',
        'import/order': 'off',
        'lines-around-comment': 'off',
        'max-len': 'off',
        'no-async-promise-executor': 'off',
        'no-bitwise': 'off',
        'no-caller': 'off',
        'no-case-declarations': 'off',
        'no-class-assign': 'off',
        'no-compare-neg-zero': 'off',
        'no-cond-assign': 'off',
        'no-confusing-arrow': 'off',
        'no-console': 'off',
        'no-const-assign': 'off',
        'no-constant-condition': 'off',
        'no-control-regex': 'off',
        'no-debugger': 'off',
        'no-delete-var': 'off',
        'no-dupe-args': 'off',
        'no-dupe-class-members': 'off',
        'no-dupe-else-if': 'off',
        'no-dupe-keys': 'off',
        'no-duplicate-case': 'off',
        'no-duplicate-imports': 'off',
        'no-empty': 'off',
        'no-empty-character-class': 'off',
        'no-empty-pattern': 'off',
        'no-eval': 'off',
        'no-ex-assign': 'off',
        'no-extra-boolean-cast': 'warn',
        'no-extra-semi': 'warn',
        'no-fallthrough': 'off',
        'no-func-assign': 'off',
        'no-global-assign': 'off',
        'no-import-assign': 'off',
        'no-inner-declarations': 'off',
        'no-invalid-regexp': 'off',
        'no-irregular-whitespace': 'off',
        'no-magic-numbers': 'off',
        'no-misleading-character-class': 'off',
        'no-mixed-operators': 'off',
        'no-new-symbol': 'off',
        'no-new-wrappers': 'off',
        'no-nonoctal-decimal-escape': 'off',
        'no-obj-calls': 'off',
        'no-octal': 'off',
        'no-param-reassign': 'off',
        'no-prototype-builtins': 'error',
        'no-redeclare': 'off',
        'no-regex-spaces': 'off',
        'no-restricted-imports': 'off',
        'no-restricted-syntax': 'off',
        'no-self-assign': 'off',
        'no-sequences': 'off',
        'no-setter-return': 'off',
        'no-shadow-restricted-names': 'off',
        'no-sparse-arrays': 'off',
        'no-tabs': 'off',
        'no-this-before-super': 'off',
        'no-throw-literal': 'off',
        'no-undef': 'off',
        'no-undef-init': 'off',
        'no-underscore-dangle': 'off',
        'no-unexpected-multiline': 'off',
        'no-unreachable': 'off',
        'no-unsafe-finally': 'off',
        'no-unsafe-negation': 'off',
        'no-unsafe-optional-chaining': 'off',
        'no-unused-labels': 'off',
        'no-useless-backreference': 'off',
        'no-useless-catch': 'off',
        'no-useless-escape': 'warn',
        'no-var': 'off',
        'no-void': 'off',
        'no-with': 'off',
        'one-var': 'off',
        'prefer-arrow/prefer-arrow-functions': 'off',
        'prefer-const': 'off',
        'prefer-spread': 'off',
        'require-yield': 'off',
        'use-isnan': 'off',
        'valid-typeof': 'off',
        curly: 'off',
        eqeqeq: 'off',
        quotes: 'off',
      },
    })),
  ...compat.config({ env: { jest: true } }).map((config) => ({
    ...config,
    files: ['**/*.spec.ts', '**/*.spec.tsx', '**/*.spec.js', '**/*.spec.jsx'],
    rules: {
      ...config.rules,
    },
  })),
]
