'use strict';

/**
 * Email notification service – compatible with Proton Mail SMTP bridge and any
 * standard SMTP provider (Gmail, SendGrid relay, etc.).
 *
 * Configuration via environment variables:
 *   SMTP_HOST        – SMTP server host (e.g. 127.0.0.1 for Proton Mail Bridge)
 *   SMTP_PORT        – SMTP server port (default: 587)
 *   SMTP_SECURE      – true for SSL (port 465), false for STARTTLS (default: false)
 *   SMTP_USER        – SMTP username / login email
 *   SMTP_PASS        – SMTP password / Proton Mail Bridge password
 *   EMAIL_FROM       – Sender display name + address (default: "Qualitet <noreply@uszefaqualitet.pl>")
 *   APP_URL          – Base URL for link generation (default: https://uszefaqualitet.pl)
 *
 * When SMTP_HOST is not configured, all send calls are silently skipped and
 * the function resolves immediately (no-op) so the app works without email.
 */

const nodemailer = require('nodemailer');

const SMTP_HOST   = process.env.SMTP_HOST   || '';
const SMTP_PORT   = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_SECURE = process.env.SMTP_SECURE === 'true';
const SMTP_USER   = process.env.SMTP_USER   || '';
const SMTP_PASS   = process.env.SMTP_PASS   || '';
const EMAIL_FROM  = process.env.EMAIL_FROM  || 'Qualitet <noreply@uszefaqualitet.pl>';
const APP_URL     = process.env.APP_URL     || 'https://uszefaqualitet.pl';

/** Lazily-created transporter – created once when first email is sent. */
let _transporter = null;

function getTransporter() {
  if (!SMTP_HOST) return null;
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      host:   SMTP_HOST,
      port:   SMTP_PORT,
      secure: SMTP_SECURE,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });
  }
  return _transporter;
}

/**
 * Send a raw email.
 *
 * @param {{ to: string, subject: string, html: string, text?: string }} opts
 * @returns {Promise<void>}  Resolves even if email is not configured (no-op).
 */
async function sendEmail({ to, subject, html, text }) {
  const transporter = getTransporter();
  if (!transporter) {
    if (process.env.NODE_ENV !== 'test') {
      console.debug('[email] SMTP not configured – skipping email to', to);
    }
    return;
  }

  try {
    await transporter.sendMail({
      from: EMAIL_FROM,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(),
    });
  } catch (err) {
    // Log but do not throw – email failure must never crash a request handler.
    console.error('[email] Failed to send to', to, ':', err.message);
  }
}

// ─── Template helpers ──────────────────────────────────────────────────────────

function emailWrapper(content) {
  return `<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',Arial,sans-serif;color:#e2e8f0}
  .container{max-width:580px;margin:32px auto;background:#1e293b;border-radius:16px;overflow:hidden;border:1px solid #334155}
  .header{background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);padding:32px 32px 24px;text-align:center}
  .header img{height:36px}
  .header h1{color:#fff;font-size:22px;margin:12px 0 0;font-weight:700}
  .body{padding:32px}
  .body p{line-height:1.7;color:#cbd5e1;margin:0 0 16px}
  .btn{display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;text-decoration:none;border-radius:10px;font-weight:700;font-size:16px;margin:8px 0}
  .highlight{background:#334155;border-radius:10px;padding:16px;margin:16px 0}
  .highlight p{margin:0;color:#f1f5f9}
  .highlight .label{font-size:12px;text-transform:uppercase;letter-spacing:.5px;color:#94a3b8;margin-bottom:4px}
  .divider{border:none;border-top:1px solid #334155;margin:24px 0}
  .footer{padding:20px 32px;text-align:center}
  .footer p{font-size:12px;color:#64748b;margin:0}
  .footer a{color:#6366f1;text-decoration:none}
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>⚡ Qualitet</h1>
  </div>
  <div class="body">
    ${content}
  </div>
  <div class="footer">
    <hr class="divider">
    <p>© 2025 Qualitet &mdash; Platforma dropshipping | <a href="${APP_URL}">uszefaqualitet.pl</a></p>
    <p style="margin-top:6px">Ten e-mail został wygenerowany automatycznie. Nie odpowiadaj na tę wiadomość.</p>
  </div>
</div>
</body>
</html>`;
}

// ─── Notification templates ────────────────────────────────────────────────────

/**
 * Welcome email sent after successful registration.
 *
 * @param {{ to: string, name: string, promoLabel: string, shopUrl?: string }} opts
 */
async function sendWelcomeEmail({ to, name, promoLabel, shopUrl }) {
  const shopSection = shopUrl
    ? `<p>Twój sklep jest już gotowy! Kliknij poniżej, żeby go skonfigurować:</p>
       <a class="btn" href="${shopUrl}">Przejdź do panelu sklepu →</a>`
    : `<a class="btn" href="${APP_URL}/generator-sklepu.html">Utwórz sklep →</a>`;

  const html = emailWrapper(`
    <p>Cześć <strong>${name}</strong>! 👋</p>
    <p>Witamy na platformie <strong>Qualitet</strong> – miejscu, gdzie możesz sprzedawać produkty hurtowni bez własnego magazynu.</p>
    <div class="highlight">
      <p class="label">Twój plan startowy</p>
      <p><strong>${promoLabel}</strong></p>
    </div>
    <p>Co możesz zrobić teraz?</p>
    <ul style="color:#cbd5e1;line-height:2">
      <li>Skonfiguruj swój sklep i wybierz produkty</li>
      <li>Ustaw własną marżę i zacznij sprzedawać</li>
      <li>Poleć platformę znajomym i zdobądź dodatkowe miesiące gratis</li>
    </ul>
    ${shopSection}
  `);

  await sendEmail({
    to,
    subject: `Witaj na platformie Qualitet, ${name}! 🚀`,
    html,
  });
}

/**
 * Order confirmation email for the buyer.
 *
 * @param {{ to: string, name: string, orderId: string, total: number, items: Array }} opts
 */
async function sendOrderConfirmationEmail({ to, name, orderId, total, items = [] }) {
  const itemsHtml = items.length
    ? `<table style="width:100%;border-collapse:collapse;margin:16px 0">
        <tr style="border-bottom:1px solid #334155">
          <th style="text-align:left;padding:8px 0;color:#94a3b8;font-size:12px;text-transform:uppercase">Produkt</th>
          <th style="text-align:right;padding:8px 0;color:#94a3b8;font-size:12px;text-transform:uppercase">Ilość</th>
          <th style="text-align:right;padding:8px 0;color:#94a3b8;font-size:12px;text-transform:uppercase">Cena</th>
        </tr>
        ${items.map((it) => `
          <tr style="border-bottom:1px solid #1e293b">
            <td style="padding:10px 0;color:#e2e8f0">${it.name || 'Produkt'}</td>
            <td style="padding:10px 0;text-align:right;color:#e2e8f0">${it.quantity || 1}</td>
            <td style="padding:10px 0;text-align:right;color:#e2e8f0">${Number(it.price || 0).toFixed(2)} zł</td>
          </tr>`).join('')}
      </table>`
    : '';

  const html = emailWrapper(`
    <p>Cześć <strong>${name}</strong>! 🎉</p>
    <p>Twoje zamówienie zostało przyjęte. Dziękujemy za zakup!</p>
    <div class="highlight">
      <p class="label">Numer zamówienia</p>
      <p style="font-family:monospace;font-size:14px">${orderId}</p>
    </div>
    ${itemsHtml}
    <div class="highlight">
      <p class="label">Suma zamówienia</p>
      <p style="font-size:24px;font-weight:800;color:#4ade80">${Number(total).toFixed(2)} zł</p>
    </div>
    <p>Możesz śledzić status swojego zamówienia w panelu konta.</p>
    <a class="btn" href="${APP_URL}/dashboard.html">Sprawdź status zamówienia →</a>
  `);

  await sendEmail({
    to,
    subject: `Potwierdzenie zamówienia #${orderId.slice(0, 8)} – Qualitet`,
    html,
  });
}

/**
 * Order status change notification.
 *
 * @param {{ to: string, name: string, orderId: string, status: string }} opts
 */
async function sendOrderStatusEmail({ to, name, orderId, status }) {
  const STATUS_LABELS = {
    paid:           '✅ Opłacone',
    processing:     '⚙️ W realizacji',
    shipped:        '📦 Wysłane',
    delivered:      '🏠 Dostarczone',
    cancelled:      '❌ Anulowane',
    payment_failed: '⚠️ Płatność nieudana',
    refunded:       '↩️ Zwrócone',
  };
  const label = STATUS_LABELS[status] || status;

  const html = emailWrapper(`
    <p>Cześć <strong>${name}</strong>!</p>
    <p>Status Twojego zamówienia uległ zmianie.</p>
    <div class="highlight">
      <p class="label">Zamówienie</p>
      <p style="font-family:monospace;font-size:13px">${orderId}</p>
    </div>
    <div class="highlight">
      <p class="label">Nowy status</p>
      <p style="font-size:20px;font-weight:700">${label}</p>
    </div>
    <a class="btn" href="${APP_URL}/dashboard.html">Zobacz szczegóły →</a>
  `);

  await sendEmail({
    to,
    subject: `Zmiana statusu zamówienia – ${label} – Qualitet`,
    html,
  });
}

/**
 * Subscription confirmation / activation email.
 *
 * @param {{ to: string, name: string, plan: string, expiresAt: Date }} opts
 */
async function sendSubscriptionEmail({ to, name, plan, expiresAt }) {
  const PLAN_LABELS = {
    trial:  'Trial',
    basic:  'Basic',
    pro:    'Pro',
    elite:  'Elite',
  };
  const planLabel = PLAN_LABELS[plan] || plan;
  const expiryStr = expiresAt
    ? new Date(expiresAt).toLocaleDateString('pl-PL', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'N/A';

  const html = emailWrapper(`
    <p>Cześć <strong>${name}</strong>! 🎊</p>
    <p>Twoja subskrypcja na platformie Qualitet została aktywowana.</p>
    <div class="highlight">
      <p class="label">Plan</p>
      <p style="font-size:22px;font-weight:800;color:#818cf8">${planLabel}</p>
    </div>
    <div class="highlight">
      <p class="label">Ważna do</p>
      <p>${expiryStr}</p>
    </div>
    <p>Możesz teraz w pełni korzystać ze wszystkich funkcji platformy.</p>
    <a class="btn" href="${APP_URL}/dashboard.html">Przejdź do panelu →</a>
  `);

  await sendEmail({
    to,
    subject: `Subskrypcja ${planLabel} aktywna – Qualitet`,
    html,
  });
}

/**
 * System broadcast / announcement email.
 *
 * @param {{ to: string, name: string, subject: string, message: string }} opts
 */
async function sendAnnouncementEmail({ to, name, subject: emailSubject, message }) {
  const html = emailWrapper(`
    <p>Cześć <strong>${name}</strong>!</p>
    ${message.split('\n').map((line) => line.trim() ? `<p>${line}</p>` : '').join('')}
    <a class="btn" href="${APP_URL}">Przejdź do platformy →</a>
  `);

  await sendEmail({ to, subject: emailSubject, html });
}

module.exports = {
  sendEmail,
  sendWelcomeEmail,
  sendOrderConfirmationEmail,
  sendOrderStatusEmail,
  sendSubscriptionEmail,
  sendAnnouncementEmail,
};
