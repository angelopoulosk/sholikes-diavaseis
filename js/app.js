import { CONFIG } from './config.js';
import { SECTIONS, CAPS, GRADES, score, isComplete, gradeFor } from './rating.js';
import { buildQuery, parseOverpass, osmHints } from './osm.js';

/* global L */

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
const map = L.map('map', { zoomControl: false }).setView(CONFIG.center, CONFIG.zoom);
L.control.zoom({ position: 'bottomright' }).addTo(map);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">Συντελεστές OpenStreetMap</a>',
}).addTo(map);

const schoolLayer = L.layerGroup().addTo(map);
const crossingLayer = L.layerGroup().addTo(map);

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

async function overpass(query) {
  let lastError;
  for (const url of CONFIG.overpass) {
    try {
      const res = await fetch(url, { method: 'POST', body: new URLSearchParams({ data: query }) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
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
  if (map.getZoom() < CONFIG.minDataZoom) {
    setStatus('Πλησίασε στον χάρτη για να φανούν σχολεία και διαβάσεις.');
    return;
  }
  const key = viewKey();
  if (state.loadedKeys.has(key)) { updateStats(); return; }
  const b = map.getBounds().pad(0.3);
  setStatus('Φόρτωση από το OpenStreetMap…');
  try {
    const json = await overpass(buildQuery(
      [b.getSouth(), b.getWest(), b.getNorth(), b.getEast()], CONFIG.schoolRadius));
    const { schools, crossings } = parseOverpass(json);
    for (const s of schools) if (!state.schools.has(s.id)) { state.schools.set(s.id, s); drawSchool(s); }
    for (const c of crossings) if (!state.crossings.has(c.id)) { state.crossings.set(c.id, c); drawCrossing(c); }
    state.loadedKeys.add(key);
    updateStats();
  } catch (err) {
    console.error(err);
    setStatus('Το OpenStreetMap δεν απάντησε. Δοκίμασε ξανά σε λίγο.');
  }
}

// ---------- map drawing ----------

function drawSchool(s) {
  L.marker([s.lat, s.lon], {
    icon: L.divIcon({ className: 'school-pin', html: '<span>Σ</span>', iconSize: [22, 22] }),
    keyboard: false,
  // An element, not a string: Leaflet would render a string tooltip as HTML.
  }).bindTooltip(el('span', {}, s.name)).addTo(schoolLayer);
}

function colorFor(crossing) {
  const audit = state.audits.get(crossing.id);
  return audit ? GRADES.find((g) => g.grade === audit.grade)?.color || UNRATED : UNRATED;
}

function drawCrossing(c) {
  c.marker = L.circleMarker([c.lat, c.lon], {
    radius: 8, weight: 2, color: '#111', fillColor: colorFor(c), fillOpacity: 1,
  }).on('click', () => select(c)).addTo(crossingLayer);
}

function updateStats() {
  const b = map.getBounds();
  const inView = [...state.crossings.values()].filter((c) => b.contains([c.lat, c.lon]));
  const rated = inView.filter((c) => state.audits.has(c.id)).length;
  const schools = [...state.schools.values()].filter((s) => b.contains([s.lat, s.lon])).length;
  setStatus(`${schools} σχολεία · ${inView.length} σχολικές διαβάσεις · ${rated} αξιολογημένες`);
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

$('#legend').append(
  ...GRADES.map((g) => {
    const dot = el('i', {});
    dot.style.background = g.color;
    return el('span', {}, dot, `${g.grade} ${g.label}`);
  }),
  (() => { const dot = el('i', {}); dot.style.background = UNRATED; return el('span', {}, dot, 'Χωρίς αξιολόγηση'); })());

$('#about-open').addEventListener('click', () => $('#about').showModal());
$('#locate').addEventListener('click', () => map.locate({ setView: true, maxZoom: 17 }));

map.on('moveend', scheduleLoad);
await loadAudits();
loadView();
