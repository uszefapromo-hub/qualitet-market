'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const { body, param } = require('express-validator');
const { v4: uuidv4 } = require('uuid');

const db = require('../../config/database');
const { validate } = require('../../middleware/validate');
const { logAudit } = require('./audit');

const router = express.Router();

const VALID_ROLES = ['customer', 'seller', 'admin', 'superadmin'];

// ─── GET /api/admin/users ─────────────────────────────────────────────────────

router.get('/', async (req, res) => {
  const page   = Math.max(1, parseInt(req.query.page  || '1',  10));
  const limit  = Math.min(100, parseInt(req.query.limit || '20', 10));
  const offset = (page - 1) * limit;
  const search = req.query.search ? `%${req.query.search}%` : null;

  try {
    let countSql = 'SELECT COUNT(*) FROM users';
    let listSql  = `SELECT id, email, name, phone, role, plan, trial_ends_at, created_at FROM users`;
    const params = [];

    if (search) {
      countSql += ' WHERE email ILIKE $1 OR name ILIKE $1';
      listSql  += ' WHERE email ILIKE $1 OR name ILIKE $1';
      params.push(search);
    }

    const countResult = await db.query(countSql, params);
    const total = parseInt(countResult.rows[0].count, 10);

    listSql += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    const result = await db.query(listSql, [...params, limit, offset]);

    return res.json({ total, page, limit, users: result.rows });
  } catch (err) {
    console.error('admin list users error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ─── GET /api/admin/users/:id ─────────────────────────────────────────────────

router.get(
  '/:id',
  [param('id').isUUID()],
  validate,
  async (req, res) => {
    try {
      const result = await db.query(
        `SELECT id, email, name, phone, role, plan, trial_ends_at, created_at, updated_at
         FROM users WHERE id = $1`,
        [req.params.id]
      );
      if (!result.rows[0]) return res.status(404).json({ error: 'Użytkownik nie znaleziony' });
      return res.json(result.rows[0]);
    } catch (err) {
      console.error('admin get user error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── PATCH /api/admin/users/:id ───────────────────────────────────────────────

router.patch(
  '/:id',
  [
    param('id').isUUID(),
    body('role').optional().isIn(VALID_ROLES),
    body('plan').optional().isIn(['trial', 'basic', 'pro', 'elite']),
    body('blocked').optional().isBoolean(),
    body('name').optional().trim().notEmpty(),
  ],
  validate,
  async (req, res) => {
    const { role, plan, blocked, name } = req.body;
    try {
      const result = await db.query(
        `UPDATE users SET
           role       = COALESCE($1, role),
           plan       = COALESCE($2, plan),
           blocked    = COALESCE($3, blocked),
           name       = COALESCE($4, name),
           updated_at = NOW()
         WHERE id = $5
         RETURNING id, email, name, phone, role, plan, blocked`,
        [role || null, plan || null, blocked !== undefined ? blocked : null, name || null, req.params.id]
      );
      if (!result.rows[0]) return res.status(404).json({ error: 'Użytkownik nie znaleziony' });
      await logAudit(req.user.id, 'user.update', 'user', req.params.id, { changes: req.body }, req);
      return res.json(result.rows[0]);
    } catch (err) {
      console.error('admin update user error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── POST /api/admin/users/:id/reset-password ─────────────────────────────────

router.post(
  '/:id/reset-password',
  [
    param('id').isUUID(),
    body('newPassword').isLength({ min: 8 }),
  ],
  validate,
  async (req, res) => {
    const { newPassword } = req.body;
    try {
      const hash = await bcrypt.hash(newPassword, 12);
      const result = await db.query(
        'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2 RETURNING id',
        [hash, req.params.id]
      );
      if (!result.rows[0]) return res.status(404).json({ error: 'Użytkownik nie znaleziony' });
      await logAudit(req.user.id, 'user.reset_password', 'user', req.params.id, {}, req);
      return res.json({ message: 'Hasło zmienione' });
    } catch (err) {
      console.error('admin reset password error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── DELETE /api/admin/users/:id ─────────────────────────────────────────────

router.delete(
  '/:id',
  [param('id').isUUID()],
  validate,
  async (req, res) => {
    try {
      const result = await db.query(
        'DELETE FROM users WHERE id = $1 RETURNING id',
        [req.params.id]
      );
      if (!result.rows[0]) return res.status(404).json({ error: 'Użytkownik nie znaleziony' });
      await logAudit(req.user.id, 'user.delete', 'user', req.params.id, {}, req);
      return res.json({ message: 'Użytkownik usunięty' });
    } catch (err) {
      console.error('admin delete user error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── POST /api/admin/users – create user ─────────────────────────────────────

router.post(
  '/',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
    body('name').trim().notEmpty(),
    body('role').optional().isIn(VALID_ROLES),
  ],
  validate,
  async (req, res) => {
    const { email, password, name, role = 'customer' } = req.body;
    try {
      const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: 'Użytkownik z tym e-mailem już istnieje' });
      }
      const id = uuidv4();
      const hash = await bcrypt.hash(password, 12);
      const result = await db.query(
        `INSERT INTO users (id, email, password_hash, name, role, plan, created_at)
         VALUES ($1,$2,$3,$4,$5,'trial',NOW())
         RETURNING id, email, name, role, plan`,
        [id, email, hash, name, role]
      );
      await logAudit(req.user.id, 'user.create', 'user', id, { email, role }, req);
      return res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error('admin create user error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

module.exports = router;
