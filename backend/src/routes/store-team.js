'use strict';

/**
 * Store Team / Collaboration routes.
 *
 * POST /api/store/invite        – owner invites a collaborator by e-mail
 * POST /api/store/accept-invite – invited user accepts the invite token
 * GET  /api/store/team          – list team members for owner's store
 * POST /api/store/revenue-split – configure revenue split percentages
 *
 * Role permission matrix:
 *   owner    – full access to all team and revenue endpoints
 *   manager  – products and orders
 *   creator  – affiliate promotion
 *   marketer – marketing tools
 */

const crypto  = require('crypto');
const express = require('express');
const { body, query } = require('express-validator');
const { v4: uuidv4 } = require('uuid');

const db = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

const VALID_ROLES = ['owner', 'manager', 'creator', 'marketer'];
const VALID_PARTICIPANTS = ['seller', 'creator', 'platform'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateInviteToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Resolve the store owned by the authenticated seller.
 * Returns the store row or null.
 */
async function getOwnerStore(userId) {
  const result = await db.query(
    'SELECT * FROM stores WHERE owner_id = $1 ORDER BY created_at ASC LIMIT 1',
    [userId]
  );
  return result.rows[0] || null;
}

// ─── POST /api/store/invite ───────────────────────────────────────────────────

router.post(
  '/invite',
  authenticate,
  requireRole('seller', 'owner', 'admin'),
  [
    body('email').isEmail().normalizeEmail().withMessage('Podaj poprawny adres e-mail'),
    body('role').isIn(VALID_ROLES).withMessage('Nieprawidłowa rola. Dozwolone: ' + VALID_ROLES.join(', ')),
  ],
  validate,
  async (req, res) => {
    const { email, role } = req.body;

    try {
      const store = await getOwnerStore(req.user.id);
      if (!store) {
        return res.status(404).json({ error: 'Nie masz jeszcze sklepu' });
      }

      // Prevent inviting yourself
      if (email === req.user.email) {
        return res.status(400).json({ error: 'Nie możesz zaprosić samego siebie' });
      }

      // Prevent inviting the store owner role twice
      if (role === 'owner') {
        return res.status(400).json({ error: 'Rola owner jest zarezerwowana dla właściciela sklepu' });
      }

      const inviteToken = generateInviteToken();

      // Upsert: if the same e-mail was previously invited (even revoked), refresh the invite
      const result = await db.query(
        `INSERT INTO store_collaborators (id, store_id, email, role, status, invite_token, invited_by, invited_at)
         VALUES ($1, $2, $3, $4, 'pending', $5, $6, NOW())
         ON CONFLICT (store_id, email) DO UPDATE
           SET role = EXCLUDED.role,
               status = 'pending',
               invite_token = EXCLUDED.invite_token,
               invited_by = EXCLUDED.invited_by,
               invited_at = NOW(),
               accepted_at = NULL
         RETURNING *`,
        [uuidv4(), store.id, email, role, inviteToken, req.user.id]
      );

      const collaborator = result.rows[0];

      return res.status(201).json({
        id: collaborator.id,
        store_id: collaborator.store_id,
        email: collaborator.email,
        role: collaborator.role,
        status: collaborator.status,
        invite_token: collaborator.invite_token,
        invited_at: collaborator.invited_at,
      });
    } catch (err) {
      console.error('store invite error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── POST /api/store/accept-invite ────────────────────────────────────────────

router.post(
  '/accept-invite',
  authenticate,
  [
    body('token').notEmpty().withMessage('Token jest wymagany'),
  ],
  validate,
  async (req, res) => {
    const { token } = req.body;

    try {
      // Find the pending invite
      const inviteResult = await db.query(
        `SELECT sc.*, s.name AS store_name
         FROM store_collaborators sc
         JOIN stores s ON sc.store_id = s.id
         WHERE sc.invite_token = $1 AND sc.status = 'pending'`,
        [token]
      );

      const invite = inviteResult.rows[0];
      if (!invite) {
        return res.status(404).json({ error: 'Zaproszenie nieważne lub już zaakceptowane' });
      }

      // Verify the token belongs to the authenticated user's email
      if (invite.email !== req.user.email) {
        return res.status(403).json({ error: 'To zaproszenie nie jest dla Ciebie' });
      }

      // Accept: bind user_id, clear token, set status active
      const updated = await db.query(
        `UPDATE store_collaborators
         SET user_id = $1, status = 'active', invite_token = NULL, accepted_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [req.user.id, invite.id]
      );

      const collaborator = updated.rows[0];

      return res.json({
        id: collaborator.id,
        store_id: collaborator.store_id,
        store_name: invite.store_name,
        role: collaborator.role,
        status: collaborator.status,
        accepted_at: collaborator.accepted_at,
      });
    } catch (err) {
      console.error('accept invite error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── GET /api/store/team ──────────────────────────────────────────────────────

router.get(
  '/team',
  authenticate,
  requireRole('seller', 'owner', 'admin'),
  async (req, res) => {
    const page  = Math.max(1, parseInt(req.query.page  || '1',  10));
    const limit = Math.min(100, parseInt(req.query.limit || '20', 10));
    const offset = (page - 1) * limit;

    try {
      const store = await getOwnerStore(req.user.id);
      if (!store) {
        return res.status(404).json({ error: 'Nie masz jeszcze sklepu' });
      }

      const countResult = await db.query(
        'SELECT COUNT(*) FROM store_collaborators WHERE store_id = $1',
        [store.id]
      );
      const total = parseInt(countResult.rows[0].count, 10);

      const membersResult = await db.query(
        `SELECT sc.id, sc.email, sc.role, sc.status, sc.invited_at, sc.accepted_at,
                u.name AS user_name
         FROM store_collaborators sc
         LEFT JOIN users u ON sc.user_id = u.id
         WHERE sc.store_id = $1
         ORDER BY sc.invited_at DESC
         LIMIT $2 OFFSET $3`,
        [store.id, limit, offset]
      );

      return res.json({
        store_id: store.id,
        total,
        page,
        limit,
        members: membersResult.rows,
      });
    } catch (err) {
      console.error('store team error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── POST /api/store/revenue-split ───────────────────────────────────────────

router.post(
  '/revenue-split',
  authenticate,
  requireRole('seller', 'owner', 'admin'),
  [
    body('seller').isFloat({ min: 0, max: 100 }).withMessage('Procent seller musi być między 0 a 100'),
    body('creator').isFloat({ min: 0, max: 100 }).withMessage('Procent creator musi być między 0 a 100'),
    body('platform').isFloat({ min: 0, max: 100 }).withMessage('Procent platform musi być między 0 a 100'),
  ],
  validate,
  async (req, res) => {
    const sellerPct   = parseFloat(req.body.seller);
    const creatorPct  = parseFloat(req.body.creator);
    const platformPct = parseFloat(req.body.platform);

    if (sellerPct + creatorPct + platformPct > 100) {
      return res.status(400).json({ error: 'Suma procent nie może przekraczać 100%' });
    }

    try {
      const store = await getOwnerStore(req.user.id);
      if (!store) {
        return res.status(404).json({ error: 'Nie masz jeszcze sklepu' });
      }

      const shares = [
        { participant: 'seller',   pct: sellerPct },
        { participant: 'creator',  pct: creatorPct },
        { participant: 'platform', pct: platformPct },
      ];

      const saved = [];
      for (const { participant, pct } of shares) {
        const r = await db.query(
          `INSERT INTO revenue_shares (id, store_id, participant, percentage, updated_at)
           VALUES ($1, $2, $3, $4, NOW())
           ON CONFLICT (store_id, participant) DO UPDATE
             SET percentage = EXCLUDED.percentage, updated_at = NOW()
           RETURNING *`,
          [uuidv4(), store.id, participant, pct]
        );
        saved.push(r.rows[0]);
      }

      return res.json({
        store_id: store.id,
        revenue_shares: saved.map((s) => ({
          participant: s.participant,
          percentage: parseFloat(s.percentage),
          updated_at: s.updated_at,
        })),
      });
    } catch (err) {
      console.error('revenue split error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

module.exports = router;
