#!/usr/bin/env node
// Add one reviewed audit to data/audits.geojson.
//
//   node scripts/add_audit.mjs audit.json [--authority "Δήμος Αθηναίων"]
//
// audit.json is the JSON block from a submitted GitHub issue. The score is
// always recomputed here from the answers, so a hand-edited grade in the
// issue cannot reach the map.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { score } from '../js/rating.js';

const DATA = fileURLToPath(new URL('../data/audits.geojson', import.meta.url));

export function toFeature(input, extra = {}) {
  const { osm_node: osmNode, lat, lon, date, answers } = input;
  if (!Number.isInteger(osmNode)) throw new Error('osm_node must be an integer');
  if (typeof lat !== 'number' || typeof lon !== 'number') throw new Error('lat/lon must be numbers');
  if (lat < 34 || lat > 42 || lon < 19 || lon > 30) throw new Error('coordinates are outside Greece');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) throw new Error('date must be YYYY-MM-DD');
  const result = score(answers || {});
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [lon, lat] },
    properties: {
      osm_node: osmNode,
      school: input.school || null,
      date,
      answers,
      model: result.model,
      points: result.points,
      grade: result.grade,
      caps: result.caps,
      notes: input.notes || null,
      photos: input.photos || [],
      authority: extra.authority || input.authority || null,
      status: input.status || 'open',
      reported_on: input.reported_on || null,
      protocol_no: input.protocol_no || null,
      fixed_on: input.fixed_on || null,
    },
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [file, ...rest] = process.argv.slice(2);
  if (!file) {
    console.error('usage: node scripts/add_audit.mjs audit.json [--authority NAME]');
    process.exit(2);
  }
  const i = rest.indexOf('--authority');
  const extra = i >= 0 ? { authority: rest[i + 1] } : {};
  const feature = toFeature(JSON.parse(readFileSync(file, 'utf8')), extra);
  const collection = JSON.parse(readFileSync(DATA, 'utf8'));
  collection.features.push(feature);
  writeFileSync(DATA, `${JSON.stringify(collection, null, 2)}\n`);
  const p = feature.properties;
  console.log(`Added node ${p.osm_node}: grade ${p.grade}, ${p.points}/100`);
}
