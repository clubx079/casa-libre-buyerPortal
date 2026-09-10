// Google Maps helpers shared by the property maps.
//
// We style the basemap with an inline `styles` array to match the Casa Libre
// brand (muted cream), and render markers as brand-coloured SVG pills. Inline
// styles require NO mapId — and classic markers work without one — so the two
// play together (Advanced Markers would have forced a Cloud mapId and dropped
// inline styling).
import { loadGoogleMapsAPI } from './googleMapsLoader';
export { loadGoogleMapsAPI };

const CREAM = '#F9F4EE';
const INK = '#111111';

// Casa Libre basemap — a deeper warm "sand" land with white roads and darker
// ink labels so roads and place names read clearly (the old cream was too
// washed-out/light). Still the brand cream family — one step bolder, NOT a
// dark theme.
export const CL_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#E6DDCD' }] },                 // deeper sand land
  { elementType: 'labels.text.fill', stylers: [{ color: '#4b4942' }] },         // darker ink labels
  { elementType: 'labels.text.stroke', stylers: [{ color: '#F3ECDF' }, { weight: 2 }] }, // cream halo
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#D5DFBE' }, { visibility: 'on' }] }, // deeper sage-green park
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#FFFFFF' }] },       // white roads pop on darker land
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#D8CFBB' }] }, // road casing
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#FBF7EF' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#F4EEE0' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#CFC4AC' }] },
  { featureType: 'road.local', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#C4D3CC' }] },       // deeper sage water
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#7d8d86' }] },
];

// Paraguay bounding box (generous). Listings with coordinates outside it are
// mis-geocoded (e.g. stuck at 0,0 or a wrong country) and must NOT be plotted.
export function inParaguay(lat, lng) {
  return lat != null && lng != null && lat >= -28 && lat <= -19 && lng >= -63 && lng <= -54;
}

const uri = (svg) => 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);

// Price pill (matches the old `.marker-pill`: black pill, cream border/text; hover = inverted).
// A PROMOTED pin (paid verified/home listing) is drawn slightly larger, with a paper
// star before the price, so a paid listing stands out on the map. The client also keeps
// promoted pins out of clusters so they're always visible.
export function pinIcon(google, label, hot, opts = {}) {
  const promoted = !!opts.promoted;
  const t = String(label ?? '•');
  if (promoted) {
    // Bigger, with a dark outer edge + cream ring + a cream "coin" holding an ink
    // star, so a paid pin clearly pops on the map. Brand ink/paper only.
    const h = 30, fs = 13, lpad = 31, coinCx = 16, coinCy = h / 2, coinR = 9.5;
    const w = Math.max(62, Math.round(18 + lpad + t.length * 8.2));
    const bodyFill = hot ? '#fff' : INK, ring = hot ? INK : CREAM, coinFill = hot ? INK : CREAM, starFill = bodyFill, textFill = hot ? INK : CREAM;
    const s = 0.6, sc = 12 * s;
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'>` +
      `<rect x='0' y='0' width='${w}' height='${h}' rx='${h / 2}' fill='${INK}'/>` +
      `<rect x='2' y='2' width='${w - 4}' height='${h - 4}' rx='${(h - 4) / 2}' fill='${bodyFill}' stroke='${ring}' stroke-width='2.5'/>` +
      `<circle cx='${coinCx}' cy='${coinCy}' r='${coinR}' fill='${coinFill}'/>` +
      `<path transform='translate(${coinCx - sc} ${coinCy - sc}) scale(${s})' fill='${starFill}' d='M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z'/>` +
      `<text x='${lpad + (w - lpad) / 2}' y='${h / 2 + 1}' dominant-baseline='middle' text-anchor='middle' font-family='Space Grotesk, Arial, sans-serif' font-size='${fs}' font-weight='700' fill='${textFill}'>${t}</text></svg>`;
    return { url: uri(svg), scaledSize: new google.maps.Size(w, h), anchor: new google.maps.Point(w / 2, h / 2) };
  }
  const w = Math.max(28, Math.round(16 + t.length * 7.6));
  const h = 24;
  const bg = hot ? '#fff' : INK, fg = hot ? INK : CREAM, st = hot ? INK : CREAM;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'>` +
    `<rect x='1.5' y='1.5' width='${w - 3}' height='${h - 3}' rx='${(h - 3) / 2}' fill='${bg}' stroke='${st}' stroke-width='2'/>` +
    `<text x='${w / 2}' y='${h / 2 + 1}' dominant-baseline='middle' text-anchor='middle' font-family='Space Grotesk, Arial, sans-serif' font-size='12' font-weight='700' fill='${fg}'>${t}</text></svg>`;
  return { url: uri(svg), scaledSize: new google.maps.Size(w, h), anchor: new google.maps.Point(w / 2, h / 2) };
}

// Cluster bubble (matches `.cluster-pill`).
export function clusterIcon(google, count, hot) {
  const s = 40;
  const bg = hot ? '#fff' : INK, fg = hot ? INK : CREAM, st = hot ? INK : CREAM;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${s}' height='${s}'>` +
    `<circle cx='${s / 2}' cy='${s / 2}' r='${s / 2 - 2}' fill='${bg}' stroke='${st}' stroke-width='2'/>` +
    `<text x='${s / 2}' y='${s / 2 + 1}' dominant-baseline='middle' text-anchor='middle' font-family='Space Grotesk, Arial, sans-serif' font-size='13' font-weight='700' fill='${fg}'>${count}</text></svg>`;
  return { url: uri(svg), scaledSize: new google.maps.Size(s, s), anchor: new google.maps.Point(s / 2, s / 2) };
}

// Shared map options — brand style, no default UI (removes Google's controls;
// the logo/attribution are hidden via CSS in globals.css).
export function mapOptions(google, extra = {}) {
  return {
    styles: CL_MAP_STYLE,
    disableDefaultUI: true,
    zoomControl: true,
    clickableIcons: false,
    keyboardShortcuts: false,
    ...extra,
  };
}
