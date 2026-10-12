import React, { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PageHeader, Alert, LoadState, Empty, Card } from '../../components/ui';
import { Qty, StatTile, Chip, Swatch, SectionTitle } from '../../components/kit';
import { Boxes, CheckCircle2, MapPin } from 'lucide-react';
import { fmtInt, fmtM } from '../../lib/format';
import * as repo from '../../db/repo';
import { useDbVersion } from '../../lib/live';

const VIEWS = ['godown', 'mill', 'dyeing', 'finished'];
const VIEW_META = {
  godown: { tone: 'slate', accent: 'bg-slate-400', hint: 'Grey cloth lying in our own godowns' },
  mill: { tone: 'sky', accent: 'bg-sky-500', hint: 'Grey cloth sent to mills, not yet in a program' },
  dyeing: { tone: 'violet', accent: 'bg-violet-500', hint: 'Takas under a dyeing program' },
  finished: { tone: 'emerald', accent: 'bg-emerald-500', hint: 'Dyed takas back from the mill (folded or not)' },
};
const natural = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true });

/** Inventory overview: four stage tiles → branch wise godown stock → one card per quality. A card opens the detail page. */
export default function InventoryPage() {
  const [params, setParams] = useSearchParams();
  const view = VIEWS.includes(params.get('view')) ? params.get('view') : 'godown';
  const branchId = view === 'godown' ? params.get('branch') || '' : '';
  const dead = params.get('mode') === 'dead';
  const [deadDays, setDeadDays] = useState(null);
  const [counts, setCounts] = useState(null);
  const [byBranch, setByBranch] = useState([]);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const dbVersion = useDbVersion();

  useEffect(() => {
    let live = true;
    Promise.all([repo.inventoryCounts(), repo.godownByBranch(), repo.getDeadStockDays()])
      .then(async ([c, b, d]) => {
        const r = dead ? await repo.deadStock(d) : await repo.inventoryList(view, { branch_id: branchId });
        if (live) { setCounts(c); setByBranch(b); setDeadDays(d); setRows(r); setError(''); }
      })
      .catch((e) => live && setError(e.message))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [view, branchId, dead, dbVersion]);

  const switchMode = (toDead) => setParams(toDead ? { mode: 'dead' } : {});
  const go = (next) => setParams(Object.fromEntries(Object.entries(next).filter(([, v]) => v)));

  // one card per quality; coloured stages also count the colours that have stock
  const cards = useMemo(() => {
    const m = new Map();
    for (const t of rows) {
      if (!m.has(t.quality_id)) m.set(t.quality_id, { id: t.quality_id, nick: t.nick_name, original: t.original_name, takas: 0, m: 0, shades: new Map(), mills: new Set(), branches: new Set() });
      const g = m.get(t.quality_id);
      g.takas += 1; g.m = Math.round((g.m + t.stock_m) * 100) / 100;
      if (t.shade_id) g.shades.set(t.shade_id, { hex: t.shade_hex, no: t.item_code || t.shade_no });
      g.idle = Math.max(g.idle || 0, t.idle_days || 0);
      if (t.mill_name) g.mills.add(t.mill_name);
      if (t.branch_name) g.branches.add(t.branch_name);
    }
    return [...m.values()].sort((a, b) => natural(a.nick, b.nick));
  }, [rows]);

  if (error && !counts) return <LoadState error={error} />;
  const coloured = dead || view === 'dyeing' || view === 'finished';
  const deadTotals = { takas: rows.length, m: Math.round(rows.reduce((s, t) => s + t.stock_m, 0) * 100) / 100 };
  const branchName = byBranch.find((b) => String(b.id) === String(branchId))?.name;

  return (
    <div className="space-y-8">
      <PageHeader title="Inventory">
        <div className="inline-flex rounded-md border border-slate-300 bg-white p-1" role="tablist">
          {[['Live stock', false], ['Dead stock', true]].map(([label, isDead]) => (
            <button key={label} type="button" role="tab" aria-selected={dead === isDead} onClick={() => switchMode(isDead)}
              className={`h-9 px-4 rounded text-sm font-medium transition ${dead === isDead ? (isDead ? 'bg-amber-500 text-white' : 'bg-primary-600 text-white') : 'text-slate-600 hover:bg-slate-100'}`}>{label}</button>
          ))}
        </div>
      </PageHeader>

      {!dead && counts && (counts.reconciled
        ? <Alert tone="success"><span className="inline-flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Stock is reconciled — the four stages add up to all {fmtInt(counts.sum)} active takas ({fmtInt(counts.sold)} sold are not stock).</span></Alert>
        : <Alert>Stock does not reconcile: stages add up to {counts.sum} takas but {counts.active} takas are active{counts.other ? ` (${counts.other} in an unknown state)` : ''}.</Alert>)}

      {dead && (
        <section>
          <SectionTitle title="Dead stock" right={<button type="button" className="text-xs font-medium text-primary-700 hover:underline" onClick={() => window.dispatchEvent(new Event('vinee:open-settings'))}>Change rule</button>} />
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <StatTile label="Dead takas" tone="amber" accent="bg-amber-500" value={fmtInt(deadTotals.takas)} unit="taka" />
            <StatTile label="Dead meters" tone="amber" accent="bg-amber-500" value={fmtM(deadTotals.m)} unit="m" />
            <StatTile label="No movement for" value={deadDays ?? '…'} unit={deadDays === 1 ? 'day or more' : 'days or more'} />
          </div>
        </section>
      )}

      {/* 1 · the four stages */}
      {!dead && <section>
        <SectionTitle title="Stock by stage" />
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {VIEWS.map((v) => (
            <StatTile key={v} label={repo.INVENTORY_VIEWS[v].label} tone={VIEW_META[v].tone} accent={VIEW_META[v].accent}
              value={counts ? fmtInt(counts.views[v].takas) : '—'} unit="taka"
              sub={<><span className="font-semibold text-slate-800">{counts ? fmtM(counts.views[v].m) : '—'}</span> <span className="text-slate-400 text-xs">meters</span></>}
              active={view === v} onClick={() => go({ view: v })} />
          ))}
        </div>
      </section>}

      {/* 2 · grey in our godowns, branch wise (only meaningful for this stage) */}
      {!dead && view === 'godown' && <section>
        <SectionTitle title="Grey at our place — branch wise" />
        {byBranch.length === 0 ? (
          <Card className="p-5 text-sm text-slate-500">No grey in our godowns right now.</Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {byBranch.map((b) => {
              const on = view === 'godown' && String(branchId) === String(b.id);
              return (
                <button key={b.id ?? 'none'} type="button" onClick={() => go({ view: 'godown', branch: on ? '' : String(b.id ?? '') })}
                  className={`text-left rounded-lg border bg-white p-4 transition hover:shadow-md ${on ? 'border-primary-500 ring-2 ring-primary-100' : 'border-slate-200 hover:border-slate-300'}`}>
                  <div className="flex items-center gap-2 text-slate-800 font-semibold"><MapPin className="w-4 h-4 text-slate-400" />{b.name}</div>
                  <Qty className="mt-3" takas={b.takas} meters={b.m} />
                  {b.unassigned > 0 && <div className="mt-2 text-xs text-amber-600">{fmtInt(b.unassigned)} taka without a rack</div>}
                </button>
              );
            })}
          </div>
        )}
      </section>}

      {/* 3 · one card per quality for the chosen stage */}
      <section>
        <SectionTitle
          title={dead ? 'Dead stock — by quality' : `${repo.INVENTORY_VIEWS[view].label} — by quality`}
          right={branchName && <button className="text-xs text-primary-600 hover:underline" onClick={() => go({ view })}>Clear branch filter</button>} />
        {loading ? <div className="p-12 text-center text-slate-500">Loading...</div> : cards.length === 0 ? (
          <Empty icon={Boxes} title={dead ? 'No dead stock' : 'No stock here'} description={dead ? `No finished goods have been idle for ${deadDays} days or more.` : 'Nothing is held at this stage right now.'} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {cards.map((q) => (
              <Link key={q.id} to={dead ? `/inventory/dead/${q.id}` : `/inventory/${view}/${q.id}${branchId ? `?branch=${branchId}` : ''}`}
                className="group rounded-lg border border-slate-200 bg-white p-5 hover:shadow-md hover:border-primary-300 transition">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-lg font-bold text-slate-900 truncate">{q.nick}</div>
                    <div className="text-xs text-slate-500 truncate">{q.original}</div>
                  </div>
                </div>
                <Qty className="mt-4" tone={dead ? 'amber' : VIEW_META[view].tone} takas={q.takas} meters={q.m} />
                <div className="mt-3 min-h-[26px] flex flex-wrap items-center gap-2">
                  {coloured ? (
                    <>
                      <Chip tone={dead ? 'amber' : VIEW_META[view].tone}>{q.shades.size} {q.shades.size === 1 ? 'colour' : 'colours'} in stock</Chip>{dead && <Chip tone="amber">idle up to {q.idle} days</Chip>}
                      <span className="flex -space-x-1.5">{[...q.shades.values()].slice(0, 8).map((s, i) => <Swatch key={i} hex={s.hex} size="sm" />)}</span>
                    </>
                  ) : view === 'mill' ? (
                    <Chip tone="sky">{q.mills.size} {q.mills.size === 1 ? 'mill' : 'mills'}: {[...q.mills].slice(0, 2).join(', ')}{q.mills.size > 2 ? '…' : ''}</Chip>
                  ) : (
                    <Chip>{q.branches.size} {q.branches.size === 1 ? 'branch' : 'branches'}: {[...q.branches].slice(0, 2).join(', ')}{q.branches.size > 2 ? '…' : ''}</Chip>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
