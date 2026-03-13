'use strict'

/**
 * Social Commerce – mounted at /api/social
 *
 *   GET  /api/social/feed                    – public post feed
 *   GET  /api/social/trending                – top posts last 7 days
 *   POST /api/social/posts                   – create post
 *   POST /api/social/posts/:id/like          – toggle like
 *   POST /api/social/posts/:id/comment       – add comment
 *   GET  /api/social/posts/:id/comments      – list comments
 */

const express = require('express')
const { body } = require('express-validator')
const { v4: uuidv4 } = require('uuid')

const db = require('../config/database')
const { authenticate } = require('../middleware/auth')
const { validate } = require('../middleware/validate')

const router = express.Router()

// ─── GET /api/social/feed ─────────────────────────────────────────────────────

router.get('/feed', async (req, res) => {
  const limit  = Math.min(100, parseInt(req.query.limit  || '20', 10))
  const offset = Math.max(0,   parseInt(req.query.offset || '0',  10))

  try {
    const [countResult, rowsResult] = await Promise.all([
      db.query(`SELECT COUNT(*) FROM social_posts WHERE is_active = TRUE`),
      db.query(
        `SELECT sp.*,
                u.name  AS author_name,
                p.name  AS product_name
         FROM social_posts sp
         LEFT JOIN users         u ON u.id = sp.user_id
         LEFT JOIN shop_products p ON p.id = sp.product_id
         WHERE sp.is_active = TRUE
         ORDER BY sp.created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      ),
    ])

    return res.json({
      posts: rowsResult.rows,
      total: parseInt(countResult.rows[0].count, 10),
    })
  } catch (err) {
    console.error('social feed error:', err.message)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

// ─── GET /api/social/trending ─────────────────────────────────────────────────

router.get('/trending', async (_req, res) => {
  try {
    const result = await db.query(
      `SELECT sp.*,
              u.name  AS author_name,
              p.name  AS product_name
       FROM social_posts sp
       LEFT JOIN users         u ON u.id = sp.user_id
       LEFT JOIN shop_products p ON p.id = sp.product_id
       WHERE sp.is_active = TRUE
         AND sp.created_at >= NOW() - INTERVAL '7 days'
       ORDER BY sp.like_count DESC
       LIMIT 20`
    )

    return res.json({ posts: result.rows })
  } catch (err) {
    console.error('social trending error:', err.message)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

// ─── POST /api/social/posts ───────────────────────────────────────────────────

router.post(
  '/posts',
  authenticate,
  [
    body('content').optional().isString().isLength({ max: 2000 }),
    body('image_url').optional().isURL(),
    body('product_id').optional().isUUID(),
    body('store_id').optional().isUUID(),
  ],
  validate,
  async (req, res) => {
    const { content, image_url, product_id, store_id } = req.body

    if (!content && !image_url) {
      return res.status(400).json({ error: 'Wymagana jest treść lub obraz posta' })
    }

    try {
      const id = uuidv4()
      const result = await db.query(
        `INSERT INTO social_posts (id, user_id, store_id, product_id, content, image_url, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         RETURNING *`,
        [id, req.user.id, store_id || null, product_id || null, content || null, image_url || null]
      )

      return res.status(201).json({ post: result.rows[0] })
    } catch (err) {
      console.error('social create post error:', err.message)
      return res.status(500).json({ error: 'Błąd serwera' })
    }
  }
)

// ─── POST /api/social/posts/:id/like ─────────────────────────────────────────

router.post('/posts/:id/like', authenticate, async (req, res) => {
  const postId = req.params.id
  const userId = req.user.id

  try {
    const existing = await db.query(
      'SELECT id FROM social_likes WHERE user_id = $1 AND post_id = $2',
      [userId, postId]
    )

    let liked
    let likeCountResult

    if (existing.rows[0]) {
      await db.query(
        'DELETE FROM social_likes WHERE user_id = $1 AND post_id = $2',
        [userId, postId]
      )
      likeCountResult = await db.query(
        `UPDATE social_posts SET like_count = GREATEST(0, like_count - 1)
         WHERE id = $1 RETURNING like_count`,
        [postId]
      )
      liked = false
    } else {
      await db.query(
        'INSERT INTO social_likes (id, user_id, post_id, created_at) VALUES ($1, $2, $3, NOW())',
        [uuidv4(), userId, postId]
      )
      likeCountResult = await db.query(
        `UPDATE social_posts SET like_count = like_count + 1
         WHERE id = $1 RETURNING like_count`,
        [postId]
      )
      liked = true
    }

    if (!likeCountResult.rows[0]) {
      return res.status(404).json({ error: 'Post nie istnieje' })
    }

    return res.json({ liked, like_count: likeCountResult.rows[0].like_count })
  } catch (err) {
    console.error('social like error:', err.message)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

// ─── POST /api/social/posts/:id/comment ──────────────────────────────────────

router.post(
  '/posts/:id/comment',
  authenticate,
  [
    body('content').notEmpty().isString().isLength({ max: 500 }),
  ],
  validate,
  async (req, res) => {
    const postId = req.params.id
    const { content } = req.body

    try {
      const postCheck = await db.query(
        'SELECT id FROM social_posts WHERE id = $1 AND is_active = TRUE',
        [postId]
      )
      if (!postCheck.rows[0]) {
        return res.status(404).json({ error: 'Post nie istnieje' })
      }

      const id = uuidv4()
      const [commentResult] = await Promise.all([
        db.query(
          `INSERT INTO social_comments (id, user_id, post_id, content, created_at)
           VALUES ($1, $2, $3, $4, NOW()) RETURNING *`,
          [id, req.user.id, postId, content]
        ),
        db.query(
          `UPDATE social_posts SET comment_count = comment_count + 1 WHERE id = $1`,
          [postId]
        ),
      ])

      return res.status(201).json({ comment: commentResult.rows[0] })
    } catch (err) {
      console.error('social comment error:', err.message)
      return res.status(500).json({ error: 'Błąd serwera' })
    }
  }
)

// ─── GET /api/social/posts/:id/comments ──────────────────────────────────────

router.get('/posts/:id/comments', async (req, res) => {
  const postId = req.params.id
  const limit  = Math.min(100, parseInt(req.query.limit  || '20', 10))
  const offset = Math.max(0,   parseInt(req.query.offset || '0',  10))

  try {
    const [countResult, rowsResult] = await Promise.all([
      db.query(
        'SELECT COUNT(*) FROM social_comments WHERE post_id = $1',
        [postId]
      ),
      db.query(
        `SELECT sc.*, u.name AS author_name
         FROM social_comments sc
         LEFT JOIN users u ON u.id = sc.user_id
         WHERE sc.post_id = $1
         ORDER BY sc.created_at ASC
         LIMIT $2 OFFSET $3`,
        [postId, limit, offset]
      ),
    ])

    return res.json({
      comments: rowsResult.rows,
      total: parseInt(countResult.rows[0].count, 10),
    })
  } catch (err) {
    console.error('social get comments error:', err.message)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

module.exports = router
