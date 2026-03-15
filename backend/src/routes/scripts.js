'use strict';

const express = require('express');
const { body, param } = require('express-validator');
const { v4: uuidv4 } = require('uuid');

const db = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

const VALID_TYPES      = ['analytics', 'tracking', 'chat', 'pixel', 'custom'];
const VALID_PLACEMENTS = ['head', 'body_start', 'body_end'];

// ─── GET /api/scripts – list all store scripts (admin/owner only) ─────────────

router.get('/', authenticate, requireRole('owner', 'admin'), async (req, res) => {
  try {
    const result = await db.query(
      `SELECT sc.*, st.name AS store_name, st.slug AS store_slug
       FROM scripts sc
       JOIN stores st ON sc.store_id = st.id
       ORDER BY st.name, sc.name`
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('list scripts error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ─── GET /api/scripts/store/:storeId – scripts for a specific store ───────────
// Public-facing endpoint used by the storefront to inject active scripts.

router.get(
  '/store/:storeId',
  [param('storeId').isUUID()],
  validate,
  async (req, res) => {
    try {
      const result = await db.query(
        `SELECT id, name, type, placement, content
         FROM scripts
         WHERE store_id = $1 AND active = TRUE
         ORDER BY placement, name`,
        [req.params.storeId]
      );
      return res.json(result.rows);
    } catch (err) {
      console.error('list store scripts error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── GET /api/scripts/:id – get single script (admin/owner only) ─────────────

router.get(
  '/:id',
  authenticate,
  requireRole('owner', 'admin'),
  [param('id').isUUID()],
  validate,
  async (req, res) => {
    try {
      const result = await db.query(
        `SELECT sc.*, st.owner_id
         FROM scripts sc
         JOIN stores st ON sc.store_id = st.id
         WHERE sc.id = $1`,
        [req.params.id]
      );
      const script = result.rows[0];
      if (!script) return res.status(404).json({ error: 'Skrypt nie znaleziony' });
      return res.json(script);
    } catch (err) {
      console.error('get script error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── POST /api/scripts – create a script (admin/owner only) ──────────────────

router.post(
  '/',
  authenticate,
  requireRole('owner', 'admin'),
  [
    body('store_id').isUUID(),
    body('name').trim().notEmpty().isLength({ max: 255 }),
    body('type').isIn(VALID_TYPES),
    body('placement').isIn(VALID_PLACEMENTS),
    body('content').trim().notEmpty(),
    body('active').optional().isBoolean(),
  ],
  validate,
  async (req, res) => {
    const { store_id, name, type, placement, content, active = true } = req.body;

    try {
      const storeResult = await db.query(
        'SELECT owner_id FROM stores WHERE id = $1',
        [store_id]
      );
      const store = storeResult.rows[0];
      if (!store) return res.status(404).json({ error: 'Sklep nie znaleziony' });

      const id = uuidv4();
      const result = await db.query(
        `INSERT INTO scripts (id, store_id, name, type, placement, content, active, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         RETURNING *`,
        [id, store_id, name, type, placement, content, active]
      );
      return res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error('create script error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── PATCH /api/scripts/:id – update a script (admin/owner only) ─────────────

router.patch(
  '/:id',
  authenticate,
  requireRole('owner', 'admin'),
  [
    param('id').isUUID(),
    body('name').optional().trim().notEmpty().isLength({ max: 255 }),
    body('type').optional().isIn(VALID_TYPES),
    body('placement').optional().isIn(VALID_PLACEMENTS),
    body('content').optional().trim().notEmpty(),
    body('active').optional().isBoolean(),
  ],
  validate,
  async (req, res) => {
    const { name, type, placement, content, active } = req.body;

    try {
      const existing = await db.query(
        `SELECT sc.id FROM scripts sc WHERE sc.id = $1`,
        [req.params.id]
      );
      if (!existing.rows[0]) return res.status(404).json({ error: 'Skrypt nie znaleziony' });

      const result = await db.query(
        `UPDATE scripts SET
           name       = COALESCE($1, name),
           type       = COALESCE($2, type),
           placement  = COALESCE($3, placement),
           content    = COALESCE($4, content),
           active     = COALESCE($5, active),
           updated_at = NOW()
         WHERE id = $6
         RETURNING *`,
        [
          name !== undefined ? name : null,
          type || null,
          placement || null,
          content !== undefined ? content : null,
          active !== undefined ? active : null,
          req.params.id,
        ]
      );
      return res.json(result.rows[0]);
    } catch (err) {
      console.error('update script error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── DELETE /api/scripts/:id – delete a script (admin/owner only) ────────────

router.delete(
  '/:id',
  authenticate,
  requireRole('owner', 'admin'),
  [param('id').isUUID()],
  validate,
  async (req, res) => {
    try {
      const existing = await db.query(
        'SELECT id FROM scripts WHERE id = $1',
        [req.params.id]
      );
      if (!existing.rows[0]) return res.status(404).json({ error: 'Skrypt nie znaleziony' });

      await db.query('DELETE FROM scripts WHERE id = $1', [req.params.id]);
      return res.status(204).end();
    } catch (err) {
      console.error('delete script error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

module.exports = router;
