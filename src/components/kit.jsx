// Presentation kit: one consistent way to show takas + meters, stat tiles and chips.
// Pure UI (no data access) so screens can adopt it — or drop it — independently.
import React, { useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, SlidersHorizontal } from 'lucide-react';
import { fmtInt, fmtM } from '../lib/format';
import { Button, Modal, SearchSlotContext, Field, Input, Select } from './ui';

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
    <div className={`flex flex-wrap gap-x-8 gap-y-2 ${className}`}>
      {takas != null && (
        <div className="min-w-0">
          <div className="text-xs font-bold text-slate-500">Takas</div>
          <div className={`mt-0.5 text-lg font-semibold leading-tight tabular-nums whitespace-nowrap ${color}`}>{fmtInt(takas)}</div>
        </div>
      )}
      {meters != null && (
        <div className="min-w-0">
          <div className="text-xs font-bold text-slate-500">Meters</div>
          <div className={`mt-0.5 text-lg font-semibold leading-tight tabular-nums whitespace-nowrap ${color}`}>{fmtM(meters)}</div>
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
      className={`relative text-left rounded-lg border bg-white p-4 transition ${onClick ? 'cursor-pointer hover:shadow-md hover:border-slate-300' : ''} ${active ? 'border-primary-500 ring-2 ring-primary-100 shadow-sm' : 'border-slate-200'} ${className}`}
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
export function SectionTitle({ title, right }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-3">
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      {right}
    </div>
  );
}

/**
 * Plain label/value list for detail screens: bold label, value underneath, no boxes.
 * items: [{ label, value, wide? }]; empty values are skipped. Cells never get narrower than 11rem so nothing breaks.
 */
export function DetailList({ items, className = '' }) {
  const shown = items.filter((i) => i && i.value !== null && i.value !== undefined && i.value !== '' && i.value !== false);
  return (
    <dl className={`grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-x-8 gap-y-5 ${className}`}>
      {shown.map((i) => (
        <div key={i.label} className={`min-w-0 ${i.wide ? 'col-span-full' : ''}`}>
          <dt className="text-xs font-bold text-slate-500 whitespace-nowrap">{i.label}</dt>
          <dd className="mt-1 text-[15px] font-medium text-slate-900 break-words tabular-nums">{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Thin progress bar with a label and percentage. */
export function Progress({ label, pct, tone = 'primary' }) {
  const color = { primary: 'bg-primary-600', emerald: 'bg-emerald-500', amber: 'bg-amber-500' }[tone] || 'bg-primary-600';
  return (
    <div>
      <div className="flex justify-between text-xs font-bold text-slate-500 mb-1.5"><span>{label}</span><span className="tabular-nums text-slate-700">{Math.round(pct)}%</span></div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden"><div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} /></div>
    </div>
  );
}

/** A search icon; when opened, a full-width search row appears just below the toolbar (a new row, nothing shifts sideways). */
export function SearchToggle({ value, onChange, placeholder = 'Search…', className = '' }) {
  const slot = useContext(SearchSlotContext);
  const [open, setOpen] = useState(!!value);
  const ref = useRef(null);
  useEffect(() => { if (open) ref.current?.focus(); }, [open]);
  const toggle = () => { if (open) onChange(''); setOpen(!open); };
  const bar = open && (
    <div className="mt-3 w-full animate-in fade-in slide-in-from-top-1 duration-200">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input ref={ref} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder}
          className="h-11 w-full rounded-md border border-slate-300 bg-white pl-10 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
        <button type="button" onClick={toggle} aria-label="Close search" className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-slate-700"><X className="w-4 h-4" /></button>
      </div>
    </div>
  );
  return (
    <>
      <button type="button" onClick={toggle} aria-label={open ? 'Close search' : 'Search'}
        className={`h-11 w-11 shrink-0 grid place-items-center rounded-md border bg-white hover:bg-slate-50 ${open || value ? 'border-primary-400 text-primary-700' : 'border-slate-300 text-slate-600'} ${className}`}>
        <Search className="w-5 h-5" />
      </button>
      {bar && (slot ? createPortal(bar, slot) : <div className="basis-full w-full order-last">{bar}</div>)}
    </>
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

/** Unique [value,label] options from rows, sorted by label. */
export function uniqueOptions(rows, idOf, labelOf) {
  const m = new Map();
  for (const row of rows) { const id = idOf(row); if (id != null && id !== '' && !m.has(String(id))) m.set(String(id), labelOf(row)); }
  return [...m.entries()].sort((a, b) => String(a[1]).localeCompare(String(b[1]), undefined, { numeric: true }));
}
/** Date (YYYY-MM-DD) inside the filter's from/to range (open ended). */
export const inDateRange = (d, v) => (!v.from || (!!d && d >= v.from)) && (!v.to || (!!d && d <= v.to));

/**
 * Filter-icon + modal for list screens: a dropdown per field (options: [[value,label]]) and a from/to date range.
 * `values` is a plain object ({field: value, from, to}); the page does the actual filtering.
 */
export function ListFilter({ fields, values, onChange, dates = true, title = 'Filters' }) {
  const keys = [...fields.map((f) => f.key), ...(dates ? ['from', 'to'] : [])];
  const count = keys.filter((k) => values[k]).length;
  const set = (k, v) => onChange({ ...values, [k]: v });
  return (
    <FilterButton count={count} title={title} onClear={() => onChange({})}>
      {fields.map((f) => (
        <Field key={f.key} label={f.label}>
          <Select value={values[f.key] || ''} onChange={(e) => set(f.key, e.target.value)}>
            <option value="">All</option>
            {f.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </Field>
      ))}
      {dates && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="From date"><Input type="date" value={values.from || ''} onChange={(e) => set('from', e.target.value)} /></Field>
          <Field label="To date"><Input type="date" value={values.to || ''} onChange={(e) => set('to', e.target.value)} /></Field>
        </div>
      )}
    </FilterButton>
  );
}
