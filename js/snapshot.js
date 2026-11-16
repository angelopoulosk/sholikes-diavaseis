// Build the snapshot the map loads: every school and pre-school in an area and
// every crossing within `radius` metres of one. Works in Node and in a browser.
//
// The obvious Overpass query ("crossings around schools") is too heavy for the
// busy public servers over a whole region, so two cheap queries fetch all
// places and all crossings and the distance filter runs here instead.

import { parseOverpass } from './osm.js';

const box = (b) => b.map((n) => n.toFixed(5)).join(',');
export const placesQuery = (b) => `[out:json][timeout:120];
nwr["amenity"~"^(school|kindergarten|childcare)$"](${box(b)});
out tags geom;`;
export const crossingsQuery = (b) => `[out:json][timeout:120];
node["highway"="crossing"](${box(b)});
out body;`;

const CROSSING_TAGS = ['crossing', 'crossing:markings', 'crossing:signals', 'crossing:island',
  'traffic_calming', 'kerb', 'tactile_paving', 'lit'];
const M_PER_DEG = 111195;

// Outline of a place as a list of lines, each a list of {lat, lon}.
function outlines(el) {
  if (el.type === 'node') return [[{ lat: el.lat, lon: el.lon }]];
  if (el.type === 'way') return el.geometry ? [el.geometry] : [];
  return (el.members || []).filter((m) => m.geometry).map((m) => m.geometry);
}

// Distance in metres from point p to segment a-b, on a local flat projection.
function toSegment(p, a, b, kx) {
  const px = (p.lon - a.lon) * kx; const py = (p.lat - a.lat) * M_PER_DEG;
  const bx = (b.lon - a.lon) * kx; const by = (b.lat - a.lat) * M_PER_DEG;
  const len = bx * bx + by * by;
  const t = len ? Math.max(0, Math.min(1, (px * bx + py * by) / len)) : 0;
  return Math.hypot(px - t * bx, py - t * by);
}

function toOutline(p, lines, kx) {
  let best = Infinity;
  for (const line of lines) {
    if (line.length === 1) best = Math.min(best, toSegment(p, line[0], line[0], kx));
    for (let i = 1; i < line.length; i += 1) best = Math.min(best, toSegment(p, line[i - 1], line[i], kx));
  }
  return best;
}

export function buildSnapshot(placeElements, crossingElements, { bbox, radius, generated }) {
  const seen = new Set();
  const elements = placeElements.filter((el) => {
    const key = `${el.type}/${el.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const places = parseOverpass({ elements }).schools;
  const byId = new Map(elements.map((el) => [`${el.type}/${el.id}`, el]));

  // Bucket each place into grid cells covering its outline plus the radius.
  const CELL = 0.004;
  const grid = new Map();
  const shapes = places.map((place, index) => {
    const lines = outlines(byId.get(place.id));
    const pts = lines.flat();
    if (!pts.length) pts.push({ lat: place.lat, lon: place.lon });
    const kx = M_PER_DEG * Math.cos((place.lat * Math.PI) / 180);
    const padLat = radius / M_PER_DEG; const padLon = radius / kx;
    const lats = pts.map((p) => p.lat); const lons = pts.map((p) => p.lon);
    for (let y = Math.floor((Math.min(...lats) - padLat) / CELL); y <= Math.floor((Math.max(...lats) + padLat) / CELL); y += 1) {
      for (let x = Math.floor((Math.min(...lons) - padLon) / CELL); x <= Math.floor((Math.max(...lons) + padLon) / CELL); x += 1) {
        const key = `${y}:${x}`;
        if (!grid.has(key)) grid.set(key, []);
        grid.get(key).push(index);
      }
    }
    return { lines: lines.length ? lines : [[{ lat: place.lat, lon: place.lon }]], kx };
  });

  const crossings = [];
  const done = new Set();
  for (const el of crossingElements) {
    if (el.type !== 'node' || el.tags?.highway !== 'crossing' || done.has(el.id)) continue;
    done.add(el.id);
    let best = null;
    for (const index of grid.get(`${Math.floor(el.lat / CELL)}:${Math.floor(el.lon / CELL)}`) || []) {
      const d = toOutline(el, shapes[index].lines, shapes[index].kx);
      if (d <= radius && (!best || d < best.d)) best = { d, index };
    }
    if (!best) continue;
    crossings.push({
      id: el.id, lat: +el.lat.toFixed(6), lon: +el.lon.toFixed(6), s: best.index, d: Math.round(best.d),
      tags: Object.fromEntries(CROSSING_TAGS.filter((k) => el.tags[k]).map((k) => [k, el.tags[k]])),
    });
  }

  const schools = places.map((p) => ({
    id: p.id, lat: +p.lat.toFixed(6), lon: +p.lon.toFixed(6), name: p.name, cat: p.cat,
    ...(p.ring ? { ring: p.ring } : {}),
  }));
  return { generated, bbox, radius, schools, crossings };
}
