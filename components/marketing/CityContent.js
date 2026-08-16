'use client';
import Link from 'next/link';
import { useLang } from '@/lib/useLang';
import { Hero, CTABand } from './Parts';

const PROSE = 'px-5 md:px-11 py-6 max-w-[760px] mx-auto text-[16px] leading-relaxed text-ink/80 [&>h2]:text-[26px] [&>h2]:font-bold [&>h2]:tracking-head [&>h2]:text-ink [&>h2]:mt-10 [&>h2]:mb-3 [&>p]:mb-4 [&_a]:font-semibold [&_a]:underline [&_a]:decoration-ink/30 hover:[&_a]:decoration-ink';

export default function CityContent({ name, others }) {
  const [lang] = useLang();
  const es = lang === 'es';
  const q = encodeURIComponent(name);
  const t = es
    ? {
        eyebrow: `Paraguay · ${name}`, title: 'Propiedades en', sub: `Casas, departamentos y locales en venta y alquiler en ${name}. Mirá todo en el mapa, con precio en guaraníes y dólares.`,
        all: `Ver propiedades en ${name} →`, sale: 'En venta', rent: 'En alquiler',
        p1: `¿Buscás una propiedad en <strong>${name}</strong>? Casa Libre reúne los avisos de casas, departamentos, dúplex y locales disponibles en ${name} y sus alrededores. Filtrá por precio, dormitorios y tipo, y compará cada opción en el mapa con fotos reales.`,
        p2pre: `Publicar tu propiedad en ${name} también es gratis: `, p2link: 'publicá en minutos', p2post: ' y llegá a miles de personas que buscan en la zona.',
        h2: 'Otras ciudades', chip: (n) => `Propiedades en ${n}`,
        ctaTitle: `Tu próximo lugar en ${name}`, ctaSub: 'Buscá o publicá gratis en Casa Libre.', ctaPrimary: [`Ver en ${name}`, `/propiedades?q=${q}`], ctaSecondary: ['Publicar gratis', '/publicar'],
      }
    : {
        eyebrow: `Paraguay · ${name}`, title: 'Properties in', sub: `Houses, apartments and commercial spaces for sale and rent in ${name}. See everything on the map, with prices in guaraníes and dollars.`,
        all: `View properties in ${name} →`, sale: 'For sale', rent: 'For rent',
        p1: `Looking for a property in <strong>${name}</strong>? Casa Libre gathers listings of houses, apartments, duplexes and commercial spaces available in ${name} and its surroundings. Filter by price, bedrooms and type, and compare each option on the map with real photos.`,
        p2pre: `Listing your property in ${name} is free too: `, p2link: 'list in minutes', p2post: ' and reach thousands of people searching in the area.',
        h2: 'Other cities', chip: (n) => `Properties in ${n}`,
        ctaTitle: `Your next place in ${name}`, ctaSub: 'Search or list for free on Casa Libre.', ctaPrimary: [`View in ${name}`, `/propiedades?q=${q}`], ctaSecondary: ['List for free', '/publicar'],
      };
  return (
    <>
      <Hero eyebrow={t.eyebrow} title={t.title} titleSerif={name} sub={t.sub} />
      <div className="px-5 md:px-11 text-center mb-4 flex flex-wrap gap-3 justify-center">
        <Link href={`/propiedades?q=${q}`} className="px-6 py-3 bg-ink text-paper rounded-pill font-bold text-[14px] shadow-hard-soft">{t.all}</Link>
        <Link href={`/propiedades?op=venta&q=${q}`} className="px-6 py-3 border-[1.5px] border-ink rounded-pill font-semibold text-[14px]">{t.sale}</Link>
        <Link href={`/propiedades?op=alquiler&q=${q}`} className="px-6 py-3 border-[1.5px] border-ink rounded-pill font-semibold text-[14px]">{t.rent}</Link>
      </div>
      <div className={PROSE}>
        <p dangerouslySetInnerHTML={{ __html: t.p1 }} />
        <p>{t.p2pre}<Link href="/publicar">{t.p2link}</Link>{t.p2post}</p>
        <h2>{t.h2}</h2>
      </div>
      <section className="px-5 md:px-11 max-w-[760px] mx-auto flex flex-wrap gap-2.5 pb-4">
        {others.map((o) => (
          <Link key={o.slug} href={`/propiedades-en/${o.slug}`} className="px-4 py-2 rounded-pill border border-ink/25 bg-card text-[13.5px] font-medium hover:border-ink">{t.chip(o.name)}</Link>
        ))}
      </section>
      <CTABand title={t.ctaTitle} sub={t.ctaSub} primary={t.ctaPrimary} secondary={t.ctaSecondary} />
    </>
  );
}
