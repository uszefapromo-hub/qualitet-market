'use strict'

/**
 * AI Module – Model (data-access layer)
 *
 * All SQL queries for the ai_conversations, ai_messages,
 * and ai_generation_log tables live here.
 */

const db = require('../../config/database')

// ─── Conversations ─────────────────────────────────────────────────────────────

async function createConversation({ userId, title = 'Nowa rozmowa', contextType = null, contextId = null }) {
  const result = await db.query(
    `INSERT INTO ai_conversations (user_id, title, context_type, context_id)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [userId, title, contextType, contextId]
  )
  return result.rows[0]
}

async function listConversations(userId, { limit = 20, offset = 0 } = {}) {
  const result = await db.query(
    `SELECT id, title, context_type, context_id, created_at, updated_at
       FROM ai_conversations
      WHERE user_id = $1
      ORDER BY updated_at DESC
      LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  )
  return result.rows
}

async function getConversation(id, userId) {
  const result = await db.query(
    `SELECT * FROM ai_conversations WHERE id = $1 AND user_id = $2`,
    [id, userId]
  )
  return result.rows[0] || null
}

async function touchConversation(id) {
  await db.query(
    `UPDATE ai_conversations SET updated_at = NOW() WHERE id = $1`,
    [id]
  )
}

async function deleteConversation(id, userId) {
  const result = await db.query(
    `DELETE FROM ai_conversations WHERE id = $1 AND user_id = $2 RETURNING id`,
    [id, userId]
  )
  return result.rows[0] || null
}

// ─── Messages ──────────────────────────────────────────────────────────────────

async function addMessage({ conversationId, role, content, tokensUsed = null }) {
  const result = await db.query(
    `INSERT INTO ai_messages (conversation_id, role, content, tokens_used)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [conversationId, role, content, tokensUsed]
  )
  return result.rows[0]
}

async function listMessages(conversationId, { limit = 50 } = {}) {
  const result = await db.query(
    `SELECT id, role, content, tokens_used, created_at
       FROM ai_messages
      WHERE conversation_id = $1
      ORDER BY created_at ASC
      LIMIT $2`,
    [conversationId, limit]
  )
  return result.rows
}

// ─── Generation log ────────────────────────────────────────────────────────────

async function logGeneration({ userId, type, prompt, result: resultText, tokensUsed = null, durationMs = null }) {
  const row = await db.query(
    `INSERT INTO ai_generation_log (user_id, type, prompt, result, tokens_used, duration_ms)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [userId, type, prompt, resultText, tokensUsed, durationMs]
  )
  return row.rows[0]
}

module.exports = {
  createConversation,
  listConversations,
  getConversation,
  touchConversation,
  deleteConversation,
  addMessage,
  listMessages,
  logGeneration,
}
