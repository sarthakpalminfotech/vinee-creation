import React, { useState, useEffect, useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { PageHeader, Card, Select, Input, Table, Th, Td, Empty, LoadState, Pager, usePaged, Field } from '../../components/ui';
import { Qty, StatTile, Chip, Swatch, SectionTitle } from '../../components/kit';
import { ArrowLeft, Boxes } from 'lucide-react';
import { fmtInt, fmtM } from '../../lib/format';
import * as repo from '../../db/repo';
import { useDbVersion } from '../../lib/live';

const natural = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true });
const r2 = (n) => Math.round(n * 100) / 100;
const TONE = { godown: 'slate', mill: 'sky', dyeing: 'violet', finished: 'emerald' };

/** Details of one quality at one stage: totals → (colours) → filters → every taka. */
export default function InventoryDetailPage() {
  const { view, qualityId } = useParams();
  const [params] = useSearchParams();
  const [all, setAll] = useState(null);
  const [error, setError] = useState('');
  const dbVersion = useDbVersion();
  const [f, setF] = useState({ group_id: '', weaver_id: '', branch_id: params.get('branch') || '', location_id: '', mill_id: '', shade_id: '', search: '' });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v, ...(k === 'group_id' ? { weaver_id: '' } : {}), ...(k === 'branch_id' ? { location_id: '' } : {}) }));

  useEffect(() => {
    let live = true;
    if (!repo.INVENTORY_VIEWS[view]) { setError('Unknown stock stage'); return undefined; }
    repo.inventoryList(view, { quality_id: qualityId })
      .then((r) => live && (setAll(r), setError('')))
      .catch((e) => live && setError(e.message));
    return () => { live = false; };
  }, [view, qualityId, dbVersion]);

  const coloured = view === 'dyeing' || view === 'finished';
  const tone = TONE[view];

  // everything except the colour choice, so the colour cards keep showing their full numbers
  const baseFiltered = useMemo(() => (all || []).filter((t) => (
    (!f.group_id || String(t.group_id) === f.group_id) && (!f.weaver_id || String(t.weaver_id) === f.weaver_id) &&
    (!f.branch_id || String(t.branch_id) === f.branch_id) && (!f.location_id || String(t.location_id) === f.location_id) &&
    (!f.mill_id || String(t.mill_id) === f.mill_id) &&
    (!f.search || `${t.challan_no}/${t.taka_no} ${t.weaver_name} ${t.program_no || ''}`.toLowerCase().includes(f.search.toLowerCase()))
  )), [all, f.group_id, f.weaver_id, f.branch_id, f.location_id, f.mill_id, f.search]);
  const shown = useMemo(() => baseFiltered.filter((t) => !f.shade_id || String(t.shade_id) === f.shade_id)
    .sort((a, b) => natural(a.challan_no, b.challan_no) || natural(a.taka_no, b.taka_no)), [baseFiltered, f.shade_id]);
  const paged = usePaged(shown, 100);

  const total = useMemo(() => ({ takas: (all || []).length, m: r2((all || []).reduce((s, t) => s + t.stock_m, 0)) }), [all]);
  const shownTotal = useMemo(() => ({ takas: shown.length, m: r2(shown.reduce((s, t) => s + t.stock_m, 0)) }), [shown]);

  // helper: group takas of the whole quality by a key → [{key,label,takas,m}]
  const by = (keyOf, labelOf) => {
    const m = new Map();
    for (const t of all || []) {
      const k = keyOf(t);
      if (k == null) continue;
      if (!m.has(k)) m.set(k, { key: k, label: labelOf(t), takas: 0, m: 0 });
      const g = m.get(k); g.takas += 1; g.m = r2(g.m + t.stock_m);
    }
    return [...m.values()].sort((a, b) => natural(a.label, b.label));
  };
  const branches = useMemo(() => by((t) => t.branch_id, (t) => t.branch_name || '—'), [all]);
  const mills = useMemo(() => by((t) => t.mill_id, (t) => t.mill_name || '—'), [all]);
  const programs = useMemo(() => by((t) => t.program_id, (t) => t.program_no), [all]);
  const groups = useMemo(() => by((t) => t.group_id, (t) => t.group_name), [all]);
  const parties = useMemo(() => by((t) => t.weaver_id, (t) => t.weaver_name).filter((p) => !f.group_id || (all || []).some((t) => t.weaver_id === p.key && String(t.group_id) === f.group_id)), [all, f.group_id]);
  const racks = useMemo(() => by((t) => t.location_id, (t) => repo.locLabel(t.shop, t.rack, t.branch_name)).filter((r) => !f.branch_id || (all || []).some((t) => t.location_id === r.key && String(t.branch_id) === f.branch_id)), [all, f.branch_id]);

  // colour cards (dyeing / finished): one per item code / shade with its own totals
  const colours = useMemo(() => {
    const m = new Map();
    for (const t of baseFiltered) {
      if (!t.shade_id) continue;
      if (!m.has(t.shade_id)) m.set(t.shade_id, { id: t.shade_id, code: t.item_code, no: t.shade_no, name: t.shade_name, hex: t.shade_hex, takas: 0, m: 0, folded: { takas: 0, m: 0 }, unfolded: { takas: 0, m: 0 }, progs: new Map() });
      const g = m.get(t.shade_id);
      g.takas += 1; g.m = r2(g.m + t.stock_m);
      if (t.status === 'FOLDED') { g.folded.takas += 1; g.folded.m = r2(g.folded.m + t.stock_m); }
      if (t.status === 'FINISHED') { g.unfolded.takas += 1; g.unfolded.m = r2(g.unfolded.m + t.stock_m); }
      if (t.program_no) g.progs.set(t.program_no, (g.progs.get(t.program_no) || 0) + 1);
    }
    return [...m.values()].sort((a, b) => natural(a.code || a.no, b.code || b.no));
  }, [baseFiltered]);

  if (error) return <LoadState error={error} />;
  if (!all) return <LoadState loading />;
  const head = all[0];
  if (!head) {
    return (
      <div className="space-y-6">
        <Link to={`/inventory?view=${view}`} className="inline-flex items-center text-sm text-slate-500 hover:text-slate-800"><ArrowLeft className="w-4 h-4 mr-1" /> Inventory</Link>
        <Empty icon={Boxes} title="No stock left" description="This quality has no takas at this stage any more." />
      </div>
    );
  }
  const foldedAll = all.filter((t) => t.status === 'FOLDED');
  const filterCount = ['group_id', 'weaver_id', 'branch_id', 'location_id', 'mill_id', 'shade_id', 'search'].filter((k) => f[k]).length;
  const showBranch = view === 'godown', showMill = view !== 'godown';

  return (
    <div className="space-y-8">
      <div>
        <Link to={`/inventory?view=${view}`} className="inline-flex items-center text-sm text-slate-500 hover:text-slate-800 mb-3"><ArrowLeft className="w-4 h-4 mr-1" /> Inventory</Link>
        <PageHeader title={head.nick_name} description={`${head.original_name} · ${repo.INVENTORY_VIEWS[view].label}`} />
      </div>

      {/* 1 · totals for this quality at this stage */}
      <section>
        <SectionTitle title="Total in stock" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatTile label="Takas" tone={tone} value={fmtInt(total.takas)} />
          <StatTile label="Meters" tone={tone} value={fmtM(total.m)} unit="m" />
          <StatTile label="Average per taka" value={total.takas ? fmtM(total.m / total.takas) : '—'} unit="m" />
          {view === 'finished' ? (
            <StatTile label="Folded (ready to sell)" tone="emerald" value={fmtInt(foldedAll.length)} unit="taka" sub={`${fmtM(r2(foldedAll.reduce((s, t) => s + t.stock_m, 0)))} m · ${fmtInt(total.takas - foldedAll.length)} still to fold`} />
          ) : view === 'dyeing' ? (
            <StatTile label="Programs running" tone="violet" value={programs.length} />
          ) : view === 'mill' ? (
            <StatTile label="Mills holding it" tone="sky" value={mills.length} />
          ) : (
            <StatTile label="Branches" value={branches.length} />
          )}
        </div>
        {view === 'godown' && branches.length > 0 && <BreakdownRow title="By branch" items={branches} active={f.branch_id} onPick={(k) => set('branch_id', String(f.branch_id) === String(k) ? '' : String(k))} />}
        {view === 'mill' && mills.length > 0 && <BreakdownRow title="By mill" items={mills} active={f.mill_id} onPick={(k) => set('mill_id', String(f.mill_id) === String(k) ? '' : String(k))} />}
        {view === 'dyeing' && programs.length > 0 && <BreakdownRow title="By program" items={programs} />}
      </section>

      {/* 2 · colours (dyeing / finished only) */}
      {coloured && (
        <section>
          <SectionTitle title={`Colours in stock (${colours.length})`} hint="Tap a colour to list only its takas below"
            right={f.shade_id && <button className="text-xs text-primary-600 hover:underline" onClick={() => set('shade_id', '')}>Show all colours</button>} />
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {colours.map((c) => {
              const on = String(f.shade_id) === String(c.id);
              return (
                <button key={c.id} type="button" onClick={() => set('shade_id', on ? '' : String(c.id))}
                  className={`text-left rounded-xl border bg-white p-4 transition hover:shadow-md ${on ? 'border-primary-500 ring-2 ring-primary-100' : 'border-slate-200 hover:border-slate-300'}`}>
                  <div className="flex items-center gap-3">
                    <Swatch hex={c.hex} size="lg" />
                    <div className="min-w-0">
                      <div className="font-mono font-bold text-slate-900">{c.code || `Shade ${c.no}`}</div>
                      <div className="text-xs text-slate-500 truncate">Shade {c.no}{c.name ? ` · ${c.name}` : ''}</div>
                    </div>
                  </div>
                  <Qty className="mt-3" tone={tone} takas={c.takas} meters={c.m} />
                  {view === 'finished' ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Chip tone="emerald">{fmtInt(c.folded.takas)} folded · {fmtM(c.folded.m)} m</Chip>
                      {c.unfolded.takas > 0 && <Chip tone="amber">{fmtInt(c.unfolded.takas)} to fold · {fmtM(c.unfolded.m)} m</Chip>}
                    </div>
                  ) : (
                    <div className="mt-3 flex flex-wrap gap-2">{[...c.progs.entries()].map(([p, n]) => <Chip key={p} tone="violet">{p} · {n} taka</Chip>)}</div>
                  )}
                </button>
              );
            })}
            {colours.length === 0 && <div className="text-sm text-slate-500">No colours match the filters.</div>}
          </div>
        </section>
      )}

      {/* 3 · filters + every taka */}
      <section>
        <SectionTitle title="Takas" hint={`${fmtInt(shownTotal.takas)} of ${fmtInt(total.takas)} shown`} />
        <Card>
          <div className="p-4 border-b border-slate-100 bg-slate-50/60 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 items-end">
            <Field label="Party group">
              <Select value={f.group_id} onChange={(e) => set('group_id', e.target.value)}>
                <option value="">All groups</option>
                {groups.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
              </Select>
            </Field>
            <Field label="Party">
              <Select value={f.weaver_id} onChange={(e) => set('weaver_id', e.target.value)}>
                <option value="">All parties</option>
                {parties.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
              </Select>
            </Field>
            {showBranch && (
              <Field label="Branch">
                <Select value={f.branch_id} onChange={(e) => set('branch_id', e.target.value)}>
                  <option value="">All branches</option>
                  {branches.map((b) => <option key={b.key} value={b.key}>{b.label}</option>)}
                </Select>
              </Field>
            )}
            {showBranch && (
              <Field label="Rack">
                <Select value={f.location_id} onChange={(e) => set('location_id', e.target.value)}>
                  <option value="">All racks</option>
                  {racks.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
                </Select>
              </Field>
            )}
            {showMill && (
              <Field label="Mill">
                <Select value={f.mill_id} onChange={(e) => set('mill_id', e.target.value)}>
                  <option value="">All mills</option>
                  {mills.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
                </Select>
              </Field>
            )}
            <Field label="Search">
              <Input placeholder="Challan / taka / party…" value={f.search} onChange={(e) => set('search', e.target.value)} />
            </Field>
            {filterCount > 0 && <button type="button" className="text-xs text-primary-600 hover:underline text-left pb-2" onClick={() => setF({ group_id: '', weaver_id: '', branch_id: '', location_id: '', mill_id: '', shade_id: '', search: '' })}>Clear {filterCount} filter{filterCount > 1 ? 's' : ''}</button>}
          </div>

          {shown.length === 0 ? (
            <div className="p-6"><Empty icon={Boxes} title="No takas match" description="Change or clear the filters." /></div>
          ) : (
            <>
              <Table>
                <thead>
                  <tr>
                    <Th>Taka</Th><Th>Party</Th>
                    {showBranch && <Th>Branch</Th>}{showBranch && <Th>Rack</Th>}
                    {showMill && <Th>Mill</Th>}
                    {coloured && <Th>Colour</Th>}
                    {view === 'dyeing' && <Th>Program</Th>}
                    {view === 'finished' && <Th>State</Th>}
                    <Th className="text-right">Meters</Th>
                  </tr>
                </thead>
                <tbody>
                  {paged.rows.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50">
                      <Td className="font-medium text-slate-900">{t.label}</Td>
                      <Td>{t.weaver_name}<div className="text-xs text-slate-400">{t.group_name}</div></Td>
                      {showBranch && <Td>{t.branch_name || '—'}</Td>}
                      {showBranch && <Td>{t.location_id ? <>{t.shop}<div className="text-xs text-slate-400">{t.rack}</div></> : <Chip tone="amber">No rack</Chip>}</Td>}
                      {showMill && <Td>{t.mill_name || '—'}</Td>}
                      {coloured && <Td><span className="inline-flex items-center gap-2"><Swatch hex={t.shade_hex} size="sm" /><span className="font-mono font-semibold">{t.item_code || t.shade_no || '—'}</span></span></Td>}
                      {view === 'dyeing' && <Td>{t.program_no}</Td>}
                      {view === 'finished' && <Td>{t.status === 'FOLDED' ? <Chip tone="emerald">Folded</Chip> : <Chip tone="amber">To fold</Chip>}</Td>}
                      <Td className="text-right font-semibold tabular-nums">{fmtM(t.stock_m)}<span className="ml-1 text-[11px] font-normal text-slate-400">m</span></Td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50">
                    <Td colSpan={2 + (showBranch ? 2 : 0) + (showMill ? 1 : 0) + (coloured ? 1 : 0) + (view === 'dyeing' || view === 'finished' ? 1 : 0)} className="font-semibold text-slate-700">Total ({fmtInt(shownTotal.takas)} taka)</Td>
                    <Td className="text-right font-bold tabular-nums">{fmtM(shownTotal.m)}<span className="ml-1 text-[11px] font-normal text-slate-400">m</span></Td>
                  </tr>
                </tfoot>
              </Table>
              <Pager paged={paged} />
            </>
          )}
        </Card>
      </section>
    </div>
  );
}

/** Row of small figures ("Surat Godown 36 taka · 3,536 m"); clickable ones act as a filter. */
function BreakdownRow({ title, items, active, onPick }) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 mr-1">{title}</span>
      {items.map((i) => {
        const on = active !== undefined && String(active) === String(i.key);
        return (
          <button key={i.key} type="button" disabled={!onPick} onClick={() => onPick?.(i.key)}
            className={`rounded-lg border px-3 py-1.5 text-sm bg-white tabular-nums ${on ? 'border-primary-500 ring-2 ring-primary-100' : 'border-slate-200'} ${onPick ? 'hover:border-slate-300' : 'cursor-default'}`}>
            <span className="font-medium text-slate-800">{i.label}</span>
            <span className="mx-2 text-slate-300">|</span>
            <strong>{fmtInt(i.takas)}</strong> <span className="text-xs text-slate-400">taka</span>
            <span className="mx-1.5 text-slate-300">·</span>
            <strong>{fmtM(i.m)}</strong> <span className="text-xs text-slate-400">m</span>
          </button>
        );
      })}
    </div>
  );
}
