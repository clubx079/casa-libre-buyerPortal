// "Todavía no tengo foto" placeholder (Roland, Nov 17 2026): a scraped listing that has
// no photo is published anyway and shows the shrugging Casa Libre mascot instead of a
// blank box — on cards, the listing page, map previews, Open Graph and the app feed.
// Files: public/no-photo/ (source + README on the Desktop, casa-libre-no-photo/).
// Plain module (no server-only): the client cards use it too.
//
// shape() (lib/listings.js) puts NO_PHOTO_URL in `image`/`images` and sets
// `no_photo: true`, so analytics / the home strip / JSON-LD can tell it apart.
export const NO_PHOTO_URL = '/no-photo/casa-libre-sin-foto-1200x900.webp';        // 4:3 cards + gallery
export const NO_PHOTO_SQUARE_URL = '/no-photo/casa-libre-sin-foto-800x800.webp';  // square spots
export const NO_PHOTO_OG_URL = '/no-photo/casa-libre-sin-foto-1200x900.jpg';      // Open Graph (WhatsApp/Facebook don't take webp)
export const NO_PHOTO_ALT = 'Todavía no tengo foto';

const PATHS = new Set([NO_PHOTO_URL, NO_PHOTO_SQUARE_URL, NO_PHOTO_OG_URL]);
export const isNoPhoto = (url) => !!url && PATHS.has(String(url).replace(/^https?:\/\/[^/]+/, ''));

// A listing's cover, or the placeholder.
export const coverOrPlaceholder = (url) => url || NO_PHOTO_URL;

// The app (and anything off-site) needs an absolute URL: turn our relative placeholder
// paths into `${origin}/no-photo/…`; real photo URLs are returned unchanged.
export function absolutePlaceholder(url, origin) {
  if (!url || !origin || !String(url).startsWith('/no-photo/')) return url;
  return `${String(origin).replace(/\/$/, '')}${url}`;
}
export function withAbsolutePlaceholder(l, origin) {
  if (!l || !l.no_photo) return l;
  return {
    ...l,
    image: absolutePlaceholder(l.image, origin),
    ...(Array.isArray(l.images) ? { images: l.images.map((u) => absolutePlaceholder(u, origin)) } : {}),
  };
}
