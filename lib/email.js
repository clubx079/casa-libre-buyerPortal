// Transactional email via Resend. Sends the Casa Libre OTP code. Server-only.
import 'server-only';
import { Resend } from 'resend';
import { promoUsd } from './stripe';
import { signRenewToken } from './promoToken';
import { COUNTRY } from './country';
import { BADGE_APPLE_CID, BADGE_PLAY_CID, badgeAttachments } from './emailBadges';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.RESEND_FROM || 'Casa Libre <onboarding@resend.dev>';

const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('email_timeout')), ms))]);

const SITE = (process.env.APP_PUBLIC_URL || COUNTRY.defaultUrl).replace(/\/$/, '');

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// App-store badges for the email footer — the same two pills the marketplace
// shows (components/AppBadges.js). They are PNGs carried inline with the message
// (see lib/emailBadges.js) because email clients strip SVG; both link to
// /descargar, exactly like on the site.
const appBadge = (cid, alt, w) =>
  `<a href="${esc(SITE)}/descargar" style="text-decoration:none"
    ><img src="cid:${cid}" alt="${esc(alt)}" width="${w}" height="43"
      style="display:block;border:0;outline:none;width:${w}px;height:43px"></a>`;

// An email card is ~460px wide, too narrow for the site's desktop row
// (badge · caption · badge ≈ 470px), so this follows the site's MOBILE variant:
// caption on top, the two badges centred underneath.
const appBadgesBlock = () => `
    <tr><td align="center" style="padding:20px 24px 26px;border-top:1px solid rgba(17,17,17,.08)">
      <div style="font-size:13px;color:rgba(17,17,17,.6);margin-bottom:12px">Funciona mejor en la app</div>
      <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto"><tr>
        <td valign="middle">${appBadge(BADGE_APPLE_CID, 'App Store', 153)}</td>
        <td style="width:12px">&nbsp;</td>
        <td valign="middle">${appBadge(BADGE_PLAY_CID, 'Google Play', 145)}</td>
      </tr></table>
    </td></tr>`;

// Shared branded shell — casa-libre.py header + ink/paper card + mono footer,
// matching the OTP + admin scraper emails. Every email that goes through here
// ends with the app-store badges.
function shell(inner) {
  return `<!doctype html><html><body style="margin:0;background:#f9f4ee;font-family:'Space Grotesk',Helvetica,Arial,sans-serif;color:#111">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f4ee;padding:32px 0">
    <tr><td align="center">
      <table width="460" cellpadding="0" cellspacing="0" style="background:#fff;border:1.5px solid rgba(17,17,17,.12);border-radius:20px;overflow:hidden">
        <tr><td style="padding:28px 32px 8px">
          <div style="font-size:22px;font-weight:700;letter-spacing:-0.03em">casa-libre<span style="font-style:italic">${COUNTRY.tld}</span></div>
        </td></tr>
        ${inner}
        ${appBadgesBlock()}
      </table>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:rgba(17,17,17,.4);margin-top:16px">${COUNTRY.brand} — ${COUNTRY.name}</div>
    </td></tr>
  </table></body></html>`;
}

const btn = (href, label) =>
  `<a href="${esc(href)}" style="display:inline-block;background:#111;color:#f9f4ee;text-decoration:none;font-size:14px;font-weight:600;padding:12px 22px;border-radius:999px">${esc(label)}</a>`;

const ghostBtn = (href, label) =>
  `<a href="${esc(href)}" style="display:inline-block;background:#fff;color:#111;text-decoration:none;font-size:14px;font-weight:600;padding:11px 20px;border-radius:999px;border:1.5px solid #111">${esc(label)}</a>`;

// Feedback prompt block reused across transactional emails.
const feedbackBlock = (src) => `
    <tr><td style="padding:6px 32px 4px">
      <div style="font-size:13px;color:rgba(17,17,17,.6);margin-bottom:10px">¿Cómo fue tu experiencia con Casa Libre?</div>
      ${ghostBtn(`${SITE}/feedback?src=${esc(src)}`, 'Dejanos tu opinión')}
    </td></tr>`;

function welcomeHtml(name) {
  const hi = name ? `, ${esc(name.split(' ')[0])}` : '';
  return shell(`
    <tr><td style="padding:8px 32px 0">
      <div style="font-size:20px;font-weight:700;letter-spacing:-0.02em">Bienvenido a Casa Libre${hi}</div>
      <div style="font-size:14px;color:rgba(17,17,17,.6);margin-top:6px;line-height:1.55">Tu cuenta está lista. Casa Libre reúne las propiedades de todo ${COUNTRY.name} en un solo lugar — comprá, alquilá o publicá, gratis. Contactás directo por WhatsApp con quien publica, sin intermediarios.</div>
    </td></tr>
    <tr><td style="padding:22px 32px 6px">${btn(`${SITE}/propiedades`, 'Explorar propiedades')}</td></tr>
    ${feedbackBlock('welcome')}
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
    <tr><td style="padding:22px 32px 6px">${btn(url || `${SITE}/propiedades`, 'Ver mi aviso')}</td></tr>
    ${feedbackBlock('listing')}
    <tr><td style="padding:14px 32px 28px"></td></tr>`);
}

// Both code emails go through shell() like everything else, so the header, the
// footer and the app badges stay in one place instead of three.
const codeEmail = (title, sub, code, note) => shell(`
        <tr><td style="padding:8px 32px 0">
          <div style="font-size:20px;font-weight:700;letter-spacing:-0.02em">${title}</div>
          <div style="font-size:14px;color:rgba(17,17,17,.55);margin-top:6px">${sub}</div>
        </td></tr>
        <tr><td align="center" style="padding:24px 32px">
          <div style="display:inline-block;background:#111;color:#f9f4ee;font-size:34px;font-weight:700;letter-spacing:10px;padding:16px 26px;border-radius:14px">${esc(code)}</div>
        </td></tr>
        <tr><td style="padding:0 32px 22px">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:12px;color:rgba(17,17,17,.45)">${note}</div>
        </td></tr>`);

function otpHtml(code) {
  return codeEmail(
    'Tu código de verificación',
    'Ingresá este código para confirmar tu email y activar tu cuenta.',
    code,
    'El código vence en 10 minutos. Si no fuiste vos, ignorá este email.',
  );
}

function resetOtpHtml(code) {
  return codeEmail(
    'Restablecé tu contraseña',
    'Recibimos un pedido para cambiar tu contraseña. Ingresá este código para continuar.',
    code,
    'El código vence en 15 minutos. Si no lo pediste, ignorá este email — tu cuenta está segura.',
  );
}

// Send a password-reset code. Returns { ok } or { ok:false, error }.
export async function sendPasswordResetEmail(email, code) {
  if (!resend || !email) return { ok: false, error: 'email_not_configured' };
  try {
    const { error } = await withTimeout(
      resend.emails.send({
        from: FROM,
        // the footer badges ride along inline; shell() references them by cid
        attachments: badgeAttachments(),
        to: email,
        subject: `${code} es tu código para restablecer la contraseña`,
        html: resetOtpHtml(code),
        text: `Tu código para restablecer la contraseña de Casa Libre es ${code}. Vence en 15 minutos. Si no lo pediste, ignorá este email.`,
      }),
      15000,
    );
    if (error) return { ok: false, error: error.message || 'send_failed' };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e?.message || 'send_failed' };
  }
}

// Send the 6-digit code. Returns { ok } or { ok:false, error }.
export async function sendOtpEmail(email, code) {
  if (!resend) return { ok: false, error: 'email_not_configured' };
  try {
    const { error } = await withTimeout(
      resend.emails.send({
        from: FROM,
        // the footer badges ride along inline; shell() references them by cid
        attachments: badgeAttachments(),
        to: email,
        subject: `${code} es tu código de Casa Libre`,
        html: otpHtml(code),
        text: `Tu código de verificación de Casa Libre es ${code}. Vence en 10 minutos.`,
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
        // the footer badges ride along inline; shell() references them by cid
        attachments: badgeAttachments(),
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

// Day-29 promotion renewal reminder. Professional, brand-styled, with a one-click
// "Renew 30 days" button (signed token → charges the vaulted card off-session).
function promotionRenewalHtml({ name, plan, title, ref, renewUrl, expiresText }) {
  const hi = name ? `, ${esc(name.split(' ')[0])}` : '';
  const usd = promoUsd(plan);
  const isHome = plan === 'home';
  const heading = isHome ? `Tu propiedad deja la portada en 1 día${hi}` : `Tu verificación vence en 1 día${hi}`;
  const lead = isHome
    ? 'Tu promoción de portada está por vencer. En 1 día tu propiedad dejará de aparecer en la página de inicio y perderá la insignia Verificada, y volverá al orden normal del marketplace.'
    : 'Tu verificación está por vencer. En 1 día tu propiedad perderá la insignia Verificada y la estrella en el mapa, y volverá al orden normal del marketplace.';
  return shell(`
    <tr><td style="padding:8px 32px 0">
      <div style="font-size:20px;font-weight:700;letter-spacing:-0.02em">${heading}</div>
      <div style="font-size:14px;color:rgba(17,17,17,.6);margin-top:6px;line-height:1.55">${lead}</div>
    </td></tr>
    <tr><td style="padding:18px 32px 0">
      <div style="font-size:12px;color:rgba(17,17,17,.45);text-transform:uppercase;letter-spacing:.06em">Aviso</div>
      <div style="font-size:16px;font-weight:600;margin-top:2px">${esc(title || 'Tu propiedad')}</div>
      ${ref ? `<div style="font-family:'IBM Plex Mono',monospace;font-size:12px;color:rgba(17,17,17,.5);margin-top:4px">Ref ${esc(ref)}</div>` : ''}
      ${expiresText ? `<div style="font-size:13px;color:rgba(17,17,17,.55);margin-top:6px">Vence el ${esc(expiresText)}</div>` : ''}
    </td></tr>
    <tr><td style="padding:22px 32px 4px">${btn(renewUrl, `Renovar 30 días · US$${usd}`)}</td></tr>
    <tr><td style="padding:2px 32px 6px">
      <div style="font-size:12.5px;color:rgba(17,17,17,.5);line-height:1.5">Con un clic renovamos por 30 días más y cobramos US$${usd} a tu tarjeta guardada. Lo verás en tu historial de pagos.</div>
    </td></tr>
    <tr><td style="padding:8px 32px 28px">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:12px;color:rgba(17,17,17,.45)">Gestioná tu tarjeta y pagos en ${esc(SITE)}/cuenta/pagos</div>
    </td></tr>`);
}

// Send the day-29 renewal reminder. Builds the signed one-click link itself. Never throws.
export async function sendPromotionRenewalEmail(email, { userId, propertyId, plan = 'verified', name, title, ref, expiresText } = {}) {
  if (!resend || !email || !propertyId || !userId) return { ok: false, error: 'email_not_configured' };
  const token = signRenewToken({ pid: propertyId, uid: userId, plan });
  const renewUrl = `${SITE}/api/promo/renew?token=${encodeURIComponent(token)}`;
  const usd = promoUsd(plan);
  const subject = plan === 'home' ? 'Tu propiedad deja la portada de Casa Libre en 1 día' : 'Tu verificación en Casa Libre vence en 1 día';
  try {
    const { error } = await withTimeout(
      resend.emails.send({
        from: FROM,
        // the footer badges ride along inline; shell() references them by cid
        attachments: badgeAttachments(),
        to: email,
        subject,
        html: promotionRenewalHtml({ name, plan, title, ref, renewUrl, expiresText }),
        text: `Tu promoción "${title || ''}" (Ref ${ref || '-'}) vence en 1 día. Renovala por 30 días más (US$${usd}) con un clic: ${renewUrl}`,
      }),
      15000,
    );
    if (error) return { ok: false, error: error.message || 'send_failed' };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e?.message || 'send_failed' };
  }
}

// Internal notification for a business / investor inquiry from /empresas — the
// "Send email" quick form and the full "Business inquiries" lead form both route
// here. Branded with the same shell() as every other Casa Libre email. Recipient
// is env-only (PARTNER_INQUIRY_EMAIL, falling back to CONTACT_EMAIL) so nothing is
// hardcoded; replies go straight to the visitor via replyTo.
function businessInquiryHtml({ source, fromEmail, name, company, type, size, phone, city, query, message }) {
  const rows = [
    ['Nombre', name], ['Empresa', company], ['Tipo', type], ['Cartera', size],
    ['WhatsApp / Tel', phone], ['Email', fromEmail], ['Ciudad', city],
  ].filter(([, v]) => v);
  const body = query || message;
  return shell(`
    <tr><td style="padding:8px 32px 0">
      <div style="font-size:20px;font-weight:700;letter-spacing:-0.02em">Nueva consulta de inversor</div>
      <div style="font-size:14px;color:rgba(17,17,17,.6);margin-top:6px">Llegó desde ${esc(SITE)}/empresas${source ? ` · ${esc(source)}` : ''}</div>
    </td></tr>
    ${rows.length ? `<tr><td style="padding:16px 32px 0">
      <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">
        ${rows.map(([k, v]) => `<tr><td style="padding:4px 0;color:rgba(17,17,17,.5);width:130px;vertical-align:top">${esc(k)}</td><td style="padding:4px 0;font-weight:600">${esc(v)}</td></tr>`).join('')}
      </table>
    </td></tr>` : ''}
    ${body ? `<tr><td style="padding:14px 32px 0">
      <div style="font-size:12px;color:rgba(17,17,17,.45);text-transform:uppercase;letter-spacing:.06em">Mensaje</div>
      <div style="font-size:14px;line-height:1.55;margin-top:4px;white-space:pre-wrap">${esc(body)}</div>
    </td></tr>` : ''}
    ${fromEmail ? `<tr><td style="padding:22px 32px 6px">${btn('mailto:' + esc(fromEmail), 'Responder')}</td></tr>` : ''}
    <tr><td style="padding:10px 32px 28px">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:12px;color:rgba(17,17,17,.45)">Casa Libre — ${COUNTRY.name}</div>
    </td></tr>`);
}

// Send the business/investor inquiry notification to the internal recipient.
// Never throws. Returns { ok } or { ok:false, error }.
export async function sendBusinessInquiryEmail(data = {}) {
  const to = process.env.PARTNER_INQUIRY_EMAIL || process.env.CONTACT_EMAIL;
  if (!resend || !to) return { ok: false, error: 'email_not_configured' };
  const who = data.name || data.company || data.fromEmail || 'un inversor';
  try {
    const { error } = await withTimeout(
      resend.emails.send({
        from: FROM,
        // the footer badges ride along inline; shell() references them by cid
        attachments: badgeAttachments(),
        to,
        replyTo: data.fromEmail || undefined,
        subject: `Nueva consulta de inversor — ${who}`,
        html: businessInquiryHtml(data),
        text: [
          'Nueva consulta de inversor desde Casa Libre /empresas.',
          data.name ? `Nombre: ${data.name}` : null,
          data.company ? `Empresa: ${data.company}` : null,
          data.fromEmail ? `Email: ${data.fromEmail}` : null,
          data.phone ? `Tel: ${data.phone}` : null,
          data.city ? `Ciudad: ${data.city}` : null,
          data.type || data.size ? `Tipo: ${data.type || '-'} · Cartera: ${data.size || '-'}` : null,
          '',
          data.query || data.message || '',
        ].filter((l) => l !== null).join('\n'),
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
        // the footer badges ride along inline; shell() references them by cid
        attachments: badgeAttachments(),
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
