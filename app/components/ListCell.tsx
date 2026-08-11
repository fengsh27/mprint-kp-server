'use client';

import { useEffect, useMemo, useState } from 'react';
import { X, Search } from 'lucide-react';

// Several publication-table columns hold a " / "-joined list that is far longer
// than the cell can show: StudiedDrugs averages ~16 items (max 114) and
// StudiedDiseases can reach 1,580. A plain `title` tooltip is not enough for
// those, so the cell shows what fits, then a "+N more" button that opens a
// searchable dialog with the full list.

const SEPARATOR = ' / ';

// Cap for the hover tooltip. The dialog is the place for the full list; a
// native tooltip with hundreds of lines is unusable and clips anyway.
const TOOLTIP_MAX_ITEMS = 25;

// Show the filter box once scanning the list by eye stops being practical.
const FILTER_THRESHOLD = 15;

export function splitList(value: string | null | undefined): string[] {
  return (value || '')
    .split(SEPARATOR)
    .map((item) => item.trim())
    .filter(Boolean);
}

// Greedily take items while they fit the cell's rough character budget. Always
// keeps at least one item so a single very long value still renders something.
function fitItems(items: string[], budget: number): string[] {
  const shown: string[] = [];
  let used = 0;
  for (const item of items) {
    const cost = item.length + (shown.length > 0 ? SEPARATOR.length : 0);
    if (shown.length > 0 && used + cost > budget) break;
    shown.push(item);
    used += cost;
  }
  return shown;
}

function tooltipFor(items: string[]): string {
  // One item per line: `title` honours newlines, and a 365-character single
  // line is the thing we are trying to get away from.
  const head = items.slice(0, TOOLTIP_MAX_ITEMS).join('\n');
  const rest = items.length - TOOLTIP_MAX_ITEMS;
  return rest > 0 ? `${head}\n…and ${rest} more` : head;
}

export type ListDialogState = {
  columnName: string;
  rowTitle: string;
  items: string[];
};

export interface ListCellProps {
  value: string | null | undefined;
  // Rough character budget for the cell, sized from the column width and the
  // 80px row height. Tuned per column by the caller.
  budget: number;
  columnName: string;
  rowTitle: string;
  onExpand: (state: ListDialogState) => void;
}

export function ListCell({ value, budget, columnName, rowTitle, onExpand }: ListCellProps) {
  const items = splitList(value);
  if (items.length === 0) return null;

  const shown = fitItems(items, budget);
  const hidden = items.length - shown.length;

  return (
    <div className="break-words" title={tooltipFor(items)}>
      {shown.join(SEPARATOR)}
      {hidden > 0 && (
        <>
          {' '}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onExpand({ columnName, rowTitle, items });
            }}
            className="whitespace-nowrap rounded px-1 text-blue-600 underline decoration-dotted underline-offset-2 hover:bg-blue-50 hover:text-blue-700"
          >
            +{hidden} more
          </button>
        </>
      )}
    </div>
  );
}

export interface ListDialogProps {
  state: ListDialogState | null;
  onClose: () => void;
}

// Modal listing the full contents of a cell. Follows the same hand-rolled
// pattern as the FDA label drawer in DrugTab (backdrop + role="dialog"), with
// Escape-to-close added.
export function ListDialog({ state, onClose }: ListDialogProps) {
  const [filter, setFilter] = useState('');

  // Reset the filter whenever a different cell is opened.
  useEffect(() => {
    setFilter('');
  }, [state]);

  useEffect(() => {
    if (!state) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [state, onClose]);

  const visible = useMemo(() => {
    if (!state) return [];
    const needle = filter.trim().toLowerCase();
    if (!needle) return state.items;
    return state.items.filter((item) => item.toLowerCase().includes(needle));
  }, [state, filter]);

  if (!state) return null;

  const showFilter = state.items.length >= FILTER_THRESHOLD;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={state.columnName}
        className="relative flex max-h-[80vh] w-full max-w-lg flex-col rounded-lg bg-white shadow-xl"
      >
        <div className="flex items-start justify-between border-b border-gray-200 p-4">
          <div className="pr-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {state.columnName}{' '}
              <span className="text-sm font-normal text-gray-500">({state.items.length})</span>
            </h3>
            {state.rowTitle && (
              <p className="mt-0.5 line-clamp-2 text-sm text-gray-500">{state.rowTitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {showFilter && (
          <div className="border-b border-gray-200 px-4 py-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                autoFocus
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder={`Filter ${state.items.length} items…`}
                className="w-full rounded border border-gray-300 py-1 pl-8 pr-3 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4">
          {visible.length === 0 ? (
            <p className="text-sm text-gray-500">No items match “{filter}”.</p>
          ) : (
            <ul className="space-y-1 text-sm text-gray-800">
              {visible.map((item, i) => (
                <li key={`${item}-${i}`} className="break-words">
                  {item}
                </li>
              ))}
            </ul>
          )}
        </div>

        {showFilter && filter.trim() && (
          <div className="border-t border-gray-200 px-4 py-2 text-xs text-gray-500">
            Showing {visible.length} of {state.items.length}
          </div>
        )}
      </div>
    </div>
  );
}
