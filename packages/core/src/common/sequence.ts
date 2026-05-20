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

export interface ISequenceExecuteResult {
  index: number;
  result: boolean;
  error?: unknown;
}

/**
 * Run async tasks in order; stop on the first one that returns false or throws.
 * On stop, `index` points to the failing task; on success, `index` is `-1`.
 */
export async function sequenceAsync(tasks: Array<() => Promise<boolean> | boolean>): Promise<ISequenceExecuteResult> {
  for (const [index, task] of tasks.entries()) {
    try {
      const result = await task();
      if (!result) {
        return {
          index,
          result: false,
        };
      }
    } catch (e: unknown) {
      return {
        index,
        result: false,
        error: e,
      };
    }
  }

  return {
    result: true,
    index: -1,
  };
}

/**
 * Synchronous variant of `sequenceAsync`. Same short-circuit and result shape.
 */
export function sequence(tasks: Array<() => boolean>): ISequenceExecuteResult {
  for (const [index, task] of tasks.entries()) {
    try {
      const result = task();
      if (!result) {
        return {
          index,
          result: false,
        };
      }
    } catch (e: unknown) {
      return {
        index,
        result: false,
        error: e,
      };
    }
  }

  return {
    result: true,
    index: -1,
  };
}
