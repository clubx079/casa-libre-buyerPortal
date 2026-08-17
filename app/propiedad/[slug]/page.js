import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getListing } from '@/lib/listings';
import { typeLabel } from '@/lib/propertyType';
import { fmtUsd, fmtPyg } from '@/lib/ui';
import Gallery from '@/components/Gallery';
import SaveButton from '@/components/SaveButton';
import { SITE } from '@/lib/site';

export const dynamic = 'force-dynamic';

const listingTitle = (l) => `${typeLabel(l.type, 'es') || 'Propiedad'}${l.beds ? ` de ${l.beds} dorm.` : ''} en ${l.neighborhood || l.city || 'Paraguay'}`;

export async function generateMetadata({ params }) {
  const l = await getListing(params.slug);
  if (!l) return { title: 'Propiedad no encontrada' };
  const title = `${listingTitle(l)} — ${fmtUsd(l.usd, 'es') || ''}${l.mode === 'alquiler' ? '/mes' : ''}`;
  const description = (l.description || `${listingTitle(l)}. ${[l.area && `${l.area} m²`, l.baths && `${l.baths} baños`, l.parking && `${l.parking} cocheras`].filter(Boolean).join(', ')}. Ver en Casa Libre.`).slice(0, 160);
  const url = `${SITE}/propiedad/${l.slug}`;
  return {
    title, description, alternates: { canonical: url },
    openGraph: { title, description, url, siteName: 'Casa Libre', type: 'website', locale: 'es_PY', images: l.image ? [{ url: l.image, alt: title }] : [] },
    twitter: { card: 'summary_large_image', title, description, images: l.image ? [l.image] : [] },
  };
}

export default async function PropiedadPage({ params }) {
  const l = await getListing(params.slug);
  if (!l) notFound();

  const url = `${SITE}/propiedad/${l.slug}`;
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'RealEstateListing',
    name: listingTitle(l), description: l.description || listingTitle(l), url,
    image: (l.images || []).slice(0, 6),
    ...(l.lat != null && l.lng != null ? { geo: { '@type': 'GeoCoordinates', latitude: l.lat, longitude: l.lng } } : {}),
    address: { '@type': 'PostalAddress', streetAddress: l.address || undefined, addressLocality: l.city || undefined, addressRegion: l.province || undefined, addressCountry: 'PY' },
    ...(l.beds ? { numberOfRooms: l.beds } : {}),
    ...(l.area ? { floorSize: { '@type': 'QuantitativeValue', value: l.area, unitCode: 'MTK' } } : {}),
    ...(l.usd ? { offers: { '@type': 'Offer', price: l.usd, priceCurrency: 'USD', availability: 'https://schema.org/InStock', url } } : {}),
  };
  const breadcrumb = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Casa Libre', item: SITE },
      { '@type': 'ListItem', position: 2, name: 'Propiedades', item: `${SITE}/propiedades` },
      ...(l.city ? [{ '@type': 'ListItem', position: 3, name: l.city, item: `${SITE}/propiedades?q=${encodeURIComponent(l.city)}` }] : []),
      { '@type': 'ListItem', position: l.city ? 4 : 3, name: listingTitle(l), item: url },
    ],
  };

  const sfx = l.mode === 'alquiler' ? '/mes' : '';
  const specs = [
    l.beds != null && [l.beds, 'Dormitorios'],
    l.baths != null && [l.baths, 'Baños'],
    l.area != null && [`${l.area} m²`, 'Superficie'],
    l.parking != null && [l.parking, 'Cocheras'],
  ].filter(Boolean);

  // Contact → open WhatsApp with a prefilled message when the listing has a phone.
  const waText = 'Hey, I saw your property on Casa Libre, I have questions';
  let waDigits = String(l.contact_phone || '').replace(/\D/g, '');
  if (waDigits) {
    if (waDigits.startsWith('0')) waDigits = '595' + waDigits.slice(1);              // PY local → intl
    else if (!waDigits.startsWith('595') && waDigits.length <= 10) waDigits = '595' + waDigits;
  }
  const waUrl = waDigits ? `https://wa.me/${waDigits}?text=${encodeURIComponent(waText)}` : null;

  return (
    <div className="min-h-screen bg-paper text-ink">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <nav className="flex items-center justify-between px-5 md:px-11 py-4 border-b border-ink/12 max-w-[1200px] mx-auto">
        <Link href="/" className="text-[22px] font-bold tracking-head">casa-libre<em className="font-serif italic font-normal">.py</em></Link>
        <Link href="/propiedades" className="text-[13px] font-semibold px-4 py-2 rounded-pill border-[1.5px] border-ink">← Volver</Link>
      </nav>

      <main className="max-w-[1200px] mx-auto px-5 md:px-11 py-8">
        {/* gallery + lightbox */}
        <div className="mb-8">
          <Gallery images={l.images} />
        </div>

        <div className="grid md:grid-cols-[1fr_320px] gap-10">
          <div>
            {typeLabel(l.type, 'es') && (
              <span className="inline-block mb-3 text-[12px] font-semibold px-3 py-1 rounded-pill border border-ink/25 bg-card">
                {typeLabel(l.type, 'es')} · {l.mode === 'alquiler' ? 'En alquiler' : 'En venta'}
              </span>
            )}
            <div className="text-[clamp(30px,5vw,46px)] font-bold tracking-display">{fmtUsd(l.usd, 'es') || '—'}{sfx}</div>
            <div className="text-[18px] font-semibold text-ink/55 mt-0.5">{fmtPyg(l.pyg, 'es') || ''}{l.pyg ? sfx : ''}</div>
            <h1 className="text-[22px] font-semibold mt-2 mb-1 tracking-head">{l.neighborhood || ''}{l.neighborhood && l.city ? ' · ' : ''}{l.city || ''}</h1>
            <p className="text-ink/60 text-[15px] m-0">{l.address}</p>
            <div className="mt-4"><SaveButton id={l.id} variant="detail" /></div>

            {specs.length > 0 && (
              <div className="flex flex-wrap gap-8 mt-6 pt-6 border-t border-ink/10">
                {specs.map(([v, k], i) => (
                  <div key={i}>
                    <div className="text-[26px] font-bold tracking-head">{v}</div>
                    <div className="font-mono text-[11px] text-ink/50">{k}</div>
                  </div>
                ))}
              </div>
            )}

            {l.description && (
              <div className="mt-8">
                <h2 className="text-[18px] font-bold tracking-head mb-3">Descripción</h2>
                <p className="text-[15px] leading-relaxed text-ink/75 whitespace-pre-line m-0">{l.description}</p>
              </div>
            )}

            {l.lat != null && l.lng != null && (
              <div className="mt-8">
                <h2 className="text-[18px] font-bold tracking-head mb-3">Ubicación</h2>
                <div className="rounded-card overflow-hidden border border-ink/15 h-[300px]">
                  <iframe
                    title="map" className="w-full h-full" loading="lazy"
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${l.lng - 0.01}%2C${l.lat - 0.008}%2C${l.lng + 0.01}%2C${l.lat + 0.008}&layer=mapnik&marker=${l.lat}%2C${l.lng}`}
                  />
                </div>
              </div>
            )}
          </div>

          <aside>
            <div className="bg-ink text-paper rounded-card p-6 md:sticky md:top-6">
              <div className="font-mono text-[10px] uppercase tracking-label text-paper/50 mb-2">{l.mode === 'alquiler' ? 'En alquiler' : 'En venta'}</div>
              <div className="text-[28px] font-bold tracking-head">{fmtUsd(l.usd, 'es') || '—'}{sfx}</div>
              <div className="text-[15px] font-semibold text-paper/60">{fmtPyg(l.pyg, 'es') || ''}{l.pyg ? sfx : ''}</div>
              <div className="text-paper/60 text-[13px] mt-1 mb-5">{l.city}</div>
              {waUrl ? (
                <a href={waUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full px-6 py-3.5 bg-paper text-ink font-semibold rounded-pill">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.1-1.3A10 10 0 1 0 12 2zm0 18a8 8 0 0 1-4.1-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 1 1 12 20zm4.4-6c-.2-.1-1.4-.7-1.6-.8s-.4-.1-.6.1-.6.8-.7.9-.3.2-.5.1a6.5 6.5 0 0 1-3.2-2.8c-.2-.4.2-.4.6-1.2.1-.2 0-.3 0-.5s-.5-1.3-.7-1.7-.4-.4-.5-.4h-.5a1 1 0 0 0-.7.3A2.8 2.8 0 0 0 6.4 9c0 1.7 1.2 3.3 1.4 3.5s2.4 3.7 5.8 5c2 .9 2.4.7 2.9.6.5 0 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2z"/></svg>
                  Contactar
                </a>
              ) : (
                <button disabled aria-disabled="true" className="w-full px-6 py-3.5 bg-paper/40 text-ink/40 font-semibold rounded-pill cursor-not-allowed">Sin contacto</button>
              )}
              {(l.contact_name || l.contact_phone) && (
                <div className="font-mono text-[11px] text-paper/50 mt-3 text-center">{l.contact_name} {l.contact_phone}</div>
              )}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
