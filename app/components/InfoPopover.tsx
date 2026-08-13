'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { HelpCircle } from 'lucide-react';

// A "?" button that opens a short explanation next to a heading.
//
// Used where a native `title` tooltip is not enough: the filter chips explain
// themselves in one line (see populationTooltip), but a chart needs a few
// sentences on what it shows and how to read it, and a hover tooltip that long
// is unreadable and cannot be kept open while looking at the graph.

export interface InfoPopoverProps {
  // Screen-reader name for the button, e.g. "About the word cloud".
  label: string;
  // Panel heading; falls back to `label`.
  title?: string;
  children: ReactNode;
  // Which edge of the panel lines up with the button. Use "right" when the
  // heading sits near the right edge of its container.
  align?: 'left' | 'right';
}

export default function InfoPopover({ label, title, children, align = 'left' }: InfoPopoverProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onPointerDown = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [open]);

  return (
    <span ref={wrapperRef} className="relative inline-flex align-middle">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={label}
        aria-expanded={open}
        className={`rounded-full p-0.5 transition-colors ${
          open ? 'text-blue-600' : 'text-gray-400 hover:text-blue-600'
        }`}
      >
        <HelpCircle className="h-4 w-4" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={title ?? label}
          className={`absolute top-7 z-30 w-80 rounded-lg border border-gray-200 bg-white p-3 text-left text-xs leading-relaxed font-normal normal-case tracking-normal text-gray-600 shadow-lg ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          <h4 className="mb-1.5 text-sm font-semibold text-gray-900">{title ?? label}</h4>
          {children}
        </div>
      )}
    </span>
  );
}
