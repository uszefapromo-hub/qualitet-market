'use strict';

const { validationResult } = require('express-validator');

/**
 * Middleware: return 422 with validation errors if any.
 */
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }
  next();
}

/**
 * Sanitize a string value to prevent stored XSS.
 * Replaces HTML special characters with their entity equivalents.
 *
 * NOTE: For a production deployment that stores HTML-rich content,
 * consider using a dedicated allowlist-based sanitization library such as
 * DOMPurify (browser) or sanitize-html (Node.js) instead of this basic encoder.
 *
 * @param {*} value
 * @returns {string}
 */
function sanitizeText(value) {
  if (value == null) return '';
  return String(value)
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/`/g, '&#x60;');
}

/**
 * Recursively sanitize all string fields in an object or array.
 * Non-string primitives and nested objects/arrays are handled recursively.
 * @param {*} data
 * @returns {*}
 */
function sanitizeDeep(data) {
  if (typeof data === 'string') return sanitizeText(data);
  if (Array.isArray(data)) return data.map(sanitizeDeep);
  if (data && typeof data === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(data)) {
      sanitized[key] = sanitizeDeep(value);
    }
    return sanitized;
  }
  return data;
}

module.exports = { validate, sanitizeText, sanitizeDeep };
