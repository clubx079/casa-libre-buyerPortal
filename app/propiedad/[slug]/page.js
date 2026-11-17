import { notFound, permanentRedirect } from 'next/navigation';
import { getListing } from '@/lib/listings';
import { typeLabel } from '@/lib/propertyType';
import { fmtUsd } from '@/lib/ui';
import PropertyViewTracker from '@/components/PropertyViewTracker';
import PropertyDetailView from '@/components/PropertyDetailView';
import { SITE } from '@/lib/site';
import { COUNTRY } from '@/lib/country';
import { NO_PHOTO_OG_URL, NO_PHOTO_ALT } from '@/lib/noPhoto';

export const dynamic = 'force-dynamic';

const listingTitle = (l) => `${typeLabel(l.type, 'es') || 'Propiedad'}${l.beds ? ` de ${l.beds} dorm.` : ''} en ${l.neighborhood || l.city || COUNTRY.name}`;

export async function generateMetadata({ params }) {
  const l = await getListing(params.slug);
  if (!l) return { title: 'Propiedad no encontrada' };
  // No price in the title when it's one we couldn't verify (lib/unverified.js).
  const title = l.usd != null ? `${listingTitle(l)} — ${fmtUsd(l.usd, 'es')}${l.mode === 'alquiler' ? '/mes' : ''}` : listingTitle(l);
  const description = (l.description || `${listingTitle(l)}. ${[l.area && `${l.area} m²`, l.baths && `${l.baths} baños`, l.parking && `${l.parking} cocheras`].filter(Boolean).join(', ')}. Ver en Casa Libre.`).slice(0, 160);
  const url = `${SITE}/propiedad/${l.id}`;
  // No photo yet → the placeholder as a JPEG (WhatsApp/Facebook previews don't take webp).
  const ogImage = l.no_photo ? { url: NO_PHOTO_OG_URL, alt: NO_PHOTO_ALT, width: 1200, height: 900 } : l.image ? { url: l.image, alt: title } : null;
  return {
    title, description, alternates: { canonical: url },
    openGraph: { title, description, url, siteName: 'Casa Libre', type: 'website', locale: 'es_PY', images: ogImage ? [ogImage] : [] },
    twitter: { card: 'summary_large_image', title, description, images: ogImage ? [ogImage.url] : [] },
  };
}

export default async function PropiedadPage({ params }) {
  const l = await getListing(params.slug);
  if (!l) notFound();
  // Audit #5: the public identifier is our internal uuid — never a source system id.
  // Old shared source-slug URLs still resolve (getListing fallback) and 301 here.
  if (params.slug !== l.id) permanentRedirect(`/propiedad/${l.id}`);

  const url = `${SITE}/propiedad/${l.id}`;
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'RealEstateListing',
    name: listingTitle(l), description: l.description || listingTitle(l), url,
    // the placeholder isn't a photo of the property → left out of the structured data
    ...(l.no_photo ? {} : { image: (l.images || []).slice(0, 6) }),
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
    property_id: l.id, slug: l.id, address: l.address || null, city: l.city || null,
    neighborhood: l.neighborhood || null, state: l.province || null, price: l.usd ?? null,
    currency: 'USD', mode: l.mode, type: l.type || null, lat: l.lat ?? null, lng: l.lng ?? null,
    no_photo: !!l.no_photo,   // shown with the "Todavía no tengo foto" placeholder (lib/noPhoto.js)
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
