# Rating method: Δείκτης Σχολικής Διάβασης

Version 0.1. The scoring code is [`js/rating.js`](../js/rating.js); if this page and the code
disagree, the code is right and this page needs fixing.

## What is rated

A **school crossing** is any pedestrian crossing within 150 m of a school or kindergarten
(OpenStreetMap `highway=crossing` near `amenity=school|kindergarten`). The auditor stands at the
crossing, ideally at drop-off or pick-up time, and answers 18 multiple-choice questions. It takes
about three minutes and needs no tools.

## Points

| Section | Points | Criteria |
|---|---|---|
| Street and speed | 35 | Speed limit (10), traffic calming (10), lanes crossed in one go (8), school street (7) |
| The crossing | 25 | Markings (8), sight lines 5 m before the crossing (6), signs (4), protection at school hours (4), lighting (3) |
| Accessibility | 25 | Kerb ramps (8), clear footway of 1.5 m (6), tactile paving (5), no obstacles (4), even surface (2) |
| Upkeep and operation | 15 | Illegal parking at audit time (5), safe footway to the school gate (4), equipment intact (3), road surface (3) |

Speed and street design carry the most weight because impact speed is what decides whether a
child survives a mistake, theirs or a driver's.

## Grades

| Grade | Points | Stars | Meaning |
|---|---|---|---|
| A | 85 to 100 | 5 | Exemplary |
| B | 70 to 84 | 4 | Good |
| **C** | 55 to 69 | 3 | **Acceptable: the minimum** |
| D | 40 to 54 | 2 | Inadequate |
| E | 25 to 39 | 1 | Dangerous |
| F | 0 to 24 | 1 | Unacceptable |

The pass mark of C, three stars, deliberately mirrors iRAP's "3 stars or better" target so the
public message is the same one used internationally. The numbers are not comparable to an iRAP
score, which uses measured speeds and traffic flows.

## Critical failures

Three conditions cap a crossing at grade D (54 points) whatever else it scores:

- no kerb ramp on either side (it is not accessible);
- a limit of 50 km/h or more with no traffic calming;
- no visible markings.

Without the cap, a freshly painted, well-lit crossing on a fast road could average its way to a
pass. The cap keeps the grade honest.

## Known limits, and how to tighten them

- **One person, one moment.** Parking and guard presence change by the hour. Record the time, and
  prefer school hours. Two independent audits per crossing before publishing a grade below C is a
  good rule once there are enough volunteers.
- **Signed speed is not real speed.** Add measured speeds later (a phone radar app or a count
  from video) for the worst sites.
- **Weights are judgement.** They follow the logic of the international sources but have not been
  calibrated against crash data. A natural test is the sister project
  [greece-road-collisions](https://github.com/angelopoulosk/greece-road-collisions): check
  whether low-graded crossings sit near recorded collisions, and adjust.
- **Missing crossings.** A school with no crossing at all within 150 m does not appear as a dot.
  This is arguably the worst case and needs its own layer (see roadmap).

Any change to weights or caps bumps `MODEL_VERSION`, and every audit stores the answers, not just
the grade, so old audits can be rescored.
