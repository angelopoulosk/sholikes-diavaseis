#!/usr/bin/env node
// Build data/snapshot.json for the area in CONFIG.snapshotBbox, so the map does
// not depend on the public Overpass servers at view time.
//
//   node scripts/build_snapshot.mjs
//
// Needs network access to the Overpass API; commit the result.

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CONFIG } from '../js/config.js';
import { placesQuery, crossingsQuery, buildSnapshot } from '../js/snapshot.js';

const OUT = fileURLToPath(new URL('../data/snapshot.json', import.meta.url));

async function overpass(query) {
  let lastError;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    for (const url of CONFIG.overpass) {
      try {
        const res = await fetch(url, {
          method: 'POST', body: new URLSearchParams({ data: query }), signal: AbortSignal.timeout(180000),
        });
        if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
        const json = await res.json();
        if (json.remark) throw new Error(`${url}: ${json.remark}`);
        return json.elements;
      } catch (err) {
        lastError = err;
        console.error(String(err));
      }
    }
    await new Promise((r) => setTimeout(r, 20000 * (attempt + 1)));
  }
  throw lastError;
}

const bbox = CONFIG.snapshotBbox;
const places = await overpass(placesQuery(bbox));
const crossings = await overpass(crossingsQuery(bbox));
const snapshot = buildSnapshot(places, crossings, {
  bbox, radius: CONFIG.schoolRadius, generated: new Date().toISOString().slice(0, 10),
});
if (snapshot.schools.length < 100) throw new Error(`Only ${snapshot.schools.length} places: refusing to overwrite the snapshot`);
writeFileSync(OUT, `${JSON.stringify(snapshot)}\n`);
console.log(`${snapshot.schools.length} places, ${snapshot.crossings.length} crossings`);
