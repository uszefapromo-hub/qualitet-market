'use strict';

const express = require('express');
const { body, param, query } = require('express-validator');

const db = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { auditLog } = require('../helpers/audit');
const { parsePagination } = require('../helpers/pagination');

const router = express.Router();

// ─── Artist profiles ───────────────────────────────────────────────────────────

// GET /api/auctions/artists — public list of artist profiles
router.get('/artists', async (req, res) => {
  const { page, limit, offset } = parsePagination(req);
  try {
    const countResult = await db.query('SELECT COUNT(*) FROM artist_profiles');
    const total = parseInt(countResult.rows[0].count, 10);
    const result = await db.query(
      `SELECT ap.id, ap.display_name, ap.bio, ap.website, ap.plan, ap.verified,
              ap.created_at, u.name AS user_name
         FROM artist_profiles ap
         JOIN users u ON u.id = ap.user_id
        ORDER BY ap.created_at DESC
        LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return res.json({ total, page, limit, artists: result.rows });
  } catch (err) {
    console.error('list artists error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// POST /api/auctions/artists — create/update own artist profile
router.post(
  '/artists',
  authenticate,
  [
    body('display_name').trim().notEmpty().isLength({ max: 120 }),
    body('bio').optional().trim().isLength({ max: 2000 }),
    body('website').optional().trim().isURL().isLength({ max: 255 }),
    body('plan').optional().isIn(['basic', 'pro']),
  ],
  validate,
  async (req, res) => {
    const { display_name, bio, website, plan } = req.body;
    const userId = req.user.id;
    try {
      const existing = await db.query(
        'SELECT id FROM artist_profiles WHERE user_id = $1',
        [userId]
      );
      let profile;
      if (existing.rows.length > 0) {
        const result = await db.query(
          `UPDATE artist_profiles
              SET display_name = $1, bio = $2, website = $3, plan = COALESCE($4, plan),
                  updated_at = NOW()
            WHERE user_id = $5
            RETURNING *`,
          [display_name, bio || null, website || null, plan || null, userId]
        );
        profile = result.rows[0];
      } else {
        const result = await db.query(
          `INSERT INTO artist_profiles (user_id, display_name, bio, website, plan)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *`,
          [userId, display_name, bio || null, website || null, plan || 'basic']
        );
        profile = result.rows[0];
      }
      auditLog({ actorUserId: userId, action: 'artist_profile_save', resource: 'artist_profiles', resourceId: profile.id });
      return res.json({ profile });
    } catch (err) {
      console.error('save artist profile error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── Artworks ─────────────────────────────────────────────────────────────────

// GET /api/auctions/artworks — public list
router.get('/artworks', async (req, res) => {
  const { page, limit, offset } = parsePagination(req);
  const statusFilter = req.query.status || null;
  try {
    const countResult = await db.query(
      `SELECT COUNT(*) FROM artworks WHERE ($1::text IS NULL OR status = $1)`,
      [statusFilter]
    );
    const total = parseInt(countResult.rows[0].count, 10);
    const result = await db.query(
      `SELECT aw.id, aw.title, aw.description, aw.image_url, aw.medium,
              aw.dimensions, aw.year_created, aw.status, aw.created_at,
              ap.display_name AS artist_name, ap.id AS artist_id
         FROM artworks aw
         JOIN artist_profiles ap ON ap.id = aw.artist_id
        WHERE ($1::text IS NULL OR aw.status = $1)
        ORDER BY aw.created_at DESC
        LIMIT $2 OFFSET $3`,
      [statusFilter, limit, offset]
    );
    return res.json({ total, page, limit, artworks: result.rows });
  } catch (err) {
    console.error('list artworks error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// POST /api/auctions/artworks — add artwork (artist must have a profile)
router.post(
  '/artworks',
  authenticate,
  [
    body('title').trim().notEmpty().isLength({ max: 255 }),
    body('description').optional().trim().isLength({ max: 3000 }),
    body('image_url').optional().trim().isURL().isLength({ max: 500 }),
    body('medium').optional().trim().isLength({ max: 100 }),
    body('dimensions').optional().trim().isLength({ max: 100 }),
    body('year_created').optional().isInt({ min: 1000, max: 9999 }),
  ],
  validate,
  async (req, res) => {
    const userId = req.user.id;
    const { title, description, image_url, medium, dimensions, year_created } = req.body;
    try {
      const artistResult = await db.query(
        'SELECT id FROM artist_profiles WHERE user_id = $1',
        [userId]
      );
      if (artistResult.rows.length === 0) {
        return res.status(403).json({ error: 'Musisz najpierw utworzyć profil artysty' });
      }
      const artistId = artistResult.rows[0].id;
      const result = await db.query(
        `INSERT INTO artworks (artist_id, title, description, image_url, medium, dimensions, year_created)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [artistId, title, description || null, image_url || null, medium || null, dimensions || null, year_created || null]
      );
      auditLog({ actorUserId: userId, action: 'artwork_create', resource: 'artworks', resourceId: result.rows[0].id });
      return res.status(201).json({ artwork: result.rows[0] });
    } catch (err) {
      console.error('create artwork error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── Auctions ─────────────────────────────────────────────────────────────────

// GET /api/auctions — public list of auctions
router.get('/', async (req, res) => {
  const { page, limit, offset } = parsePagination(req);
  const statusFilter = req.query.status || 'active';
  try {
    const countResult = await db.query(
      `SELECT COUNT(*) FROM auctions WHERE ($1::text IS NULL OR status = $1)`,
      [statusFilter === 'all' ? null : statusFilter]
    );
    const total = parseInt(countResult.rows[0].count, 10);
    const result = await db.query(
      `SELECT a.id, a.title, a.description, a.starting_price, a.current_price,
              a.bid_count, a.status, a.starts_at, a.ends_at, a.created_at,
              aw.image_url AS artwork_image, aw.title AS artwork_title,
              ap.display_name AS artist_name, ap.id AS artist_id
         FROM auctions a
         JOIN artworks aw ON aw.id = a.artwork_id
         JOIN artist_profiles ap ON ap.id = a.artist_id
        WHERE ($1::text IS NULL OR a.status = $1)
        ORDER BY a.ends_at ASC
        LIMIT $2 OFFSET $3`,
      [statusFilter === 'all' ? null : statusFilter, limit, offset]
    );
    return res.json({ total, page, limit, auctions: result.rows });
  } catch (err) {
    console.error('list auctions error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// GET /api/auctions/:id — single auction details
router.get(
  '/:id',
  [param('id').isUUID()],
  validate,
  async (req, res) => {
    try {
      const result = await db.query(
        `SELECT a.*, aw.title AS artwork_title, aw.description AS artwork_description,
                aw.image_url AS artwork_image, aw.medium, aw.dimensions, aw.year_created,
                ap.display_name AS artist_name, ap.bio AS artist_bio,
                u.name AS winner_name
           FROM auctions a
           JOIN artworks aw ON aw.id = a.artwork_id
           JOIN artist_profiles ap ON ap.id = a.artist_id
           LEFT JOIN users u ON u.id = a.winner_id
          WHERE a.id = $1`,
        [req.params.id]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Aukcja nie istnieje' });
      const auction = result.rows[0];

      const bidsResult = await db.query(
        `SELECT ab.id, ab.amount, ab.created_at, u.name AS bidder_name
           FROM auction_bids ab
           JOIN users u ON u.id = ab.bidder_id
          WHERE ab.auction_id = $1
          ORDER BY ab.amount DESC
          LIMIT 10`,
        [req.params.id]
      );
      auction.top_bids = bidsResult.rows;
      return res.json({ auction });
    } catch (err) {
      console.error('get auction error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// POST /api/auctions — create a new auction (artist only)
router.post(
  '/',
  authenticate,
  [
    body('artwork_id').isUUID(),
    body('title').trim().notEmpty().isLength({ max: 255 }),
    body('description').optional().trim().isLength({ max: 3000 }),
    body('starting_price').isFloat({ min: 0 }),
    body('reserve_price').optional().isFloat({ min: 0 }),
    body('ends_at').isISO8601(),
  ],
  validate,
  async (req, res) => {
    const userId = req.user.id;
    const { artwork_id, title, description, starting_price, reserve_price, ends_at } = req.body;
    try {
      const artistResult = await db.query(
        'SELECT id FROM artist_profiles WHERE user_id = $1',
        [userId]
      );
      if (artistResult.rows.length === 0) {
        return res.status(403).json({ error: 'Musisz najpierw utworzyć profil artysty' });
      }
      const artistId = artistResult.rows[0].id;

      // Verify the artwork belongs to this artist and is available
      const artworkResult = await db.query(
        `SELECT id FROM artworks WHERE id = $1 AND artist_id = $2 AND status = 'available'`,
        [artwork_id, artistId]
      );
      if (artworkResult.rows.length === 0) {
        return res.status(400).json({ error: 'Dzieło nie istnieje lub jest niedostępne' });
      }

      const endsAtDate = new Date(ends_at);
      if (endsAtDate <= new Date()) {
        return res.status(400).json({ error: 'Data zakończenia musi być w przyszłości' });
      }

      const result = await db.query(
        `INSERT INTO auctions (artwork_id, artist_id, title, description, starting_price, reserve_price, current_price, ends_at)
         VALUES ($1, $2, $3, $4, $5, $6, $5, $7)
         RETURNING *`,
        [artwork_id, artistId, title, description || null, starting_price, reserve_price || null, ends_at]
      );

      // Mark artwork as on_auction
      await db.query(`UPDATE artworks SET status = 'on_auction' WHERE id = $1`, [artwork_id]);

      auditLog({ actorUserId: userId, action: 'auction_create', resource: 'auctions', resourceId: result.rows[0].id });
      return res.status(201).json({ auction: result.rows[0] });
    } catch (err) {
      console.error('create auction error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// POST /api/auctions/:id/bid — place a bid
router.post(
  '/:id/bid',
  authenticate,
  [
    param('id').isUUID(),
    body('amount').isFloat({ min: 0.01 }),
  ],
  validate,
  async (req, res) => {
    const userId = req.user.id;
    const { amount } = req.body;
    const auctionId = req.params.id;
    try {
      const auctionResult = await db.query(
        `SELECT * FROM auctions WHERE id = $1`,
        [auctionId]
      );
      if (auctionResult.rows.length === 0) return res.status(404).json({ error: 'Aukcja nie istnieje' });
      const auction = auctionResult.rows[0];

      if (auction.status !== 'active') {
        return res.status(400).json({ error: 'Aukcja nie jest aktywna' });
      }
      if (new Date(auction.ends_at) < new Date()) {
        return res.status(400).json({ error: 'Aukcja zakończyła się' });
      }
      if (parseFloat(amount) <= parseFloat(auction.current_price)) {
        return res.status(400).json({ error: 'Oferta musi być wyższa niż aktualna cena' });
      }

      // Check bidder is not the artist
      const artistCheck = await db.query(
        'SELECT user_id FROM artist_profiles WHERE id = $1',
        [auction.artist_id]
      );
      if (artistCheck.rows.length > 0 && artistCheck.rows[0].user_id === userId) {
        return res.status(400).json({ error: 'Artysta nie może licytować własnych dzieł' });
      }

      // Insert bid
      const bidResult = await db.query(
        `INSERT INTO auction_bids (auction_id, bidder_id, amount) VALUES ($1, $2, $3) RETURNING *`,
        [auctionId, userId, amount]
      );

      // Update auction current price and bid count
      await db.query(
        `UPDATE auctions SET current_price = $1, bid_count = bid_count + 1, winner_id = $2, updated_at = NOW() WHERE id = $3`,
        [amount, userId, auctionId]
      );

      auditLog({ actorUserId: userId, action: 'auction_bid', resource: 'auction_bids', resourceId: bidResult.rows[0].id, metadata: { auction_id: auctionId, amount } });
      return res.status(201).json({ bid: bidResult.rows[0] });
    } catch (err) {
      console.error('place bid error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// GET /api/auctions/:id/bids — list bids for an auction
router.get(
  '/:id/bids',
  [param('id').isUUID()],
  validate,
  async (req, res) => {
    const { page, limit, offset } = parsePagination(req);
    try {
      const countResult = await db.query(
        'SELECT COUNT(*) FROM auction_bids WHERE auction_id = $1',
        [req.params.id]
      );
      const total = parseInt(countResult.rows[0].count, 10);
      const result = await db.query(
        `SELECT ab.id, ab.amount, ab.created_at, u.name AS bidder_name
           FROM auction_bids ab
           JOIN users u ON u.id = ab.bidder_id
          WHERE ab.auction_id = $1
          ORDER BY ab.amount DESC
          LIMIT $2 OFFSET $3`,
        [req.params.id, limit, offset]
      );
      return res.json({ total, page, limit, bids: result.rows });
    } catch (err) {
      console.error('list bids error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

module.exports = router;
