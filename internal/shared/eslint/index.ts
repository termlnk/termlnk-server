/**
 * Copyright 2026-present Termlnk
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://polyformproject.org/licenses/noncommercial/1.0.0
 *
 * Use of this software for any commercial purpose is prohibited.
 * The software is provided "AS IS", WITHOUT WARRANTY OR CONDITION OF ANY KIND,
 * either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import type { Rules } from '@antfu/eslint-config';
import type { Linter } from 'eslint';
import { fixupPluginRules } from '@eslint/compat';
import typescriptParser from '@typescript-eslint/parser';
import header from 'eslint-plugin-header';
import barrel from 'eslint-plugin-no-barrel-import';
import penetrating from 'eslint-plugin-no-penetrating-import';
import noSelfPackageImports from './plugins/no-self-package-imports';

/**
 * Base ESLint rules for termlnk-server. Mirrors the desktop monorepo's style
 * choices (curly multi-line, single quotes, 2-space indent, kebab/PascalCase
 * filenames) but drops the React/Tailwind concerns since this repo is Node-only.
 */
export const baseRules: Partial<Rules> = {
  'no-useless-call': 'off',
  'unicorn/prefer-node-protocol': 'off',
  'no-async-promise-executor': 'off',

  // Server is Node-only: console / process / Buffer are idiomatic.
  'no-console': 'off',
  'node/prefer-global/process': 'off',
  'node/prefer-global/buffer': 'off',

  curly: ['error', 'multi-line'],
  'antfu/if-newline': 'off',
  'no-param-reassign': ['off'],
  'eol-last': ['error', 'always'],
  'no-empty-function': 'off',
  'no-alert': 'off',

  'ts/no-explicit-any': 'off',
  'ts/no-redeclare': 'off',
  'ts/method-signature-style': 'off',

  'style/no-multiple-empty-lines': ['error', { max: 1, maxEOF: 0 }],
  'style/brace-style': ['warn', '1tbs', { allowSingleLine: true }],
  'style/arrow-parens': ['error', 'always'],
  'style/spaced-comment': 'off',
  'style/indent-binary-ops': 'off',
  'style/operator-linebreak': 'off',
  'style/indent': ['error', 2, {
    ObjectExpression: 'first',
    SwitchCase: 1,
    ignoreComments: true,
  }],
  'style/quotes': ['warn', 'single', { avoidEscape: true }],
  'style/quote-props': ['warn', 'as-needed'],
  'style/multiline-ternary': 'warn',

  'style/comma-dangle': ['error', {
    arrays: 'always-multiline',
    objects: 'always-multiline',
    imports: 'always-multiline',
    exports: 'always-multiline',
    enums: 'always-multiline',
    functions: 'never',
  }],

  'unicorn/filename-case': [
    'error',
    {
      cases: {
        kebabCase: true,
        pascalCase: true,
      },
    },
  ],

  'sort-imports': [
    'error',
    {
      allowSeparatedGroups: false,
      ignoreCase: true,
      ignoreDeclarationSort: true,
      ignoreMemberSort: false,
      memberSyntaxSortOrder: ['none', 'all', 'multiple', 'single'],
    },
  ],
  'perfectionist/sort-imports': 'warn',
  'perfectionist/sort-named-exports': 'warn',
  'perfectionist/sort-exports': 'error',

  'accessor-pairs': 'warn',
  'jsdoc/tag-lines': 'off',

  'unused-imports/no-unused-vars': 'warn',
  'ts/no-restricted-types': 'warn',
  'ts/no-wrapper-object-types': 'warn',
  'ts/no-empty-object-type': 'warn',
  'ts/no-unsafe-function-type': 'off',
  'ts/no-unused-expressions': 'warn',
  'no-prototype-builtins': 'warn',
  'eslint-comments/no-unlimited-disable': 'off',
  'ts/prefer-ts-expect-error': 'off',
  'ts/ban-ts-comment': 'off',
  'ts/no-duplicate-enum-values': 'off',
  'no-cond-assign': 'off',
  'ts/no-use-before-define': 'warn',
  'test/no-identical-title': 'warn',
  'ts/no-non-null-asserted-optional-chain': 'warn',
  'no-restricted-syntax': 'warn',
  'prefer-regex-literals': 'warn',
  'ts/no-this-alias': 'warn',
  'prefer-promise-reject-errors': 'warn',
  'no-new': 'warn',
  'unicorn/error-message': 'warn',
  'ts/prefer-literal-enum-member': 'warn',
  'no-control-regex': 'warn',
  'ts/no-import-type-side-effects': 'warn',
  'unicorn/number-literal-case': 'warn',
  'unicorn/prefer-type-error': 'warn',
};

export function typescriptPreset(): Linter.Config {
  return {
    files: ['**/*.ts'],
    plugins: {
      termlnk: {
        rules: {
          'no-self-package-imports': noSelfPackageImports as any,
        },
      },
    },
    rules: {
      // Naming conventions match the desktop monorepo:
      //   - Interfaces start with capital `I`.
      //   - Private class members start with `_`.
      'ts/naming-convention': [
        'warn',
        {
          selector: 'interface',
          format: ['PascalCase'],
          custom: {
            regex: '^I[A-Z0-9]',
            match: true,
          },
        },
        {
          selector: ['classMethod', 'classProperty'],
          modifiers: ['private'],
          format: ['camelCase'],
          leadingUnderscore: 'require',
        },
      ],
    },
    languageOptions: {
      parser: typescriptParser,
    },
  };
}

export function termlnkSourcePreset(): Linter.Config {
  return {
    files: ['**/*.ts'],
    ignores: [
      '**/__tests__/**/*',
      '**/*.spec.ts',
      '**/*.test.ts',
    ],
    rules: {
      'termlnk/no-self-package-imports': 'error',
    },
    languageOptions: {
      parser: typescriptParser,
    },
  };
}

export function specPreset(): Linter.Config {
  return {
    files: [
      '**/*.spec.ts',
      '**/__tests__/**/*.ts',
    ],
    rules: {
      'ts/explicit-function-return-type': 'off',
    },
  };
}

export function penetratingPreset(): Linter.Config {
  return {
    files: ['**/*.ts'],
    plugins: {
      penetrating,
    },
    ignores: [
      '**/__tests__/**/*',
      '**/__testing__/**/*',
      'examples/**/*',
    ],
    rules: {
      'penetrating/no-penetrating-import': 2,
    },
  };
}

export function noBarrelImportPreset(): Linter.Config {
  return {
    files: ['**/*.ts'],
    ignores: [
      '**/*.d.ts',
      '**/*.spec.ts',
      '**/*.test.ts',
    ],
    plugins: {
      barrel,
    },
    rules: {
      'barrel/no-barrel-import': 2,
      complexity: ['warn', { max: 100 }],
      'max-lines-per-function': ['warn', 300],
    },
  };
}

export function headerPreset(): Linter.Config {
  header.rules.header.meta.schema = false;

  return {
    files: ['**/*.ts'],
    ignores: [
      '**/*.d.ts',
      '**/vitest.config.ts',
      '**/vitest.workspace.ts',
    ],
    plugins: {
      header: fixupPluginRules(header),
    },
    rules: {
      'header/header': [
        2,
        'block',
        [
          '*',
          ' * Copyright 2026-present Termlnk',
          ' *',
          ' * Licensed under the PolyForm Noncommercial License 1.0.0 (the "License");',
          ' * you may not use this file except in compliance with the License.',
          ' * You may obtain a copy of the License at',
          ' *',
          ' *     https://polyformproject.org/licenses/noncommercial/1.0.0',
          ' *',
          ' * Use of this software for any commercial purpose is prohibited.',
          ' * The software is provided "AS IS", WITHOUT WARRANTY OR CONDITION OF ANY KIND,',
          ' * either express or implied. See the License for the specific language',
          ' * governing permissions and limitations under the License.',
          ' ',
        ],
        2,
      ],
    },
  };
}
