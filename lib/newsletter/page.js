// The /newsletter page's data (pure — tests/newsletter.test.mjs): every issue as a web article,
// filled with this week's measured numbers. An issue missing one of its numbers is left out
// (never shown with a gap or an invented value). Body markup = lib/emailTemplateRender.js's.
import { ISSUES, STORIES, storyBlock } from './content.js';
import { missingVars } from '../automations/newsletter.js';

const TAG = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
const fill = (s, vars) => String(s ?? '').replace(TAG, (_, k) => (vars[k] == null ? '' : String(vars[k])));

// body markup → [{ type: 'p' | 'h' | 'stat' | 'button', … }] (the email-only bits dropped:
// the preheader, the "Hola {{name}}" greeting, the link back to this page).
export function blocksOf(body, vars = {}) {
  const out = [];
  for (const raw of String(body || '').split(/\n\s*\n/)) {
    const p = raw.trim();
    if (!p || p.startsWith('>>') || /^-{3,}$/.test(p) || /^Hola \{\{\s*name\s*\}\}/.test(p) || /^Hi \{\{\s*name\s*\}\}/.test(p)) continue;
    const btn = /^\[\[([^\]]+)\]\]\(([^)\s]+)\)$/.exec(p);
    if (btn) {
      if (/newsletter_url|stories_url/.test(btn[2])) continue;
      out.push({ type: 'button', label: fill(btn[1], vars), href: fill(btn[2], vars) });
      continue;
    }
    if (p.startsWith('## ')) { out.push({ type: 'h', text: fill(p.slice(3), vars) }); continue; }
    const stat = /^!!\s+([^|]+?)\s*\|\s*([\s\S]+)$/.exec(p);
    if (stat) { out.push({ type: 'stat', value: fill(stat[1], vars), text: fill(stat[2], vars) }); continue; }
    out.push({ type: 'p', text: fill(p, vars) });
  }
  return out;
}

const relative = (href) => String(href || '').replace(/^https?:\/\/[^/]+/, '') || '/';

// A stored (generated) issue's body is a list of paragraphs; a hand-made one is one string.
const asText = (b) => (Array.isArray(b) ? b.join('\n\n') : String(b || ''));

// → [{ slug, cat, title, heading, blocks, story, button }] for 'es' | 'en' (pt reads Spanish).
// only = an edition's issues (lib/newsletter/editions.js), in that order: ISSUES slugs (the
// hand-made editions) or the issue objects themselves (the stored weekly ones); default = all.
// stories = the edition's story objects (a stored issue's story is one of them).
export function pageIssues(vars = {}, lang = 'es', only = null, stories = []) {
  const out = [];
  const list = Array.isArray(only) ? only.map((s) => (s && typeof s === 'object' ? s : ISSUES.find((i) => i.slug === s))).filter(Boolean) : ISSUES;
  const storyOf = (slug) => (slug ? (stories || []).find((s) => s.slug === slug) || STORIES.find((s) => s.slug === slug) || null : null);
  for (const i of list) {
    const en = lang === 'en' && i.en;
    const handMadeStory = typeof i.body === 'string' && i.story && STORIES.some((s) => s.slug === i.story);
    const body = en ? asText(i.en.body) : (handMadeStory ? i.body.replace(storyBlock(i.story), '') : asText(i.body));
    const subject = en ? i.en.subject : i.subject;
    const heading = en ? i.en.heading : i.heading;
    if (missingVars({ subject, heading, body }, vars).length) continue;
    const title = fill(subject, { ...vars, name: '' }).replace(/^\s*,\s*/, '').replace(/^\p{Ll}/u, (c) => c.toUpperCase());
    out.push({
      slug: i.slug,
      ...(i.cat ? { cat: i.cat } : {}),
      title,
      heading: fill(heading, vars),
      blocks: blocksOf(body, vars).map((b) => (b.type === 'button' ? { ...b, href: relative(b.href) } : b)),
      story: storyOf(i.story),
      button: { label: i.button_label, href: relative(fill(i.button_url, vars)) },
    });
  }
  return out;
}
