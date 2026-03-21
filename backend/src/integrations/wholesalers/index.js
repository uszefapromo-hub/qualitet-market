'use strict';

/**
 * Wholesaler connector registry.
 *
 * Add new connectors here.  Each connector must export a fetchProducts()
 * function that returns an array of items in the standard format:
 *
 * {
 *   source, external_id, name, cost_price, image,
 *   category, stock, created_at, rating, sales,
 *   shipping_time, currency
 * }
 */

const wholesalerA = require('./wholesaler-a');
const wholesalerB = require('./wholesaler-b');

const connectors = [wholesalerA, wholesalerB];

module.exports = connectors;
