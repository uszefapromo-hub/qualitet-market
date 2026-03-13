'use strict'

/**
 * Products Module – Controller
 */

const ProductsService = require('./service')

async function getProduct(req, res, next) {
  try {
    const product = await ProductsService.getProduct(req.params.id)
    res.json(product)
  } catch (err) {
    next(err)
  }
}

module.exports = { getProduct }
