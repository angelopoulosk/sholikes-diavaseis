import test from 'node:test';
import assert from 'node:assert/strict';
import { SECTIONS, ALL_CRITERIA, MAX_SCORE, score, isComplete } from '../js/rating.js';
import { buildQuery, parseOverpass, distanceMetres, osmHints, classify } from '../js/osm.js';
import { toFeature } from '../scripts/add_audit.mjs';
import { buildSnapshot, placesQuery, crossingsQuery } from '../js/snapshot.js';

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
  assert.match(q, /around\.places:150/);
  assert.match(q, /\.pre out tags geom;/);
  assert.match(q, /\.crossings out body;/);
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

test('snapshot keeps crossings within the radius of a place outline, with their nearest place', () => {
  const square = [[37.98, 23.73], [37.981, 23.73], [37.981, 23.731], [37.98, 23.731], [37.98, 23.73]]
    .map(([lat, lon]) => ({ lat, lon }));
  const places = [
    { type: 'way', id: 1, bounds: { minlat: 37.98, minlon: 23.73, maxlat: 37.981, maxlon: 23.731 }, geometry: square, tags: { amenity: 'school', name: '1ο Δημοτικό' } },
    { type: 'node', id: 2, lat: 37.99, lon: 23.74, tags: { amenity: 'kindergarten', name: 'Παιδικός Σταθμός' } },
    { type: 'way', id: 1, bounds: { minlat: 37.98, minlon: 23.73, maxlat: 37.981, maxlon: 23.731 }, geometry: square, tags: { amenity: 'school', name: '1ο Δημοτικό' } },
  ];
  const node = (id, lat, lon, tags = {}) => ({ type: 'node', id, lat, lon, tags: { highway: 'crossing', ...tags } });
  const crossings = [
    node(10, 37.9795, 23.7305, { crossing: 'zebra', source: 'survey' }), // 56 m south of the school edge
    node(11, 37.9805, 23.7305), // inside the grounds: distance is to the nearest edge
    node(12, 37.9775, 23.7305), // 278 m away
    node(13, 37.9905, 23.74), // 56 m from the σταθμός
    node(10, 37.9795, 23.7305), // duplicate from an overlapping tile
  ];
  const snap = buildSnapshot(places, crossings, { bbox: [37.6, 23.3, 38.4, 24.15], radius: 150, generated: '2026-11-16' });
  assert.deepEqual(snap.schools.map((s) => [s.id, s.cat, Boolean(s.ring)]),
    [['way/1', 'school', true], ['node/2', 'stathmos_private', false]]);
  assert.deepEqual(snap.crossings.map((c) => [c.id, c.s, c.d]), [[10, 0, 56], [11, 0, 44], [13, 1, 56]]);
  assert.deepEqual(snap.crossings[0].tags, { crossing: 'zebra' });
  assert.match(placesQuery([37.6, 23.3, 38.4, 24.15]), /out tags geom;/);
  assert.match(crossingsQuery([37.6, 23.3, 38.4, 24.15]), /out body;/);
});

test('places are sorted into schools, νηπιαγωγεία and public or private σταθμούς', () => {
  const kind = (tags) => classify(tags);
  assert.equal(kind({ amenity: 'school', name: '5ο Γυμνάσιο' }), 'school');
  assert.equal(kind({ amenity: 'kindergarten', name: '85ο Νηπιαγωγείο Αθηνών' }), 'nipiagogeio');
  assert.equal(kind({ amenity: 'kindergarten' }), 'nipiagogeio');
  assert.equal(kind({ amenity: 'kindergarten', name: 'Παιδικός Σταθμός Τα Αστεράκια' }), 'stathmos_private');
  assert.equal(kind({ amenity: 'kindergarten', name: 'ΒΡΕΦΟΝΗΠΙΑΚΟΣ ΣΤΑΘΜΟΣ' }), 'stathmos_private');
  assert.equal(kind({ amenity: 'childcare', name: 'Little Stars' }), 'stathmos_private');
  assert.equal(kind({ amenity: 'kindergarten', name: 'Δημοτικός Παιδικός Σταθμός Κυψέλης' }), 'stathmos_public');
  assert.equal(kind({ amenity: 'childcare', 'operator:type': 'public' }), 'stathmos_public');
  assert.equal(kind({ amenity: 'kindergarten', name: '10ος Βρεφονηπιακός Σταθμός' }), 'stathmos_public');
  assert.equal(kind({ amenity: 'kindergarten', name: '10ο Νηπιαγωγείο' }), 'nipiagogeio');
  assert.equal(kind({ amenity: 'kindergarten', name: 'Ιδιωτικός Παιδικός Σταθμός Δήμου 12' }), 'stathmos_private');
});

test('a pre-school mapped as a closed way keeps its outline, a node does not', () => {
  const { schools } = parseOverpass({ elements: [
    { type: 'way', id: 9, bounds: { minlat: 37.98, minlon: 23.73, maxlat: 37.981, maxlon: 23.731 },
      geometry: [{ lat: 37.98, lon: 23.73 }, { lat: 37.981, lon: 23.73 }, { lat: 37.981, lon: 23.731 }, { lat: 37.98, lon: 23.73 }],
      tags: { amenity: 'kindergarten', name: '3ο Νηπιαγωγείο' } },
    { type: 'node', id: 10, lat: 37.99, lon: 23.74, tags: { amenity: 'childcare' } },
  ] });
  assert.equal(schools[0].ring.length, 4);
  assert.deepEqual(schools[0].ring[0], [23.73, 37.98]);
  assert.ok(Math.abs(schools[0].lat - 37.9805) < 1e-9);
  assert.deepEqual([schools[1].cat, schools[1].name, schools[1].ring], ['stathmos_private', 'Ιδιωτικός παιδικός σταθμός', undefined]);
});
