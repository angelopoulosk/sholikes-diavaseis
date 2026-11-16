#!/usr/bin/env node
// Build data/snapshot.json: every school and school crossing in the configured
// area, so the map does not depend on the public Overpass servers at view time.
//
//   node scripts/build_snapshot.mjs
//
// Needs network access to the Overpass API; commit the result.

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CONFIG } from '../js/config.js';
import { buildQuery, parseOverpass } from '../js/osm.js';

const OUT = fileURLToPath(new URL('../data/snapshot.json', import.meta.url));
const CROSSING_TAGS = ['crossing', 'crossing:markings', 'crossing:signals', 'crossing:island',
  'traffic_calming', 'kerb', 'tactile_paving', 'lit'];

// Keep only what the map shows, and store each crossing's nearest school as an
// index into the schools list.
export function toSnapshot(parsed, bbox, generated) {
  const schools = parsed.schools.map((s) => ({
    id: s.id, lat: +s.lat.toFixed(6), lon: +s.lon.toFixed(6), name: s.name, cat: s.cat,
    ...(s.ring ? { ring: s.ring } : {}),
  }));
  const index = new Map(parsed.schools.map((s, i) => [s.id, i]));
  const crossings = parsed.crossings.map((c) => ({
    id: c.id, lat: +c.lat.toFixed(6), lon: +c.lon.toFixed(6),
    s: c.school ? index.get(c.school.id) : null,
    d: c.schoolDistance,
    tags: Object.fromEntries(CROSSING_TAGS.filter((k) => c.tags[k]).map((k) => [k, c.tags[k]])),
  }));
  return { generated, bbox, radius: CONFIG.schoolRadius, schools, crossings };
}

async function overpass(query) {
  let lastError;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    for (const url of CONFIG.overpass) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          body: new URLSearchParams({ data: query }),
          signal: AbortSignal.timeout(600000),
        });
        if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
        return await res.json();
      } catch (err) {
        lastError = err;
        console.error(String(err));
      }
    }
    await new Promise((r) => setTimeout(r, 30000 * (attempt + 1)));
  }
  throw lastError;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const bbox = CONFIG.snapshotBbox;
  const query = buildQuery(bbox, CONFIG.schoolRadius).replace('[timeout:25]', '[timeout:540][maxsize:1073741824]');
  const parsed = parseOverpass(await overpass(query));
  if (parsed.schools.length < 100) throw new Error(`Only ${parsed.schools.length} schools: refusing to overwrite the snapshot`);
  const snapshot = toSnapshot(parsed, bbox, new Date().toISOString().slice(0, 10));
  writeFileSync(OUT, `${JSON.stringify(snapshot)}\n`);
  console.log(`${snapshot.schools.length} schools, ${snapshot.crossings.length} crossings`);
}
