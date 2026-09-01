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

// Casa Libre basemap — muted cream land, soft water, quiet roads, POIs hidden.
export const CL_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#F4F1EA' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#6c6a63' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#F9F4EE' }, { weight: 2 }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#E4EAD6' }, { visibility: 'on' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#FFFFFF' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#E6E2D8' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#F7F4ED' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#EDE8DD' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#E0DACd' }] },
  { featureType: 'road.local', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#D7E2DE' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#9aa8a3' }] },
];

const uri = (svg) => 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);

// Price pill (matches the old `.marker-pill`: black pill, cream border/text; hover = inverted).
export function pinIcon(google, label, hot) {
  const t = String(label ?? '•');
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
