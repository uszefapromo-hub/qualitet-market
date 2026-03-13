'use strict'

/**
 * Payments Module – Service (business-logic layer)
 */

const PaymentsModel = require('./model')

const ALLOWED_STATUSES = ['pending', 'paid', 'failed', 'refunded', 'cancelled']

async function getPayment(id) {
  const payment = await PaymentsModel.findById(id)
  if (!payment) {
    const err = new Error('Płatność nie istnieje')
    err.status = 404
    throw err
  }
  return payment
}

async function updatePaymentStatus(id, status, providerRef) {
  if (!ALLOWED_STATUSES.includes(status)) {
    const err = new Error(`Nieprawidłowy status płatności. Dozwolone: ${ALLOWED_STATUSES.join(', ')}`)
    err.status = 400
    throw err
  }
  const payment = await PaymentsModel.updateStatus(id, status, providerRef)
  if (!payment) {
    const err = new Error('Płatność nie istnieje')
    err.status = 404
    throw err
  }
  return payment
}

module.exports = { getPayment, updatePaymentStatus }
