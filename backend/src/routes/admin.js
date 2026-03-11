'use strict';

/**
 * /api/admin  –  SuperAdmin panel router
 *
 * ALL sub-routes are protected by two middlewares applied here:
 *   1. authenticate  – verifies the JWT
 *   2. requireSuperAdmin  – checks role === 'superadmin'
 *
 * Sub-routes live under backend/src/routes/admin/
 */

const express = require('express');

const { authenticate, requireSuperAdmin } = require('../middleware/auth');

const dashboardRouter     = require('./admin/dashboard');
const usersRouter         = require('./admin/users');
const shopsRouter         = require('./admin/shops');
const productsRouter      = require('./admin/products');
const suppliersRouter     = require('./admin/suppliers');
const ordersRouter        = require('./admin/orders');
const subscriptionsRouter = require('./admin/subscriptions');
const auditRouter         = require('./admin/audit');

const router = express.Router();

// ─── Global middleware for all /api/admin/* endpoints ─────────────────────────
router.use(authenticate, requireSuperAdmin);

// ─── Mount sub-routers ────────────────────────────────────────────────────────
router.use('/dashboard',     dashboardRouter);
router.use('/users',         usersRouter);
router.use('/shops',         shopsRouter);
router.use('/products',      productsRouter);
router.use('/suppliers',     suppliersRouter);
router.use('/orders',        ordersRouter);
router.use('/subscriptions', subscriptionsRouter);
router.use('/audit-logs',    auditRouter);

module.exports = router;
