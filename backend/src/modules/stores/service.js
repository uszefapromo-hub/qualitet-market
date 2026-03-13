'use strict'

/**
 * Stores Module – Service (business-logic layer)
 */

const StoresModel = require('./model')

async function getStore(id) {
  const store = await StoresModel.findById(id)
  if (!store) {
    const err = new Error('Sklep nie istnieje')
    err.status = 404
    throw err
  }
  return store
}

async function getStoreByOwner(ownerId) {
  return StoresModel.findByOwnerId(ownerId)
}

module.exports = { getStore, getStoreByOwner }
