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

import type { users } from '../entities';
import type { ITxContext } from '../services/db-adaptor.service';
import { createIdentifier } from '@termlnk-server/core';

export type IUserRow = typeof users.$inferSelect;

export interface IUserInsertParams {
  email: string;
  displayName: string | null;
  emailVerified: boolean;
}

export interface IUsersRepository {
  /**
   * Insert a new user. PG unique-violation on (email) surfaces with
   * `cause.code === '23505'`; the repository implementation normalizes that
   * into `UniqueViolationError` so the service layer doesn't read the raw
   * driver code.
   */
  insert(values: IUserInsertParams, tx?: ITxContext): Promise<IUserRow>;
  findById(id: string, tx?: ITxContext): Promise<IUserRow | null>;
  /** Email lookup is case-sensitive; caller is responsible for lowercasing. */
  findByEmail(email: string, tx?: ITxContext): Promise<IUserRow | null>;
}

export const IUsersRepository = createIdentifier<IUsersRepository>('database.users-repository');
