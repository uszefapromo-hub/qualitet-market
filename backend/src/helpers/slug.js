'use strict';

const db = require('../config/database');

/**
 * Convert a free-text name into a URL-safe slug.
 * Normalises Polish diacritics, lowercases, strips special chars,
 * and replaces spaces/underscores with hyphens.
 */
function nameToSlug(name) {
  const map = {
    ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ź: 'z', ż: 'z',
    Ą: 'a', Ć: 'c', Ę: 'e', Ł: 'l', Ń: 'n', Ó: 'o', Ś: 's', Ź: 'z', Ż: 'z',
  };
  return name
    .split('')
    .map((ch) => map[ch] || ch)
    .join('')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-{2,}/g, '-')
    .slice(0, 80) || 'sklep';
}

/**
 * Find a unique slug for a new store, appending a numeric suffix if needed.
 * Throws if a unique slug cannot be found within 100 attempts.
 */
async function uniqueSlug(base) {
  let candidate = base;
  const MAX_ATTEMPTS = 100;
  for (let suffix = 1; suffix <= MAX_ATTEMPTS; suffix++) {
    const { rows } = await db.query('SELECT id FROM stores WHERE slug = $1', [candidate]);
    if (rows.length === 0) return candidate;
    candidate = `${base}-${suffix}`;
  }
  throw new Error(`Cannot generate unique slug from "${base}" after ${MAX_ATTEMPTS} attempts`);
}

module.exports = { nameToSlug, uniqueSlug };
