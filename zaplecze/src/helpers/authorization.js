'use strict';

const db = require('../db');

function isAdmin(user) {
  return !!user && ['owner', 'admin'].includes(user.role);
}

async function getUserPrimaryStore(userId) {
  const result = await db.query(
    'SELECT * FROM stores WHERE owner_id = $1 ORDER BY created_at ASC LIMIT 1',
    [userId]
  );

  const store = result.rows[0];

  if (!store) {
    const err = new Error('Nie masz jeszcze sklepu');
    err.statusCode = 404;
    throw err;
  }

  return store;
}

async function verifyStoreOwnership(storeId, user) {
  const result = await db.query(
    'SELECT * FROM stores WHERE id = $1 LIMIT 1',
    [storeId]
  );

  const store = result.rows[0];

  if (!store) {
    const err = new Error('Sklep nie znaleziony');
    err.statusCode = 404;
    throw err;
  }

  if (!isAdmin(user) && store.owner_id !== user.id) {
    const err = new Error('Brak uprawnień do tego sklepu');
    err.statusCode = 403;
    throw err;
  }

  return store;
}

module.exports = {
  isAdmin,
  getUserPrimaryStore,
  verifyStoreOwnership,
};
