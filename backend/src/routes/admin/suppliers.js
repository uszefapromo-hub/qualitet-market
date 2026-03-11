'use strict';

const express = require('express');
const { body, param } = require('express-validator');
const { v4: uuidv4 } = require('uuid');

const db = require('../../config/database');
const { validate } = require('../../middleware/validate');
const { logAudit } = require('./audit');

const router = express.Router();

// ─── GET /api/admin/suppliers ─────────────────────────────────────────────────

router.get('/', async (req, res) => {
  const page   = Math.max(1, parseInt(req.query.page  || '1',  10));
  const limit  = Math.min(100, parseInt(req.query.limit || '20', 10));
  const offset = (page - 1) * limit;

  try {
    const countResult = await db.query('SELECT COUNT(*) FROM suppliers');
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await db.query(
      `SELECT id, name, integration_type, api_url, margin, notes, active, country, status, last_sync_at, created_at
       FROM suppliers ORDER BY name ASC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return res.json({ total, page, limit, suppliers: result.rows });
  } catch (err) {
    console.error('admin list suppliers error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ─── GET /api/admin/suppliers/:id ─────────────────────────────────────────────

router.get(
  '/:id',
  [param('id').isUUID()],
  validate,
  async (req, res) => {
    try {
      const result = await db.query('SELECT * FROM suppliers WHERE id = $1', [req.params.id]);
      if (!result.rows[0]) return res.status(404).json({ error: 'Hurtownia nie znaleziona' });
      return res.json(result.rows[0]);
    } catch (err) {
      console.error('admin get supplier error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── POST /api/admin/suppliers ────────────────────────────────────────────────

router.post(
  '/',
  [
    body('name').trim().notEmpty(),
    body('integration_type').isIn(['api', 'xml', 'csv', 'manual']),
    body('api_url').optional({ nullable: true }).isURL(),
    body('margin').optional().isFloat({ min: 0, max: 100 }),
    body('country').optional().trim(),
    body('status').optional().isIn(['active', 'inactive']),
  ],
  validate,
  async (req, res) => {
    const {
      name,
      integration_type,
      api_url = null,
      api_key = null,
      margin = 0,
      notes = null,
      country = null,
      status = 'active',
    } = req.body;

    try {
      const id = uuidv4();
      const result = await db.query(
        `INSERT INTO suppliers
           (id, name, integration_type, api_url, api_key, margin, notes, active, country, status, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,true,$8,$9,NOW())
         RETURNING *`,
        [id, name, integration_type, api_url, api_key, margin, notes, country, status]
      );
      await logAudit(req.user.id, 'supplier.create', 'supplier', id, { name }, req);
      return res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error('admin create supplier error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── PATCH /api/admin/suppliers/:id ──────────────────────────────────────────

router.patch(
  '/:id',
  [
    param('id').isUUID(),
    body('name').optional().trim().notEmpty(),
    body('api_url').optional({ nullable: true }).isURL(),
    body('margin').optional().isFloat({ min: 0, max: 100 }),
    body('active').optional().isBoolean(),
    body('country').optional().trim(),
    body('status').optional().isIn(['active', 'inactive']),
  ],
  validate,
  async (req, res) => {
    const { name, api_url, api_key, margin, active, notes, country, status } = req.body;
    try {
      const result = await db.query(
        `UPDATE suppliers SET
           name             = COALESCE($1, name),
           api_url          = COALESCE($2, api_url),
           api_key          = COALESCE($3, api_key),
           margin           = COALESCE($4, margin),
           active           = COALESCE($5, active),
           notes            = COALESCE($6, notes),
           country          = COALESCE($7, country),
           status           = COALESCE($8, status),
           updated_at       = NOW()
         WHERE id = $9
         RETURNING *`,
        [name || null, api_url !== undefined ? api_url : null,
         api_key !== undefined ? api_key : null,
         margin !== undefined ? margin : null,
         active !== undefined ? active : null,
         notes !== undefined ? notes : null,
         country !== undefined ? country : null,
         status || null,
         req.params.id]
      );
      if (!result.rows[0]) return res.status(404).json({ error: 'Hurtownia nie znaleziona' });
      await logAudit(req.user.id, 'supplier.update', 'supplier', req.params.id, { changes: req.body }, req);
      return res.json(result.rows[0]);
    } catch (err) {
      console.error('admin update supplier error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── DELETE /api/admin/suppliers/:id ─────────────────────────────────────────

router.delete(
  '/:id',
  [param('id').isUUID()],
  validate,
  async (req, res) => {
    try {
      const result = await db.query(
        'DELETE FROM suppliers WHERE id = $1 RETURNING id',
        [req.params.id]
      );
      if (!result.rows[0]) return res.status(404).json({ error: 'Hurtownia nie znaleziona' });
      await logAudit(req.user.id, 'supplier.delete', 'supplier', req.params.id, {}, req);
      return res.json({ message: 'Hurtownia usunięta' });
    } catch (err) {
      console.error('admin delete supplier error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── POST /api/admin/suppliers/import ────────────────────────────────────────

router.post('/import', async (_req, res) => {
  // Placeholder – full import logic lives in the seller-facing suppliers route.
  // The admin route exposes the same capability without store_id restriction.
  return res.status(501).json({ error: 'Użyj POST /api/suppliers/:id/import z parametrem store_id' });
});

// ─── POST /api/admin/suppliers/sync ──────────────────────────────────────────

router.post('/sync', async (_req, res) => {
  return res.status(501).json({ error: 'Użyj POST /api/suppliers/:id/sync z parametrem store_id' });
});

module.exports = router;
