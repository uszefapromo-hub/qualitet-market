'use strict'

/**
 * AI Module – Routes
 *
 * All endpoints require authentication (Bearer JWT).
 *
 * POST   /api/ai/chat                   – send a message (creates or continues a conversation)
 * GET    /api/ai/conversations           – list the current user's conversations
 * GET    /api/ai/conversations/:id       – get conversation + messages
 * DELETE /api/ai/conversations/:id       – delete a conversation
 * POST   /api/ai/product-description    – generate a product description
 * POST   /api/ai/store-description      – generate a store description
 * POST   /api/ai/generate-store         – generate a full store setup (name, slogan, products)
 * POST   /api/ai/marketing-pack         – generate a marketing pack for a product
 */

const { Router } = require('express')
const { authenticate } = require('../../middleware/auth')
const ctrl = require('./controller')

const router = Router()

// All AI endpoints require a valid JWT
router.use(authenticate)

router.post('/chat', ctrl.chatValidators, ctrl.postChat)

router.get('/conversations', ctrl.listConversationsValidators, ctrl.listConversations)
router.get('/conversations/:id', ctrl.getConversationValidators, ctrl.getConversation)
router.delete('/conversations/:id', ctrl.getConversationValidators, ctrl.deleteConversation)

router.post('/product-description', ctrl.productDescriptionValidators, ctrl.postProductDescription)
router.post('/store-description', ctrl.storeDescriptionValidators, ctrl.postStoreDescription)

router.post('/generate-store', ctrl.generateStoreValidators, ctrl.postGenerateStore)
router.post('/marketing-pack', ctrl.marketingPackValidators, ctrl.postMarketingPack)

module.exports = router
