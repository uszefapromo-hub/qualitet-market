'use strict'

/**
 * Affiliate Module – Service (business-logic layer)
 */

const AffiliateModel = require('./model')

async function getLinkByCode(code) {
  const link = await AffiliateModel.findLinkByCode(code)
  if (!link) {
    const err = new Error('Link afiliacyjny nie istnieje')
    err.status = 404
    throw err
  }
  return link
}

async function getUserLinks(userId) {
  return AffiliateModel.findLinksByUserId(userId)
}

module.exports = { getLinkByCode, getUserLinks }
