# Σχολικές Διαβάσεις

**Κάθε παιδί να περνάει απέναντι με ασφάλεια.**

Χάρτης και αξιολόγηση των διαβάσεων πεζών γύρω από τα σχολεία: πόσο ασφαλείς και προσβάσιμες
είναι, σε τι κατάσταση βρίσκονται και ποιος είναι υπεύθυνος να τις συντηρεί.

A civic project that maps every pedestrian crossing near a school, grades it against
international standards, publishes its condition and names the body responsible for keeping it up.

## What is here

| | |
|---|---|
| [`index.html`](index.html) | The map (MapLibre GL JS on OpenFreeMap tiles). School grounds are highlighted in yellow from the base map's vector tiles; the crossings within 150 m of each school come live from OpenStreetMap and are coloured by grade. Click a crossing to see or submit an audit. |
| [`js/rating.js`](js/rating.js) | The scoring model: 18 questions, 100 points, grades A to F, minimum pass C (3 stars). |
| [`data/audits.geojson`](data/audits.geojson) | Published audits. Empty until the pilot starts. |
| [`docs/standards.md`](docs/standards.md) | International and Greek standards for school crossings |
| [`docs/rating-method.md`](docs/rating-method.md) | How a crossing is graded, and the method's limits |
| [`docs/accountability.md`](docs/accountability.md) | Who is responsible, and the escalation ladder |
| [`docs/management.md`](docs/management.md) | Roles, yearly rhythm, pilot plan |
| [`docs/promotion.md`](docs/promotion.md) | Message, tactics, calendar |
| [`docs/coalitions.md`](docs/coalitions.md) | Partners to approach and what to ask of each |
| [`docs/roadmap.md`](docs/roadmap.md) | Next steps and open decisions |
| [`docs/sources.md`](docs/sources.md) | Sources, and facts still to verify |

## Run it

No build step.

```sh
npm start        # serves the map at http://localhost:8000
npm test         # scoring, OSM parsing and importer tests
```

## Publish an audit

1. Someone submits an audit from the map; it arrives as a GitHub issue labelled `audit`.
2. Check the photos against the answers and save the JSON block as a file.
3. `node scripts/add_audit.mjs audit.json --authority "Δήμος …"`
4. Commit `data/audits.geojson`. The crossing changes colour on the map.

The importer recomputes the grade from the answers, so a grade can never be typed in by hand.

## Data and credit

Map data © OpenStreetMap contributors, ODbL. The grade is a citizens' audit and does not replace
a professional road safety assessment.
