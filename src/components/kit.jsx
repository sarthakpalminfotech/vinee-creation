// Presentation kit: one consistent way to show takas + meters, stat tiles and chips.
// Pure UI (no data access) so screens can adopt it — or drop it — independently.
import React, { useEffect, useRef, useState } from 'react';
import { Search, X, SlidersHorizontal } from 'lucide-react';
import { fmtInt, fmtM } from '../lib/format';
import { Button, Modal } from './ui';

const TONES = {
  slate: 'text-slate-900',
  sky: 'text-sky-700',
  violet: 'text-violet-700',
  amber: 'text-amber-700',
  emerald: 'text-emerald-700',
  primary: 'text-primary-700',
};

/**
 * Takas and meters, always labelled and never run together.
 *  variant="block"  → two labelled cells side by side (cards, headers)
 *  variant="cell"   → two stacked lines, right-aligned (table cells)
 *  variant="inline" → "48 taka · 4,812.50 m" with the numbers emphasised (one-liners)
 */
export function Qty({ takas, meters, variant = 'block', tone = 'slate', className = '' }) {
  const color = TONES[tone] || TONES.slate;
  if (variant === 'cell') {
    return (
      <div className={`text-right leading-tight tabular-nums ${className}`}>
        {takas != null && <div className={`font-semibold ${color}`}>{fmtInt(takas)} <span className="text-[11px] font-medium text-slate-400">taka</span></div>}
        {meters != null && <div className="text-xs text-slate-500">{fmtM(meters)} <span className="text-[11px] text-slate-400">m</span></div>}
      </div>
    );
  }
  if (variant === 'inline') {
    return (
      <span className={`tabular-nums ${className}`}>
        <strong className={`font-semibold ${color}`}>{fmtInt(takas)}</strong> <span className="text-slate-400 text-xs">taka</span>
        <span className="mx-1.5 text-slate-300">|</span>
        <strong className={`font-semibold ${color}`}>{fmtM(meters)}</strong> <span className="text-slate-400 text-xs">m</span>
      </span>
    );
  }
  return (
    <div className={`flex divide-x divide-slate-200 rounded-lg bg-slate-50 border border-slate-200 max-w-full ${className}`}>
      {takas != null && (
        <div className="px-3 py-2 min-w-0 shrink-0">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Takas</div>
          <div className={`text-base font-bold leading-tight tabular-nums whitespace-nowrap ${color}`}>{fmtInt(takas)}</div>
        </div>
      )}
      {meters != null && (
        <div className="px-3 py-2 min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Meters</div>
          <div className={`text-base font-bold leading-tight tabular-nums whitespace-nowrap ${color}`}>{fmtM(meters)}</div>
        </div>
      )}
    </div>
  );
}

/** Big KPI tile: label on top, number in the middle, detail underneath. Becomes a button when onClick is given. */
export function StatTile({ label, value, unit, sub, tone = 'slate', active = false, onClick, accent, className = '' }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`relative text-left rounded-xl border bg-white p-4 transition ${onClick ? 'cursor-pointer hover:shadow-md hover:border-slate-300' : ''} ${active ? 'border-primary-500 ring-2 ring-primary-100 shadow-sm' : 'border-slate-200'} ${className}`}
    >
      {accent && <span className={`absolute left-0 top-3 bottom-3 w-1 rounded-r ${accent}`} />}
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`mt-1 text-3xl font-bold leading-none tabular-nums ${TONES[tone] || TONES.slate}`}>
        {value}{unit && <span className="ml-1.5 text-sm font-medium text-slate-400">{unit}</span>}
      </div>
      {sub && <div className="mt-2 text-sm text-slate-600 tabular-nums">{sub}</div>}
    </Tag>
  );
}

/** Small rounded label. */
export function Chip({ children, tone = 'slate', className = '' }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700',
    sky: 'bg-sky-50 text-sky-700',
    violet: 'bg-violet-50 text-violet-700',
    amber: 'bg-amber-50 text-amber-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    primary: 'bg-primary-50 text-primary-700',
  };
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone] || tones.slate} ${className}`}>{children}</span>;
}

/** Colour swatch dot for a shade. */
export function Swatch({ hex, size = 'md' }) {
  const s = size === 'sm' ? 'w-3.5 h-3.5' : size === 'lg' ? 'w-8 h-8' : 'w-5 h-5';
  return <span className={`inline-block shrink-0 rounded-full border border-black/10 ${s}`} style={{ backgroundColor: hex || '#cccccc' }} />;
}

/** Section heading used above groups of cards. */
export function SectionTitle({ title, hint, right }) {
  return (
    <div className="flex items-end justify-between gap-3 mb-3">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">{title}</h2>
        {hint && <p className="text-xs text-slate-400 mt-0.5">{hint}</p>}
      </div>
      {right}
    </div>
  );
}

/** A search icon that slides open into a search box (and closes again). Keeps toolbars uncluttered. */
export function SearchToggle({ value, onChange, placeholder = 'Search…', className = '' }) {
  const [open, setOpen] = useState(!!value);
  const ref = useRef(null);
  useEffect(() => { if (open) ref.current?.focus(); }, [open]);
  const toggle = () => { if (open && value) onChange(''); setOpen(!open); };
  return (
    <div className={`flex items-center ${className}`}>
      <div className={`overflow-hidden transition-all duration-300 ease-out ${open ? 'w-44 sm:w-64 opacity-100 mr-2' : 'w-0 opacity-0'}`}>
        <input ref={ref} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} tabIndex={open ? 0 : -1}
          className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
      </div>
      <button type="button" onClick={toggle} aria-label={open ? 'Close search' : 'Search'}
        className={`relative h-11 w-11 shrink-0 grid place-items-center rounded-lg border bg-white text-slate-600 hover:bg-slate-50 ${value && !open ? 'border-primary-400 text-primary-600' : 'border-slate-300'}`}>
        {open ? <X className="w-5 h-5" /> : <Search className="w-5 h-5" />}
      </button>
    </div>
  );
}

/** Filter icon button with a count badge; opens a modal that holds the less-used filters. */
export function FilterButton({ count = 0, title = 'Filters', onClear, children }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Open filters"
        className={`relative h-11 px-3 shrink-0 inline-flex items-center gap-2 rounded-lg border bg-white text-sm font-medium hover:bg-slate-50 ${count ? 'border-primary-400 text-primary-700' : 'border-slate-300 text-slate-700'}`}>
        <SlidersHorizontal className="w-5 h-5" />
        <span className="hidden sm:inline">Filters</span>
        {count > 0 && <span className="min-w-[20px] h-5 px-1 rounded-full bg-primary-600 text-white text-xs font-semibold grid place-items-center">{count}</span>}
      </button>
      <Modal isOpen={open} onClose={() => setOpen(false)} title={title} maxWidth="max-w-lg">
        <div className="space-y-4">{children}</div>
        <div className="mt-6 flex items-center justify-between gap-3">
          <Button variant="ghost" type="button" onClick={onClear} disabled={!count}>Clear all</Button>
          <Button type="button" onClick={() => setOpen(false)}>Done</Button>
        </div>
      </Modal>
    </>
  );
}
