// Δείκτης Σχολικής Διάβασης — scoring model.
// Single source of truth: the audit form, the map colours, the CLI importer
// and docs/rating-method.md all follow this file.
// Works in the browser (ES module) and in Node.

export const MODEL_VERSION = '0.1';

// Each criterion: id, Greek label, max points and its options (value -> points).
export const SECTIONS = [
  {
    id: 'street',
    label: 'Ταχύτητα & δρόμος',
    criteria: [
      {
        id: 'speed_limit', label: 'Όριο ταχύτητας στον δρόμο της διάβασης',
        options: [
          ['le20', 'Έως 20 χλμ/ώ ή πεζόδρομος / σχολικός δρόμος', 10],
          ['30', '30 χλμ/ώ', 8],
          ['40', '40 χλμ/ώ', 3],
          ['ge50', '50 χλμ/ώ ή περισσότερο', 0],
        ],
      },
      {
        id: 'calming', label: 'Μέτρα μείωσης ταχύτητας',
        options: [
          ['raised', 'Υπερυψωμένη διάβαση', 10],
          ['near', 'Σαμαράκι / στένωση / οφιοειδής χάραξη σε απόσταση έως 50 μ.', 7],
          ['none', 'Κανένα', 0],
        ],
      },
      {
        id: 'lanes', label: 'Λωρίδες που διασχίζει το παιδί χωρίς στάση',
        options: [
          ['1', 'Μία', 8],
          ['2', 'Δύο', 5],
          ['3_refuge', 'Τρεις ή περισσότερες, με νησίδα στη μέση', 3],
          ['3_plain', 'Τρεις ή περισσότερες, χωρίς νησίδα', 0],
        ],
      },
      {
        id: 'school_street', label: 'Σχολικός δρόμος (χωρίς αυτοκίνητα τις ώρες του σχολείου)',
        options: [
          ['yes', 'Ναι, μόνιμα ή τις ώρες προσέλευσης/αποχώρησης', 7],
          ['no', 'Όχι', 0],
        ],
      },
    ],
  },
  {
    id: 'crossing',
    label: 'Η διάβαση',
    criteria: [
      {
        id: 'markings', label: 'Διαγράμμιση',
        options: [
          ['clear', 'Καθαρή, φαίνεται από μακριά', 8],
          ['faded', 'Ξεθωριασμένη', 4],
          ['none', 'Δεν υπάρχει ή δεν φαίνεται', 0],
        ],
      },
      {
        id: 'signs', label: 'Πινακίδες (διάβαση πεζών & προειδοποίηση για σχολείο)',
        options: [
          ['both', 'Και οι δύο', 4],
          ['one', 'Μόνο η μία', 2],
          ['none', 'Καμία', 0],
        ],
      },
      {
        id: 'sightlines', label: 'Ορατότητα: τα 5 μ. πριν τη διάβαση είναι ελεύθερα',
        options: [
          ['clear', 'Ελεύθερα (χωρίς στάθμευση, κάδους, φυτά)', 6],
          ['partial', 'Εν μέρει κρυμμένη', 3],
          ['blocked', 'Το παιδί δεν φαίνεται πριν πατήσει στον δρόμο', 0],
        ],
      },
      {
        id: 'lighting', label: 'Φωτισμός πάνω στη διάβαση',
        options: [['yes', 'Ναι', 3], ['no', 'Όχι', 0]],
      },
      {
        id: 'protection', label: 'Προστασία τις ώρες του σχολείου',
        options: [
          ['yes', 'Φανάρι με φάση πεζών, σχολικός τροχονόμος ή κλειστός δρόμος', 4],
          ['no', 'Τίποτα', 0],
        ],
      },
    ],
  },
  {
    id: 'access',
    label: 'Προσβασιμότητα',
    criteria: [
      {
        id: 'ramps', label: 'Ράμπες ή ισόπεδη σύνδεση με το πεζοδρόμιο',
        options: [
          ['both', 'Και στις δύο πλευρές', 8],
          ['one', 'Μόνο στη μία', 3],
          ['none', 'Σε καμία', 0],
        ],
      },
      {
        id: 'tactile', label: 'Οδηγός όδευσης τυφλών / πλάκες προειδοποίησης',
        options: [
          ['both', 'Και στις δύο πλευρές', 5],
          ['one', 'Μόνο στη μία', 2],
          ['none', 'Σε καμία', 0],
        ],
      },
      {
        id: 'footway', label: 'Ελεύθερο πλάτος πεζοδρομίου τουλάχιστον 1,5 μ. ως τη διάβαση',
        options: [
          ['both', 'Και στις δύο πλευρές', 6],
          ['one', 'Μόνο στη μία', 3],
          ['none', 'Σε καμία', 0],
        ],
      },
      {
        id: 'obstacles', label: 'Ράμπες και χώρος αναμονής χωρίς εμπόδια',
        options: [
          ['clear', 'Ελεύθερα', 4],
          ['blocked', 'Κολώνες, κάδοι, οχήματα ή άλλα εμπόδια', 0],
        ],
      },
      {
        id: 'surface', label: 'Ομαλή επιφάνεια, χωρίς λακκούβες και νερά',
        options: [['yes', 'Ναι', 2], ['no', 'Όχι', 0]],
      },
    ],
  },
  {
    id: 'upkeep',
    label: 'Συντήρηση & λειτουργία',
    criteria: [
      {
        id: 'parking', label: 'Παράνομη στάθμευση πάνω στη διάβαση ή στις γωνίες (τη στιγμή του ελέγχου)',
        options: [
          ['none', 'Καμία', 5],
          ['some', 'Ένα όχημα / εν μέρει', 2],
          ['blocked', 'Η διάβαση είναι κλεισμένη', 0],
        ],
      },
      {
        id: 'equipment', label: 'Πινακίδες, φανάρια, κολωνάκια σε καλή κατάσταση',
        options: [['yes', 'Ναι', 3], ['no', 'Όχι / λείπουν', 0]],
      },
      {
        id: 'roadway', label: 'Οδόστρωμα στη διάβαση χωρίς φθορές',
        options: [['yes', 'Ναι', 3], ['no', 'Όχι', 0]],
      },
      {
        id: 'gate_route', label: 'Συνεχές, ασφαλές πεζοδρόμιο από τη διάβαση ως την πύλη του σχολείου',
        options: [['yes', 'Ναι', 4], ['no', 'Όχι', 0]],
      },
    ],
  },
];

// Critical failures: a crossing with one of these cannot score above grade D,
// whatever else is good about it.
export const CAPS = [
  {
    id: 'no_ramps', label: 'Καμία ράμπα: η διάβαση δεν είναι προσβάσιμη',
    test: (a) => a.ramps === 'none',
  },
  {
    id: 'fast_unprotected', label: 'Όριο 50+ χλμ/ώ χωρίς κανένα μέτρο μείωσης ταχύτητας',
    test: (a) => a.speed_limit === 'ge50' && a.calming === 'none',
  },
  {
    id: 'no_markings', label: 'Δεν υπάρχει ορατή διαγράμμιση',
    test: (a) => a.markings === 'none',
  },
];

export const GRADES = [
  { grade: 'A', min: 85, stars: 5, color: '#1a7f4b', label: 'Υποδειγματική' },
  { grade: 'B', min: 70, stars: 4, color: '#6aa329', label: 'Καλή' },
  { grade: 'C', min: 55, stars: 3, color: '#d4a40c', label: 'Αποδεκτή (ελάχιστο)' },
  { grade: 'D', min: 40, stars: 2, color: '#e07b1a', label: 'Ανεπαρκής' },
  { grade: 'E', min: 25, stars: 1, color: '#d1442b', label: 'Επικίνδυνη' },
  { grade: 'F', min: 0, stars: 1, color: '#8f1d1d', label: 'Απαράδεκτη' },
];
const CAP_SCORE = 54; // top of grade D

export const ALL_CRITERIA = SECTIONS.flatMap((s) => s.criteria);
export const MAX_SCORE = ALL_CRITERIA.reduce(
  (sum, c) => sum + Math.max(...c.options.map((o) => o[2])), 0);

export function gradeFor(points) {
  return GRADES.find((g) => points >= g.min);
}

// answers: { criterionId: optionValue }. Throws if an answer is missing or unknown,
// so a half-filled audit can never be published with a score.
export function score(answers) {
  let raw = 0;
  const sections = {};
  for (const section of SECTIONS) {
    let got = 0;
    let max = 0;
    for (const c of section.criteria) {
      const value = answers[c.id];
      const option = c.options.find((o) => o[0] === value);
      if (!option) throw new Error(`Missing or invalid answer for "${c.id}"`);
      got += option[2];
      max += Math.max(...c.options.map((o) => o[2]));
    }
    sections[section.id] = { points: got, max };
    raw += got;
  }
  const caps = CAPS.filter((c) => c.test(answers)).map((c) => c.id);
  const points = caps.length ? Math.min(raw, CAP_SCORE) : raw;
  const g = gradeFor(points);
  return { model: MODEL_VERSION, raw, points, max: MAX_SCORE, grade: g.grade, stars: g.stars, caps, sections };
}

export function isComplete(answers) {
  return ALL_CRITERIA.every((c) => c.options.some((o) => o[0] === answers[c.id]));
}
