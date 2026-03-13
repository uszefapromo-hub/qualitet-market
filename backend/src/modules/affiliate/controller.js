'use strict'

/**
 * Affiliate Module – Controller
 */

const AffiliateService = require('./service')

async function getLink(req, res, next) {
  try {
    const link = await AffiliateService.getLinkByCode(req.params.code)
    res.json(link)
  } catch (err) {
    next(err)
  }
}

module.exports = { getLink }
