// OpenStreetMap helpers: build the Overpass query, parse the answer and link
// each crossing to its nearest school. No browser APIs, so Node can test it.

// The kinds of place the map tells apart, each with its own colour.
export const CATEGORIES = {
  school: { label: 'Σχολείο', color: '#ffd400' },
  nipiagogeio: { label: 'Νηπιαγωγείο', color: '#06b6d4' },
  stathmos_private: { label: 'Ιδιωτικός παιδικός σταθμός', color: '#e11d9c' },
  stathmos_public: { label: 'Δημοτικός παιδικός σταθμός', color: '#1e3a8a' },
};

// OpenStreetMap uses amenity=kindergarten for both νηπιαγωγεία and παιδικούς
// σταθμούς and rarely records who runs them, so the name decides:
// - a name that says παιδικός / βρεφικός / βρεφονηπιακός σταθμός is a σταθμός;
// - a σταθμός is public only when its tags or name say so (δημοτικός, δήμου,
//   κρατικός, δημόσιος) or its name starts with a number (10ος …); every other
//   σταθμός is counted as private.
const STATHMOS = /παιδικ|βρεφ|σταθμ|nursery|day ?care|creche/i;
const PUBLIC = /δημοτικ|δήμου|δημου|κρατικ|δημόσι|δημοσι|municipal/i;
const PRIVATE = /ιδιωτικ|private/i;
// Numbered σταθμοί («10ος Βρεφονηπιακός Σταθμός») belong to a municipality's network.
const NUMBERED = /^\s*\d+\s*(ος|ης|ο|η)(\s|$)/i;
const plain = (text) => (text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function classify(tags) {
  const t = tags || {};
  if (t.amenity === 'school') return 'school';
  const name = plain(`${t.name || ''} ${t.operator || ''}`);
  const isStathmos = t.amenity === 'childcare' || STATHMOS.test(name);
  if (!isStathmos) return 'nipiagogeio';
  const owner = plain(t['operator:type']);
  if (PRIVATE.test(owner) || PRIVATE.test(name)) return 'stathmos_private';
  if (['public', 'government', 'municipal'].includes(owner) || PUBLIC.test(name) || NUMBERED.test(plain(t.name))) {
    return 'stathmos_public';
  }
  return 'stathmos_private';
}

export function buildQuery(bbox, radius) {
  // bbox = [south, west, north, east]
  // Crossings need "out body": "out tags" would drop their coordinates.
  // Pre-schools come with their outline ("geom") so the map can colour them itself;
  // school grounds are drawn from the base map tiles and only need a centre.
  const b = bbox.map((n) => n.toFixed(5)).join(',');
  return `[out:json][timeout:25];
nwr["amenity"="school"](${b})->.schools;
nwr["amenity"~"^(kindergarten|childcare)$"](${b})->.pre;
(.schools; .pre;)->.places;
node["highway"="crossing"](around.places:${radius})->.crossings;
.schools out tags center;
.pre out tags geom;
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

const PLACE = ['school', 'kindergarten', 'childcare'];

export function parseOverpass(json) {
  const schools = [];
  const crossings = [];
  for (const el of json.elements || []) {
    const tags = el.tags || {};
    const b = el.bounds;
    const lat = el.lat ?? el.center?.lat ?? (b ? (b.minlat + b.maxlat) / 2 : null);
    const lon = el.lon ?? el.center?.lon ?? (b ? (b.minlon + b.maxlon) / 2 : null);
    if (lat == null || lon == null) continue;
    if (tags.highway === 'crossing' && el.type === 'node') {
      crossings.push({ id: el.id, lat, lon, tags });
    } else if (PLACE.includes(tags.amenity)) {
      const cat = classify(tags);
      const place = { id: `${el.type}/${el.id}`, lat, lon, cat, name: tags.name || CATEGORIES[cat].label };
      // A closed way becomes an outline; anything else is drawn as a point.
      const g = el.type === 'way' ? el.geometry : null;
      if (g && g.length >= 4 && g[0].lat === g.at(-1).lat && g[0].lon === g.at(-1).lon) {
        place.ring = g.map((p) => [+p.lon.toFixed(6), +p.lat.toFixed(6)]);
      }
      schools.push(place);
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
