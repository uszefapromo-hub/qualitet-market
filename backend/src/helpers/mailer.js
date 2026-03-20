'use strict';

/**
 * Mailer helper – sends product import notification emails to the platform admin.
 *
 * Designed to be fire-and-forget (callers do NOT await the returned promise).
 * All errors are caught internally and logged, so this function never rejects.
 *
 * SMTP is sent via nodemailer when SMTP_HOST is configured.  When SMTP is not
 * configured (or nodemailer is not installed) the message is still persisted in
 * the mail_messages table with status = 'queued'.
 *
 * Environment variables used:
 *   ADMIN_EMAIL   – primary recipient; if absent, the first owner/admin in the DB is used
 *   SMTP_HOST     – SMTP server hostname (optional)
 *   SMTP_PORT     – SMTP port (default: 587)
 *   SMTP_SECURE   – 'true' to enable TLS (default: false)
 *   SMTP_USER     – SMTP auth username
 *   SMTP_PASS     – SMTP auth password
 *   SMTP_FROM     – sender address (default: noreply@uszefaqualitet.pl)
 *   DASHBOARD_URL – URL shown in notification emails (default: https://uszefaqualitet.pl/produkty.html)
 */

// Optional nodemailer – non-critical; gracefully skipped if not installed.
let nodemailer = null;
try { nodemailer = require('nodemailer'); } catch (_) { /* non-critical */ }

const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

// ─── Admin email resolution ────────────────────────────────────────────────────

/**
 * Returns the recipient email address for admin notifications.
 * Uses ADMIN_EMAIL env var when set; otherwise queries the first owner/admin
 * in the users table.
 *
 * @returns {Promise<string|null>}
 */
async function resolveAdminEmail() {
  const envEmail = process.env.ADMIN_EMAIL;
  if (envEmail) return envEmail;

  try {
    const result = await db.query(
      `SELECT email FROM users
        WHERE role IN ('owner', 'admin')
        ORDER BY CASE role WHEN 'owner' THEN 0 ELSE 1 END, created_at ASC
        LIMIT 1`
    );
    return result.rows[0]?.email || null;
  } catch {
    return null;
  }
}

// ─── SMTP dispatch ─────────────────────────────────────────────────────────────

async function dispatchSmtp(to, subject, text) {
  const smtpHost = process.env.SMTP_HOST;
  if (!smtpHost || !nodemailer) return false;

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
    },
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@uszefaqualitet.pl',
    to,
    subject,
    text,
  });
  return true;
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Sends a product import notification email to the platform admin/owner.
 *
 * This function is designed to be called WITHOUT await (fire-and-forget).
 * It never throws – all errors are caught and logged.
 *
 * @param {object}  options
 * @param {string}  options.supplierName   Display name of the supplier or import source.
 * @param {number}  [options.count=0]      Number of products imported/updated.
 * @param {'success'|'partial'|'failure'} options.status  Outcome of the import job.
 * @param {string}  [options.errorMessage] Error detail string (used when status='failure').
 * @param {Date}    [options.completedAt]  Completion timestamp (defaults to now).
 */
async function sendImportNotification({
  supplierName,
  count = 0,
  status,
  errorMessage = null,
  completedAt = new Date(),
}) {
  try {
    const toEmail = await resolveAdminEmail();
    if (!toEmail) {
      console.warn('[mailer] No admin email configured – skipping import notification');
      return;
    }

    const dashboardUrl = process.env.DASHBOARD_URL || 'https://uszefaqualitet.pl/produkty.html';
    const completedAtStr = completedAt.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';

    let subject, body;
    if (status === 'failure') {
      subject = `\u274C Import produktów zakończony z błędem – ${supplierName}`;
      body = [
        'Raport importu produktów – BŁĄD',
        '',
        `Dostawca / źródło: ${supplierName}`,
        `Status: Błąd importu`,
        `Czas zakończenia: ${completedAtStr}`,
        '',
        'Szczegóły błędu:',
        errorMessage || 'Nieznany błąd',
        '',
        `Panel administracyjny: ${dashboardUrl}`,
      ].join('\n');
    } else {
      const statusLabel = status === 'partial' ? 'Częściowy sukces' : 'Sukces';
      subject = `\u2705 Import produktów zakończony – ${supplierName} | ${count} produktów`;
      body = [
        'Raport importu produktów',
        '',
        `Dostawca / źródło: ${supplierName}`,
        `Liczba produktów: ${count}`,
        `Status: ${statusLabel}`,
        `Czas zakończenia: ${completedAtStr}`,
        '',
        `Panel produktów: ${dashboardUrl}`,
      ].join('\n');
    }

    const msgId = uuidv4();

    // Persist to mail_messages table (fire-and-forget – errors suppressed)
    // to_user_id and created_by are NULL for system-generated notifications
    // (no specific user is associated with the automated import job).
    try {
      await db.query(
        `INSERT INTO mail_messages (id, to_email, to_user_id, subject, body, status, created_by, created_at)
         VALUES ($1, $2, NULL, $3, $4, 'queued', NULL, NOW())`,
        [msgId, toEmail, subject, body]
      );
    } catch (dbErr) {
      console.error('[mailer] Failed to persist mail_message:', dbErr.message);
    }

    // Attempt SMTP delivery
    let sent = false;
    try {
      sent = await dispatchSmtp(toEmail, subject, body);
    } catch (sendErr) {
      console.error('[mailer] SMTP send error (non-critical):', sendErr.message);
    }

    if (sent) {
      try {
        await db.query(
          `UPDATE mail_messages SET status = 'sent', sent_at = NOW() WHERE id = $1`,
          [msgId]
        );
      } catch { /* ignore */ }
    }
  } catch (err) {
    console.error('[mailer] sendImportNotification error (non-critical):', err.message);
  }
}

module.exports = { sendImportNotification, resolveAdminEmail, sendPasswordResetEmail };

// ─── sendPasswordResetEmail ────────────────────────────────────────────────────

/**
 * Sends a password-reset link to the user's email address.
 *
 * Designed to be called WITHOUT await (fire-and-forget).
 * All errors are caught internally; the function never rejects.
 *
 * @param {object} options
 * @param {string} options.to    Recipient email address.
 * @param {string} options.name  User's display name.
 * @param {string} options.token Raw reset token (NOT hashed – URL-embedded).
 */
async function sendPasswordResetEmail({ to, name, token }) {
  try {
    const appUrl = process.env.APP_URL || 'https://uszefaqualitet.pl';
    const resetUrl = `${appUrl}/login.html?reset_token=${encodeURIComponent(token)}`;

    const subject = 'Resetowanie hasła – QualitetMarket';
    const body = [
      `Cześć ${name},`,
      '',
      'Otrzymaliśmy prośbę o zresetowanie hasła do Twojego konta w QualitetMarket.',
      '',
      'Kliknij poniższy link, aby ustawić nowe hasło (link ważny przez 1 godzinę):',
      resetUrl,
      '',
      'Jeśli to nie Ty wysłałeś/aś tę prośbę, zignoruj tę wiadomość – Twoje hasło nie zostanie zmienione.',
      '',
      '– Zespół QualitetMarket',
    ].join('\n');

    const msgId = uuidv4();

    try {
      await db.query(
        `INSERT INTO mail_messages (id, to_email, to_user_id, subject, body, status, created_by, created_at)
         VALUES ($1, $2, NULL, $3, $4, 'queued', NULL, NOW())`,
        [msgId, to, subject, body]
      );
    } catch (dbErr) {
      console.error('[mailer] Failed to persist password reset mail_message:', dbErr.message);
    }

    let sent = false;
    try {
      sent = await dispatchSmtp(to, subject, body);
    } catch (sendErr) {
      console.error('[mailer] SMTP send error for password reset (non-critical):', sendErr.message);
    }

    if (sent) {
      try {
        await db.query(
          `UPDATE mail_messages SET status = 'sent', sent_at = NOW() WHERE id = $1`,
          [msgId]
        );
      } catch { /* ignore */ }
    }
  } catch (err) {
    console.error('[mailer] sendPasswordResetEmail error (non-critical):', err.message);
  }
}
