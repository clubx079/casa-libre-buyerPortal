import Link from 'next/link';
import { COUNTRY } from '@/lib/country';

// Server-rendered listing card grid for the SEO landing pages (matrix + future).
// Plain <img loading="lazy"> (no next/image remote-domain config needed). On-brand
// ink/paper cards; each links to the property detail page.
const fmtUsd = (n) => (n ? `US$ ${Number(n).toLocaleString('es')}` : 'Consultar precio');

function metaLine(l) {
  return [
    l.beds ? `${l.beds} dorm` : null,
    l.baths ? `${l.baths} baño${l.baths > 1 ? 's' : ''}` : null,
    l.area ? `${Number(l.area).toLocaleString('es')} m²` : null,
  ].filter(Boolean).join(' · ');
}

export default function ListingGrid({ listings = [] }) {
  if (!listings.length) return null;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {listings.map((l) => {
        const loc = [l.neighborhood, l.city].filter(Boolean).join(', ') || l.address || COUNTRY.name;
        const meta = metaLine(l);
        return (
          <Link
            key={l.id}
            href={`/propiedad/${l.id}`}
            className="group block overflow-hidden rounded-2xl border-[1.5px] border-ink bg-card transition-transform hover:-translate-y-0.5"
          >
            <div className="aspect-[4/3] w-full overflow-hidden bg-hatch1">
              {l.image ? (
                <img
                  src={l.image}
                  alt={`${l.type || 'Propiedad'} en ${loc}`}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform group-hover:scale-[1.03]"
                />
              ) : null}
            </div>
            <div className="p-3.5">
              <div className="text-[16px] font-bold text-ink">
                {fmtUsd(l.usd)}
                {l.mode === 'alquiler' ? <span className="text-[13px] font-medium text-ink/60"> /mes</span> : null}
              </div>
              <div className="mt-0.5 truncate text-[14px] text-ink">{loc}</div>
              {meta ? <div className="mt-1 text-[12.5px] text-ink/55">{meta}</div> : null}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
