'use strict'

/**
 * Products Module – Service (business-logic layer)
 */

const ProductsModel = require('./model')

async function getProduct(id) {
  const product = await ProductsModel.findById(id)
  if (!product) {
    const err = new Error('Produkt nie istnieje')
    err.status = 404
    throw err
  }
  return product
}

module.exports = { getProduct }
