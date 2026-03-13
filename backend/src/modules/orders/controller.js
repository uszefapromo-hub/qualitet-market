'use strict'

/**
 * Orders Module – Controller
 */

const OrdersService = require('./service')

async function getOrder(req, res, next) {
  try {
    const order = await OrdersService.getOrder(req.params.id)
    res.json(order)
  } catch (err) {
    next(err)
  }
}

module.exports = { getOrder }
