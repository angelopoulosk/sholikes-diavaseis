// Project settings. Change these in one place.
export const CONFIG = {
  // GitHub repository that receives audit submissions as issues.
  repo: 'angelopoulosk/sholikes-diavaseis',
  // Base map: any style on the OpenMapTiles schema whose vector source is named
  // "openmaptiles" and that ships the "Noto Sans Bold" font.
  style: 'https://tiles.openfreemap.org/styles/positron',
  // Map start: central Athens.
  center: [37.9838, 23.7275],
  zoom: 16,
  // Schools and crossings are only loaded at this zoom or closer.
  minDataZoom: 15,
  // A crossing counts as a "school crossing" when it is this close (metres) to a school.
  schoolRadius: 150,
  // Overpass API mirrors. The map asks all of them at once and uses the first answer.
  overpass: [
    'https://overpass-api.de/api/interpreter',
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
  ],
  // Prebuilt copy of schools and crossings for this area [south, west, north, east]
  // (Attica mainland). Inside it the map needs no live query.
  snapshot: 'data/snapshot.json',
  snapshotBbox: [37.60, 23.30, 38.40, 24.15],
  audits: 'data/audits.geojson',
};
