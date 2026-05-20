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

import antfu from '@antfu/eslint-config';
import {
  baseRules,
  headerPreset,
  noBarrelImportPreset,
  penetratingPreset,
  specPreset,
  termlnkSourcePreset,
  typescriptPreset,
} from '@termlnk-server/shared/eslint';

export default antfu(
  {
    gitignore: {
      files: ['.gitignore'],
      root: true,
    },
    ignores: [
      'pnpm-lock.yaml',
      'packages/database/src/migrations/**',
    ],
    stylistic: {
      indent: 2,
      semi: true,
    },
    regexp: false,
    react: false,
    pnpm: false,
    yaml: {
      overrides: {
        'yaml/indent': ['error', 2, { indicatorValueIndent: 2 }],
      },
    },
    markdown: false,
    typescript: true,
    formatters: {
      css: false,
      html: false,
    },
    rules: baseRules,
  },
  penetratingPreset(),
  typescriptPreset(),
  termlnkSourcePreset(),
  noBarrelImportPreset(),
  specPreset(),
  headerPreset()
);
