// WhatsApp campaign reply keywords (Roland's Marketing Formula, 2026-11-02): the formula
// templates end with two quick-reply buttons, SÍ and BAJA. A tap (or the word typed):
//   SÍ   → an instant reply with the /publicar link (UTM tags in Roland's format: lowercase,
//          underscores) + the chat tagged "SÍ" and marked unread so a person follows up.
//   BAJA → Relay itself opts the contact out (campaigns skip them); we confirm it.
// Only answered when the last template this number got is one of the formula templates, so a
// "sí" in any other chat is left to the team. Pure — tests/waKeywords.test.mjs.

const SITE = 'https://casa-libre.com.py';

// template → audience (which reply + utm_campaign)
export const FORMULA_TEMPLATES = {
  cl_agentes_respuesta: 'agentes',
  cl_agentes_link: 'agentes',
  cl_inmobiliarias_cartera: 'inmobiliarias',
  cl_desarrolladoras_proyecto: 'desarrolladoras',
  cl_duenos_publicar: 'duenos',
};

const strip = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');
export const isYes = (text) => strip(text) === 'si';
export const isBaja = (text) => strip(text) === 'baja';

// Roland: every link carries utm_source / utm_medium / utm_campaign / utm_content, lowercase
// with underscores. The message shows a SHORT link (/r/si-ag…) that redirects to this full one
// (app/r/[slug]/route.js), so WhatsApp shows casa-libre.com.py/r/si-ag, not the whole query.
export function publishLink(audience, site = SITE) {
  const q = new URLSearchParams({
    utm_source: 'whatsapp',
    utm_medium: 'mensaje',
    utm_campaign: `${audience}_lanzamiento`,
    utm_content: 'respuesta_si',
  });
  return `${String(site).replace(/\/$/, '')}/publicar?${q.toString()}`;
}

// short code → audience, for /r/<code>
export const SHORT_LINKS = { 'si-ag': 'agentes', 'si-in': 'inmobiliarias', 'si-de': 'desarrolladoras', 'si-du': 'duenos' };
const SHORT_OF = Object.fromEntries(Object.entries(SHORT_LINKS).map(([k, v]) => [v, k]));
export const shortLink = (audience) => `${SITE}/r/${SHORT_OF[audience] || 'si-ag'}`;   // https:// kept: WhatsApp only links reliably with it

// the reply to SÍ, per audience (Spanish voseo, no emojis — Roland)
export function yesReply(audience) {
  const link = shortLink(audience);
  switch (audience) {
    case 'inmobiliarias':
      return `¡Genial! Te ayudamos a pasar toda tu cartera a Casa Libre. Podés empezar publicando tu primera propiedad acá:\n${link}\n\nAlguien de nuestro equipo te va a escribir para coordinar el resto.`;
    case 'desarrolladoras':
      return `¡Genial! Podés publicar tu proyecto acá:\n${link}\n\nAlguien de nuestro equipo te va a escribir para ayudarte a ponerlo frente a más compradores.`;
    case 'duenos':
      return `¡Genial! Publicá tu propiedad acá, te lleva 2 minutos:\n${link}\n\nSi necesitás ayuda, respondé este mensaje y alguien de nuestro equipo te ayuda.`;
    default:
      return `¡Genial! Publicá tu primera propiedad acá, te lleva 2 minutos:\n${link}\n\nAlguien de nuestro equipo te va a escribir para ayudarte con lo que necesites.`;
  }
}
export const BAJA_REPLY = 'Listo. No vas a recibir más mensajes de Casa Libre.';

// From the conversation (newest first, Relay messages): the formula template this reply answers,
// and whether we already answered it. → { template, audience, sentAt, alreadyAnswered } | null
export function formulaContext(messages = [], { now = Date.now(), maxAgeDays = 7 } = {}) {
  const t = (m) => Date.parse(m?.timestamps?.created || m?.created_at || 0) || 0;
  const sorted = [...messages].sort((a, b) => t(b) - t(a));
  const tpl = sorted.find((m) => m?.direction === 'outbound' && m?.type === 'template');
  const name = tpl?.template?.name;
  if (!name || !FORMULA_TEMPLATES[name]) return null;
  if (now - t(tpl) > maxAgeDays * 86400000) return null;
  const alreadyAnswered = sorted.some((m) => m?.direction === 'outbound' && t(m) >= t(tpl) && m !== tpl && /\/r\/si-|utm_content=respuesta_si/.test(String(m?.text || '')));
  return { template: name, audience: FORMULA_TEMPLATES[name], sentAt: new Date(t(tpl)).toISOString(), alreadyAnswered };
}
