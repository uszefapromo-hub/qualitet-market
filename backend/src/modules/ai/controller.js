'use strict'

/**
 * AI Module – Controller (request/response layer)
 *
 * Each exported function is an Express route handler.
 * Business logic and DB access are delegated to the service and model layers.
 */

const { body, param, query, validationResult } = require('express-validator')
const AiService = require('./service')
const AiModel = require('./model')

// ─── Helpers ──────────────────────────────────────────────────────────────────

function validationErrors(req, res) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({ error: errors.array()[0].msg })
    return true
  }
  return false
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

/**
 * POST /api/ai/chat
 * Body: { message, conversation_id?, context_type?, context_id? }
 */
const chatValidators = [
  body('message').notEmpty().withMessage('Wiadomość jest wymagana').isLength({ max: 4000 }).withMessage('Wiadomość jest za długa (max 4000 znaków)'),
  body('conversation_id').optional().isUUID().withMessage('Nieprawidłowy format conversation_id'),
  body('context_type').optional().isIn(['product', 'store', 'general']).withMessage('Nieprawidłowy typ kontekstu'),
  body('context_id').optional().isUUID().withMessage('Nieprawidłowy format context_id'),
]

async function postChat(req, res, next) {
  if (validationErrors(req, res)) return
  try {
    const result = await AiService.chat({
      userId: req.user.id,
      conversationId: req.body.conversation_id || null,
      userMessage: req.body.message,
      contextType: req.body.context_type || null,
      contextId: req.body.context_id || null,
    })
    res.json(result)
  } catch (err) {
    next(err)
  }
}

// ─── Conversations ─────────────────────────────────────────────────────────────

/**
 * GET /api/ai/conversations
 */
const listConversationsValidators = [
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit musi być liczbą 1–100'),
  query('offset').optional().isInt({ min: 0 }).withMessage('offset musi być nieujemną liczbą'),
]

async function listConversations(req, res, next) {
  if (validationErrors(req, res)) return
  try {
    const limit = Math.min(100, parseInt(req.query.limit, 10) || 20)
    const offset = parseInt(req.query.offset, 10) || 0
    const conversations = await AiModel.listConversations(req.user.id, { limit, offset })
    res.json({ conversations })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/ai/conversations/:id
 */
const getConversationValidators = [
  param('id').isUUID().withMessage('Nieprawidłowy format id'),
]

async function getConversation(req, res, next) {
  if (validationErrors(req, res)) return
  try {
    const conversation = await AiModel.getConversation(req.params.id, req.user.id)
    if (!conversation) return res.status(404).json({ error: 'Rozmowa nie istnieje' })

    const messages = await AiModel.listMessages(req.params.id)
    res.json({ conversation, messages })
  } catch (err) {
    next(err)
  }
}

/**
 * DELETE /api/ai/conversations/:id
 */
async function deleteConversation(req, res, next) {
  if (validationErrors(req, res)) return
  try {
    const deleted = await AiModel.deleteConversation(req.params.id, req.user.id)
    if (!deleted) return res.status(404).json({ error: 'Rozmowa nie istnieje' })
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
}

// ─── Generation endpoints ──────────────────────────────────────────────────────

/**
 * POST /api/ai/product-description
 * Body: { name, category?, keywords?, language? }
 */
const productDescriptionValidators = [
  body('name').notEmpty().withMessage('Nazwa produktu jest wymagana').isLength({ max: 200 }).withMessage('Nazwa jest za długa'),
  body('category').optional().isLength({ max: 100 }),
  body('keywords').optional().isLength({ max: 200 }),
  body('language').optional().isIn(['pl', 'en', 'de', 'fr']).withMessage('Obsługiwane języki: pl, en, de, fr'),
]

async function postProductDescription(req, res, next) {
  if (validationErrors(req, res)) return
  try {
    const result = await AiService.generateProductDescription({
      userId: req.user.id,
      name: req.body.name,
      category: req.body.category || '',
      keywords: req.body.keywords || '',
      language: req.body.language || 'pl',
    })
    res.json(result)
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/ai/store-description
 * Body: { store_name, category?, tone? }
 */
const storeDescriptionValidators = [
  body('store_name').notEmpty().withMessage('Nazwa sklepu jest wymagana').isLength({ max: 200 }).withMessage('Nazwa jest za długa'),
  body('category').optional().isLength({ max: 100 }),
  body('tone').optional().isIn(['profesjonalny', 'przyjazny', 'luksusowy', 'casualowy']).withMessage('Nieprawidłowy ton'),
]

async function postStoreDescription(req, res, next) {
  if (validationErrors(req, res)) return
  try {
    const result = await AiService.generateStoreDescription({
      userId: req.user.id,
      storeName: req.body.store_name,
      category: req.body.category || '',
      tone: req.body.tone || 'profesjonalny',
    })
    res.json(result)
  } catch (err) {
    next(err)
  }
}

module.exports = {
  chatValidators,
  postChat,
  listConversationsValidators,
  listConversations,
  getConversationValidators,
  getConversation,
  deleteConversation,
  productDescriptionValidators,
  postProductDescription,
  storeDescriptionValidators,
  postStoreDescription,
}
