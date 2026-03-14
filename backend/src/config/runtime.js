'use strict';

const INSECURE_JWT_SECRETS = new Set([
  'change_this_secret',
  'your_super_secret_jwt_key_change_this_in_production',
]);
let hasWarnedAboutJwtFallback = false;

function getAllowedOrigins() {
  return (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  const isInsecureSecret = !secret || INSECURE_JWT_SECRETS.has(secret);

  if (isInsecureSecret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET musi być ustawiony na bezpieczną wartość w środowisku production');
    }

    if (process.env.NODE_ENV !== 'test' && !hasWarnedAboutJwtFallback) {
      console.warn('[config] JWT_SECRET nie jest ustawiony poprawnie; używam tylko deweloperskiego fallbacku');
      hasWarnedAboutJwtFallback = true;
    }
  }

  return secret || 'change_this_secret';
}

function validateRuntimeConfig() {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  if (getAllowedOrigins().length === 0) {
    throw new Error('ALLOWED_ORIGINS musi być ustawione w środowisku production');
  }

  getJwtSecret();
}

module.exports = {
  getAllowedOrigins,
  getJwtSecret,
  validateRuntimeConfig,
};
