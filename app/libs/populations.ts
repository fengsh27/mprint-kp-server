// Population hierarchy shared by the filter bar (StudyFilters) and the row
// filtering in home.tsx.
//
// Background on the source data (`new_population`): every study carries its
// parent tag *and* its sub-type tag. A study about infants is tagged both
// "Pediatric" and "Infant" — verified across the full table, a sub-type tag
// never appears without its parent (0 exceptions). So the bare parent token is
// redundant whenever a sub-type is present, and only carries information when
// the study has no sub-type at all: ~30.8k maternal and ~2.3k pediatric studies.
//
// Those studies have no token of their own in the data, so we synthesize one
// (`unspecified`) instead of exposing the bare parent token — which would
// otherwise match every study in the group and make the checkbox useless.

export type PopulationGroup = {
  label: string;
  // Raw parent tokens. Present on every study in the group, so these are
  // dropped during normalization rather than shown as their own option.
  umbrella: string[];
  // Raw sub-type tokens, ordered for display.
  children: string[];
  // Bar colour for this group's parent row in the Overview chart.
  color: string;
  // Bar colour shared by this group's sub-type rows.
  childColor: string;
  // Synthetic token for "in this group, but no sub-type stated".
  unspecified: string;
};

// Pediatric first, matching the order of the pre-built static cache
// (`population_data` in app/data/static_data.json).
export const POPULATION_GROUPS: PopulationGroup[] = [
  {
    label: 'Pediatric',
    umbrella: ['Pediatric'],
    // Ordered by developmental stage.
    children: ['Fetal', 'Neonatal', 'Infant', 'Child', 'Adolescent'],
    unspecified: 'Pediatric (unspecified)',
    color: '#fbbf24',
    childColor: '#60a5fa',
  },
  {
    label: 'Maternal',
    umbrella: ['Maternal'],
    // Ordered by stage of pregnancy rather than by frequency.
    children: [
      'Preconception/Fertility',
      'Pregnant',
      'Peripartum',
      'Postpartum',
      'Lactation',
    ],
    unspecified: 'Maternal (unspecified)',
    color: '#fbbf24',
    childColor: '#f87171',
  },
];

// Shown as its own category rather than under Maternal: it is an outcome, not a
// stage of pregnancy, and it cross-cuts the maternal stages (a study about it is
// also happening during pregnancy or peripartum). Keeping it out of the Maternal
// children also means it does not suppress "Maternal (unspecified)" — a study
// tagged only Maternal + this still has no maternal sub-type.
export const STANDALONE_POPULATIONS = ['Adverse Pregnancy Outcome'];

const STANDALONE_COLOR = '#f87171';

// Categories for the Overview population bar chart, in display order.
//
// This list is the query-driven counterpart of the pre-built `population_data`
// in app/data/static_data.json, which the landing page renders directly. The two
// must stay in step: before this existed, the chart showed a hardcoded list of
// eleven names, five of which ('Fetus', 'Premature', 'Newborn', 'Neonate',
// 'Labor') no longer exist in the data — so selecting a drug swapped 13 correct
// bars for 6 real ones plus 5 permanently empty ones, and silently dropped
// Adolescent, Peripartum, Lactation, Preconception/Fertility and APO.
//
// Parent rows are group totals: the parent tag is on every study in its group,
// so 'Pediatric' counts all pediatric studies, not just unspecified ones. That
// matches how the static cache counts them. The "(unspecified)" split exists
// only in the filter bar, which is asking a different question.
export const POPULATION_CHART_CATEGORIES: Array<{ name: string; color: string }> = [
  ...POPULATION_GROUPS.flatMap((group) => [
    { name: group.label, color: group.color },
    ...group.children.map((name) => ({ name, color: group.childColor })),
  ]),
  ...STANDALONE_POPULATIONS.map((name) => ({ name, color: STANDALONE_COLOR })),
];

// Chip label for the synthetic `unspecified` tokens. The group name is already
// the heading next to it, so the chip itself just reads "Unspecified".
export const UNSPECIFIED_LABEL = 'Unspecified';

// Hover definitions for the population filter.
//
// NOTE: these describe what each term conventionally means, not the rule the
// tagger actually applied. `new_population` is built outside this repo and its
// criteria are not documented here, so the age ranges below are the usual
// clinical conventions and should be reviewed by a domain expert before being
// treated as authoritative (see also the planned definitions page).
export const POPULATION_DEFINITIONS: Record<string, string> = {
  Pediatric: 'Any pediatric population, from before birth through adolescence.',
  Fetal: 'The unborn, from roughly 8 weeks of gestation until birth.',
  Neonatal: 'Newborns, from birth to about 28 days.',
  Infant: 'From about 28 days to 1 year old.',
  Child: 'From about 1 to 12 years old.',
  Adolescent: 'From about 13 to 18 years old.',

  Maternal: 'Any maternal population, before, during or after pregnancy.',
  'Preconception/Fertility':
    'The period before conception, including fertility and planning or trying to conceive.',
  Pregnant: 'During pregnancy, from conception to the onset of labor.',
  Peripartum: 'Around the time of birth, covering late pregnancy, labor and delivery.',
  Postpartum: 'After birth, usually the first six weeks.',
  Lactation: 'Breastfeeding and milk production.',
  'Adverse Pregnancy Outcome':
    'An adverse result of pregnancy, such as preterm birth, pre-eclampsia, stillbirth or low birth weight. An outcome rather than a stage, so it can overlap any of the stages above.',
};

// Tooltip for a population option. Falls back to the bare name for anything not
// in the table (the "Other" bucket), so unknown tags still get a sane title.
export function populationTooltip(name: string) {
  const definition = POPULATION_DEFINITIONS[name];
  return definition ? `${name} — ${definition}` : name;
}

export function unspecifiedTooltip(groupLabel: string) {
  return `${groupLabel}, unspecified — tagged ${groupLabel} but with no specific sub-population identified. Studies here may also be tagged under the other group.`;
}

const UMBRELLA_TO_GROUP = new Map<string, PopulationGroup>(
  POPULATION_GROUPS.flatMap((group) => group.umbrella.map((token) => [token, group] as const))
);

// Every token the filter bar knows how to place in a group.
export const GROUPED_POPULATION_NAMES = new Set([
  ...POPULATION_GROUPS.flatMap((group) => [group.unspecified, ...group.children]),
  ...STANDALONE_POPULATIONS,
]);

// Display order for tokens that aren't rendered by group (the "Other" bucket)
// and for the stable ordering of `availablePopulations`.
const POPULATION_ORDER = [
  ...POPULATION_GROUPS.flatMap((group) => [group.unspecified, ...group.children]),
  ...STANDALONE_POPULATIONS,
];

export function orderPopulations(populations: string[]) {
  return [...populations].sort((a, b) => {
    const ia = POPULATION_ORDER.indexOf(a);
    const ib = POPULATION_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

export function splitPopulationTokens(value: string | null | undefined) {
  return (value || '')
    .split(' / ')
    .map((token) => token.trim())
    .filter(Boolean);
}

// Replaces each bare parent token with either nothing (a sub-type is present, so
// the parent adds no information) or the group's synthetic `unspecified` token.
// All other tokens pass through untouched.
export function normalizePopulationTokens(tokens: string[]): string[] {
  const present = new Set(tokens);
  const result = new Set<string>();
  for (const token of tokens) {
    const group = UMBRELLA_TO_GROUP.get(token);
    if (!group) {
      result.add(token);
    } else if (!group.children.some((child) => present.has(child))) {
      result.add(group.unspecified);
    }
  }
  return [...result];
}

// Convenience for the two call sites that start from the raw " / "-joined string.
export function populationsOf(value: string | null | undefined) {
  return normalizePopulationTokens(splitPopulationTokens(value));
}
