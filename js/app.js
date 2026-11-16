import { CONFIG } from './config.js';
import { SECTIONS, CAPS, GRADES, score, isComplete, gradeFor } from './rating.js';
import { CATEGORIES, buildQuery, parseOverpass, osmHints } from './osm.js';

/* global maplibregl */

const $ = (sel) => document.querySelector(sel);
const el = (tag, attrs = {}, ...children) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  // Text is always added as text nodes: OSM names and tags are untrusted input.
  for (const c of children.flat()) node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return node;
};

const UNRATED = '#6b7280';
const map = new maplibregl.Map({
  container: 'map',
  style: CONFIG.style,
  center: [CONFIG.center[1], CONFIG.center[0]],
  zoom: CONFIG.zoom,
});
map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

// School grounds come straight from the base map's vector tiles (OpenMapTiles
// schema): a halo, a yellow fill, a dark outline and the school's name.
const SCHOOL_LAYERS = ['school-zone', 'school-fill', 'school-line', 'school-name',
  'pre-zone', 'pre-fill', 'pre-line', 'pre-point', 'pre-name'];

function addSchools() {
  // Only schools here: νηπιαγωγεία and παιδικοί σταθμοί get their own colours below.
  const isSchool = ['==', ['get', 'class'], 'school'];
  const base = { source: 'openmaptiles', 'source-layer': 'landuse', minzoom: 11, filter: isSchool };
  map.addLayer({ id: 'school-zone', type: 'line', ...base,
    paint: { 'line-color': '#ffc400', 'line-opacity': 0.35, 'line-blur': 4,
      'line-width': ['interpolate', ['linear'], ['zoom'], 11, 4, 14, 14, 17, 34] } });
  map.addLayer({ id: 'school-fill', type: 'fill', ...base,
    paint: { 'fill-color': '#ffd400', 'fill-opacity': 0.55 } });
  map.addLayer({ id: 'school-line', type: 'line', ...base,
    paint: { 'line-color': '#1a1a1a',
      'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.5, 15, 2] } });
  map.addLayer({ id: 'school-name', type: 'symbol',
    source: 'openmaptiles', 'source-layer': 'poi', minzoom: 15,
    filter: ['all', ['==', ['get', 'class'], 'school'], ['!=', ['get', 'subclass'], 'kindergarten']],
    layout: {
      'text-field': ['concat', '🏫 ', ['coalesce', ['get', 'name'], 'Σχολείο']],
      'text-font': ['Noto Sans Bold'], 'text-size': 11,
      'text-max-width': 9, 'text-optional': true },
    paint: { 'text-color': '#3a2c00', 'text-halo-color': '#fff3b0', 'text-halo-width': 1.5 } });
}

function setSchools(on) {
  for (const id of SCHOOL_LAYERS) {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
  }
}

// Νηπιαγωγεία and παιδικοί σταθμοί cannot be told apart in the base map tiles,
// so they are drawn from our own OpenStreetMap data, coloured by category.
function addPreschools() {
  map.addSource('preschools', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  const base = { source: 'preschools', minzoom: 11 };
  const isArea = ['==', ['geometry-type'], 'Polygon'];
  const color = ['get', 'color'];
  // These outlines are often a single small building. A wide halo with sharp
  // corners turns into a spiky smudge around them when zoomed out, so the halo
  // has round corners, stays narrow and only appears at close zoom.
  map.addLayer({ id: 'pre-zone', type: 'line', ...base, minzoom: 15, filter: isArea,
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': color, 'line-opacity': 0.3, 'line-blur': 3,
      'line-width': ['interpolate', ['linear'], ['zoom'], 15, 4, 17, 14] } });
  map.addLayer({ id: 'pre-fill', type: 'fill', ...base, filter: isArea,
    paint: { 'fill-color': color, 'fill-opacity': 0.8 } });
  map.addLayer({ id: 'pre-line', type: 'line', ...base, filter: isArea,
    paint: { 'line-color': '#1a1a1a',
      'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.5, 15, 2] } });
  // Places mapped as a single point get a coloured square.
  map.addLayer({ id: 'pre-point', type: 'circle', ...base, filter: ['==', ['geometry-type'], 'Point'],
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 2, 14, 5, 17, 11],
      'circle-color': color, 'circle-opacity': 0.75,
      'circle-stroke-color': '#1a1a1a', 'circle-stroke-width': 1.5 } });
  map.addLayer({ id: 'pre-name', type: 'symbol', ...base, minzoom: 15,
    layout: {
      'text-field': ['get', 'name'], 'text-font': ['Noto Sans Bold'], 'text-size': 11,
      'text-max-width': 9, 'text-offset': [0, 1.2], 'text-optional': true },
    paint: { 'text-color': '#1a1a1a', 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 } });
}

function drawPreschools() {
  map.getSource('preschools').setData({
    type: 'FeatureCollection',
    features: [...state.schools.values()].filter((p) => p.cat !== 'school').map((p) => ({
      type: 'Feature',
      geometry: p.ring ? { type: 'Polygon', coordinates: [p.ring] } : { type: 'Point', coordinates: [p.lon, p.lat] },
      properties: { name: p.name, color: CATEGORIES[p.cat].color },
    })),
  });
}

// Crossings are our own data layer and stay on top of the school highlight.
function addCrossings() {
  map.addSource('crossings', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addLayer({ id: 'crossings', type: 'circle', source: 'crossings',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 14, 4, 17, 9],
      'circle-color': ['get', 'color'],
      'circle-stroke-color': '#111', 'circle-stroke-width': 2 } });
  map.on('click', 'crossings', (e) => {
    const c = state.crossings.get(e.features[0].properties.id);
    if (c) select(c);
  });
  map.on('mouseenter', 'crossings', () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', 'crossings', () => { map.getCanvas().style.cursor = ''; });
}

const state = {
  audits: new Map(), // osm node id -> latest audit properties
  crossings: new Map(),
  schools: new Map(),
  loadedKeys: new Set(),
  selected: null,
};

// ---------- data ----------

async function loadAudits() {
  try {
    const res = await fetch(CONFIG.audits, { cache: 'no-cache' });
    const json = await res.json();
    for (const f of json.features || []) {
      const p = f.properties || {};
      const prev = state.audits.get(p.osm_node);
      if (!prev || String(p.date) > String(prev.date)) state.audits.set(p.osm_node, p);
    }
  } catch (err) {
    console.warn('Δεν φορτώθηκαν οι αξιολογήσεις', err);
  }
}

// Ask every mirror at once and take the first good answer: the public servers
// are often busy, and one slow mirror should not hold up the map.
async function overpass(query) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  try {
    return await Promise.any(CONFIG.overpass.map(async (url) => {
      const res = await fetch(url, {
        method: 'POST', body: new URLSearchParams({ data: query }), signal: controller.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    }));
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}

// The prebuilt snapshot covers the pilot region; live queries are only needed outside it.
async function loadSnapshot() {
  try {
    const res = await fetch(CONFIG.snapshot, { cache: 'no-cache' });
    if (!res.ok) return;
    const snap = await res.json();
    for (const sc of snap.schools) state.schools.set(sc.id, sc);
    for (const c of snap.crossings) {
      state.crossings.set(c.id, { ...c, school: snap.schools[c.s] || null, schoolDistance: c.d });
    }
    state.snapshotBbox = snap.bbox;
    drawPreschools();
    drawCrossings();
  } catch (err) {
    console.warn('Δεν υπάρχει αποθηκευμένο στιγμιότυπο· χρήση ζωντανών δεδομένων', err);
  }
}

function insideSnapshot(v) {
  const b = state.snapshotBbox;
  return b && v.getSouth() >= b[0] && v.getWest() >= b[1] && v.getNorth() <= b[2] && v.getEast() <= b[3];
}

function viewKey() {
  // Snap the view to a coarse grid so small pans reuse what is already loaded.
  const c = map.getCenter();
  return `${(c.lat * 100).toFixed(0)}:${(c.lng * 100).toFixed(0)}`;
}

let loadTimer;
function scheduleLoad() {
  clearTimeout(loadTimer);
  loadTimer = setTimeout(loadView, 400);
}

async function loadView() {
  // Inside the snapshot everything is already on the map at any zoom.
  if (insideSnapshot(map.getBounds())) { updateStats(); return; }
  if (map.getZoom() < CONFIG.minDataZoom) {
    setStatus('Πλησίασε στον χάρτη για να φανούν σχολεία και διαβάσεις.');
    return;
  }
  const key = viewKey();
  if (state.loadedKeys.has(key)) { updateStats(); return; }
  // Load a little beyond the screen so short pans need no new request.
  const v = map.getBounds();
  const padLat = (v.getNorth() - v.getSouth()) * 0.3;
  const padLon = (v.getEast() - v.getWest()) * 0.3;
  setStatus('Φόρτωση από το OpenStreetMap (μπορεί να πάρει έως ένα λεπτό)…');
  try {
    const json = await overpass(buildQuery(
      [v.getSouth() - padLat, v.getWest() - padLon, v.getNorth() + padLat, v.getEast() + padLon],
      CONFIG.schoolRadius));
    const { schools, crossings } = parseOverpass(json);
    for (const s of schools) state.schools.set(s.id, s);
    drawPreschools();
    for (const c of crossings) if (!state.crossings.has(c.id)) state.crossings.set(c.id, c);
    drawCrossings();
    state.loadedKeys.add(key);
    updateStats();
  } catch (err) {
    console.error(err);
    setStatus('Το OpenStreetMap δεν απάντησε. Δοκίμασε ξανά σε λίγο.');
  }
}

// ---------- map drawing ----------

function colorFor(crossing) {
  const audit = state.audits.get(crossing.id);
  return audit ? GRADES.find((g) => g.grade === audit.grade)?.color || UNRATED : UNRATED;
}

function drawCrossings() {
  map.getSource('crossings').setData({
    type: 'FeatureCollection',
    features: [...state.crossings.values()].map((c) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [c.lon, c.lat] },
      properties: { id: c.id, color: colorFor(c) },
    })),
  });
}

function updateStats() {
  const b = map.getBounds();
  const inView = [...state.crossings.values()].filter((c) => b.contains([c.lon, c.lat]));
  const rated = inView.filter((c) => state.audits.has(c.id)).length;
  const schools = [...state.schools.values()].filter((s) => b.contains([s.lon, s.lat])).length;
  setStatus(`${schools} σχολεία και σταθμοί · ${inView.length} σχολικές διαβάσεις · ${rated} αξιολογημένες`);
}

function setStatus(text) { $('#status').textContent = text; }

// ---------- panel ----------

function openPanel(...content) {
  const body = $('#panel-body');
  body.replaceChildren(...content);
  $('#panel').classList.add('open');
  body.scrollTop = 0;
}
function closePanel() {
  $('#panel').classList.remove('open');
  state.selected = null;
}
$('#panel-close').addEventListener('click', closePanel);

function gradeBadge(grade) {
  const g = GRADES.find((x) => x.grade === grade);
  const badge = el('span', { class: 'grade' }, grade);
  badge.style.background = g.color;
  return badge;
}

function daysSince(dateText) {
  const t = Date.parse(dateText);
  return Number.isNaN(t) ? null : Math.max(0, Math.floor((Date.now() - t) / 86400000));
}

function select(c) {
  state.selected = c;
  const audit = state.audits.get(c.id);
  const parts = [
    el('p', { class: 'eyebrow' }, c.school ? `${c.schoolDistance} μ. από: ${c.school.name}` : 'Σχολική διάβαση'),
    ...(c.school ? [el('p', { class: 'muted small kind' }, CATEGORIES[c.school.cat]?.label || '')] : []),
  ];

  if (audit) {
    const g = GRADES.find((x) => x.grade === audit.grade);
    parts.push(el('div', { class: 'result' },
      gradeBadge(audit.grade),
      el('div', {},
        el('strong', {}, `${audit.points} / 100 · ${'★'.repeat(g.stars)}${'☆'.repeat(5 - g.stars)}`),
        el('div', { class: 'muted' }, `${g.label} · έλεγχος ${audit.date}`))));
    if (audit.caps?.length) {
      parts.push(el('ul', { class: 'caps' }, audit.caps.map((id) =>
        el('li', {}, CAPS.find((x) => x.id === id)?.label || id))));
    }
    parts.push(accountabilityBlock(audit));
  } else {
    parts.push(el('div', { class: 'result' },
      el('span', { class: 'grade unrated' }, '?'),
      el('div', {}, el('strong', {}, 'Δεν έχει αξιολογηθεί'),
        el('div', { class: 'muted' }, 'Χρειάζονται 3 λεπτά μπροστά στη διάβαση.'))));
  }

  const hints = osmHints(c.tags);
  if (hints.length) {
    parts.push(el('h3', {}, 'Τι λέει το OpenStreetMap'),
      el('dl', { class: 'hints' }, hints.flatMap((h) => [el('dt', {}, h.label), el('dd', {}, h.value)])),
      el('p', { class: 'muted small' }, 'Ενδείξεις μόνο· μπορεί να είναι παλιές ή ελλιπείς.'));
  }

  parts.push(
    el('button', { class: 'primary', onclick: () => openAudit(c) },
      audit ? 'Νέα αξιολόγηση' : 'Αξιολόγησε αυτή τη διάβαση'),
    el('p', { class: 'muted small' },
      el('a', { href: `https://www.openstreetmap.org/node/${c.id}`, target: '_blank', rel: 'noopener' },
        `OSM node ${c.id}`)));
  openPanel(...parts);
}

function accountabilityBlock(audit) {
  const rows = [['Υπεύθυνος φορέας', audit.authority || 'Δεν έχει εντοπιστεί ακόμη']];
  const statusNames = {
    open: 'Δεν έχει αναφερθεί', reported: 'Αναφέρθηκε, αναμένεται απάντηση',
    acknowledged: 'Απάντησε ο φορέας', scheduled: 'Προγραμματίστηκε', fixed: 'Διορθώθηκε',
  };
  rows.push(['Κατάσταση', statusNames[audit.status] || statusNames.open]);
  if (audit.reported_on) {
    rows.push(['Αναφέρθηκε', `${audit.reported_on}${audit.protocol_no ? ` (αρ. πρωτ. ${audit.protocol_no})` : ''}`]);
    if (audit.status !== 'fixed') {
      const days = daysSince(audit.reported_on);
      if (days != null) rows.push(['Χωρίς διόρθωση', `${days} ημέρες`]);
    }
  }
  if (audit.fixed_on) rows.push(['Διορθώθηκε', audit.fixed_on]);
  return el('dl', { class: 'hints account' }, rows.flatMap(([k, v]) => [el('dt', {}, k), el('dd', {}, v)]));
}

// ---------- audit form ----------

function openAudit(c) {
  const answers = {};
  const live = el('div', { class: 'live' }, 'Απάντησε σε όλα για να βγει ο βαθμός.');
  const submit = el('button', { class: 'primary', disabled: '' }, 'Υποβολή αξιολόγησης');
  const copy = el('button', { class: 'ghost', disabled: '' }, 'Αντιγραφή ως JSON');

  const refresh = () => {
    const done = Object.keys(answers).length;
    if (!isComplete(answers)) {
      const total = SECTIONS.reduce((n, s) => n + s.criteria.length, 0);
      live.replaceChildren(`${done} από ${total} απαντήσεις`);
      return;
    }
    const r = score(answers);
    const g = gradeFor(r.points);
    live.replaceChildren(gradeBadge(r.grade),
      el('strong', {}, ` ${r.points} / 100 · ${g.label}`),
      r.caps.length ? el('div', { class: 'small' }, 'Ο βαθμός περιορίστηκε λόγω κρίσιμης έλλειψης.') : '');
    submit.removeAttribute('disabled');
    copy.removeAttribute('disabled');
  };

  const fieldsets = SECTIONS.map((section) => el('fieldset', {},
    el('legend', {}, section.label),
    section.criteria.map((crit) => el('div', { class: 'question' },
      el('p', {}, crit.label),
      crit.options.map(([value, label]) => el('label', { class: 'option' },
        el('input', {
          type: 'radio', name: crit.id, value,
          onchange: () => { answers[crit.id] = value; refresh(); },
        }),
        el('span', {}, label)))))));

  const notes = el('textarea', { rows: '3', placeholder: 'Παρατηρήσεις (προαιρετικά)' });
  const record = () => {
    const r = score(answers);
    return {
      osm_node: c.id, lat: +c.lat.toFixed(6), lon: +c.lon.toFixed(6),
      school: c.school?.name || null, date: new Date().toISOString().slice(0, 10),
      answers: { ...answers }, model: r.model, points: r.points, grade: r.grade, caps: r.caps,
      notes: notes.value.trim() || null, status: 'open',
    };
  };

  submit.addEventListener('click', () => {
    const rec = record();
    const title = `Αξιολόγηση: ${rec.school || 'σχολική διάβαση'} (${rec.grade}, ${rec.points}/100)`;
    const body = [
      'Αξιολόγηση σχολικής διάβασης. Πρόσθεσε φωτογραφίες σύροντάς τες εδώ πριν την υποβολή.',
      '', '```json', JSON.stringify(rec, null, 2), '```',
    ].join('\n');
    const url = `https://github.com/${CONFIG.repo}/issues/new?labels=audit`
      + `&title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
    window.open(url, '_blank', 'noopener');
  });
  copy.addEventListener('click', async () => {
    await navigator.clipboard.writeText(JSON.stringify(record(), null, 2));
    copy.textContent = 'Αντιγράφηκε';
  });

  openPanel(
    el('p', { class: 'eyebrow' }, c.school ? c.school.name : 'Σχολική διάβαση'),
    el('h2', {}, 'Αξιολόγηση διάβασης'),
    el('p', { class: 'muted' }, 'Στάσου μπροστά στη διάβαση, ιδανικά την ώρα που σχολάνε τα παιδιά.'),
    ...fieldsets, notes, live, submit, copy,
    el('p', { class: 'muted small' },
      'Η υποβολή ανοίγει ένα έτοιμο δελτίο στο GitHub (χρειάζεται λογαριασμός). '
      + 'Δημοσιεύεται στον χάρτη αφού ελεγχθεί.'),
    el('button', { class: 'ghost', onclick: () => select(c) }, 'Πίσω'));
}

// ---------- legend & start ----------

const swatch = (color, className = '') => {
  const dot = el('i', { class: className });
  dot.style.background = color;
  return dot;
};
const schoolToggle = el('input', { type: 'checkbox', checked: '', onchange: (e) => setSchools(e.target.checked) });
$('#legend').append(
  ...GRADES.map((g) => el('span', {}, swatch(g.color), `${g.grade} ${g.label}`)),
  el('span', {}, swatch(UNRATED), 'Χωρίς αξιολόγηση'),
  el('label', {}, schoolToggle, 'Σχολεία και σταθμοί'),
  ...Object.values(CATEGORIES).map((c) => el('span', {}, swatch(c.color, 'square'), c.label)));

$('#about-open').addEventListener('click', () => $('#about').showModal());
$('#locate').addEventListener('click', () => {
  navigator.geolocation?.getCurrentPosition((pos) => {
    map.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 17 });
  });
});

map.on('load', async () => {
  addSchools();
  addPreschools();
  addCrossings();
  await Promise.all([loadAudits(), loadSnapshot()]);
  map.on('moveend', scheduleLoad);
  loadView();
});
