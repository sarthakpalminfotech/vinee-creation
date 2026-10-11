import React, { useState, useEffect, useMemo, useRef } from 'react';
import { PageHeader, Card, Button, Table, Th, Td, Select, Input, Empty, Modal, Alert, LoadState, Pager, usePaged, useAction } from '../../components/ui';
import { MapPin, CheckCircle, History, ChevronRight } from 'lucide-react';
import { fmtM } from '../../lib/format';
import * as repo from '../../db/repo';

const natural = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true });

export default function LocationAssignmentPage() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [takas, setTakas] = useState([]);
  const [locations, setLocations] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
  const [qualityFilter, setQualityFilter] = useState('');
  const [challanFilter, setChallanFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('UNASSIGNED');
  const [search, setSearch] = useState('');
  const [firstN, setFirstN] = useState('');
  const [target, setTarget] = useState('');
  const [msg, setMsg] = useState('');
  const [history, setHistory] = useState(null);
  const [openRacks, setOpenRacks] = useState(() => new Set());
  const lastClicked = useRef(null);
  const { busy, error, run } = useAction();

  async function load() {
    try {
      const [all, locs] = await Promise.all([repo.listTakas("WHERE t.status='GODOWN_GREY'"), repo.listLocations()]);
      setTakas(all); setLocations(locs); setLoadError('');
    } catch (e) { setLoadError(e.message); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const qualities = useMemo(() => [...new Map(takas.map((t) => [t.quality_id, t.nick_name])).entries()], [takas]);
  const challans = useMemo(() => [...new Map(takas.map((t) => [t.receipt_id, `${t.challan_no} · ${t.weaver_name}`])).entries()], [takas]);

  const filtered = useMemo(() => takas.filter((t) => {
    if (qualityFilter && String(t.quality_id) !== qualityFilter) return false;
    if (challanFilter && String(t.receipt_id) !== challanFilter) return false;
    if (locationFilter === 'UNASSIGNED' && t.location_id) return false;
    if (locationFilter !== 'ALL' && locationFilter !== 'UNASSIGNED' && String(t.location_id) !== locationFilter) return false;
    if (search && !`${t.challan_no}/${t.taka_no}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }).sort((a, b) => natural(a.challan_no, b.challan_no) || natural(a.taka_no, b.taka_no)), [takas, qualityFilter, challanFilter, locationFilter, search]);

  const paged = usePaged(filtered, 100);

  // stock by location (R-LOC-3)
  const byLocation = useMemo(() => repo.groupPickList(takas), [takas]);
  const byShop = useMemo(() => {
    const m = new Map();
    for (const g of byLocation) { const k = g.shop || ''; if (!m.has(k)) m.set(k, { shop: k, racks: [], count: 0, meters: 0 }); const s = m.get(k); s.racks.push(g); s.count += g.count; s.meters += g.meters; }
    return [...m.values()];
  }, [byLocation]);

  const toggle = (id, shift) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (shift && lastClicked.current != null) {
        const ids = filtered.map((t) => t.id);
        const a = ids.indexOf(lastClicked.current), b = ids.indexOf(id);
        if (a >= 0 && b >= 0) { for (const x of ids.slice(Math.min(a, b), Math.max(a, b) + 1)) next.add(x); return next; }
      }
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    lastClicked.current = id;
  };
  const selectAllShown = () => setSelected((p) => new Set([...p, ...filtered.map((t) => t.id)]));
  const selectFirst = () => { const n = Number.parseInt(firstN, 10); if (n > 0) setSelected((p) => new Set([...p, ...filtered.slice(0, n).map((t) => t.id)])); };
  const clear = () => setSelected(new Set());

  const selTakas = takas.filter((t) => selected.has(t.id));
  const selMeters = selTakas.reduce((s, t) => s + Number(t.grey_meter), 0);

  const apply = () => run(async () => {
    if (!target) throw new Error('Choose the rack to assign to');
    const n = await repo.assignLocation([...selected], Number(target));
    setMsg(`${n} taka(s) assigned to ${repo.locLabel(...(({ shop, rack }) => [shop, rack])(locations.find((l) => String(l.id) === String(target)) || {}))}.`);
    setSelected(new Set()); setTarget('');
    await load();
  });

  const showHistory = async (t) => setHistory({ taka: t, rows: await repo.getTakaHistory(t.id) });

  if (loading || loadError) return <LoadState loading={loading} error={loadError} onRetry={load} />;

  return (
    <div className="space-y-6">
      <PageHeader title="Rack / Godown" description="Grey fabric at our place: assign takas to racks in bulk, move them, and see stock by shop and rack." />

      <Card className="p-4 flex flex-wrap gap-3 items-center">
        <span className="text-sm font-medium text-slate-600">Assign {selected.size} selected ({fmtM(selMeters)} m) to</span>
        <div className="w-64">
          <Select value={target} onChange={(e) => setTarget(e.target.value)} id="target-rack">
            <option value="">Select rack…</option>
            {locations.map((l) => <option key={l.id} value={l.id}>{repo.locLabel(l.shop, l.rack)}</option>)}
          </Select>
        </div>
        <Button id="apply-rack" onClick={apply} disabled={busy || !target || selected.size === 0}><CheckCircle className="w-4 h-4 mr-2" />{busy ? 'Saving…' : `Apply (${selected.size})`}</Button>
        <Alert>{error}</Alert>
        <Alert tone="success">{msg}</Alert>
      </Card>

      <Card>
        <div className="p-4 border-b border-slate-100 flex flex-wrap gap-3 items-center bg-slate-50/50">
          <Select className="w-44" value={qualityFilter} onChange={(e) => setQualityFilter(e.target.value)}>
            <option value="">All qualities</option>
            {qualities.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </Select>
          <Select className="w-56" value={challanFilter} onChange={(e) => setChallanFilter(e.target.value)}>
            <option value="">All challans</option>
            {challans.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </Select>
          <Select className="w-48" value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)}>
            <option value="UNASSIGNED">Unassigned only</option>
            <option value="ALL">All racks</option>
            {locations.map((l) => <option key={l.id} value={l.id}>{repo.locLabel(l.shop, l.rack)}</option>)}
          </Select>
          <Input className="w-40" placeholder="Search taka…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="flex-1 flex flex-wrap justify-end gap-2 items-center">
            <Input className="w-20 h-8" inputMode="numeric" placeholder="First N" value={firstN} onChange={(e) => setFirstN(e.target.value)} aria-label="First N takas" />
            <Button variant="outline" size="sm" onClick={selectFirst} disabled={!firstN}>Select N</Button>
            <Button variant="outline" size="sm" onClick={selectAllShown} disabled={!filtered.length}>Select all shown ({filtered.length})</Button>
            <Button variant="ghost" size="sm" onClick={clear}>Clear</Button>
          </div>
        </div>
        <p className="px-4 pt-2 text-xs text-slate-400">Tip: click one taka, then shift-click another to select the whole range.</p>

        {filtered.length === 0 ? (
          <div className="p-6"><Empty icon={MapPin} title="No takas match" description="Only grey takas still in our godown can be assigned to a rack." /></div>
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th className="w-12"><input type="checkbox" aria-label="Select all shown" checked={filtered.length > 0 && filtered.every((t) => selected.has(t.id))} onChange={(e) => (e.target.checked ? selectAllShown() : clear())} /></Th>
                  <Th>Taka</Th><Th>Quality</Th><Th>Party</Th><Th className="text-right">Meters</Th><Th>Current rack</Th><Th></Th>
                </tr>
              </thead>
              <tbody>
                {paged.rows.map((t) => (
                  <tr key={t.id} className={`hover:bg-slate-50 cursor-pointer ${selected.has(t.id) ? 'bg-primary-50/50' : ''}`} onClick={(e) => toggle(t.id, e.shiftKey)}>
                    <Td><input type="checkbox" readOnly checked={selected.has(t.id)} aria-label={`Select ${t.challan_no}/${t.taka_no}`} /></Td>
                    <Td className="font-medium text-slate-900">{t.challan_no}/{t.taka_no}</Td>
                    <Td>{t.nick_name}</Td>
                    <Td>{t.weaver_name}</Td>
                    <Td className="text-right">{fmtM(t.grey_meter)}</Td>
                    <Td>{t.location_id ? repo.locLabel(t.shop, t.rack) : <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-full border border-amber-200">Unassigned</span>}</Td>
                    <Td className="text-right" onClick={(e) => e.stopPropagation()}>
                      <button type="button" className="p-1 text-slate-400 hover:text-primary-600" title="Movement history" onClick={() => showHistory(t)}><History className="w-4 h-4" /></button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pager paged={paged} />
          </>
        )}
      </Card>

      <Card>
        <div className="p-4 border-b border-slate-100 font-semibold text-slate-900">Grey stock by location</div>
        {byShop.length === 0 ? <div className="p-6 text-sm text-slate-500">No grey stock in our godown.</div> : (
          <div className="divide-y divide-slate-100">
            {byShop.map((s) => (
              <div key={s.shop || 'none'} className="p-4">
                <div className="flex justify-between font-medium text-slate-900">
                  <span>{s.shop || 'No rack assigned'}</span><span>{s.count} taka · {fmtM(s.meters)} m</span>
                </div>
                <div className="mt-2 space-y-1">
                  {s.racks.map((g) => {
                    const open = openRacks.has(g.key);
                    return (
                      <div key={g.key}>
                        <button type="button" className="w-full flex items-center justify-between text-sm py-1.5 px-2 rounded hover:bg-slate-50"
                          onClick={() => setOpenRacks((p) => { const n = new Set(p); if (n.has(g.key)) n.delete(g.key); else n.add(g.key); return n; })}>
                          <span className="flex items-center gap-1"><ChevronRight className={`w-4 h-4 transition-transform ${open ? 'rotate-90' : ''}`} />{g.rack || 'Unassigned'}</span>
                          <span className="text-slate-600">{g.count} taka · {fmtM(g.meters)} m</span>
                        </button>
                        {open && <div className="ml-6 text-xs text-slate-500 flex flex-wrap gap-1.5 py-1">{g.takas.map((t) => <span key={t.id} className="px-1.5 py-0.5 bg-slate-100 rounded">{t.challan_no}/{t.taka_no} · {fmtM(t.grey_meter)}</span>)}</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal isOpen={!!history} onClose={() => setHistory(null)} title={history ? `History · ${history.taka.challan_no}/${history.taka.taka_no}` : ''} maxWidth="max-w-xl">
        <ul className="space-y-2 text-sm max-h-96 overflow-y-auto">
          {history?.rows.map((h) => (
            <li key={h.id} className="flex justify-between gap-3 border-b border-slate-100 pb-1.5">
              <span>{h.note || h.to_status}{h.from_rack || h.to_rack ? ` · ${h.from_rack ? repo.locLabel(h.from_shop, h.from_rack) : 'none'} → ${h.to_rack ? repo.locLabel(h.to_shop, h.to_rack) : 'none'}` : ''}{h.mill_name ? ` · ${h.mill_name}` : ''}</span>
              <span className="text-slate-400 whitespace-nowrap">{h.at?.slice(0, 16).replace('T', ' ')}</span>
            </li>
          ))}
          {history && history.rows.length === 0 && <li className="text-slate-500">No recorded movements (taka pre-dates history tracking).</li>}
        </ul>
      </Modal>
    </div>
  );
}
