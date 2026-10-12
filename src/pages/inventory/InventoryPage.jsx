import React, { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PageHeader, Alert, LoadState, Empty, Card } from '../../components/ui';
import { Qty, StatTile, Chip, Swatch, SectionTitle } from '../../components/kit';
import { Boxes, CheckCircle2, MapPin, ChevronRight } from 'lucide-react';
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
  const [counts, setCounts] = useState(null);
  const [byBranch, setByBranch] = useState([]);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const dbVersion = useDbVersion();

  useEffect(() => {
    let live = true;
    Promise.all([repo.inventoryCounts(), repo.godownByBranch(), repo.inventoryList(view, { branch_id: branchId })])
      .then(([c, b, r]) => { if (live) { setCounts(c); setByBranch(b); setRows(r); setError(''); } })
      .catch((e) => live && setError(e.message))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [view, branchId, dbVersion]);

  const go = (next) => setParams(Object.fromEntries(Object.entries(next).filter(([, v]) => v)));

  // one card per quality; coloured stages also count the colours that have stock
  const cards = useMemo(() => {
    const m = new Map();
    for (const t of rows) {
      if (!m.has(t.quality_id)) m.set(t.quality_id, { id: t.quality_id, nick: t.nick_name, original: t.original_name, takas: 0, m: 0, shades: new Map(), mills: new Set(), branches: new Set() });
      const g = m.get(t.quality_id);
      g.takas += 1; g.m = Math.round((g.m + t.stock_m) * 100) / 100;
      if (t.shade_id) g.shades.set(t.shade_id, { hex: t.shade_hex, no: t.item_code || t.shade_no });
      if (t.mill_name) g.mills.add(t.mill_name);
      if (t.branch_name) g.branches.add(t.branch_name);
    }
    return [...m.values()].sort((a, b) => natural(a.nick, b.nick));
  }, [rows]);

  if (error && !counts) return <LoadState error={error} />;
  const coloured = view === 'dyeing' || view === 'finished';
  const branchName = byBranch.find((b) => String(b.id) === String(branchId))?.name;

  return (
    <div className="space-y-8">
      <PageHeader title="Inventory" description="Everything we hold, stage by stage. Pick a stage, then open a quality for the full details." />

      {counts && (counts.reconciled
        ? <Alert tone="success"><span className="inline-flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Stock is reconciled — the four stages add up to all {fmtInt(counts.sum)} active takas ({fmtInt(counts.sold)} sold are not stock).</span></Alert>
        : <Alert>Stock does not reconcile: stages add up to {counts.sum} takas but {counts.active} takas are active{counts.other ? ` (${counts.other} in an unknown state)` : ''}.</Alert>)}

      {/* 1 · the four stages */}
      <section>
        <SectionTitle title="Stock by stage" />
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {VIEWS.map((v) => (
            <StatTile key={v} label={repo.INVENTORY_VIEWS[v].label} tone={VIEW_META[v].tone} accent={VIEW_META[v].accent}
              value={counts ? fmtInt(counts.views[v].takas) : '—'} unit="taka"
              sub={<><span className="font-semibold text-slate-800">{counts ? fmtM(counts.views[v].m) : '—'}</span> <span className="text-slate-400 text-xs">meters</span></>}
              active={view === v} onClick={() => go({ view: v })} />
          ))}
        </div>
      </section>

      {/* 2 · grey in our godowns, branch wise */}
      <section>
        <SectionTitle title="Grey at our place — branch wise" hint="Tap a branch to see only its stock below" />
        {byBranch.length === 0 ? (
          <Card className="p-5 text-sm text-slate-500">No grey in our godowns right now.</Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {byBranch.map((b) => {
              const on = view === 'godown' && String(branchId) === String(b.id);
              return (
                <button key={b.id ?? 'none'} type="button" onClick={() => go({ view: 'godown', branch: on ? '' : String(b.id ?? '') })}
                  className={`text-left rounded-xl border bg-white p-4 transition hover:shadow-md ${on ? 'border-primary-500 ring-2 ring-primary-100' : 'border-slate-200 hover:border-slate-300'}`}>
                  <div className="flex items-center gap-2 text-slate-800 font-semibold"><MapPin className="w-4 h-4 text-slate-400" />{b.name}</div>
                  <Qty className="mt-3" takas={b.takas} meters={b.m} />
                  {b.unassigned > 0 && <div className="mt-2 text-xs text-amber-600">{fmtInt(b.unassigned)} taka without a rack</div>}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* 3 · one card per quality for the chosen stage */}
      <section>
        <SectionTitle
          title={`${repo.INVENTORY_VIEWS[view].label} — by quality`}
          hint={`${VIEW_META[view].hint}${branchName ? ` · ${branchName} only` : ''}`}
          right={branchName && <button className="text-xs text-primary-600 hover:underline" onClick={() => go({ view })}>Clear branch filter</button>} />
        {loading ? <div className="p-12 text-center text-slate-500">Loading...</div> : cards.length === 0 ? (
          <Empty icon={Boxes} title="No stock here" description="Nothing is held at this stage right now." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {cards.map((q) => (
              <Link key={q.id} to={`/inventory/${view}/${q.id}${branchId ? `?branch=${branchId}` : ''}`}
                className="group rounded-xl border border-slate-200 bg-white p-5 hover:shadow-md hover:border-primary-300 transition">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-lg font-bold text-slate-900 truncate">{q.nick}</div>
                    <div className="text-xs text-slate-500 truncate">{q.original}</div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-primary-500 shrink-0" />
                </div>
                <Qty className="mt-4" tone={VIEW_META[view].tone} takas={q.takas} meters={q.m} />
                <div className="mt-3 min-h-[26px] flex flex-wrap items-center gap-2">
                  {coloured ? (
                    <>
                      <Chip tone={VIEW_META[view].tone}>{q.shades.size} {q.shades.size === 1 ? 'colour' : 'colours'} in stock</Chip>
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
