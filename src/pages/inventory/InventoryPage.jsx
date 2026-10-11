import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader, Card, Select, Input, Table, Th, Td, Empty, Alert, LoadState, Pager, usePaged } from '../../components/ui';
import { Boxes, CheckCircle2 } from 'lucide-react';
import { fmtM, fmtInt } from '../../lib/format';
import * as repo from '../../db/repo';

const VIEWS = ['godown', 'mill', 'dyeing', 'finished'];
const natural = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true });

export default function InventoryPage() {
  const [params, setParams] = useSearchParams();
  const view = VIEWS.includes(params.get('view')) ? params.get('view') : 'godown';
  const [counts, setCounts] = useState(null);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [masters, setMasters] = useState({ qualities: [], groups: [], mills: [], shades: [], locations: [] });
  const [f, setF] = useState({ quality_id: '', group_id: '', weaver_id: '', mill_id: '', shade_id: '', location_id: '' });
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [qualities, groups, mills, shades, locations] = await Promise.all([repo.listQualities(), repo.listWeaverGroups(), repo.listMills(), repo.listShades(), repo.listLocations()]);
        setMasters({ qualities, groups, mills, shades, locations });
      } catch (e) { setError(e.message); }
    })();
  }, []);

  useEffect(() => {
    let live = true;
    setLoading(true);
    // filters that are not shown for this view must not silently hide stock
    const eff = { ...f };
    if (view === 'godown') { eff.mill_id = ''; eff.shade_id = ''; }
    if (view === 'mill') eff.shade_id = '';
    if (view !== 'godown') eff.location_id = '';
    Promise.all([repo.inventoryCounts(), repo.inventoryList(view, eff)])
      .then(([c, r]) => { if (live) { setCounts(c); setRows(r); setError(''); } })
      .catch((e) => live && setError(e.message))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [view, f]);

  const set = (k, v) => setF((p) => ({ ...p, [k]: v, ...(k === 'group_id' ? { weaver_id: '' } : {}) }));
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (q ? rows.filter((t) => `${t.challan_no}/${t.taka_no} ${t.nick_name} ${t.weaver_name}`.toLowerCase().includes(q)) : rows)
      .sort((a, b) => natural(a.challan_no, b.challan_no) || natural(a.taka_no, b.taka_no));
  }, [rows, search]);
  const paged = usePaged(shown, 100);

  const totals = useMemo(() => ({ takas: shown.length, m: Math.round(shown.reduce((s, t) => s + t.stock_m, 0) * 100) / 100 }), [shown]);
  const summary = useMemo(() => {
    const m = new Map();
    for (const t of shown) {
      const key = `${t.quality_id}|${view === 'godown' || view === 'mill' ? '' : t.shade_id}`;
      if (!m.has(key)) m.set(key, { key, quality: t.nick_name, shade: view === 'godown' || view === 'mill' ? null : t.shade_no, hex: t.shade_hex, takas: 0, m: 0 });
      const g = m.get(key); g.takas += 1; g.m = Math.round((g.m + t.stock_m) * 100) / 100;
    }
    return [...m.values()].sort((a, b) => natural(a.quality, b.quality) || natural(a.shade || '', b.shade || ''));
  }, [shown, view]);

  const group = masters.groups.find((g) => String(g.id) === f.group_id);
  const parties = masters.groups.flatMap((g) => g.firms.map((w) => ({ ...w, group_name: g.name }))).filter((w) => !f.group_id || String(w.group_id) === f.group_id);
  const showShade = view === 'dyeing' || view === 'finished';
  const showMill = view !== 'godown';

  if (error && !counts) return <LoadState error={error} />;

  return (
    <div className="space-y-6">
      <PageHeader title="Inventory" description="Four kinds of stock — every total below is the sum of the taka rows shown." />

      {counts && (counts.reconciled
        ? <Alert tone="success"><span className="inline-flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Reconciled: {fmtInt(counts.views.godown.takas)} + {fmtInt(counts.views.mill.takas)} + {fmtInt(counts.views.dyeing.takas)} + {fmtInt(counts.views.finished.takas)} = {fmtInt(counts.sum)} takas = all active takas ({fmtInt(counts.sold)} already sold are not stock).</span></Alert>
        : <Alert>Stock does not reconcile: views add up to {counts.sum} takas but {counts.active} takas are active{counts.other ? ` (${counts.other} in an unknown state)` : ''}.</Alert>)}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {VIEWS.map((v) => (
          <button key={v} type="button" id={`view-${v}`} onClick={() => setParams({ view: v })}
            className={`text-left rounded-xl border p-4 bg-white transition ${view === v ? 'border-primary-500 ring-2 ring-primary-200' : 'border-slate-200 hover:border-slate-300'}`}>
            <div className="text-sm text-slate-500">{repo.INVENTORY_VIEWS[v].label}</div>
            <div className="text-2xl font-bold text-slate-900">{counts ? fmtInt(counts.views[v].takas) : '—'} <span className="text-sm font-normal text-slate-500">taka</span></div>
            <div className="text-sm text-slate-600">{counts ? fmtM(counts.views[v].m) : '—'} m</div>
          </button>
        ))}
      </div>

      <Card>
        <div className="p-4 border-b border-slate-100 flex flex-wrap gap-3 items-center bg-slate-50/50">
          <Select className="w-40" value={f.quality_id} onChange={(e) => set('quality_id', e.target.value)}>
            <option value="">All qualities</option>
            {masters.qualities.map((q) => <option key={q.id} value={q.id}>{q.nick_name}</option>)}
          </Select>
          <Select className="w-44" value={f.group_id} onChange={(e) => set('group_id', e.target.value)}>
            <option value="">All party groups</option>
            {masters.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </Select>
          <Select className="w-44" value={f.weaver_id} onChange={(e) => set('weaver_id', e.target.value)}>
            <option value="">All parties{group ? ` in ${group.name}` : ''}</option>
            {parties.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </Select>
          {showMill && (
            <Select className="w-40" value={f.mill_id} onChange={(e) => set('mill_id', e.target.value)}>
              <option value="">All mills</option>
              {masters.mills.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </Select>
          )}
          {showShade && (
            <Select className="w-44" value={f.shade_id} onChange={(e) => set('shade_id', e.target.value)}>
              <option value="">All shades</option>
              {masters.shades.map((s) => <option key={s.id} value={s.id}>{s.chart_name}: {s.number}</option>)}
            </Select>
          )}
          {view === 'godown' && (
            <Select className="w-48" value={f.location_id} onChange={(e) => set('location_id', e.target.value)}>
              <option value="">All racks</option>
              {masters.locations.map((l) => <option key={l.id} value={l.id}>{repo.locLabel(l.shop, l.rack)}</option>)}
            </Select>
          )}
          <Input className="w-44" placeholder="Search taka / party…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="ml-auto text-sm font-medium text-slate-700" id="inv-total">{fmtInt(totals.takas)} takas · {fmtM(totals.m)} m</div>
        </div>

        {loading ? <div className="p-12 text-center text-slate-500">Loading...</div> : shown.length === 0 ? (
          <div className="p-6"><Empty icon={Boxes} title="No stock here" description="Nothing matches this view and these filters." /></div>
        ) : (
          <>
            <div className="p-4 border-b border-slate-100">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Summary</div>
              <div className="flex flex-wrap gap-2 text-sm">
                {summary.map((g) => (
                  <span key={g.key} className="inline-flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
                    {g.hex && <span className="w-3 h-3 rounded-sm border border-slate-200" style={{ backgroundColor: g.hex }} />}
                    {g.quality}{g.shade ? ` · ${g.shade}` : ''}: <strong>{g.takas}</strong> tk · {fmtM(g.m)} m
                  </span>
                ))}
              </div>
            </div>
            <Table>
              <thead>
                <tr>
                  <Th>Taka</Th><Th>Quality</Th><Th>Party</Th>
                  {view === 'godown' && <Th>Rack</Th>}
                  {showMill && <Th>Mill</Th>}
                  {showShade && <Th>Shade</Th>}
                  {view === 'dyeing' && <Th>Program</Th>}
                  {view === 'finished' && <Th>State</Th>}
                  <Th className="text-right">Meters</Th>
                </tr>
              </thead>
              <tbody>
                {paged.rows.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <Td className="font-medium text-slate-900">{t.label}</Td>
                    <Td>{t.nick_name}</Td>
                    <Td>{t.weaver_name}</Td>
                    {view === 'godown' && <Td>{t.location_id ? repo.locLabel(t.shop, t.rack) : <span className="text-amber-600 text-xs font-medium">Unassigned</span>}</Td>}
                    {showMill && <Td>{t.mill_name || '—'}</Td>}
                    {showShade && <Td><span className="inline-flex items-center gap-2"><span className="w-3 h-3 rounded-sm border border-slate-200" style={{ backgroundColor: t.shade_hex || '#ccc' }} />{t.shade_no || '—'}</span></Td>}
                    {view === 'dyeing' && <Td>{t.program_no}</Td>}
                    {view === 'finished' && <Td>{t.status === 'FOLDED' ? 'Folded (ready)' : 'Not folded yet'}</Td>}
                    <Td className="text-right">{fmtM(t.stock_m)}</Td>
                  </tr>
                ))}
                <tr className="bg-slate-50 font-bold">
                  <Td colSpan={3 + (view === 'godown' ? 1 : 0) + (showMill ? 1 : 0) + (showShade ? 1 : 0) + (view === 'dyeing' || view === 'finished' ? 1 : 0)}>Total</Td>
                  <Td className="text-right">{fmtM(totals.m)}</Td>
                </tr>
              </tbody>
            </Table>
            <Pager paged={paged} />
          </>
        )}
      </Card>
    </div>
  );
}
