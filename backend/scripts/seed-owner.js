'use strict';

/**
 * Platform owner account initialisation script.
 *
 * Creates or updates the owner account so the platform administrator
 * can log in to the admin panel.
 *
 * Configuration via environment variables (or .env file):
 *
 *   OWNER_EMAIL     – account e-mail address (required)
 *   OWNER_PASSWORD  – plain-text password to set  (required)
 *   OWNER_NAME      – display name                (default: "Właściciel Platformy")
 *   OWNER_PHONE     – phone number stored on the account (optional)
 *
 * Usage:
 *   node scripts/seed-owner.js
 *   npm run seed:owner
 *
 * The script is idempotent: running it again updates the existing account
 * rather than creating a duplicate.
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('../src/config/database');

async function seedOwner() {
  const email    = process.env.OWNER_EMAIL;
  const password = process.env.OWNER_PASSWORD;
  const name     = process.env.OWNER_NAME  || 'Właściciel Platformy';
  const phone    = process.env.OWNER_PHONE || null;

  if (!email) {
    console.error('ERROR: OWNER_EMAIL environment variable is required.');
    process.exit(1);
  }
  if (!password) {
    console.error('ERROR: OWNER_PASSWORD environment variable is required.');
    process.exit(1);
  }

  console.log(`Initialising owner account: ${email}`);

  const passwordHash = await bcrypt.hash(password, 12);

  const existing = await db.query(
    'SELECT id, role FROM users WHERE email = $1',
    [email]
  );

  if (existing.rows.length > 0) {
    const user = existing.rows[0];
    console.log(`User already exists (id=${user.id}, role=${user.role}) – updating…`);

    await db.query(
      `UPDATE users
          SET password_hash = $1,
              phone         = COALESCE($2, phone),
              role          = 'owner',
              plan          = 'elite',
              updated_at    = NOW()
        WHERE email = $3`,
      [passwordHash, phone, email]
    );

    console.log(`Updated: role=owner, plan=elite${phone ? `, phone=${phone}` : ''}`);
  } else {
    const id = uuidv4();

    await db.query(
      `INSERT INTO users (id, email, password_hash, name, phone, role, plan, created_at)
       VALUES ($1, $2, $3, $4, $5, 'owner', 'elite', NOW())`,
      [id, email, passwordHash, name, phone]
    );

    console.log(`Created owner account: id=${id}${phone ? `, phone=${phone}` : ''}`);
  }

  console.log('Done. You can now log in at /login.html');
  await db.pool.end();
}

seedOwner().catch((err) => {
  console.error('seed-owner failed:', err.message);
  process.exit(1);
});
