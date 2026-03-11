'use strict';

const express = require('express');
const { body, param } = require('express-validator');
const { v4: uuidv4 } = require('uuid');

const db = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

// ─── List categories ───────────────────────────────────────────────────────────
// Public endpoint – anyone can browse categories.

router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM categories WHERE active = true ORDER BY sort_order ASC, name ASC'
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('list categories error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ─── Get single category ───────────────────────────────────────────────────────

router.get('/:id', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM categories WHERE id = $1', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Kategoria nie znaleziona' });
    return res.json(result.rows[0]);
  } catch (err) {
    console.error('get category error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ─── Create category ──────────────────────────────────────────────────────────

router.post(
  '/',
  authenticate,
  requireRole('owner', 'admin'),
  [
    body('name').trim().notEmpty(),
    body('slug').trim().matches(/^[a-z0-9-]+$/).isLength({ max: 100 }),
    body('parent_id').optional().isUUID(),
    body('description').optional().trim(),
    body('icon').optional().trim(),
    body('sort_order').optional().isInt({ min: 0 }),
  ],
  validate,
  async (req, res) => {
    const { name, slug, parent_id = null, description = '', icon = null, sort_order = 0 } = req.body;

    try {
      const slugCheck = await db.query('SELECT id FROM categories WHERE slug = $1', [slug]);
      if (slugCheck.rows.length > 0) {
        return res.status(409).json({ error: 'Kategoria z tym slugiem już istnieje' });
      }

      const id = uuidv4();
      const result = await db.query(
        `INSERT INTO categories (id, name, slug, parent_id, description, icon, sort_order, active, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW())
         RETURNING *`,
        [id, name, slug, parent_id, description, icon, sort_order]
      );
      return res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error('create category error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── Update category ──────────────────────────────────────────────────────────

router.put(
  '/:id',
  authenticate,
  requireRole('owner', 'admin'),
  [
    param('id').isUUID(),
    body('name').optional().trim().notEmpty(),
    body('description').optional().trim(),
    body('icon').optional().trim(),
    body('sort_order').optional().isInt({ min: 0 }),
    body('active').optional().isBoolean(),
  ],
  validate,
  async (req, res) => {
    const { name, description, icon, sort_order, active } = req.body;
    try {
      const result = await db.query(
        `UPDATE categories SET
           name       = COALESCE($1, name),
           description= COALESCE($2, description),
           icon       = COALESCE($3, icon),
           sort_order = COALESCE($4, sort_order),
           active     = COALESCE($5, active)
         WHERE id = $6
         RETURNING *`,
        [
          name || null,
          description !== undefined ? description : null,
          icon !== undefined ? icon : null,
          sort_order !== undefined ? sort_order : null,
          active !== undefined ? active : null,
          req.params.id,
        ]
      );
      if (!result.rows[0]) return res.status(404).json({ error: 'Kategoria nie znaleziona' });
      return res.json(result.rows[0]);
    } catch (err) {
      console.error('update category error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── Delete category ──────────────────────────────────────────────────────────

router.delete('/:id', authenticate, requireRole('owner', 'admin'), async (req, res) => {
  try {
    const result = await db.query('DELETE FROM categories WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Kategoria nie znaleziona' });
    return res.json({ message: 'Kategoria usunięta' });
  } catch (err) {
    console.error('delete category error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

module.exports = router;
