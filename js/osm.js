// OpenStreetMap helpers: build the Overpass query, parse the answer and link
// each crossing to its nearest school. No browser APIs, so Node can test it.

export function buildQuery(bbox, radius) {
  // bbox = [south, west, north, east]
  // Crossings need "out body": "out tags" would drop their coordinates.
  const b = bbox.map((n) => n.toFixed(5)).join(',');
  return `[out:json][timeout:25];
nwr["amenity"~"^(school|kindergarten)$"](${b})->.schools;
node["highway"="crossing"](around.schools:${radius})->.crossings;
.schools out tags center;
.crossings out body;`;
}

export function distanceMetres(a, b) {
  const R = 6371000;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function parseOverpass(json) {
  const schools = [];
  const crossings = [];
  for (const el of json.elements || []) {
    const tags = el.tags || {};
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (lat == null || lon == null) continue;
    if (tags.highway === 'crossing' && el.type === 'node') {
      crossings.push({ id: el.id, lat, lon, tags });
    } else if (tags.amenity === 'school' || tags.amenity === 'kindergarten') {
      schools.push({
        id: `${el.type}/${el.id}`, lat, lon, tags,
        name: tags.name || (tags.amenity === 'kindergarten' ? 'Νηπιαγωγείο / παιδικός σταθμός' : 'Σχολείο'),
      });
    }
  }
  for (const c of crossings) {
    let best = null;
    for (const s of schools) {
      const d = distanceMetres(c, s);
      if (!best || d < best.d) best = { d, s };
    }
    c.school = best ? best.s : null;
    c.schoolDistance = best ? Math.round(best.d) : null;
  }
  return { schools, crossings };
}

// What OpenStreetMap already says about a crossing. These are hints for the
// auditor, not a score: OSM tags are often missing or out of date.
export function osmHints(tags) {
  const t = tags || {};
  const hints = [];
  const add = (label, value) => hints.push({ label, value });
  const yn = (v) => (v === 'yes' ? 'ναι' : v === 'no' ? 'όχι' : v);
  if (t.crossing || t['crossing:markings']) {
    const kind = t['crossing:markings'] || t.crossing;
    const names = {
      zebra: 'ζέβρα', marked: 'με διαγράμμιση', uncontrolled: 'με διαγράμμιση, χωρίς φανάρι',
      unmarked: 'χωρίς διαγράμμιση', traffic_signals: 'με φανάρι', no: 'χωρίς διαγράμμιση', yes: 'με διαγράμμιση',
    };
    add('Τύπος', names[kind] || kind);
  }
  if (t['crossing:signals']) add('Φανάρι', yn(t['crossing:signals']));
  if (t.traffic_calming) add('Μείωση ταχύτητας', t.traffic_calming === 'table' ? 'υπερυψωμένη' : t.traffic_calming);
  if (t['crossing:island']) add('Νησίδα', yn(t['crossing:island']));
  if (t.kerb) add('Κράσπεδο', { lowered: 'χαμηλωμένο', flush: 'ισόπεδο', raised: 'υπερυψωμένο' }[t.kerb] || t.kerb);
  if (t.tactile_paving) add('Οδηγός τυφλών', yn(t.tactile_paving));
  if (t.lit) add('Φωτισμός', yn(t.lit));
  return hints;
}
