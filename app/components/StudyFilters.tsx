'use client';

import { useState } from 'react';
import { Filter, RotateCcw, ChevronDownIcon } from 'lucide-react';

export interface StudyTypeOption {
  value: string;
  label: string;
}

export interface StudyFiltersProps {
  studyTypeOptions: StudyTypeOption[];
  selectedStudyTypes: string[];
  onToggleStudyType: (value: string) => void;
  availablePopulations: string[];
  // null means "all populations selected" (the default / unfiltered state).
  selectedPopulations: string[] | null;
  onTogglePopulation: (value: string) => void;
  // Bulk select/deselect (used by the group parent checkboxes).
  onSetPopulations: (values: string[], selected: boolean) => void;
  onReset: () => void;
  filteredCount: number;
  totalCount: number;
}

// Two-level population grouping. Each group's `umbrella` token(s) (e.g. a study
// tagged simply "Maternal") are folded into the parent checkbox, so the parent
// acts as select-all over the umbrella + every child present. Synonyms cover the
// raw cache vocabulary and the normalized names the Overview bars use.
const POPULATION_GROUPS: Array<{ label: string; umbrella: string[]; children: string[] }> = [
  {
    label: 'Maternal',
    umbrella: ['Maternal'],
    children: [
      'Preconception/Fertility',
      'Pregnant', 'Pregnancy',
      'Peripartum', 'Labor',
      'Postpartum',
      'Lactation',
      'Adverse Pregnancy Outcome',
    ],
  },
  {
    label: 'Pediatric',
    umbrella: ['Pediatric'],
    children: [
      'Fetal', 'Fetus',
      'Neonatal', 'Neonate', 'Newborn', 'Premature',
      'Infant',
      'Child',
      'Adolescent',
    ],
  },
];

const GROUPED_NAMES = new Set(
  POPULATION_GROUPS.flatMap((group) => [...group.umbrella, ...group.children])
);

// A live, client-side filter bar shown above the result tabs. It narrows the
// already-fetched study rows by study type (PK/PE/CT) and population; every
// downstream view (Overview counts/charts, Publication, Author Network, Word
// Cloud) re-derives from the filtered set. No re-query happens on toggle.
//
// The panel is collapsible (collapsed by default) to keep the results area
// roomy; the status line and Reset stay in the header so an active filter is
// always visible even while collapsed.
export default function StudyFilters({
  studyTypeOptions,
  selectedStudyTypes,
  onToggleStudyType,
  availablePopulations,
  selectedPopulations,
  onTogglePopulation,
  onSetPopulations,
  onReset,
  filteredCount,
  totalCount,
}: StudyFiltersProps) {
  const [expanded, setExpanded] = useState(false);

  // Nothing to filter until study rows have loaded.
  if (totalCount === 0) return null;

  const available = new Set(availablePopulations);
  const isPopulationChecked = (population: string) =>
    selectedPopulations === null || selectedPopulations.includes(population);

  // Build the visible groups from whatever populations are present.
  const groups = POPULATION_GROUPS.map((group) => {
    const umbrella = group.umbrella.filter((name) => available.has(name));
    const children = group.children.filter((name) => available.has(name));
    const members = [...umbrella, ...children];
    return { label: group.label, children, members };
  }).filter((group) => group.members.length > 0);

  // Anything present but not covered by a group is shown flat under "Other".
  const otherPopulations = availablePopulations.filter((name) => !GROUPED_NAMES.has(name));

  const allStudyTypes = selectedStudyTypes.length === studyTypeOptions.length;
  const allPopulations = selectedPopulations === null;
  const isFiltering = !allStudyTypes || !allPopulations;

  return (
    <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50">
      {/* Header (always visible, toggles the body) */}
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 px-4 py-2 text-left"
      >
        <ChevronDownIcon
          className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
        />
        <span className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <Filter className="h-4 w-4 text-gray-500" />
          Filters
        </span>
        {isFiltering && !expanded && (
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
            active
          </span>
        )}

        <span className="ml-auto flex items-center gap-3 text-xs text-gray-500">
          <span>
            {isFiltering ? (
              <>
                Showing <span className="font-semibold text-gray-700">{filteredCount}</span> of{' '}
                {totalCount} publications
              </>
            ) : (
              <>{totalCount} publications</>
            )}
          </span>
          {isFiltering && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onReset();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation();
                  onReset();
                }
              }}
              className="flex items-center gap-1 rounded px-2 py-1 text-blue-600 hover:bg-blue-50 hover:text-blue-700 transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </span>
          )}
        </span>
      </button>

      {/* Body */}
      {expanded && (
        <div className="space-y-2 border-t border-gray-200 px-4 py-2.5 text-[13px]">
          {/* Study type */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Study type
            </span>
            {studyTypeOptions.map((option) => (
              <label
                key={option.value}
                className="flex items-center gap-1 text-gray-700"
                title={option.label}
              >
                <input
                  type="checkbox"
                  checked={selectedStudyTypes.includes(option.value)}
                  onChange={() => onToggleStudyType(option.value)}
                  className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span>{option.value}</span>
              </label>
            ))}
          </div>

          {/* Population (hierarchical, inline groups) */}
          {(groups.length > 0 || otherPopulations.length > 0) && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Population
              </span>
              {groups.map((group) => {
                const allOn = group.members.every(isPopulationChecked);
                const noneOn = group.members.every((m) => !isPopulationChecked(m));
                const indeterminate = !allOn && !noneOn;
                return (
                  <div
                    key={group.label}
                    className="flex flex-wrap items-center gap-x-2.5 gap-y-1 border-l border-gray-200 pl-3 first-of-type:border-l-0 first-of-type:pl-0"
                  >
                    {/* Parent (select-all) */}
                    <label className="flex items-center gap-1 font-medium text-gray-800">
                      <input
                        type="checkbox"
                        checked={allOn}
                        ref={(el) => {
                          if (el) el.indeterminate = indeterminate;
                        }}
                        onChange={() => onSetPopulations(group.members, !allOn)}
                        className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>{group.label}</span>
                    </label>
                    {/* Children */}
                    {group.children.map((population) => (
                      <label
                        key={population}
                        className="flex items-center gap-1 text-gray-600"
                      >
                        <input
                          type="checkbox"
                          checked={isPopulationChecked(population)}
                          onChange={() => onTogglePopulation(population)}
                          className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span>{population}</span>
                      </label>
                    ))}
                  </div>
                );
              })}

              {/* Other (ungrouped) */}
              {otherPopulations.length > 0 && (
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 border-l border-gray-200 pl-3">
                  <span className="font-medium text-gray-800">Other</span>
                  {otherPopulations.map((population) => (
                    <label
                      key={population}
                      className="flex items-center gap-1 text-gray-600"
                    >
                      <input
                        type="checkbox"
                        checked={isPopulationChecked(population)}
                        onChange={() => onTogglePopulation(population)}
                        className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>{population}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
