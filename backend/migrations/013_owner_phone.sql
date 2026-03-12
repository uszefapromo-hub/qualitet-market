-- Migration 013: Set owner phone number
-- Associates the platform owner's phone number with the owner account
-- so that phone-based login (POST /api/auth/login with phone field) works.

UPDATE users
   SET phone      = '+48882914429',
       updated_at = NOW()
 WHERE role = 'owner'
   AND (phone IS NULL OR phone = '');
