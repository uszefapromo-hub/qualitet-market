'use strict';

const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

/**
 * Fire-and-forget audit log entry.
 *
 * Column names match 002_extended_schema.sql:
 *   user_id, action, resource, resource_id, metadata, ip_address
 *
 * @param {object} opts
 * @param {string|null}  opts.actorUserId  – UUID of the user performing the action
 * @param {string}       opts.action       – e.g. 'shop_product.created'
 * @param {string|null}  [opts.resource]   – resource type, e.g. 'shop_product'
 * @param {string|null}  [opts.resourceId] – UUID of the affected resource
 * @param {object|null}  [opts.payload]    – additional metadata (stored as JSONB)
 * @param {string|null}  [opts.ipAddress]  – client IP address
 */
function auditLog({ actorUserId = null, action, resource = null, resourceId = null, payload = null, ipAddress = null }) {
  // Fire-and-forget – errors are logged but never thrown
  const id = uuidv4();
  db.query(
    `INSERT INTO audit_logs (id, user_id, action, resource, resource_id, metadata, ip_address, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7::inet, NOW())`,
    [id, actorUserId, action, resource, resourceId, payload ? JSON.stringify(payload) : null, ipAddress]
  ).catch((err) => {
    console.error('auditLog error:', err.message);
  });
}

/**
 * Compute the selling price for a shop product based on the base price and margin settings.
 *
 * @param {number}      priceGross   – base product price_gross (before store markup)
 * @param {string}      marginType   – 'percent' | 'fixed'
 * @param {number|null} marginValue  – margin value (percent or fixed amount); null → no adjustment
 * @returns {number}                 – computed selling price rounded to 2 decimal places
 *
 * Rules:
 *   percent → priceGross * (1 + marginValue / 100)
 *   fixed   → priceGross + marginValue
 */
function computeSellingPrice(priceGross, marginType, marginValue) {
  const pg = parseFloat(priceGross);
  if (marginValue == null) return parseFloat(pg.toFixed(2));
  const mv = parseFloat(marginValue);
  const raw = marginType === 'fixed' ? pg + mv : pg * (1 + mv / 100);
  return parseFloat(raw.toFixed(2));
}

module.exports = { auditLog, computeSellingPrice };
