'use client';
import Link from 'next/link';
import { useLang } from '@/lib/useLang';
import { CITIES, COMPETITORS } from '@/lib/site';

// Site-wide footer. The dense internal linking here is the main signal Google
// uses to choose sitelinks, so every marketing page links to every other.
const L = {
  es: {
    tagline: 'Comprá, alquilá y publicá propiedades en Paraguay — gratis.',
    platform: 'Plataforma', company: 'Empresa', cities: 'Ciudades', compare: 'Comparar',
    buy: 'Comprar propiedades', rent: 'Alquilar propiedades', all: 'Ver todas las propiedades', publish: 'Publicar gratis',
    story: 'Nuestra historia', how: 'Cómo funciona', sell: 'Publicá tu propiedad', business: 'Para empresas', contact: 'Contacto', faq: 'Preguntas frecuentes',
    cityPrefix: '', vs: (n) => `Casa Libre vs ${n}`,
    terms: 'Términos', privacy: 'Privacidad',
    fxNote: 'Conversión referencial al tipo de cambio del día · fuente open.er-api.com',
  },
  en: {
    tagline: 'Buy, rent and list properties in Paraguay — free.',
    platform: 'Platform', company: 'Company', cities: 'Cities', compare: 'Compare',
    buy: 'Buy properties', rent: 'Rent properties', all: 'Browse all listings', publish: 'List for free',
    story: 'Our story', how: 'How it works', sell: 'List your property', business: 'For businesses', contact: 'Contact', faq: 'FAQ',
    cityPrefix: '', vs: (n) => `Casa Libre vs ${n}`,
    terms: 'Terms', privacy: 'Privacy',
    fxNote: 'Reference exchange rate of the day · source open.er-api.com',
  },
};

export default function Footer() {
  const [lang] = useLang();
  const t = L[lang];
  const sections = [
    { title: t.platform, links: [[t.buy, '/comprar'], [t.rent, '/alquilar'], [t.all, '/propiedades'], [t.publish, '/publicar']] },
    { title: t.company, links: [[t.story, '/nuestra-historia'], [t.how, '/como-funciona'], [t.sell, '/vender'], [t.business, '/empresas'], [t.contact, '/contacto'], [t.faq, '/preguntas-frecuentes']] },
    { title: t.cities, links: CITIES.slice(0, 8).map((c) => [c.name, `/propiedades-en/${c.slug}`]) },
    { title: t.compare, links: COMPETITORS.map((c) => [t.vs(c.name), `/comparar/${c.slug}`]) },
  ];
  return (
    <footer className="bg-ink text-paper mt-auto">
      <div className="max-w-[1200px] mx-auto px-5 md:px-11 py-14">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="text-[22px] font-bold tracking-head">casa-libre<em className="font-serif italic font-normal">.py</em></Link>
            <p className="text-[13px] text-paper/60 mt-3 leading-relaxed max-w-[220px]">{t.tagline}</p>
          </div>
          {sections.map((s) => (
            <div key={s.title}>
              <div className="text-[12px] font-semibold uppercase tracking-label text-paper/50 mb-3">{s.title}</div>
              <ul className="flex flex-col gap-2">
                {s.links.map(([label, href]) => (
                  <li key={href}><Link href={href} className="text-[13.5px] text-paper/80 hover:text-paper">{label}</Link></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 pt-6 border-t border-paper/15 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="font-mono text-[11px] text-paper/45">© {new Date().getFullYear()} Casa Libre — Paraguay · <a href="mailto:hola@casa-libre.com" className="hover:text-paper">hola@casa-libre.com</a></div>
          <div className="flex gap-5 text-[12px] text-paper/60">
            <Link href="/terminos" className="hover:text-paper">{t.terms}</Link>
            <Link href="/privacidad" className="hover:text-paper">{t.privacy}</Link>
            <Link href="/contacto" className="hover:text-paper">{t.contact}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
