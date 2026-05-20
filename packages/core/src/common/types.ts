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

export type Nullable<T> = T | null | undefined;

export type DeepReadonly<T> = {
  readonly [P in keyof T]: DeepReadonly<T[P]>;
};

export function isString(str: unknown): str is string {
  return (typeof str === 'string');
}

export function isStringArray(value: unknown): value is string[] {
  return isArrayOf(value, isString);
}

export function isArrayOf<T>(value: unknown, check: (item: unknown) => item is T): value is T[] {
  return Array.isArray(value) && value.every(check);
}

/**
 * Object excluding null, arrays, RegExp, and Date.
 */
export function isObject(obj: unknown): obj is object {
  // The method can't do a type cast since there are type (like strings) which
  // are subclasses of any put not positvely matched by the function. Hence type
  // narrowing results in wrong results.
  return typeof obj === 'object'
    && obj !== null
    && !Array.isArray(obj)
    && !(obj instanceof RegExp)
    && !(obj instanceof Date);
}

/**
 * Buffer or any Uint8Array-derived typed array.
 */
export function isTypedArray(obj: unknown): obj is object {
  const TypedArray = Object.getPrototypeOf(Uint8Array);
  return typeof obj === 'object'
    && obj instanceof TypedArray;
}

/**
 * Unlike `typeof obj === 'number'`, this returns `false` for `NaN`.
 */
export function isNumber(obj: unknown): obj is number {
  return (typeof obj === 'number' && !Number.isNaN(obj));
}

export function isIterable<T>(obj: unknown): obj is Iterable<T> {
  return !!obj && typeof (obj as any)[Symbol.iterator] === 'function';
}

export function isBoolean(obj: unknown): obj is boolean {
  return (obj === true || obj === false);
}

export function isUndefined(obj: unknown): obj is undefined {
  return (typeof obj === 'undefined');
}

export function isDefined<T>(arg: T | null | undefined): arg is T {
  return !isUndefinedOrNull(arg);
}

export function isUndefinedOrNull(obj: unknown): obj is undefined | null {
  return (isUndefined(obj) || obj === null);
}

const hasOwnProperty = Object.prototype.hasOwnProperty;

export function isEmptyObject(obj: unknown): obj is object {
  if (!isObject(obj)) {
    return false;
  }

  for (const key in obj) {
    if (hasOwnProperty.call(obj, key)) {
      return false;
    }
  }

  return true;
}

export function isFunction(obj: unknown): obj is Function {
  return (typeof obj === 'function');
}

export function areFunctions(...objects: unknown[]): boolean {
  return objects.length > 0 && objects.every(isFunction);
}
