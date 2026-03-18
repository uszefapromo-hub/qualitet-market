'use strict';

/**
 * Pagination helpers.
 *
 * parsePagination(req, opts?) – extract page / limit / offset from query params.
 *
 * @param {import('express').Request} req
 * @param {{ defaultLimit?: number, maxLimit?: number }} [opts]
 * @returns {{ page: number, limit: number, offset: number }}
 */
function parsePagination(req, { defaultLimit = 20, maxLimit = 100 } = {}) {
  const page  = Math.max(1, parseInt(req.query.page  || '1',  10));
  const limit = Math.min(maxLimit, Math.max(1, parseInt(req.query.limit || String(defaultLimit), 10)));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

module.exports = { parsePagination };
