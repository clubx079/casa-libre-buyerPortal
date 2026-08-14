import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getListing } from '@/lib/listings';
import { typeLabel } from '@/lib/propertyType';
import { fmtUsd, fmtPyg } from '@/lib/ui';
import Gallery from '@/components/Gallery';

export const dynamic = 'force-dynamic';

export default async function PropiedadPage({ params }) {
  const l = await getListing(params.slug);
  if (!l) notFound();

  const sfx = l.mode === 'alquiler' ? '/mes' : '';
  const specs = [
    l.beds != null && [l.beds, 'Dormitorios'],
    l.baths != null && [l.baths, 'Baños'],
    l.area != null && [`${l.area} m²`, 'Superficie'],
    l.parking != null && [l.parking, 'Cocheras'],
  ].filter(Boolean);

  return (
    <div className="min-h-screen bg-paper text-ink">
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
              <button className="w-full px-6 py-3.5 bg-paper text-ink font-semibold rounded-pill">Contactar</button>
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
