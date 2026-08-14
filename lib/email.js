// Transactional email via Resend. Sends the Casa Libre OTP code. Server-only.
import 'server-only';
import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.RESEND_FROM || 'Casa Libre <onboarding@resend.dev>';

const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('email_timeout')), ms))]);

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
