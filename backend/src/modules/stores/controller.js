'use strict'

/**
 * Stores Module – Controller
 */

const StoresService = require('./service')

async function getStore(req, res, next) {
  try {
    const store = await StoresService.getStore(req.params.id)
    res.json(store)
  } catch (err) {
    next(err)
  }
}

module.exports = { getStore }
