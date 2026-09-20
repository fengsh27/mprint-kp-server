'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, ExternalLink, Search, X } from 'lucide-react';
import InfoPopover from './InfoPopover';
import { daGetAeEvidence, daGetAeSimilarDrugs, daGetAeSummary } from '../dataprovider/dataaccessor';
import type { ConceptRow } from '../libs/database/types';
import {
  AE_SOURCES,
  type AeEvidenceItem,
  type AeSimilarDrug,
  type AeSource,
  type AeSummary,
  type HighlightSegment,
} from '../libs/ae/types';

// "One drug, four evidence sources": for the selected drug, every adverse
// event found in human PubMed, animal PubMed, FDA human-label text and FDA
// animal-label text, with a count. Clicking an event opens the supporting
// evidence (highlighted abstracts or label excerpts) in a dialog.
//
// Data comes from the ae_* tables in kb_app (scripts/create_ae_tables.py),
// looked up by the same CUIs the rest of the portal resolved for this drug.

const SOURCE_META: Record<
  AeSource,
  { label: string; short: string; description: string; dot: string; header: string; ring: string }
> = {
  pubmed_human: {
    label: 'Human PubMed',
    short: 'PubMed (human)',
    description: 'Drug–event pairs extracted from human-study abstracts (MedGemma extraction).',
    dot: 'bg-blue-500',
    header: 'bg-blue-50 border-blue-200',
    ring: 'focus:ring-blue-500',
  },
  pubmed_animal: {
    label: 'Animal PubMed',
    short: 'PubMed (animal)',
    description: 'Drug–event pairs extracted from animal-study abstracts, with species.',
    dot: 'bg-teal-500',
    header: 'bg-teal-50 border-teal-200',
    ring: 'focus:ring-teal-500',
  },
  fda_human: {
    label: 'FDA Label (Human)',
    short: 'FDA label (human)',
    description: 'Events coded from the human-use sections of FDA drug labels (pregnancy, lactation, pediatric use, …).',
    dot: 'bg-orange-500',
    header: 'bg-orange-50 border-orange-200',
    ring: 'focus:ring-orange-500',
  },
  fda_animal: {
    label: 'FDA Label (Animal)',
    short: 'FDA label (animal)',
    description: 'Events coded from the animal-toxicology sections of FDA drug labels, with species.',
    dot: 'bg-purple-500',
    header: 'bg-purple-50 border-purple-200',
    ring: 'focus:ring-purple-500',
  },
};

const PAGE_SIZE = 20;
const MAX_SIMILAR = 12;

const PUBMED_URL = (pmid: string) => `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`;

function sectionLabel(section: string): string {
  return section
    .replace(/_/g, ' ')
    .replace(/\band or\b/g, 'and/or')
    .replace(/^\w/, (c) => c.toUpperCase());
}

// Renders the highlight tree: drug mentions in blue, adverse events in yellow.
// The pair was chosen for red-green colour-blind accessibility.
export function HighlightedText({ segments }: { segments: HighlightSegment[] }) {
  return (
    <>
      {segments.map((seg, i) => {
        if (seg.type === 'text') return <span key={i}>{seg.text}</span>;
        const cls =
          seg.type === 'drug'
            ? 'rounded bg-blue-100 px-0.5 text-blue-900 underline decoration-blue-400 decoration-2 underline-offset-2'
            : 'rounded bg-yellow-200 px-0.5 text-yellow-950';
        return (
          <mark key={i} className={cls}>
            <HighlightedText segments={seg.children} />
          </mark>
        );
      })}
    </>
  );
}

function Badge({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs text-gray-700"
    >
      {children}
    </span>
  );
}

type Selection = { source: AeSource; adverseEvent: string; count: number };

type EvidenceState = {
  items: AeEvidenceItem[];
  total: number;
  loading: boolean;
  error: string | null;
};

interface AdverseEventsTabProps {
  selectedDrug: string;
  concepts: ConceptRow[];
}

export default function AdverseEventsTab({ selectedDrug, concepts }: AdverseEventsTabProps) {
  const cuis = useMemo(
    () => Array.from(new Set(concepts.filter((c) => c.type === 'drug').map((c) => c.cui))).sort(),
    [concepts]
  );
  const cuiKey = cuis.join(',');

  const [summary, setSummary] = useState<AeSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [similar, setSimilar] = useState<AeSimilarDrug[]>([]);
  const [filter, setFilter] = useState('');
  const [selection, setSelection] = useState<Selection | null>(null);
  const [evidence, setEvidence] = useState<EvidenceState>({ items: [], total: 0, loading: false, error: null });

  // Guards against a slower earlier request overwriting a newer one.
  const evidenceRequestRef = useRef(0);

  useEffect(() => {
    setSelection(null);
    setFilter('');
    if (cuis.length === 0) {
      setSummary(null);
      setSimilar([]);
      return;
    }
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);
    daGetAeSummary(cuis, { signal: controller.signal })
      .then((data) => {
        setSummary(data);
        setIsLoading(false);
      })
      .catch((err: any) => {
        if (err?.name === 'AbortError') return;
        console.error('Error fetching adverse-event summary:', err);
        setError('Failed to load adverse-event data');
        setIsLoading(false);
      });
    daGetAeSimilarDrugs(cuis, MAX_SIMILAR, { signal: controller.signal })
      .then((data) => setSimilar(data?.results ?? []))
      .catch((err: any) => {
        if (err?.name === 'AbortError') return;
        console.error('Error fetching similar drugs:', err);
        setSimilar([]);
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cuiKey]);

  const loadEvidence = (sel: Selection, offset: number) => {
    const token = ++evidenceRequestRef.current;
    setEvidence((prev) => ({
      items: offset === 0 ? [] : prev.items,
      total: offset === 0 ? 0 : prev.total,
      loading: true,
      error: null,
    }));
    daGetAeEvidence(cuis, sel.source, sel.adverseEvent, { limit: PAGE_SIZE, offset })
      .then((data) => {
        if (evidenceRequestRef.current !== token) return;
        setEvidence((prev) => ({
          items: offset === 0 ? data.results : [...prev.items, ...data.results],
          total: data.total,
          loading: false,
          error: null,
        }));
      })
      .catch((err: any) => {
        if (evidenceRequestRef.current !== token || err?.name === 'AbortError') return;
        console.error('Error fetching adverse-event evidence:', err);
        setEvidence((prev) => ({ ...prev, loading: false, error: 'Failed to load evidence' }));
      });
  };

  const openEvidence = (sel: Selection) => {
    setSelection(sel);
    loadEvidence(sel, 0);
  };

  const closeEvidence = () => {
    evidenceRequestRef.current += 1;
    setSelection(null);
  };

  const needle = filter.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!summary) return null;
    const out = {} as Record<AeSource, AeSummary['categories'][AeSource]>;
    for (const s of AE_SOURCES) {
      const list = summary.categories[s] ?? [];
      out[s] = needle ? list.filter((e) => e.adverse_event.toLowerCase().includes(needle)) : list;
    }
    return out;
  }, [summary, needle]);

  const totalEvents = summary
    ? AE_SOURCES.reduce((n, s) => n + (summary.categories[s]?.length ?? 0), 0)
    : 0;

  if (cuis.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="mx-auto mb-4 h-16 w-16 text-gray-300" />
          <p className="text-lg text-gray-500">Please select a drug to view adverse-event evidence</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
              Adverse events for <span className="text-blue-700">{selectedDrug}</span>
              <InfoPopover label="About adverse-event evidence" title="Adverse-event evidence">
                <p>
                  Each column lists the adverse events linked to this drug in one evidence source, with the
                  number of supporting records. Click an event to read the evidence: abstracts with the drug
                  (<mark className="rounded bg-blue-100 px-0.5 text-blue-900">blue</mark>) and the event
                  (<mark className="rounded bg-yellow-200 px-0.5 text-yellow-950">yellow</mark>) highlighted for
                  PubMed sources, or the coded label record and the label text it came from for FDA sources.
                </p>
                <p className="mt-2">
                  Events were extracted automatically by a language model or string matching and have not
                  been manually reviewed. Treat them as leads to verify against the source, not as
                  established findings.
                </p>
              </InfoPopover>
            </h3>
            {summary && summary.drugNames.length > 0 && (
              <p className="mt-1 text-sm text-gray-500">
                Matched names: {summary.drugNames.slice(0, 8).join(', ')}
                {summary.drugNames.length > 8 ? ` and ${summary.drugNames.length - 8} more` : ''}
              </p>
            )}
          </div>
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter adverse events…"
              aria-label="Filter adverse events"
              className="w-full rounded border border-gray-300 py-1.5 pl-8 pr-3 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
          </div>
        ) : error ? (
          <p className="mt-6 text-sm text-red-600">{error}</p>
        ) : summary && totalEvents === 0 ? (
          <p className="mt-6 text-sm text-gray-500">
            No adverse-event records were found for this drug in any of the four sources.
          </p>
        ) : filtered ? (
          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {AE_SOURCES.map((source) => {
              const meta = SOURCE_META[source];
              const list = filtered[source];
              const all = summary!.categories[source]?.length ?? 0;
              return (
                <section key={source} className="flex min-h-[16rem] flex-col rounded-lg border border-gray-200">
                  <header className={`flex items-center justify-between rounded-t-lg border-b px-3 py-2 ${meta.header}`}>
                    <div className="flex items-center gap-2">
                      <span className={`inline-block h-2.5 w-2.5 rounded-full ${meta.dot}`} aria-hidden="true" />
                      <h4 className="text-sm font-semibold text-gray-800" title={meta.description}>
                        {meta.label}
                      </h4>
                    </div>
                    <span className="text-xs text-gray-500">
                      {needle && list.length !== all ? `${list.length} of ${all}` : all}
                    </span>
                  </header>
                  <ul className="max-h-[28rem] flex-1 overflow-y-auto p-1">
                    {list.length === 0 ? (
                      <li className="px-2 py-3 text-xs text-gray-400">
                        {all === 0 ? 'No evidence in this source.' : 'No events match the filter.'}
                      </li>
                    ) : (
                      list.map((entry) => {
                        const active =
                          selection?.source === source && selection.adverseEvent === entry.adverse_event;
                        return (
                          <li key={entry.adverse_event}>
                            <button
                              type="button"
                              onClick={() =>
                                openEvidence({ source, adverseEvent: entry.adverse_event, count: entry.count })
                              }
                              className={`flex w-full items-start justify-between gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-gray-100 focus:outline-none focus:ring-2 ${meta.ring} ${
                                active ? 'bg-gray-100 font-medium text-gray-900' : 'text-blue-700'
                              }`}
                            >
                              <span className="break-words underline decoration-dotted underline-offset-2">
                                {entry.adverse_event}
                              </span>
                              <span className="shrink-0 text-xs text-gray-500">{entry.count}</span>
                            </button>
                          </li>
                        );
                      })
                    )}
                  </ul>
                </section>
              );
            })}
          </div>
        ) : null}
      </div>

      {similar.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="flex items-center gap-2 text-base font-semibold text-gray-900">
            Structurally similar drugs
            <InfoPopover label="About structurally similar drugs" title="Structurally similar drugs">
              <p>
                Other drugs in the adverse-event data whose chemical structure is similar to this one
                (Tanimoto similarity on PubChem fingerprints, 1.0 = identical). Useful for finding class
                effects when the selected drug itself has little evidence.
              </p>
            </InfoPopover>
          </h3>
          <ul className="mt-3 flex flex-wrap gap-2">
            {similar.map((d) => (
              <li key={`${d.cui ?? d.name}`}>
                <Badge title={`Tanimoto similarity ${d.similarity.toFixed(3)}`}>
                  {d.name}
                  <span className="ml-1 text-gray-400">{d.similarity.toFixed(2)}</span>
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      )}

      {selection && (
        <EvidenceDialog
          selection={selection}
          drug={selectedDrug}
          state={evidence}
          onClose={closeEvidence}
          onLoadMore={() => loadEvidence(selection, evidence.items.length)}
        />
      )}
    </div>
  );
}

interface EvidenceDialogProps {
  selection: Selection;
  drug: string;
  state: EvidenceState;
  onClose: () => void;
  onLoadMore: () => void;
}

// Modal listing the evidence behind one adverse event in one source. Same
// hand-rolled pattern as ListDialog (backdrop + role="dialog" + Escape).
function EvidenceDialog({ selection, drug, state, onClose, onLoadMore }: EvidenceDialogProps) {
  const meta = SOURCE_META[selection.source];
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const hasMore = state.items.length < state.total;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Evidence for ${selection.adverseEvent}`}
        className="relative flex max-h-[85vh] w-full max-w-3xl flex-col rounded-lg bg-white shadow-xl"
      >
        <div className="flex items-start justify-between border-b border-gray-200 p-4">
          <div className="pr-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {selection.adverseEvent}{' '}
              <span className="text-sm font-normal text-gray-500">
                ({state.total || selection.count})
              </span>
            </h3>
            <p className="mt-0.5 flex items-center gap-2 text-sm text-gray-500">
              <span className={`inline-block h-2.5 w-2.5 rounded-full ${meta.dot}`} aria-hidden="true" />
              {meta.label} · {drug}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {state.error && <p className="text-sm text-red-600">{state.error}</p>}
          {state.items.map((item, i) =>
            item.kind === 'pubmed' ? (
              <PubmedEvidenceCard key={`${item.pmid}-${i}`} item={item} />
            ) : (
              <LabelEvidenceCard key={`${item.section}-${i}`} item={item} />
            )
          )}
          {state.loading && (
            <div className="flex justify-center py-4">
              <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-blue-600" />
            </div>
          )}
          {!state.loading && !state.error && state.items.length === 0 && (
            <p className="text-sm text-gray-500">No evidence records found.</p>
          )}
          {!state.loading && hasMore && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={onLoadMore}
                className="rounded border border-gray-300 px-4 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                Load more ({state.total - state.items.length} remaining)
              </button>
            </div>
          )}
        </div>

        <div className="border-t border-gray-200 px-4 py-2 text-xs text-gray-500">
          <mark className="rounded bg-blue-100 px-1 text-blue-900">drug</mark> and{' '}
          <mark className="rounded bg-yellow-200 px-1 text-yellow-950">adverse event</mark> mentions are
          highlighted. Extracted automatically; verify against the source.
        </div>
      </div>
    </div>
  );
}

function PubmedEvidenceCard({ item }: { item: Extract<AeEvidenceItem, { kind: 'pubmed' }> }) {
  return (
    <article className="rounded-lg border border-gray-200 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <a
          href={PUBMED_URL(item.pmid)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
        >
          PMID {item.pmid}
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
        {item.population && <Badge>{item.population}</Badge>}
        {item.species && <Badge>{item.species}</Badge>}
        {item.dosage && <Badge title="Dosage as extracted">{item.dosage}</Badge>}
        {item.finding_type && <Badge title="Finding type">{item.finding_type.replace(/_/g, ' ')}</Badge>}
        {item.confidence && <Badge title="Extraction confidence">confidence: {item.confidence}</Badge>}
      </div>
      {item.title && <h4 className="mt-2 text-sm font-semibold text-gray-900">{item.title}</h4>}
      <p className="mt-2 text-sm leading-relaxed text-gray-800">
        {item.segments.length > 0 ? <HighlightedText segments={item.segments} /> : <em>No abstract available.</em>}
      </p>
      {item.reasoning && (
        <details className="mt-2 text-xs text-gray-600">
          <summary className="cursor-pointer select-none text-gray-500">Extraction rationale</summary>
          <p className="mt-1 leading-relaxed">{item.reasoning}</p>
        </details>
      )}
    </article>
  );
}

function LabelEvidenceCard({ item }: { item: Extract<AeEvidenceItem, { kind: 'label' }> }) {
  return (
    <article className="rounded-lg border border-gray-200 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-gray-900">{sectionLabel(item.section)}</span>
        <Badge title="Label drug name">{item.drug_name}</Badge>
        {item.population && <Badge>{item.population}</Badge>}
        {item.species && <Badge>{item.species}</Badge>}
        {item.age_range && <Badge>{item.age_range}</Badge>}
        {item.dosage && <Badge title="Dosage as extracted">{item.dosage}</Badge>}
        {item.meddra_term && <Badge title={item.meddra_soc ?? 'MedDRA preferred term'}>MedDRA: {item.meddra_term}</Badge>}
      </div>
      {item.excerpts.length === 0 ? (
        <p className="mt-2 text-xs text-gray-500">
          The label section text for this record is not available; the coded fields above are the evidence.
        </p>
      ) : (
        <div className="mt-2 space-y-2">
          {item.excerpts.map((segments, i) => (
            <p key={i} className="max-h-64 overflow-y-auto rounded bg-gray-50 p-2 text-sm leading-relaxed text-gray-800">
              <HighlightedText segments={segments} />
            </p>
          ))}
        </div>
      )}
    </article>
  );
}
