// Tiny helpers for the three UI languages (es default, en, pt = pt-BR).
// tr(lang, es, en, pt): the string for `lang`; PT falls back to ES (closer to Portuguese than EN).
export const tr = (lang, es, en, pt) => (lang === 'en' ? en : lang === 'pt' ? (pt ?? es) : es);
// Field of a { es, en, pt } object for `lang` (falls back to es).
export const pickLang = (o, lang) => (o ? o[lang] ?? o.es : undefined);
// Number/date locale for `lang`.
export const localeFor = (lang, esLocale = 'es') => (lang === 'en' ? 'en-US' : lang === 'pt' ? 'pt-BR' : esLocale);
