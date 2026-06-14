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

import process from 'node:process';
import { hash } from '@node-rs/argon2';
import { ARGON2_OPTIONS } from '@termlnk-server/admin';
import pg from 'pg';

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('[reset-admin-password] DATABASE_URL is required');
    process.exit(1);
  }

  const email = (process.env.ADMIN_EMAIL ?? '').trim().toLowerCase();
  const newPassword = process.env.ADMIN_NEW_PASSWORD ?? '';
  if (!email || !newPassword) {
    console.error('[reset-admin-password] ADMIN_EMAIL and ADMIN_NEW_PASSWORD are required');
    process.exit(1);
  }
  if (newPassword.length < 8) {
    console.error('[reset-admin-password] password must be at least 8 characters');
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: url });
  try {
    await client.connect();
    const passwordHash = await hash(newPassword, ARGON2_OPTIONS);
    const result = await client.query(
      'UPDATE admin_users SET password_hash = $1, updated_at = now() WHERE email = $2 RETURNING id',
      [passwordHash, email]
    );
    if (result.rowCount === 0) {
      console.error(`[reset-admin-password] admin '${email}' not found`);
      process.exit(1);
    }
    console.log(`[reset-admin-password] password updated for ${email}`);
  } finally {
    await client.end();
  }
}

void main().catch((err) => {
  console.error('[reset-admin-password] failed:', err);
  process.exit(1);
});
