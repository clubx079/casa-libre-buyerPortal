// Transactional email via Resend. Sends the Casa Libre OTP code. Server-only.
import 'server-only';
import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.RESEND_FROM || 'Casa Libre <onboarding@resend.dev>';

const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('email_timeout')), ms))]);

const SITE = (process.env.APP_PUBLIC_URL || 'https://casa-libre-buyerportal.apps.airosofts.com').replace(/\/$/, '');

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Shared branded shell — casa-libre.py header + ink/paper card + mono footer,
// matching the OTP + admin scraper emails.
function shell(inner) {
  return `<!doctype html><html><body style="margin:0;background:#f9f4ee;font-family:'Space Grotesk',Helvetica,Arial,sans-serif;color:#111">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f4ee;padding:32px 0">
    <tr><td align="center">
      <table width="460" cellpadding="0" cellspacing="0" style="background:#fff;border:1.5px solid rgba(17,17,17,.12);border-radius:20px;overflow:hidden">
        <tr><td style="padding:28px 32px 8px">
          <div style="font-size:22px;font-weight:700;letter-spacing:-0.03em">casa-libre<span style="font-style:italic">.py</span></div>
        </td></tr>
        ${inner}
      </table>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:rgba(17,17,17,.4);margin-top:16px">Casa Libre — Paraguay</div>
    </td></tr>
  </table></body></html>`;
}

const btn = (href, label) =>
  `<a href="${esc(href)}" style="display:inline-block;background:#111;color:#f9f4ee;text-decoration:none;font-size:14px;font-weight:600;padding:12px 22px;border-radius:999px">${esc(label)}</a>`;

function welcomeHtml(name) {
  const hi = name ? `, ${esc(name.split(' ')[0])}` : '';
  return shell(`
    <tr><td style="padding:8px 32px 0">
      <div style="font-size:20px;font-weight:700;letter-spacing:-0.02em">Bienvenido a Casa Libre${hi}</div>
      <div style="font-size:14px;color:rgba(17,17,17,.6);margin-top:6px;line-height:1.55">Tu cuenta está lista. Casa Libre reúne las propiedades de todo Paraguay en un solo lugar — comprá, alquilá o publicá, gratis. Contactás directo por WhatsApp con quien publica, sin intermediarios.</div>
    </td></tr>
    <tr><td style="padding:22px 32px 6px">${btn(`${SITE}/propiedades`, 'Explorar propiedades')}</td></tr>
    <tr><td style="padding:10px 32px 28px">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:12px;color:rgba(17,17,17,.45)">¿Tenés una propiedad? Publicala gratis en ${esc(SITE)}/publicar</div>
    </td></tr>`);
}

function listingPublishedHtml({ name, title, ref, url }) {
  const hi = name ? `, ${esc(name.split(' ')[0])}` : '';
  return shell(`
    <tr><td style="padding:8px 32px 0">
      <div style="font-size:20px;font-weight:700;letter-spacing:-0.02em">Tu propiedad está publicada${hi}</div>
      <div style="font-size:14px;color:rgba(17,17,17,.6);margin-top:6px;line-height:1.55">Ya está en línea y visible para todos los compradores en Casa Libre. Los interesados te escribirán directo por WhatsApp o te llamarán.</div>
    </td></tr>
    <tr><td style="padding:20px 32px 0">
      <div style="font-size:12px;color:rgba(17,17,17,.45);text-transform:uppercase;letter-spacing:.06em">Aviso</div>
      <div style="font-size:16px;font-weight:600;margin-top:2px">${esc(title || 'Tu propiedad')}</div>
      ${ref ? `<div style="font-family:'IBM Plex Mono',monospace;font-size:12px;color:rgba(17,17,17,.5);margin-top:4px">Ref ${esc(ref)}</div>` : ''}
    </td></tr>
    <tr><td style="padding:22px 32px 28px">${btn(url || `${SITE}/propiedades`, 'Ver mi aviso')}</td></tr>`);
}

function otpHtml(code) {
  return `<!doctype html><html><body style="margin:0;background:#f9f4ee;font-family:'Space Grotesk',Helvetica,Arial,sans-serif;color:#111">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f4ee;padding:32px 0">
    <tr><td align="center">
      <table width="440" cellpadding="0" cellspacing="0" style="background:#fff;border:1.5px solid rgba(17,17,17,.12);border-radius:20px;overflow:hidden">
        <tr><td style="padding:28px 32px 8px">
          <div style="font-size:22px;font-weight:700;letter-spacing:-0.03em">casa-libre<span style="font-style:italic">.py</span></div>
        </td></tr>
        <tr><td style="padding:8px 32px 0">
          <div style="font-size:20px;font-weight:700;letter-spacing:-0.02em">Tu código de verificación</div>
          <div style="font-size:14px;color:rgba(17,17,17,.55);margin-top:6px">Ingresá este código para confirmar tu email y activar tu cuenta.</div>
        </td></tr>
        <tr><td align="center" style="padding:24px 32px">
          <div style="display:inline-block;background:#111;color:#f9f4ee;font-size:34px;font-weight:700;letter-spacing:10px;padding:16px 26px;border-radius:14px">${code}</div>
        </td></tr>
        <tr><td style="padding:0 32px 28px">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:12px;color:rgba(17,17,17,.45)">El código vence en 10 minutos. Si no fuiste vos, ignorá este email.</div>
        </td></tr>
      </table>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:rgba(17,17,17,.4);margin-top:16px">Casa Libre — Paraguay</div>
    </td></tr>
  </table></body></html>`;
}

// Send the 6-digit code. Returns { ok } or { ok:false, error }.
export async function sendOtpEmail(email, code) {
  if (!resend) return { ok: false, error: 'email_not_configured' };
  try {
    const { error } = await withTimeout(
      resend.emails.send({
        from: FROM,
        to: email,
        subject: `${code} es tu código de Casa Libre`,
        html: otpHtml(code),
        text: `Tu código de verificación de Casa Libre es ${code}. Vence en 10 minutos.`,
        headers: { 'X-Priority': '1', Importance: 'high' },
      }),
      15000
    );
    if (error) return { ok: false, error: error.message || 'send_failed' };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e?.message || 'send_failed' };
  }
}

// Welcome email on signup. Never throws — fire-and-forget from the signup flow.
export async function sendWelcomeEmail(email, name) {
  if (!resend || !email) return { ok: false, error: 'email_not_configured' };
  try {
    const { error } = await withTimeout(
      resend.emails.send({
        from: FROM,
        to: email,
        subject: 'Bienvenido a Casa Libre',
        html: welcomeHtml(name),
        text: `Bienvenido a Casa Libre. Tu cuenta está lista. Explorá propiedades en ${SITE}/propiedades o publicá gratis en ${SITE}/publicar.`,
      }),
      15000,
    );
    if (error) return { ok: false, error: error.message || 'send_failed' };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e?.message || 'send_failed' };
  }
}

// Confirmation email when a user publishes a listing. Never throws.
export async function sendListingPublishedEmail(email, { name, title, ref, url } = {}) {
  if (!resend || !email) return { ok: false, error: 'email_not_configured' };
  try {
    const { error } = await withTimeout(
      resend.emails.send({
        from: FROM,
        to: email,
        subject: 'Tu propiedad está publicada en Casa Libre',
        html: listingPublishedHtml({ name, title, ref, url }),
        text: `Tu propiedad "${title || ''}" (Ref ${ref || '-'}) ya está publicada en Casa Libre. Verla: ${url || `${SITE}/propiedades`}`,
      }),
      15000,
    );
    if (error) return { ok: false, error: error.message || 'send_failed' };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e?.message || 'send_failed' };
  }
}
