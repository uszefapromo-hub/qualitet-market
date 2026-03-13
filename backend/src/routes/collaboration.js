'use strict'

/**
 * Collaborative Stores Routes – /api/collaboration
 *
 * POST   /api/collaboration/invite              – invite a user to collaborate on a store
 * POST   /api/collaboration/accept/:token       – accept a collaboration invitation
 * GET    /api/collaboration/stores/:storeId/team – list store team members
 * DELETE /api/collaboration/stores/:storeId/members/:userId – remove a team member
 * GET    /api/collaboration/my-stores           – stores where the current user is a collaborator
 * GET    /api/collaboration/stores/:storeId/revenue-split – get revenue share settings
 * PUT    /api/collaboration/stores/:storeId/revenue-split – update revenue share settings (owner/manager)
 */

const { Router } = require('express')
const { body, param, validationResult } = require('express-validator')
const { v4: uuidv4 } = require('uuid')
const { authenticate } = require('../middleware/auth')
const db = require('../config/database')

const router = Router()
router.use(authenticate)

// ─── Helpers ──────────────────────────────────────────────────────────────────

function validationErrors(req, res) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({ error: errors.array()[0].msg })
    return true
  }
  return false
}

async function requireStoreOwnerOrManager(req, res, storeId, userId) {
  const result = await db.query(
    `SELECT role FROM store_collaborators
      WHERE store_id = $1 AND user_id = $2 AND status = 'active'`,
    [storeId, userId]
  )
  if (!result.rows.length) {
    // Check if they are the store owner
    const ownerCheck = await db.query(`SELECT id FROM stores WHERE id = $1 AND owner_id = $2`, [storeId, userId])
    if (!ownerCheck.rows.length) return null
    return 'owner'
  }
  return result.rows[0].role
}

// ─── POST /api/collaboration/invite ──────────────────────────────────────────
router.post(
  '/invite',
  [
    body('store_id').isUUID().withMessage('Nieprawidłowy store_id'),
    body('email').isEmail().withMessage('Nieprawidłowy email'),
    body('role').isIn(['manager', 'creator', 'marketer']).withMessage('Rola musi być: manager, creator lub marketer'),
  ],
  async (req, res, next) => {
    if (validationErrors(req, res)) return
    try {
      const { store_id, email, role } = req.body

      // Verify caller is owner or manager of the store
      const callerRole = await requireStoreOwnerOrManager(req, res, store_id, req.user.id)
      if (!callerRole) return res.status(403).json({ error: 'Brak uprawnień do zarządzania tym sklepem' })
      if (callerRole === 'creator' || callerRole === 'marketer') {
        return res.status(403).json({ error: 'Tylko właściciel i manager mogą zapraszać współpracowników' })
      }

      // Check store exists
      const storeCheck = await db.query(`SELECT id, name FROM stores WHERE id = $1`, [store_id])
      if (!storeCheck.rows.length) return res.status(404).json({ error: 'Sklep nie istnieje' })

      // Check if user is already a collaborator
      const invitedUser = await db.query(`SELECT id FROM users WHERE email = $1`, [email])
      if (invitedUser.rows.length) {
        const alreadyCollab = await db.query(
          `SELECT id FROM store_collaborators WHERE store_id = $1 AND user_id = $2 AND status IN ('active','pending')`,
          [store_id, invitedUser.rows[0].id]
        )
        if (alreadyCollab.rows.length) {
          return res.status(409).json({ error: 'Ten użytkownik jest już współpracownikiem sklepu' })
        }
      }

      // Create invitation
      const token = uuidv4()
      const result = await db.query(
        `INSERT INTO collaboration_invitations (store_id, invited_by, email, role, token)
              VALUES ($1, $2, $3, $4, $5)
           RETURNING id, email, role, token, expires_at, created_at`,
        [store_id, req.user.id, email, role, token]
      )

      res.status(201).json({
        invitation: result.rows[0],
        store_name: storeCheck.rows[0].name,
        message: `Zaproszenie wysłane na adres ${email}`,
      })
    } catch (err) {
      next(err)
    }
  }
)

// ─── POST /api/collaboration/accept/:token ────────────────────────────────────
router.post(
  '/accept/:token',
  [param('token').notEmpty().withMessage('Token jest wymagany')],
  async (req, res, next) => {
    if (validationErrors(req, res)) return
    try {
      const invitation = await db.query(
        `SELECT * FROM collaboration_invitations
          WHERE token = $1 AND status = 'pending' AND expires_at > NOW()`,
        [req.params.token]
      )

      if (!invitation.rows.length) return res.status(404).json({ error: 'Zaproszenie nie istnieje lub wygasło' })

      const inv = invitation.rows[0]

      // Verify the authenticated user's email matches the invitation
      const userCheck = await db.query(`SELECT id, email FROM users WHERE id = $1`, [req.user.id])
      if (!userCheck.rows.length) return res.status(404).json({ error: 'Użytkownik nie istnieje' })

      if (userCheck.rows[0].email !== inv.email) {
        return res.status(403).json({ error: 'To zaproszenie nie jest przeznaczone dla Twojego konta' })
      }

      // Add to store collaborators
      await db.query(
        `INSERT INTO store_collaborators (store_id, user_id, role, status, invited_by, accepted_at)
              VALUES ($1, $2, $3, 'active', $4, NOW())
           ON CONFLICT (store_id, user_id) DO UPDATE
              SET role = EXCLUDED.role, status = 'active', accepted_at = NOW()`,
        [inv.store_id, req.user.id, inv.role, inv.invited_by]
      )

      // Mark invitation as accepted
      await db.query(`UPDATE collaboration_invitations SET status = 'accepted' WHERE id = $1`, [inv.id])

      res.json({ success: true, store_id: inv.store_id, role: inv.role })
    } catch (err) {
      next(err)
    }
  }
)

// ─── GET /api/collaboration/stores/:storeId/team ─────────────────────────────
router.get(
  '/stores/:storeId/team',
  [param('storeId').isUUID().withMessage('Nieprawidłowy storeId')],
  async (req, res, next) => {
    if (validationErrors(req, res)) return
    try {
      const result = await db.query(
        `SELECT sc.id, sc.role, sc.status, sc.invited_at, sc.accepted_at,
                u.id AS user_id,
                COALESCE(u.name, u.email) AS username,
                u.email
           FROM store_collaborators sc
           JOIN users u ON sc.user_id = u.id
          WHERE sc.store_id = $1 AND sc.status IN ('active','pending')
          ORDER BY sc.role, sc.invited_at`,
        [req.params.storeId]
      )

      res.json({ team: result.rows })
    } catch (err) {
      next(err)
    }
  }
)

// ─── DELETE /api/collaboration/stores/:storeId/members/:userId ───────────────
router.delete(
  '/stores/:storeId/members/:userId',
  [
    param('storeId').isUUID().withMessage('Nieprawidłowy storeId'),
    param('userId').isUUID().withMessage('Nieprawidłowy userId'),
  ],
  async (req, res, next) => {
    if (validationErrors(req, res)) return
    try {
      const { storeId, userId } = req.params

      // Only owner/manager can remove, or users can remove themselves
      if (req.user.id !== userId) {
        const callerRole = await requireStoreOwnerOrManager(req, res, storeId, req.user.id)
        if (!callerRole) return res.status(403).json({ error: 'Brak uprawnień' })
        if (callerRole === 'creator' || callerRole === 'marketer') {
          return res.status(403).json({ error: 'Tylko właściciel i manager mogą usuwać współpracowników' })
        }
      }

      const result = await db.query(
        `UPDATE store_collaborators SET status = 'removed'
          WHERE store_id = $1 AND user_id = $2 AND status = 'active'
          RETURNING id`,
        [storeId, userId]
      )

      if (!result.rows.length) return res.status(404).json({ error: 'Współpracownik nie istnieje' })
      res.json({ success: true })
    } catch (err) {
      next(err)
    }
  }
)

// ─── GET /api/collaboration/my-stores ────────────────────────────────────────
router.get('/my-stores', async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT sc.role, sc.status, sc.accepted_at,
              s.id AS store_id, s.name AS store_name, s.slug AS store_slug
         FROM store_collaborators sc
         JOIN stores s ON sc.store_id = s.id
        WHERE sc.user_id = $1 AND sc.status = 'active'
        ORDER BY sc.accepted_at DESC`,
      [req.user.id]
    )
    res.json({ stores: result.rows })
  } catch (err) {
    next(err)
  }
})

// ─── GET /api/collaboration/stores/:storeId/revenue-split ────────────────────
router.get(
  '/stores/:storeId/revenue-split',
  [param('storeId').isUUID().withMessage('Nieprawidłowy storeId')],
  async (req, res, next) => {
    if (validationErrors(req, res)) return
    try {
      const result = await db.query(
        `SELECT rs.id, rs.share_type, rs.share_value, rs.applies_to, rs.is_active, rs.created_at,
                sc.role AS collaborator_role,
                u.id AS collaborator_user_id,
                COALESCE(u.name, u.email) AS collaborator_name
           FROM revenue_shares rs
           JOIN store_collaborators sc ON rs.collaborator_id = sc.id
           JOIN users u ON sc.user_id = u.id
          WHERE rs.store_id = $1 AND rs.is_active = TRUE
          ORDER BY sc.role`,
        [req.params.storeId]
      )
      res.json({ revenue_split: result.rows })
    } catch (err) {
      next(err)
    }
  }
)

// ─── PUT /api/collaboration/stores/:storeId/revenue-split ────────────────────
router.put(
  '/stores/:storeId/revenue-split',
  [
    param('storeId').isUUID().withMessage('Nieprawidłowy storeId'),
    body('splits').isArray({ min: 1 }).withMessage('splits musi być niepustą tablicą'),
    body('splits.*.collaborator_id').isUUID().withMessage('Nieprawidłowy collaborator_id'),
    body('splits.*.share_value').isFloat({ min: 0, max: 100 }).withMessage('share_value musi być między 0 a 100'),
    body('splits.*.applies_to').optional().isIn(['all', 'sales', 'affiliate', 'live']).withMessage('Nieprawidłowe applies_to'),
  ],
  async (req, res, next) => {
    if (validationErrors(req, res)) return
    try {
      const { storeId } = req.params
      const callerRole = await requireStoreOwnerOrManager(req, res, storeId, req.user.id)
      if (!callerRole) return res.status(403).json({ error: 'Brak uprawnień do zarządzania tym sklepem' })
      if (callerRole === 'creator' || callerRole === 'marketer') {
        return res.status(403).json({ error: 'Tylko właściciel i manager mogą zarządzać podziałem przychodów' })
      }

      const { splits } = req.body
      const results = []

      for (const split of splits) {
        const { collaborator_id, share_value, share_type = 'percent', applies_to = 'all' } = split

        // Verify collaborator belongs to this store
        const collabCheck = await db.query(
          `SELECT id FROM store_collaborators WHERE id = $1 AND store_id = $2 AND status = 'active'`,
          [collaborator_id, storeId]
        )
        if (!collabCheck.rows.length) continue

        const result = await db.query(
          `INSERT INTO revenue_shares (store_id, collaborator_id, share_type, share_value, applies_to)
                VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (store_id, collaborator_id, applies_to)
           DO UPDATE SET share_type = EXCLUDED.share_type, share_value = EXCLUDED.share_value, updated_at = NOW()
           RETURNING id, share_type, share_value, applies_to`,
          [storeId, collaborator_id, share_type, share_value, applies_to]
        )
        results.push(result.rows[0])
      }

      res.json({ success: true, updated: results })
    } catch (err) {
      next(err)
    }
  }
)

module.exports = router
