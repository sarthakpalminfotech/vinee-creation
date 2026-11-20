// Presentation kit: one consistent way to show takas + meters, stat tiles and chips.
// Pure UI (no data access) so screens can adopt it — or drop it — independently.
import React, { useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, SlidersHorizontal, List, LayoutGrid, ChevronDown, Check } from 'lucide-react';
import { fmtInt, fmtM } from '../lib/format';
import { Button, Modal, SearchSlotContext, Field, Input, Select } from './ui';

const TONES = {
  slate: 'text-slate-900',
  sky: 'text-sky-700',
  violet: 'text-violet-700',
  amber: 'text-amber-700',
  emerald: 'text-emerald-700',
  primary: 'text-primary-700',
  red: 'text-red-600',
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
      <div className={`text-right leading-snug tabular-nums ${className}`}>
        {takas != null && <div className={`text-sm font-semibold ${color}`}>{fmtInt(takas)} <span className="text-xs font-medium text-slate-400">taka</span></div>}
        {meters != null && <div className={`text-sm font-semibold ${color}`}>{fmtM(meters)} <span className="text-xs font-medium text-slate-400">m</span></div>}
      </div>
    );
  }
  if (variant === 'inline') {
    return (
      <span className={`tabular-nums ${className}`}>
        {takas != null && <><strong className={`font-semibold ${color}`}>{fmtInt(takas)}</strong> <span className="text-slate-400 text-xs">taka</span></>}
        {takas != null && meters != null && <span className="mx-1.5 text-slate-300">|</span>}
        {meters != null && <><strong className={`font-semibold ${color}`}>{fmtM(meters)}</strong> <span className="text-slate-400 text-xs">m</span></>}
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
      className={`relative text-left rounded-xl border bg-white p-4 shadow-soft transition ${onClick ? 'cursor-pointer hover:shadow-md hover:border-sage active:scale-[0.99]' : ''} ${active ? 'border-primary-600 ring-[3px] ring-primary-100' : 'border-slate-200'} ${className}`}
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
    red: 'bg-red-50 text-red-700',
  };
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone] || tones.slate} ${className}`}>{children}</span>;
}


/** Colour swatch dot for a shade. */
export function Swatch({ hex, size = 'md' }) {
  const s = size === 'sm' ? 'w-3.5 h-3.5' : size === 'lg' ? 'w-8 h-8' : 'w-5 h-5';
  return <span className={`inline-block shrink-0 rounded-full border border-black/10 ${s}`} style={{ backgroundColor: hex || '#cccccc' }} />;
}

/**
 * A colour as shown everywhere: the image when the colour has one, else the hex colour, else a neutral placeholder.
 * Pass the fields directly (hex, image) — or spread any shade-like row via shade={{hex|shade_hex, image_url|shade_image}}.
 * shape: 'round' (default) | 'square'. size: sm | md | lg | xl
 */
export function ShadeSwatch({ hex, image, shade, size = 'md', shape = 'round', className = '' }) {
  const h = hex ?? shade?.hex ?? shade?.shade_hex;
  const img = image ?? shade?.image_url ?? shade?.shade_image;
  const dims = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-10 h-10', xl: 'w-full h-full' }[size] || 'w-6 h-6';
  const rounded = shape === 'square' ? 'rounded-md' : 'rounded-full';
  const common = `inline-block shrink-0 border border-black/10 ${rounded} ${dims} ${className}`;
  if (img) return <img src={img} alt="" loading="lazy" crossOrigin="anonymous" className={`${common} object-cover bg-slate-100`} />;
  if (h) return <span className={common} style={{ backgroundColor: h, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }} />;
  return <span className={`${common} bg-slate-100 grid place-items-center text-slate-400 text-[10px] leading-none`}>?</span>;
}
/** Swatch + shade name on one line. `row` can be any shade-like row (number/shade_no, hex/shade_hex, image_url/shade_image). */
export function ShadeLabel({ row, name, size = 'md', className = '' }) {
  const label = name ?? row?.number ?? row?.shade_no ?? '—';
  return (
    <span className={`inline-flex items-center gap-2 min-w-0 ${className}`}>
      <ShadeSwatch shade={row} size={size} />
      <span className="truncate font-medium text-slate-900">{label}</span>
    </span>
  );
}

/**
 * Colour dropdown that shows each colour with its swatch / image. colours: rows with {shade_id, number, name, hex, image_url};
 * value = shade_id as string; exclude = shade ids already used on another line.
 */
export function ColourSelect({ colours, value, onChange, exclude, placeholder = 'Select colour…', disabled = false, className = '' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const listRef = useRef(null);
  const [pos, setPos] = useState(null);
  // The list is portalled to <body> with fixed coordinates so no parent section can clip it.
  useEffect(() => {
    if (!open) return undefined;
    const place = () => {
      const r = ref.current?.getBoundingClientRect();
      if (!r) return;
      const below = window.innerHeight - r.bottom;
      const up = below < 200 && r.top > below;
      const maxH = Math.min(256, Math.max(120, (up ? r.top : below) - 12));
      setPos({ left: r.left, width: r.width, maxH, ...(up ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 }) });
    };
    place();
    const away = (e) => {
      if (ref.current?.contains(e.target) || listRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', away);
    document.addEventListener('touchstart', away);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      document.removeEventListener('mousedown', away); document.removeEventListener('touchstart', away);
      window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true);
    };
  }, [open]);
  const ex = exclude || new Set();
  const cur = colours.find((c) => String(c.shade_id) === String(value));
  const rows = colours.filter((c) => String(c.shade_id) === String(value) || !ex.has(String(c.shade_id)));
  return (
    <div ref={ref} className={`relative ${className}`}>
      <button type="button" disabled={disabled} onClick={() => setOpen(!open)} aria-haspopup="listbox" aria-expanded={open}
        className="flex h-11 w-full items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-left text-[15px] hover:border-sage focus:outline-none focus:border-primary-600 focus:ring-[3px] focus:ring-primary-600/20 disabled:opacity-50">
        {cur ? <><ShadeSwatch shade={cur} size="md" /><span className="min-w-0 flex-1 truncate font-medium text-slate-900">{cur.number}{cur.name ? <span className="font-normal text-slate-500"> · {cur.name}</span> : null}</span></> : <span className="flex-1 text-slate-400">{placeholder}</span>}
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
      </button>
      {open && pos && createPortal(
        <div ref={listRef} role="listbox" style={{ position: 'fixed', left: pos.left, top: pos.top, bottom: pos.bottom, width: pos.width, maxHeight: pos.maxH }}
          className="z-[100] min-w-[14rem] overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-pop">
          {rows.map((c) => (
            <button key={c.shade_id} type="button" role="option" aria-selected={String(c.shade_id) === String(value)}
              onClick={() => { onChange(String(c.shade_id)); setOpen(false); }}
              className="flex min-h-[44px] w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[15px] hover:bg-primary-50 aria-selected:bg-primary-50">
              <ShadeSwatch shade={c} size="md" /><span className="min-w-0 flex-1 truncate"><span className="font-medium text-slate-900">{c.number}</span>{c.name ? <span className="text-slate-500"> · {c.name}</span> : null}</span>
            </button>
          ))}
          {rows.length === 0 && <div className="px-3 py-3 text-sm text-slate-500">No more colours.</div>}
        </div>,
        document.body
      )}
    </div>
  );
}

/** Section heading used above groups of cards. */
export function SectionTitle({ title, right }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-3">
      <h2 className="font-display text-[15px] font-bold text-forest">{title}</h2>
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
          className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-11 text-base focus:outline-none focus:ring-[3px] focus:ring-primary-600/20 focus:border-primary-600" />
        <button type="button" onClick={toggle} aria-label="Close search" className="absolute right-0.5 top-1/2 -translate-y-1/2 w-10 h-10 grid place-items-center text-slate-400 hover:text-slate-700"><X className="w-4 h-4" /></button>
      </div>
    </div>
  );
  return (
    <>
      <button type="button" onClick={toggle} aria-label={open ? 'Close search' : 'Search'}
        className={`h-11 w-11 shrink-0 grid place-items-center rounded-lg border hover:bg-primary-50 ${open || value ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-slate-300 bg-white text-slate-600'} ${className}`}>
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
        className={`relative h-11 min-w-[44px] justify-center px-3 shrink-0 inline-flex items-center gap-2 rounded-lg border text-sm font-medium hover:bg-primary-50 ${count ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-slate-300 bg-white text-slate-700'}`}>
        <SlidersHorizontal className="w-5 h-5" />
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

/**
 * List / card view switch, remembered per screen in this browser. Until the user picks one, tablets (< 1280 px) start
 * on cards — wide tables don't fit a tablet without scrolling sideways — and desktops on `initial`.
 */
export function useViewMode(key, initial = 'list') {
  const storageKey = `vinee:view:${key}`;
  const fallback = typeof window !== 'undefined' && window.matchMedia?.('(max-width: 1279px)').matches ? 'card' : initial;
  const [mode, setMode] = useState(() => { try { return localStorage.getItem(storageKey) || fallback; } catch { return fallback; } });
  const change = (m) => { setMode(m); try { localStorage.setItem(storageKey, m); } catch { /* private mode */ } };
  return [mode, change];
}
export function ViewToggle({ mode, onChange }) {
  const btn = (m, Icon, label) => (
    <button type="button" onClick={() => onChange(m)} aria-label={label} aria-pressed={mode === m}
      className={`h-9 w-10 grid place-items-center rounded-md ${mode === m ? 'bg-primary-600 text-white shadow-sm' : 'text-slate-600 hover:bg-primary-50'}`}>
      <Icon className="w-5 h-5" />
    </button>
  );
  return (
    <div className="inline-flex rounded-lg border border-slate-300 bg-white p-[3px]">
      {btn('list', List, 'List view')}
      {btn('card', LayoutGrid, 'Card view')}
    </div>
  );
}

/** True on wide screens (desktop, >= 1024px). Tablets and phones use step-by-step screens instead. */
export function useIsDesktop() {
  const q = '(min-width: 1024px)';
  const get = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(q).matches : true);
  const [is, setIs] = useState(get);
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const m = window.matchMedia(q);
    const on = () => setIs(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return is;
}

/**
 * Bottom bar with a form's totals and its main button on tablets / phones: it sticks to the bottom of the screen while the
 * form scrolls, so the save button is always under the thumb. Hidden from `hideFrom` up ('lg' | 'xl'), where a side
 * summary card takes over; 'never' keeps it on every width. Spans the full content width (matches the shell's padding).
 */
export function ActionBar({ children, hideFrom = 'lg', className = '' }) {
  const hide = { lg: 'lg:hidden', xl: 'xl:hidden', never: '' }[hideFrom] ?? 'lg:hidden';
  return (
    <div className={`sticky bottom-0 z-20 -mx-4 sm:-mx-5 md:-mx-7 xl:-mx-8 mt-6 border-t border-slate-200 bg-white/95 px-4 sm:px-5 md:px-7 xl:px-8 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-bar backdrop-blur ${hide} ${className}`}>
      {children}
    </div>
  );
}

/** Numbered step tabs for tablet/phone create screens. */
export function StepTabs({ steps, step, onStep }) {
  return (
    <div className="flex gap-1 rounded-xl border border-slate-200 bg-white p-1 mb-5 shadow-soft">
      {steps.map((label, i) => {
        const n = i + 1, on = step === n, done = n < step;
        return (
          <button key={label} type="button" onClick={() => onStep(n)} aria-current={on ? 'step' : undefined}
            className={`flex-1 min-w-0 h-12 rounded-lg text-sm font-semibold inline-flex items-center justify-center gap-2 px-2 transition-colors ${on ? 'bg-primary-600 text-white shadow-sm' : done ? 'text-primary-800 hover:bg-primary-50' : 'text-slate-600 hover:bg-primary-50'}`}>
            <span className={`w-6 h-6 shrink-0 rounded-full grid place-items-center text-xs border ${on ? 'border-white/60' : done ? 'border-primary-600 bg-primary-600 text-white' : 'border-slate-300'}`}>{done ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : n}</span><span className="truncate">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
