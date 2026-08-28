// Casa Libre brand basemap — warm "paper" cream land (#f9f4ee), crisp white
// roads, ink-muted labels with a cream halo, soft sage water. Shared by the
// marketplace map and the property-view map so the basemap matches the brand
// (ink #111 / paper #f9f4ee) instead of a generic grayscale.
export const CL_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#f9f4ee' }] },                 // paper land
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#6b6862' }] },         // ink-muted labels
  { elementType: 'labels.text.stroke', stylers: [{ color: '#f9f4ee' }] },       // cream halo
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#e0d9cc' }] },
  { featureType: 'administrative.country', elementType: 'geometry.stroke', stylers: [{ color: '#cec5b4' }] },
  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#f9f4ee' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#f1ece1' }] },
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#e6e7d3' }] },   // soft warm green
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },        // white roads
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#eee7db' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#9c978c' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#f0e9dc' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#e3dccd' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#cdd6d1' }] },        // soft sage water
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#8fa39a' }] },
];
