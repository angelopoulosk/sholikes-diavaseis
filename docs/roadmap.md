# Roadmap

## Now (in this repository)

- Map of schools and the crossings within 150 m of them, live from OpenStreetMap
- 18-question audit with A to F grade, submitted as a GitHub issue
- Importer that recomputes scores, with tests
- Standards, rating method, accountability, management, promotion and coalition notes

## Next

1. **Pilot area**: choose the municipal community and audit it.
2. **Authority register**: `data/authorities.json` with the owner service and protocol contact per municipality, shown in the crossing panel.
3. **Schools with no crossing** within 150 m as their own layer.
4. **Photos** stored with each audit and shown in the panel.
5. **School and municipality pages**: report card per school, league table per municipality.
6. **Easier submission**: a form with a small backend and moderation, so parents do not need a GitHub account.
7. **Collision overlay** from [greece-road-collisions](https://github.com/angelopoulosk/greece-road-collisions): recorded collisions within 150 m of each school.
8. **Offline snapshot** of the OSM data so the map does not depend on the public Overpass servers.

## Later

- Measured speeds at the worst sites
- Formal iRAP Star Rating for Schools assessments with a partner
- English interface
- Annual report

## Decisions still open

- Licence for code and for the audit data (suggestion: MIT for code, ODbL-compatible open licence for data)
- Domain name
- Whether auditors are named or anonymous
- Legal form after the pilot
