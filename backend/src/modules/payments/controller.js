'use strict'

/**
 * Payments Module – Controller
 */

const PaymentsService = require('./service')

async function getPayment(req, res, next) {
  try {
    const payment = await PaymentsService.getPayment(req.params.id)
    res.json(payment)
  } catch (err) {
    next(err)
  }
}

module.exports = { getPayment }
