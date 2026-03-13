'use strict'

/**
 * AI Module – Service (business-logic layer)
 *
 * Handles:
 *  - Communication with the AI provider (OpenAI-compatible REST API)
 *  - Persisting conversation history via the model layer
 *  - Product/store description generation
 *
 * Required env vars:
 *   OPENAI_API_KEY   – API key for the AI provider (optional – falls back to mock)
 *   OPENAI_BASE_URL  – Base URL of the AI provider (default: https://api.openai.com/v1)
 *   OPENAI_MODEL     – Model name to use (default: gpt-3.5-turbo)
 */

// node-fetch is the project-standard HTTP client (also used in services/supplier-import.js).
// It provides a consistent fetch API across Node.js versions supported by this project.
const fetch = require('node-fetch')
const AiModel = require('./model')

const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-3.5-turbo'

// ─── Low-level provider call ───────────────────────────────────────────────────

/**
 * Call the OpenAI Chat Completions endpoint (or compatible alternative).
 * Returns { content, tokensUsed } or throws.
 * When OPENAI_API_KEY is absent a deterministic mock response is returned so
 * developers can work locally without a real API key.
 *
 * @param {Array<{role: string, content: string}>} messages
 * @param {object} options
 * @returns {Promise<{content: string, tokensUsed: number}>}
 */
async function callAiProvider(messages, { temperature = 0.7, maxTokens = 800 } = {}) {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    // Mock response for local development / tests
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')
    return {
      content: `[AI mock] Odpowiedź na: "${lastUserMsg ? lastUserMsg.content.slice(0, 80) : '(brak wiadomości)'}"`,
      tokensUsed: 0,
    }
  }

  const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    const err = new Error(`AI provider error ${response.status}: ${body}`)
    err.status = 502
    throw err
  }

  const data = await response.json()
  const choice = data.choices && data.choices[0]
  if (!choice) {
    const err = new Error('AI provider returned no choices')
    err.status = 502
    throw err
  }

  return {
    content: choice.message.content.trim(),
    tokensUsed: data.usage ? data.usage.total_tokens : null,
  }
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT_CHAT =
  'Jesteś pomocnym asystentem dla sprzedawców na platformie Qualitet. ' +
  'Odpowiadasz po polsku, w sposób zwięzły i profesjonalny. ' +
  'Pomagasz z opisami produktów, strategią sprzedaży, obsługą klienta i marketingiem.'

/**
 * Send a chat message in an existing conversation or create a new one.
 * Returns { conversationId, message } where message is the assistant reply.
 */
async function chat({ userId, conversationId, userMessage, contextType, contextId }) {
  // Resolve or create conversation
  let conversation
  if (conversationId) {
    conversation = await AiModel.getConversation(conversationId, userId)
    if (!conversation) {
      const err = new Error('Rozmowa nie istnieje lub brak dostępu')
      err.status = 404
      throw err
    }
  } else {
    // Auto-title from first user message (first 60 chars)
    const title = userMessage.length > 60 ? userMessage.slice(0, 57) + '…' : userMessage
    conversation = await AiModel.createConversation({ userId, title, contextType, contextId })
  }

  // Persist user message
  await AiModel.addMessage({ conversationId: conversation.id, role: 'user', content: userMessage })

  // Load recent history (last 20 messages) for context window
  const history = await AiModel.listMessages(conversation.id, { limit: 20 })

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT_CHAT },
    ...history.map((m) => ({ role: m.role, content: m.content })),
  ]

  const { content, tokensUsed } = await callAiProvider(messages)

  // Persist assistant reply
  const assistantMsg = await AiModel.addMessage({
    conversationId: conversation.id,
    role: 'assistant',
    content,
    tokensUsed,
  })

  await AiModel.touchConversation(conversation.id)

  return { conversationId: conversation.id, message: assistantMsg }
}

// ─── Product description generator ────────────────────────────────────────────

/**
 * Generate a compelling product description.
 * @param {{ userId: string, name: string, category?: string, keywords?: string, language?: string }} opts
 */
async function generateProductDescription({ userId, name, category = '', keywords = '', language = 'pl' }) {
  const langLabel = language === 'pl' ? 'po polsku' : `in ${language}`
  const prompt =
    `Napisz atrakcyjny, sprzedażowy opis produktu ${langLabel} dla:\n` +
    `Nazwa: ${name}\n` +
    (category ? `Kategoria: ${category}\n` : '') +
    (keywords ? `Słowa kluczowe: ${keywords}\n` : '') +
    `\nOpis powinien mieć 3-5 zdań, podkreślać korzyści dla klienta i zachęcać do zakupu.`

  const start = Date.now()
  const { content, tokensUsed } = await callAiProvider(
    [
      { role: 'system', content: 'Jesteś ekspertem od copywritingu e-commerce. Piszesz krótkie, skuteczne opisy produktów.' },
      { role: 'user', content: prompt },
    ],
    { temperature: 0.8, maxTokens: 400 }
  )
  const durationMs = Date.now() - start

  await AiModel.logGeneration({ userId, type: 'product_description', prompt, result: content, tokensUsed, durationMs })

  return { description: content, tokensUsed }
}

// ─── Store description generator ──────────────────────────────────────────────

/**
 * Generate a store/brand description.
 * @param {{ userId: string, storeName: string, category?: string, tone?: string }} opts
 */
async function generateStoreDescription({ userId, storeName, category = '', tone = 'profesjonalny' }) {
  const prompt =
    `Napisz krótki opis sklepu internetowego po polsku:\n` +
    `Nazwa: ${storeName}\n` +
    (category ? `Branża/kategoria: ${category}\n` : '') +
    `Ton: ${tone}\n` +
    `\nOpis powinien mieć 2-4 zdania i zachęcać klientów do zakupów.`

  const start = Date.now()
  const { content, tokensUsed } = await callAiProvider(
    [
      { role: 'system', content: 'Jesteś ekspertem od budowania marki i copywritingu. Tworzysz opisy sklepów, które budują zaufanie.' },
      { role: 'user', content: prompt },
    ],
    { temperature: 0.75, maxTokens: 300 }
  )
  const durationMs = Date.now() - start

  await AiModel.logGeneration({ userId, type: 'store_description', prompt, result: content, tokensUsed, durationMs })

  return { description: content, tokensUsed }
}

module.exports = {
  chat,
  generateProductDescription,
  generateStoreDescription,
}
