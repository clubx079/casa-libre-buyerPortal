// Did the WhatsApp code reach the phone? (Omar, Nov 23: a Uruguayan seller tried a number with no
// WhatsApp; Meta refused all 14 codes — error 131026 — and she only saw "no code arrives".)
// Relay has no delivery status on /otp, but each code is a message in that number's conversation
// with a status, so we read the newest code messages sent since the click. Pure — tests/waDelivery.test.mjs.
//   'no_whatsapp'  Meta: undeliverable (131026) — that number has no WhatsApp (or can't receive)
//   'failed'       another delivery error
//   'delivered'    delivered or read
//   'pending'      not known yet (keep waiting)
export const NO_WHATSAPP_CODES = [131026];

export function deliveryState(messages = [], sinceMs = 0) {
  const codes = (Array.isArray(messages) ? messages : [])
    .filter((m) => m && m.direction === 'outbound' && (m.kind === 'otp' || m.template?.category === 'authentication'))
    .filter((m) => Date.parse(m.timestamps?.created || 0) >= sinceMs - 5000)
    .sort((a, b) => Date.parse(b.timestamps?.created || 0) - Date.parse(a.timestamps?.created || 0));
  const m = codes[0];
  if (!m) return 'pending';
  if (m.status === 'delivered' || m.status === 'read') return 'delivered';
  if (m.status === 'failed') return NO_WHATSAPP_CODES.includes(Number(m.error?.code)) ? 'no_whatsapp' : 'failed';
  return 'pending';
}
