// Presentation kit: one consistent way to show takas + meters, stat tiles and chips.
// Pure UI (no data access) so screens can adopt it — or drop it — independently.
import React from 'react';
import { fmtInt, fmtM } from '../lib/format';

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
    <div className={`grid grid-cols-2 divide-x divide-slate-200 rounded-lg bg-slate-50 border border-slate-200 ${className}`}>
      <div className="px-3 py-2">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Takas</div>
        <div className={`text-lg font-bold leading-tight tabular-nums ${color}`}>{fmtInt(takas)}</div>
      </div>
      <div className="px-3 py-2">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Meters</div>
        <div className={`text-lg font-bold leading-tight tabular-nums ${color}`}>{fmtM(meters)}</div>
      </div>
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
