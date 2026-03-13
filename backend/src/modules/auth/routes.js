'use strict'

/**
 * Auth Module – Routes
 *
 * Re-exports the existing flat auth router so the module directory acts as
 * the canonical entry-point for this module.
 *
 * app.js should import this instead of ../../routes/auth going forward.
 */

module.exports = require('../../routes/auth')
