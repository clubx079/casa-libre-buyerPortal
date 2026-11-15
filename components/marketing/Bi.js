'use client';
// Multilingual text node. The matrix pages (city and neighbourhood) are server
// rendered in Spanish — that is what crawlers index — so their visible strings go
// through this to follow the site's ES/EN/PT toggle without a second URL.
import { useLang } from '@/lib/useLang';

export default function Bi({ es, en, pt }) {
  const [lang] = useLang();
  if (lang === 'pt' && pt) return <>{pt}</>;
  return <>{lang === 'en' && en ? en : es}</>;
}
