// WhatsApp campaign reply keywords (Roland's Marketing Formula, 2026-11-02): the formula
// templates end with quick-reply buttons — one word per audience. A tap (or the word typed):
//   SÍ       (agents, owners) → an instant reply with the /publicar link (UTM tags in Roland's
//            format: lowercase, underscores) + the chat tagged "SÍ" and marked unread.
//   CARTERA  (agencies: "we have many properties") → the portfolio-migration reply + link,
//            tagged "CARTERA"; the team is emailed at once (a person migrates the portfolio).
//   PROYECTO (developers: "I have a project") → the project reply + link, tagged "PROYECTO";
//            the team is emailed at once.
//   BAJA     → Relay itself opts the contact out (campaigns skip them); we confirm it.
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
  // Nov 2026 batches: same text, A = US mascot image, B = analytics GIF (no BAJA line)
  cl_agentes_mascota: 'agentes',
  cl_agentes_estadisticas: 'agentes',
  cl_inmobiliarias_mascota: 'inmobiliarias',
  cl_inmobiliarias_estadisticas: 'inmobiliarias',
  cl_desarrolladoras_mascota: 'desarrolladoras',
  cl_desarrolladoras_estadisticas: 'desarrolladoras',
};

const strip = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');
export const isYes = (text) => strip(text) === 'si';
export const isBaja = (text) => strip(text) === 'baja';
export const isCartera = (text) => strip(text) === 'cartera';
export const isProyecto = (text) => strip(text) === 'proyecto';
// → 'si' | 'baja' | 'cartera' | 'proyecto' | null
export const keywordOf = (text) => (isYes(text) ? 'si' : isBaja(text) ? 'baja' : isCartera(text) ? 'cartera' : isProyecto(text) ? 'proyecto' : null);
export const KEYWORD_TAG = { si: 'SÍ', cartera: 'CARTERA', proyecto: 'PROYECTO', baja: 'BAJA' };

// Roland: every link carries utm_source / utm_medium / utm_campaign / utm_content, lowercase
// with underscores. The message shows a SHORT link (/r/si-ag…) that redirects to this full one
// (app/r/[slug]/route.js), so WhatsApp shows casa-libre.com.py/r/si-ag, not the whole query.
export function publishLink(audience, site = SITE, ref = '', content = 'respuesta_si') {
  const q = new URLSearchParams({
    utm_source: 'whatsapp',
    utm_medium: 'mensaje',
    utm_campaign: `${audience}_lanzamiento`,
    utm_content: content,   // respuesta_si | respuesta_cartera | respuesta_proyecto
    ...(ref ? { utm_term: ref } : {}),   // the person (their row in the batch) — admin: clicked / landed / signed in
  });
  return `${String(site).replace(/\/$/, '')}/publicar?${q.toString()}`;
}

// short code → audience, for /r/<code>; /r/cartera and /r/proyecto carry their own utm_content
export const SHORT_LINKS = { 'si-ag': 'agentes', 'si-in': 'inmobiliarias', 'si-de': 'desarrolladoras', 'si-du': 'duenos', cartera: 'inmobiliarias', proyecto: 'desarrolladoras' };
export const SHORT_CONTENT = { cartera: 'respuesta_cartera', proyecto: 'respuesta_proyecto' };
const SHORT_OF = { agentes: 'si-ag', inmobiliarias: 'si-in', desarrolladoras: 'si-de', duenos: 'si-du' };
export const shortLink = (audience, ref = '') => `${SITE}/r/${SHORT_OF[audience] || 'si-ag'}${ref ? `?r=${ref}` : ''}`;   // https:// kept: WhatsApp only links reliably with it
export const keywordLink = (keyword, audience, ref = '') => (keyword === 'cartera' || keyword === 'proyecto') ? `${SITE}/r/${keyword}${ref ? `?r=${ref}` : ''}` : shortLink(audience, ref);

// the reply to SÍ, per audience (Spanish voseo, no emojis — Roland)
// The person's code — the SAME function as the admin's lib/waCampaigns.js recipientRef (key =
// their recipient key, e.g. lead:<id>, or the phone), so a click / visit / sign-up carrying it is
// matched to their row in the batch.
const fnv = (s) => { let h = 0x811c9dc5; for (const ch of String(s)) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(36); };
export const recipientRef = (key) => fnv(`r:${key}`).padStart(7, '0').slice(0, 8);

export function yesReply(audience, ref = '') {
  const link = shortLink(audience, ref);
  switch (audience) {
    case 'inmobiliarias':
      return `¡Genial! Te ayudamos a pasar toda tu cartera a Casa-Libre. Podés empezar publicando tu primera propiedad acá:\n${link}\n\nAlguien de nuestro equipo te va a escribir para coordinar el resto.`;
    case 'desarrolladoras':
      return `¡Genial! Podés publicar tu proyecto acá:\n${link}\n\nAlguien de nuestro equipo te va a escribir para ayudarte a ponerlo frente a más compradores.`;
    case 'duenos':
      return `¡Genial! Publicá tu propiedad acá, te lleva 2 minutos:\n${link}\n\nSi necesitás ayuda, respondé este mensaje y alguien de nuestro equipo te ayuda.`;
    default:
      return `¡Genial! Publicá tu primera propiedad acá, te lleva 2 minutos:\n${link}\n\nAlguien de nuestro equipo te va a escribir para ayudarte con lo que necesites.`;
  }
}
export const BAJA_REPLY = 'Listo. No vas a recibir más mensajes de Casa-Libre.';

// CARTERA: an agency with many listings — confirm, say a person will coordinate the migration,
// ask the one thing that person needs, and give the tracked link (Roland: a person starts the
// portfolio migration).
export const carteraReply = (ref = '') => `¡Genial! Te ayudamos a pasar toda tu cartera a Casa-Libre, sin costo durante el lanzamiento.\n\nPara empezar, contanos: ¿cuántas propiedades tenés y dónde las publicás hoy (tu web, otro portal o un Excel)? Alguien de nuestro equipo te escribe enseguida para coordinar la migración.\n\nSi querés, podés empezar ya publicando una propiedad acá:\n${keywordLink('cartera', 'inmobiliarias', ref)}`;
// PROYECTO: a developer — same shape (Roland: a person follows up with the developer).
export const proyectoReply = (ref = '') => `¡Genial! Queremos poner tu proyecto frente a más compradores en Casa-Libre.\n\nContanos: ¿cómo se llama el proyecto, dónde está y cuántas unidades tiene? Alguien de nuestro equipo te escribe enseguida para ayudarte a publicarlo.\n\nSi querés, podés empezar ya acá:\n${keywordLink('proyecto', 'desarrolladoras', ref)}`;
// the reply for a keyword (not BAJA)
export const keywordReply = (keyword, audience, ref = '') => (keyword === 'cartera' ? carteraReply(ref) : keyword === 'proyecto' ? proyectoReply(ref) : yesReply(audience, ref));

// "Sí, avisame" — the quick reply of cl_plan_agentes_v2 ("want us to tell you first when the
// plan for agents is ready?"): recorded (chat tag) and confirmed.
export const PLAN_TEMPLATES = ['cl_plan_agentes_v2'];
export const isPlanYes = (text) => /^si,?\s*avisame$/.test(String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z,\s]/g, '').replace(/\s+/g, ' ').trim());
export const planReply = (name = '') => `Listo${name ? `, ${String(name).trim().split(/\s+/)[0]}` : ''}: te avisamos primero cuando el plan para agentes de Casa-Libre esté disponible.`;
// the last template this number got is the plan-for-agents one, in the last 14 days
export function planContext(messages = [], { now = Date.now() } = {}) {
  const t = (m) => Date.parse(m?.timestamps?.created || m?.created_at || 0) || 0;
  const tpl = [...messages].sort((a, b) => t(b) - t(a)).find((m) => m?.direction === 'outbound' && m?.type === 'template');
  if (!tpl || !PLAN_TEMPLATES.includes(tpl.template?.name) || now - t(tpl) > 14 * 86400000) return null;
  const answered = messages.some((m) => m?.direction === 'outbound' && t(m) > t(tpl) && /plan para agentes de Casa-Libre esté disponible/.test(String(m?.text || '')));
  return { template: tpl.template.name, answered };
}

// From the conversation (newest first, Relay messages): the formula template this reply answers,
// and which keywords we already answered since it (a warm agent may tap SÍ and then CARTERA:
// each is answered once). → { template, audience, sentAt, answered: Set, alreadyAnswered } | null
export function formulaContext(messages = [], { now = Date.now(), maxAgeDays = 7 } = {}) {
  const t = (m) => Date.parse(m?.timestamps?.created || m?.created_at || 0) || 0;
  const sorted = [...messages].sort((a, b) => t(b) - t(a));
  const tpl = sorted.find((m) => m?.direction === 'outbound' && m?.type === 'template');
  const name = tpl?.template?.name;
  if (!name || !FORMULA_TEMPLATES[name]) return null;
  if (now - t(tpl) > maxAgeDays * 86400000) return null;
  const answered = new Set();
  for (const m of sorted) {
    if (m?.direction !== 'outbound' || t(m) < t(tpl) || m === tpl) continue;
    const text = String(m?.text || '');
    if (/\/r\/si-|utm_content=respuesta_si/.test(text)) answered.add('si');
    if (/\/r\/cartera|utm_content=respuesta_cartera/.test(text)) answered.add('cartera');
    if (/\/r\/proyecto|utm_content=respuesta_proyecto/.test(text)) answered.add('proyecto');
  }
  return { template: name, audience: FORMULA_TEMPLATES[name], sentAt: new Date(t(tpl)).toISOString(), answered, alreadyAnswered: answered.has('si') };
}
