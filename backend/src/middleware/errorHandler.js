'use strict'

/**
 * Centralised error-handling middleware.
 *
 * Express recognises 4-argument middleware as an error handler.
 * Register this AFTER all routes so it catches any error passed via next(err)
 * or thrown from async route handlers wrapped with express-async-errors /
 * a manual try-catch that calls next(err).
 *
 * HTTP status is resolved from (in priority order):
 *   err.status  → err.statusCode  → 500
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500

  // Never leak stack-traces or raw messages in production for 5xx errors
  const isDev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test'
  const message =
    status < 500
      ? err.message || 'Błąd żądania'
      : isDev
        ? err.message || 'Wewnętrzny błąd serwera'
        : 'Wewnętrzny błąd serwera'

  if (status >= 500) {
    console.error('[errorHandler]', err.stack || err.message)
  }

  res.status(status).json({ error: message })
}

module.exports = errorHandler
