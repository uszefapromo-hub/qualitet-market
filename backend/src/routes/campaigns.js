'use strict';

const express = require('express');
const { body, param } = require('express-validator');
const { v4: uuidv4 } = require('uuid');

const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

// ─── List campaigns (public, active) ──────────────────────────────────────────
// IMPORTANT: specific routes (/my/*, /promoted) must be registered BEFORE /:id

router.get('/', async (req, res) => {
  try {
    const limit = Math.min(100, parseInt(req.query.limit, 10) || 20);
    const offset = parseInt(req.query.offset, 10) || 0;
    const status = req.query.status || 'active';

    const result = await db.query(
      `SELECT c.*, u.name AS owner_name,
              COUNT(DISTINCT cp.product_id) AS product_count,
              COUNT(DISTINCT cpar.creator_id) FILTER (WHERE cpar.status = 'approved') AS participant_count
       FROM campaigns c
       LEFT JOIN users u ON c.owner_id = u.id
       LEFT JOIN campaign_products cp ON c.id = cp.campaign_id
       LEFT JOIN campaign_participants cpar ON c.id = cpar.campaign_id
       WHERE c.status = $1
       GROUP BY c.id, u.name
       ORDER BY c.created_at DESC
       LIMIT $2 OFFSET $3`,
      [status, limit, offset]
    );
    return res.json({ campaigns: result.rows });
  } catch (err) {
    console.error('list campaigns error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ─── My campaigns (owner) — must be before /:id ───────────────────────────────

router.get('/my/campaigns', authenticate, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT c.*,
              COUNT(DISTINCT cp.product_id) AS product_count,
              COUNT(DISTINCT cpar.creator_id) FILTER (WHERE cpar.status = 'approved') AS participant_count
       FROM campaigns c
       LEFT JOIN campaign_products cp ON c.id = cp.campaign_id
       LEFT JOIN campaign_participants cpar ON c.id = cpar.campaign_id
       WHERE c.owner_id = $1
       GROUP BY c.id
       ORDER BY c.created_at DESC`,
      [req.user.id]
    );
    return res.json({ campaigns: result.rows });
  } catch (err) {
    console.error('my campaigns error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ─── My participations (creator) — must be before /:id ───────────────────────

router.get('/my/participations', authenticate, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT cpar.*, c.title AS campaign_title, c.commission_rate, c.status AS campaign_status,
              u.name AS owner_name
       FROM campaign_participants cpar
       JOIN campaigns c ON cpar.campaign_id = c.id
       JOIN users u ON c.owner_id = u.id
       WHERE cpar.creator_id = $1
       ORDER BY cpar.joined_at DESC`,
      [req.user.id]
    );
    return res.json({ participations: result.rows });
  } catch (err) {
    console.error('my participations error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ─── Promoted listings (GET & POST) — must be before /:id ────────────────────

router.get('/promoted', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT pl.*, p.name AS product_name, p.price, p.image_url
       FROM promoted_listings pl
       JOIN products p ON pl.product_id = p.id
       WHERE pl.active = TRUE AND pl.ends_at > NOW()
       ORDER BY pl.created_at DESC
       LIMIT 50`
    );
    return res.json({ listings: result.rows });
  } catch (err) {
    console.error('list promoted error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

router.post(
  '/promoted',
  authenticate,
  [
    body('product_id').isUUID(),
    body('plan').isIn(['7d', '30d']),
  ],
  validate,
  async (req, res) => {
    const { product_id, plan } = req.body;
    const pricePln = plan === '7d' ? 29 : 79;
    const durationDays = plan === '7d' ? 7 : 30;
    const id = uuidv4();

    try {
      const product = await db.query(
        'SELECT id FROM products WHERE id = $1 AND seller_id = $2',
        [product_id, req.user.id]
      );
      if (!product.rows[0]) return res.status(404).json({ error: 'Produkt nie znaleziony' });

      const result = await db.query(
        `INSERT INTO promoted_listings (id, product_id, seller_id, plan, price_pln, ends_at)
         VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '${durationDays} days')
         RETURNING *`,
        [id, product_id, req.user.id, plan, pricePln]
      );
      return res.status(201).json({ listing: result.rows[0] });
    } catch (err) {
      console.error('create promoted listing error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── Get single campaign ───────────────────────────────────────────────────────

router.get(
  '/:id',
  [param('id').isUUID()],
  validate,
  async (req, res) => {
    try {
      const result = await db.query(
        `SELECT c.*, u.name AS owner_name
         FROM campaigns c
         LEFT JOIN users u ON c.owner_id = u.id
         WHERE c.id = $1`,
        [req.params.id]
      );
      if (!result.rows[0]) return res.status(404).json({ error: 'Kampania nie znaleziona' });

      const products = await db.query(
        `SELECT p.id, p.name, p.price, p.image_url
         FROM campaign_products cp
         JOIN products p ON cp.product_id = p.id
         WHERE cp.campaign_id = $1`,
        [req.params.id]
      );

      const participants = await db.query(
        `SELECT cpar.id, cpar.status, cpar.joined_at, u.name AS creator_name
         FROM campaign_participants cpar
         JOIN users u ON cpar.creator_id = u.id
         WHERE cpar.campaign_id = $1 AND cpar.status = 'approved'`,
        [req.params.id]
      );

      return res.json({
        campaign: result.rows[0],
        products: products.rows,
        participants: participants.rows,
      });
    } catch (err) {
      console.error('get campaign error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── Create campaign ───────────────────────────────────────────────────────────

router.post(
  '/',
  authenticate,
  [
    body('title').trim().notEmpty().isLength({ max: 255 }),
    body('description').optional().trim().isLength({ max: 2000 }),
    body('budget').isFloat({ min: 0 }),
    body('commission_rate').optional().isFloat({ min: 0, max: 1 }),
    body('starts_at').optional().isISO8601(),
    body('ends_at').optional().isISO8601(),
  ],
  validate,
  async (req, res) => {
    const { title, description, budget, commission_rate, starts_at, ends_at } = req.body;
    const id = uuidv4();
    try {
      const result = await db.query(
        `INSERT INTO campaigns
           (id, owner_id, title, description, budget, commission_rate, starts_at, ends_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING *`,
        [id, req.user.id, title, description || null, budget, commission_rate ?? 0.10, starts_at || null, ends_at || null]
      );
      return res.status(201).json({ campaign: result.rows[0] });
    } catch (err) {
      console.error('create campaign error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── Update campaign ───────────────────────────────────────────────────────────

router.put(
  '/:id',
  authenticate,
  [
    param('id').isUUID(),
    body('title').optional().trim().notEmpty().isLength({ max: 255 }),
    body('description').optional().trim().isLength({ max: 2000 }),
    body('budget').optional().isFloat({ min: 0 }),
    body('commission_rate').optional().isFloat({ min: 0, max: 1 }),
    body('status').optional().isIn(['draft', 'active', 'paused', 'ended']),
    body('starts_at').optional().isISO8601(),
    body('ends_at').optional().isISO8601(),
  ],
  validate,
  async (req, res) => {
    try {
      const existing = await db.query(
        'SELECT * FROM campaigns WHERE id = $1',
        [req.params.id]
      );
      if (!existing.rows[0]) return res.status(404).json({ error: 'Kampania nie znaleziona' });

      const isAdmin = ['owner', 'admin'].includes(req.user.role);
      if (!isAdmin && existing.rows[0].owner_id !== req.user.id) {
        return res.status(403).json({ error: 'Brak dostępu' });
      }

      const { title, description, budget, commission_rate, status, starts_at, ends_at } = req.body;
      const result = await db.query(
        `UPDATE campaigns
         SET title          = COALESCE($1, title),
             description    = COALESCE($2, description),
             budget         = COALESCE($3, budget),
             commission_rate= COALESCE($4, commission_rate),
             status         = COALESCE($5, status),
             starts_at      = COALESCE($6, starts_at),
             ends_at        = COALESCE($7, ends_at),
             updated_at     = NOW()
         WHERE id = $8
         RETURNING *`,
        [title, description, budget, commission_rate, status, starts_at, ends_at, req.params.id]
      );
      return res.json({ campaign: result.rows[0] });
    } catch (err) {
      console.error('update campaign error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── Delete campaign ───────────────────────────────────────────────────────────

router.delete(
  '/:id',
  authenticate,
  [param('id').isUUID()],
  validate,
  async (req, res) => {
    try {
      const existing = await db.query(
        'SELECT * FROM campaigns WHERE id = $1',
        [req.params.id]
      );
      if (!existing.rows[0]) return res.status(404).json({ error: 'Kampania nie znaleziona' });

      const isAdmin = ['owner', 'admin'].includes(req.user.role);
      if (!isAdmin && existing.rows[0].owner_id !== req.user.id) {
        return res.status(403).json({ error: 'Brak dostępu' });
      }

      await db.query('DELETE FROM campaigns WHERE id = $1', [req.params.id]);
      return res.json({ message: 'Kampania usunięta' });
    } catch (err) {
      console.error('delete campaign error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── Join campaign (creator) ───────────────────────────────────────────────────

router.post(
  '/:id/join',
  authenticate,
  [param('id').isUUID()],
  validate,
  async (req, res) => {
    try {
      const campaign = await db.query(
        'SELECT * FROM campaigns WHERE id = $1 AND status = $2',
        [req.params.id, 'active']
      );
      if (!campaign.rows[0]) return res.status(404).json({ error: 'Kampania nie znaleziona lub nieaktywna' });

      const id = uuidv4();
      const result = await db.query(
        `INSERT INTO campaign_participants (id, campaign_id, creator_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (campaign_id, creator_id) DO NOTHING
         RETURNING *`,
        [id, req.params.id, req.user.id]
      );
      if (!result.rows[0]) {
        return res.status(409).json({ error: 'Już dołączyłeś do tej kampanii' });
      }
      return res.status(201).json({ participant: result.rows[0] });
    } catch (err) {
      console.error('join campaign error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── Approve / reject participant (campaign owner) ─────────────────────────────

router.patch(
  '/:id/participants/:participantId',
  authenticate,
  [
    param('id').isUUID(),
    param('participantId').isUUID(),
    body('status').isIn(['approved', 'rejected']),
  ],
  validate,
  async (req, res) => {
    try {
      const campaign = await db.query(
        'SELECT * FROM campaigns WHERE id = $1',
        [req.params.id]
      );
      if (!campaign.rows[0]) return res.status(404).json({ error: 'Kampania nie znaleziona' });

      const isAdmin = ['owner', 'admin'].includes(req.user.role);
      if (!isAdmin && campaign.rows[0].owner_id !== req.user.id) {
        return res.status(403).json({ error: 'Brak dostępu' });
      }

      const result = await db.query(
        `UPDATE campaign_participants
         SET status = $1
         WHERE id = $2 AND campaign_id = $3
         RETURNING *`,
        [req.body.status, req.params.participantId, req.params.id]
      );
      if (!result.rows[0]) return res.status(404).json({ error: 'Uczestnik nie znaleziony' });
      return res.json({ participant: result.rows[0] });
    } catch (err) {
      console.error('update participant error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

module.exports = router;
