# Managing the project

## Operating loop

```
map every school crossing  ->  audit  ->  publish grade  ->  report to owner (protocol no.)
        ^                                                             |
        |                                                             v
   re-audit after fix  <-  record fix, thank the service  <-  follow up, escalate
```

Everything the project does should move a crossing one step around this loop.

## Roles (one person can hold several at the start)

| Role | Does |
|---|---|
| Coordinator | Sets priorities, speaks for the project, keeps the fairness rules |
| Data steward | Reviews submitted audits, runs `scripts/add_audit.mjs`, keeps the authority register |
| School ambassadors | One parent or teacher per school: audits its crossings twice a year, co-signs requests |
| Municipal liaison | Files requests, tracks protocol numbers and replies, attends council meetings |
| Technical adviser | A transport engineer who sanity-checks the method and the worst cases (volunteer or partner organisation) |

## Rhythm

| When | What |
|---|---|
| September, first two school weeks | Full audit round: paint is at its worst after summer and attention is at its peak |
| October | Requests filed; first municipal report cards |
| January | Follow-ups; statutory reply periods have expired |
| March to April | Second audit round |
| May | Annual report and league table, timed with the spring Streets for Kids action |
| Monthly | 30-minute review of open cases: what moved, what is stuck, who chases |

## Data

- **Crossings and schools** come live from OpenStreetMap. Fix errors at the source (add a
  missing crossing or school in OSM) so everyone benefits.
- **Audits** live in `data/audits.geojson`, one feature per audit, answers included. Git history
  is the audit trail.
- **Submissions** arrive as GitHub issues labelled `audit`; the data steward checks the photos
  against the answers and imports. This is deliberately manual for the pilot. When volume passes
  a few dozen a month, move to a form with a small backend and a moderation queue.
- **Authority register**: keep a simple table per municipality (owner service, protocol email,
  deputy mayors, council meeting dates). Start it in the pilot municipality.

## Quality rules

- A grade below C is published only with photos and a dated audit.
- Two independent audits before a crossing is named in press material.
- Scores are always recomputed from answers by the importer; nobody types a grade.
- Every published claim about an authority links to the request, its protocol number and the reply.

## Pilot before scale

Pick **one municipal community with 10 to 15 schools**, ideally where a parents' association is
already keen. Success for the pilot, within one school term:

1. every school crossing in the area audited;
2. requests filed for every crossing below C;
3. at least one visible fix, with a before and after photo;
4. one council discussion or written commitment.

Only then recruit the next area. A map with 40 well-documented crossings and two fixes persuades
more than a map with 4,000 grey dots.

## Money and legal form

The pilot needs almost nothing: hosting is free, the domain is about €15 a year. If the project
grows, the choices are to stay an informal citizens' initiative hosted by a partner organisation,
or to register as a non-profit (ΑΜΚΕ or σωματείο) so it can sign agreements with municipalities
and receive grants. Decide after the pilot. Keep independence from any body the project rates:
accept data and cooperation from municipalities and sponsors, not editorial input.
