'use client';
// Bilingual text node. The matrix pages (city and neighbourhood) are server
// rendered in Spanish — that is what crawlers index — so their visible strings go
// through this to follow the site's ES/EN toggle without a second URL.
import { useLang } from '@/lib/useLang';

export default function Bi({ es, en }) {
  const [lang] = useLang();
  return <>{lang === 'en' && en ? en : es}</>;
}
