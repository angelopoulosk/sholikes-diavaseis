import test from 'node:test';
import assert from 'node:assert/strict';
import { SECTIONS, ALL_CRITERIA, MAX_SCORE, score, isComplete } from '../js/rating.js';
import { buildQuery, parseOverpass, distanceMetres, osmHints } from '../js/osm.js';
import { toFeature } from '../scripts/add_audit.mjs';

const pick = (index) => Object.fromEntries(
  ALL_CRITERIA.map((c) => [c.id, c.options.at(index)[0]]));
const best = pick(0);
const worst = pick(-1);

test('the model adds up to 100 points', () => {
  assert.equal(MAX_SCORE, 100);
  const perSection = SECTIONS.map((s) => score(best).sections[s.id].max);
  assert.deepEqual(perSection, [35, 25, 25, 15]);
});

test('best and worst answers give A/100 and F/0', () => {
  assert.deepEqual([score(best).grade, score(best).points, score(best).stars], ['A', 100, 5]);
  assert.deepEqual([score(worst).grade, score(worst).points], ['F', 0]);
});

test('a crossing with no ramps cannot score above D', () => {
  const r = score({ ...best, ramps: 'none' });
  assert.equal(r.raw, 92);
  assert.equal(r.points, 54);
  assert.equal(r.grade, 'D');
  assert.deepEqual(r.caps, ['no_ramps']);
});

test('50 km/h is only capped when there is no traffic calming', () => {
  assert.deepEqual(score({ ...best, speed_limit: 'ge50' }).caps, []);
  assert.deepEqual(score({ ...best, speed_limit: 'ge50', calming: 'none' }).caps, ['fast_unprotected']);
});

test('incomplete or invalid audits are rejected', () => {
  const { lighting, ...partial } = best;
  assert.equal(isComplete(partial), false);
  assert.throws(() => score(partial), /lighting/);
  assert.throws(() => score({ ...best, markings: 'sparkly' }), /markings/);
});

test('Overpass query and parsing link crossings to the nearest school', () => {
  const q = buildQuery([37.97, 23.72, 37.99, 23.74], 150);
  assert.match(q, /around\.schools:150/);
  assert.match(q, /37\.97000,23\.72000,37\.99000,23\.74000/);
  const { schools, crossings } = parseOverpass({ elements: [
    { type: 'way', id: 1, center: { lat: 37.98, lon: 23.73 }, tags: { amenity: 'school', name: '1ο Δημοτικό' } },
    { type: 'node', id: 2, lat: 37.99, lon: 23.74, tags: { amenity: 'kindergarten' } },
    { type: 'node', id: 3, lat: 37.9805, lon: 23.73, tags: { highway: 'crossing', crossing: 'zebra' } },
  ] });
  assert.equal(schools.length, 2);
  assert.equal(crossings[0].school.name, '1ο Δημοτικό');
  assert.ok(Math.abs(crossings[0].schoolDistance - 56) <= 1);
});

test('distance is about 111 km per degree of latitude', () => {
  const d = distanceMetres({ lat: 37, lon: 23 }, { lat: 38, lon: 23 });
  assert.ok(Math.abs(d - 111195) < 50);
});

test('OSM hints are translated and unknown tags are ignored', () => {
  const hints = osmHints({ crossing: 'zebra', tactile_paving: 'no', traffic_calming: 'table', foo: 'bar' });
  assert.deepEqual(hints.map((h) => h.value), ['ζέβρα', 'υπερυψωμένη', 'όχι']);
});

test('importer recomputes the grade and rejects bad records', () => {
  const input = { osm_node: 42, lat: 37.98, lon: 23.73, date: '2026-11-16', answers: worst, grade: 'A', points: 100 };
  const f = toFeature(input, { authority: 'Δήμος Αθηναίων' });
  assert.equal(f.properties.grade, 'F');
  assert.equal(f.properties.authority, 'Δήμος Αθηναίων');
  assert.deepEqual(f.geometry.coordinates, [23.73, 37.98]);
  assert.throws(() => toFeature({ ...input, lat: 51.5, lon: -0.1 }), /outside Greece/);
  assert.throws(() => toFeature({ ...input, date: '16/11/2026' }), /date/);
});
