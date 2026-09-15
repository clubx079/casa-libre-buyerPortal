'use client';
// Small, subtle "App coming soon" pill shown right under the casa-libre wordmark
// in every page header (web + mobile). Localized via the shared useLang hook —
// the lang set is es/en (see lib/useLang.js); falls back to ES.
import { useLang } from '@/lib/useLang';

const T = {
  es: 'App muy pronto',
  en: 'App coming soon',
  pt: 'App em breve',
};

export default function AppComingSoon({ className = '' }) {
  const [lang] = useLang();
  const label = T[lang] || T.es;
  return (
    <span
      className={`inline-flex w-fit items-center gap-1.5 self-start rounded-pill border border-ink/25 bg-ink/[0.04] px-2.5 py-[3px] text-[10.5px] font-semibold leading-none text-ink ${className}`}
    >
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-ink/55 animate-pulse" aria-hidden="true" />
      {label}
    </span>
  );
}
