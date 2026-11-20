// One consistent taka display (R-UI-1): the METERS are what matter (large, semibold, tabular), the taka number is small and muted.
//   TakaChip  – a tap tile (selectable)             TakaGrid  – responsive grid of tiles (3 phone · 4 tablet portrait · 6 landscape / laptop)
//   TakaList  – read-only column blocks (screens + PDFs): each block is its own bordered box with its own header, so the number of
//               one column never sits next to the meters of the column before it.
import React from 'react';
import { Check } from 'lucide-react';
import { fmtM } from '../lib/format';

const BADGE = {
  slate: 'bg-slate-100 text-slate-600', amber: 'bg-amber-50 text-amber-700', red: 'bg-red-50 text-red-600',
  emerald: 'bg-emerald-50 text-emerald-700', primary: 'bg-primary-50 text-primary-700', sky: 'bg-sky-50 text-sky-700',
};

/** Tiny badge (lot, damaged, job-worked …) — always on its own line below the meters. */
export function TakaBadge({ children, tone = 'slate' }) {
  return <span className={`inline-block max-w-full truncate rounded px-1 text-[10px] font-medium leading-4 ${BADGE[tone] || BADGE.slate}`}>{children}</span>;
}

/** no = taka number (muted), meters = the main text. badges: [{text, tone}]. */
export function TakaChip({ no, meters, selected = false, disabled = false, onClick, badges = [], className = '', ...rest }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag type={onClick ? 'button' : undefined} onClick={disabled ? undefined : onClick} disabled={onClick ? disabled : undefined}
      aria-pressed={onClick ? selected : undefined}
      className={`relative min-h-[44px] w-full rounded-md border px-2.5 py-1.5 text-left leading-tight transition ${selected ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-200' : 'border-slate-200 bg-white'} ${onClick && !disabled && !selected ? 'hover:bg-slate-50' : ''} ${disabled ? 'cursor-not-allowed bg-slate-50 opacity-60' : ''} ${className}`}
      {...rest}>
      <span className="block text-[11px] leading-none text-slate-400">#{no}</span>
      <span className="mt-1 block whitespace-nowrap text-base font-semibold tabular-nums text-slate-900">{fmtM(meters)}<span className="ml-0.5 text-[11px] font-normal text-slate-400">m</span></span>
      {badges.length > 0 && <span className="mt-0.5 flex flex-wrap gap-1">{badges.map((b, i) => <TakaBadge key={i} tone={b.tone}>{b.text}</TakaBadge>)}</span>}
      {selected && <Check className="absolute right-1.5 top-1.5 h-3.5 w-3.5 text-primary-600" aria-hidden="true" />}
    </Tag>
  );
}

/** Responsive grid of TakaChips. items: [{id, no, meters, badges?, disabled?}]; sel: Set of ids; onToggle(id). */
export function TakaGrid({ items, sel, onToggle, className = '' }) {
  return (
    <div className={`grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10 ${className}`}>
      {items.map((t) => (
        <TakaChip key={t.id} no={t.no} meters={t.meters} badges={t.badges} disabled={t.disabled} selected={sel ? sel.has(t.id) : false} onClick={onToggle ? () => onToggle(t.id) : undefined} />
      ))}
    </div>
  );
}

const sum2 = (a) => Math.round(a.reduce((s, x) => s + Number(x || 0), 0) * 100) / 100;

/**
 * Read-only taka list in column blocks. items: [{id, no, meters, tag?}] (tag = small muted text after the number, e.g. a lot).
 * rowsPerBlock rows per block (default 20). pdf: fixed 4 blocks per row (A4 pages), otherwise the blocks follow the width.
 */
export function TakaList({ items, rowsPerBlock = 20, pdf = false, showTotal = true, className = '' }) {
  const blocks = [];
  for (let i = 0; i < items.length; i += rowsPerBlock) blocks.push(items.slice(i, i + rowsPerBlock));
  const grid = pdf ? 'grid-cols-4 gap-4' : 'grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4';
  return (
    <div className={className}>
      <div className={`grid ${grid}`}>
        {blocks.map((b, bi) => (
          <div key={bi} className="overflow-hidden rounded-md border border-slate-300 bg-white" style={pdf ? { breakInside: 'avoid' } : undefined}>
            <div className="flex justify-between border-b border-slate-300 bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500"><span>No</span><span>Meters</span></div>
            {b.map((t, i) => (
              <div key={t.id ?? `${bi}-${i}`} className={`flex items-baseline justify-between gap-2 px-2.5 py-1 ${i % 2 ? 'bg-slate-50' : ''}`}>
                <span className="min-w-0 truncate text-[11px] text-slate-400">{t.no}{t.tag ? <span className="ml-1.5 text-slate-400">· {t.tag}</span> : null}</span>
                <span className="w-20 shrink-0 text-right text-sm font-semibold tabular-nums text-slate-900">{fmtM(t.meters)}</span>
              </div>
            ))}
            <div className="flex justify-between gap-2 border-t border-slate-300 bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700 tabular-nums"><span>{b.length} taka</span><span>{fmtM(sum2(b.map((t) => t.meters)))} m</span></div>
          </div>
        ))}
      </div>
      {showTotal && items.length > rowsPerBlock && (
        <div className="mt-2 flex justify-between rounded-md bg-slate-100 px-3 py-1.5 text-sm font-bold tabular-nums text-slate-900"><span>Total — {items.length} takas</span><span>{fmtM(sum2(items.map((t) => t.meters)))} m</span></div>
      )}
    </div>
  );
}
