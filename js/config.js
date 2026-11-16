// Project settings. Change these in one place.
export const CONFIG = {
  // GitHub repository that receives audit submissions as issues.
  repo: 'angelopoulosk/sholikes-diavaseis',
  // Map start: central Athens.
  center: [37.9838, 23.7275],
  zoom: 16,
  // Schools and crossings are only loaded at this zoom or closer.
  minDataZoom: 15,
  // A crossing counts as a "school crossing" when it is this close (metres) to a school.
  schoolRadius: 150,
  // Overpass API mirrors, tried in order.
  overpass: [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
  ],
  audits: 'data/audits.geojson',
};
