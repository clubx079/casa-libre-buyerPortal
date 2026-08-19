import { notFound } from 'next/navigation';
import { getListing } from '@/lib/listings';
import { typeLabel } from '@/lib/propertyType';
import { fmtUsd } from '@/lib/ui';
import PropertyViewTracker from '@/components/PropertyViewTracker';
import PropertyDetailView from '@/components/PropertyDetailView';
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

  // Analytics props for property_viewed.
  const trackProps = {
    property_id: l.id, slug: l.slug, address: l.address || null, city: l.city || null,
    neighborhood: l.neighborhood || null, state: l.province || null, price: l.usd ?? null,
    currency: 'USD', mode: l.mode, type: l.type || null, lat: l.lat ?? null, lng: l.lng ?? null,
  };

  return (
    <>
      <PropertyViewTracker property={trackProps} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <PropertyDetailView l={l} url={url} />
    </>
  );
}
