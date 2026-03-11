'use strict';

const express = require('express');
const { body, param } = require('express-validator');
const { v4: uuidv4 } = require('uuid');

const db = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

// ─── GET /api/categories ───────────────────────────────────────────────────────
// Public – returns active categories optionally filtered by parent_id.

router.get('/', async (req, res) => {
  const parentId = req.query.parent_id || null;
  try {
    const result = parentId
      ? await db.query(
          `SELECT * FROM categories WHERE status = 'active' AND parent_id = $1 ORDER BY name`,
          [parentId]
        )
      : await db.query(
          `SELECT * FROM categories WHERE status = 'active' ORDER BY name`
        );
    return res.json({ categories: result.rows });
  } catch (err) {
    console.error('list categories error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ─── GET /api/categories/:id ───────────────────────────────────────────────────

router.get('/:id', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM categories WHERE id = $1', [req.params.id]);
    const cat = result.rows[0];
    if (!cat) return res.status(404).json({ error: 'Kategoria nie znaleziona' });
    return res.json(cat);
  } catch (err) {
    console.error('get category error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ─── POST /api/categories ──────────────────────────────────────────────────────
// Admin / owner only.

router.post(
  '/',
  authenticate,
  requireRole('owner', 'admin'),
  [
    body('name').trim().notEmpty(),
    body('slug').trim().matches(/^[a-z0-9-]+$/i).isLength({ max: 100 }),
    body('parent_id').optional({ nullable: true }).isUUID(),
    body('status').optional().isIn(['active', 'inactive']),
  ],
  validate,
  async (req, res) => {
    const { name, slug, parent_id = null, status = 'active' } = req.body;
    try {
      const slugCheck = await db.query('SELECT id FROM categories WHERE slug = $1', [slug]);
      if (slugCheck.rows.length > 0) {
        return res.status(409).json({ error: 'Slug kategorii jest już zajęty' });
      }

      const id = uuidv4();
      const result = await db.query(
        `INSERT INTO categories (id, parent_id, name, slug, status, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         RETURNING *`,
        [id, parent_id, name, slug, status]
      );
      return res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error('create category error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── PUT /api/categories/:id ───────────────────────────────────────────────────

router.put(
  '/:id',
  authenticate,
  requireRole('owner', 'admin'),
  [
    param('id').isUUID(),
    body('name').optional().trim().notEmpty(),
    body('slug').optional().trim().matches(/^[a-z0-9-]+$/i),
    body('parent_id').optional({ nullable: true }).isUUID(),
    body('status').optional().isIn(['active', 'inactive']),
  ],
  validate,
  async (req, res) => {
    const { name, slug, parent_id, status } = req.body;
    try {
      const catResult = await db.query('SELECT id FROM categories WHERE id = $1', [req.params.id]);
      if (!catResult.rows[0]) return res.status(404).json({ error: 'Kategoria nie znaleziona' });

      if (slug) {
        const slugCheck = await db.query(
          'SELECT id FROM categories WHERE slug = $1 AND id <> $2',
          [slug, req.params.id]
        );
        if (slugCheck.rows.length > 0) {
          return res.status(409).json({ error: 'Slug kategorii jest już zajęty' });
        }
      }

      const result = await db.query(
        `UPDATE categories SET
           name       = COALESCE($1, name),
           slug       = COALESCE($2, slug),
           parent_id  = COALESCE($3, parent_id),
           status     = COALESCE($4, status),
           updated_at = NOW()
         WHERE id = $5
         RETURNING *`,
        [name || null, slug || null, parent_id !== undefined ? parent_id : null, status !== undefined ? status : null, req.params.id]
      );
      return res.json(result.rows[0]);
    } catch (err) {
      console.error('update category error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

module.exports = router;
