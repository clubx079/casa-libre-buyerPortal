// Monochrome Google basemap — near-white land, white roads, pale grey water,
// muted grey labels. Shared by the marketplace map and the property-view map so
// the basemap matches DeelMap's clean grayscale look.
export const CL_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#f7f7f7' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#cccccc' }] },
  { featureType: 'administrative.country', elementType: 'geometry.stroke', stylers: [{ color: '#bdbdbd' }] },
  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#f7f7f7' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#ececec' }] },
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#e9e9e9' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#ececec' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#a3a3a3' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#ededed' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#dddddd' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#dddddd' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#a3a3a3' }] },
];
