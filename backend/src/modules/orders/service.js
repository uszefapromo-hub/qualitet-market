'use strict'

/**
 * Orders Module – Service (business-logic layer)
 */

const OrdersModel = require('./model')

async function getOrder(id) {
  const order = await OrdersModel.findById(id)
  if (!order) {
    const err = new Error('Zamówienie nie istnieje')
    err.status = 404
    throw err
  }
  return order
}

async function updateOrderStatus(id, status) {
  const ALLOWED = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled']
  if (!ALLOWED.includes(status)) {
    const err = new Error(`Nieprawidłowy status zamówienia. Dozwolone: ${ALLOWED.join(', ')}`)
    err.status = 400
    throw err
  }
  const order = await OrdersModel.updateStatus(id, status)
  if (!order) {
    const err = new Error('Zamówienie nie istnieje')
    err.status = 404
    throw err
  }
  return order
}

module.exports = { getOrder, updateOrderStatus }
