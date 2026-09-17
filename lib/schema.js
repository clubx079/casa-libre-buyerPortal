// Shared JSON-LD builders for SEO. Rendered as <script type="application/ld+json">
// — INVISIBLE to users, consumed only by search engines. The item shape mirrors the
// per-property RealEstateListing schema already used on app/propiedad/[slug]/page.js,
// so a listing looks the same to Google whether it's on a collection or its own page.

// BreadcrumbList from an ordered [{ name, url }] trail.
export function breadcrumbLd(crumbs) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem', position: i + 1, name: c.name, item: c.url,
    })),
  };
}

// CollectionPage wrapping an ItemList of the listings actually shown on the page.
// Only emit this where the listings are really rendered (e.g. /propiedades and the
// matrix pages) — never on a marketing shell that just links out, or the schema
// would not match the visible content. `listings` are the card objects the page
// already has; `site` is the absolute base URL (lib/site.js SITE).
export function collectionListingLd({ name, description, url, listings = [], site }) {
  const items = listings.slice(0, 24).map((l, i) => {
    const itemUrl = `${site}/propiedad/${l.id}`;
    const label =
      l.address ||
      [l.type, l.neighborhood || l.city].filter(Boolean).join(' en ') ||
      'Propiedad';
    const node = {
      '@type': 'RealEstateListing',
      name: label,
      url: itemUrl,
      ...(l.image ? { image: l.image } : {}),
      ...(l.usd
        ? { offers: { '@type': 'Offer', price: l.usd, priceCurrency: 'USD', availability: 'https://schema.org/InStock', url: itemUrl } }
        : {}),
    };
    return { '@type': 'ListItem', position: i + 1, url: itemUrl, item: node };
  });
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name,
    description,
    url,
    mainEntity: { '@type': 'ItemList', numberOfItems: items.length, itemListElement: items },
  };
}
