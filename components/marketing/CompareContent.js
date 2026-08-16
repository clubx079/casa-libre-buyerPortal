'use client';
import Link from 'next/link';
import { useLang } from '@/lib/useLang';
import { Hero, CTABand } from './Parts';

export default function CompareContent({ name, blurb, blurbEn, others }) {
  const [lang] = useLang();
  const es = lang === 'es';
  const t = es
    ? {
        eyebrow: 'Comparación', title: 'Casa Libre',
        sub: `${name} es ${blurb} Casa Libre es un marketplace donde buscar y publicar propiedades en Paraguay es simple y gratis.`,
        rows: [
          ['Costo de publicar', 'Gratis', 'Planes pagos / comisiones'],
          ['Comisión por venta', 'Sin comisión', 'Suele cobrar'],
          ['Publicación al instante', 'Sí', 'Depende del plan'],
          ['Mapa con todas las propiedades', 'Sí', 'Limitado'],
          ['Precio en ₲ y US$', 'Sí', 'Varía'],
          ['Contacto directo con el dueño', 'Sí', 'A veces vía inmobiliaria'],
        ],
        note: 'Si estás decidiendo dónde publicar o buscar tu próxima propiedad en Paraguay, la diferencia principal es simple: en <strong>Casa Libre</strong> publicar es gratis, sin comisiones, y todo se ve en un mapa claro con precios en guaraníes y dólares.',
        chip: (n) => `Casa Libre vs ${n}`,
        ctaTitle: 'Probá Casa Libre gratis', ctaSub: 'Buscá miles de propiedades o publicá la tuya sin costo.', ctaPrimary: ['Ver propiedades', '/propiedades'], ctaSecondary: ['Publicar gratis', '/publicar'],
      }
    : {
        eyebrow: 'Comparison', title: 'Casa Libre',
        sub: `${name} is ${blurbEn || blurb} Casa Libre is a marketplace where searching and listing properties in Paraguay is simple and free.`,
        rows: [
          ['Cost to list', 'Free', 'Paid plans / commissions'],
          ['Sales commission', 'No commission', 'Usually charges'],
          ['Instant publishing', 'Yes', 'Depends on the plan'],
          ['Map with every property', 'Yes', 'Limited'],
          ['Price in ₲ and US$', 'Yes', 'Varies'],
          ['Direct contact with the owner', 'Yes', 'Sometimes via an agency'],
        ],
        note: 'If you’re deciding where to list or search for your next property in Paraguay, the main difference is simple: on <strong>Casa Libre</strong> listing is free, with no commissions, and everything shows on a clear map with prices in guaraníes and dollars.',
        chip: (n) => `Casa Libre vs ${n}`,
        ctaTitle: 'Try Casa Libre for free', ctaSub: 'Search thousands of properties or list yours at no cost.', ctaPrimary: ['Browse listings', '/propiedades'], ctaSecondary: ['List for free', '/publicar'],
      };
  return (
    <>
      <Hero eyebrow={t.eyebrow} title={t.title} titleSerif={`vs ${name}`} sub={t.sub} />
      <section className="px-5 md:px-11 py-6 max-w-[820px] mx-auto">
        <div className="overflow-x-auto rounded-card border border-ink/15">
          <table className="w-full text-[14px] bg-card">
            <thead>
              <tr className="border-b border-ink/12">
                <th className="text-left font-semibold p-4"> </th>
                <th className="text-left font-bold p-4">Casa Libre</th>
                <th className="text-left font-semibold p-4 text-ink/60">{name}</th>
              </tr>
            </thead>
            <tbody>
              {t.rows.map(([label, a, b], i) => (
                <tr key={i} className="border-b border-ink/8 last:border-0">
                  <td className="p-4 font-medium text-ink/70">{label}</td>
                  <td className="p-4 font-semibold">{a}</td>
                  <td className="p-4 text-ink/55">{b}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[15px] text-ink/70 leading-relaxed mt-6" dangerouslySetInnerHTML={{ __html: t.note }} />
        <div className="mt-5 flex flex-wrap gap-2.5">
          {others.map((o) => <Link key={o.slug} href={`/comparar/${o.slug}`} className="px-4 py-2 rounded-pill border border-ink/25 bg-card text-[13px] font-medium hover:border-ink">{t.chip(o.name)}</Link>)}
        </div>
      </section>
      <CTABand title={t.ctaTitle} sub={t.ctaSub} primary={t.ctaPrimary} secondary={t.ctaSecondary} />
    </>
  );
}
