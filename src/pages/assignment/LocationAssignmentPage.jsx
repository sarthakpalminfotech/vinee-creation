import React, { useState, useEffect, useMemo, useRef } from 'react';
import { PageHeader, Card, Button, Table, Th, Td, Select, Input, Empty, Modal, Alert, LoadState, Pager, usePaged, useAction, Field } from '../../components/ui';
import { Qty, Chip, SearchToggle, FilterButton, SectionTitle } from '../../components/kit';
import { MapPin, CheckCircle, History } from 'lucide-react';
import { fmtM, fmtInt } from '../../lib/format';
import * as repo from '../../db/repo';
import { useDbVersion } from '../../lib/live';

const natural = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true });

/** Rack / Godown: stock by branch and rack first, then the takas of our godowns with bulk rack assignment. */
export default function LocationAssignmentPage() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [takas, setTakas] = useState([]);
  const [locations, setLocations] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
  // always visible filters
  const [branchFilter, setBranchFilter] = useState('');
  const [qualityFilter, setQualityFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('UNASSIGNED'); // UNASSIGNED | ASSIGNED | ALL
  // inside the filter modal
  const [challanFilter, setChallanFilter] = useState('');
  const [rackFilter, setRackFilter] = useState('');
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
  const dbVersion = useDbVersion();
  useEffect(() => { load(); }, [dbVersion]);

  const branches = useMemo(() => [...new Map(takas.map((t) => [String(t.branch_id ?? ''), t.branch_name || 'No branch'])).entries()], [takas]);
  const qualities = useMemo(() => [...new Map(takas.map((t) => [t.quality_id, t.nick_name])).entries()], [takas]);
  const challans = useMemo(() => [...new Map(takas.filter((t) => !qualityFilter || String(t.quality_id) === qualityFilter).map((t) => [t.receipt_id, `${t.challan_no} · ${t.weaver_name}`])).entries()], [takas, qualityFilter]);
  const filterRacks = useMemo(() => locations.filter((l) => !branchFilter || String(l.branch_id) === branchFilter), [locations, branchFilter]);

  // racks the selected takas may go to: only those of their branch
  const selBranchIds = useMemo(() => new Set(takas.filter((t) => selected.has(t.id)).map((t) => String(t.branch_id ?? ''))), [takas, selected]);
  const targetRacks = useMemo(() => (selBranchIds.size ? locations.filter((l) => selBranchIds.size === 1 && selBranchIds.has(String(l.branch_id))) : locations), [locations, selBranchIds]);

  const filtered = useMemo(() => takas.filter((t) => {
    if (branchFilter && String(t.branch_id) !== branchFilter) return false;
    if (qualityFilter && String(t.quality_id) !== qualityFilter) return false;
    if (typeFilter === 'UNASSIGNED' && t.location_id) return false;
    if (typeFilter === 'ASSIGNED' && !t.location_id) return false;
    if (challanFilter && String(t.receipt_id) !== challanFilter) return false;
    if (rackFilter && String(t.location_id) !== rackFilter) return false;
    if (search && !`${t.challan_no}/${t.taka_no} ${t.weaver_name}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }).sort((a, b) => natural(a.challan_no, b.challan_no) || natural(a.taka_no, b.taka_no)), [takas, branchFilter, qualityFilter, typeFilter, challanFilter, rackFilter, search]);

  const paged = usePaged(filtered, 100);
  const modalFilterCount = (challanFilter ? 1 : 0) + (rackFilter ? 1 : 0);

  // stock by branch → rack (R-LOC-3)
  const byBranch = useMemo(() => {
    const m = new Map();
    for (const g of repo.groupPickList(takas)) {
      const k = g.branch || 'No branch';
      if (!m.has(k)) m.set(k, { name: k, racks: [], count: 0, meters: 0 });
      const b = m.get(k); b.racks.push(g); b.count += g.count; b.meters = Math.round((b.meters + g.meters) * 100) / 100;
    }
    return [...m.values()].sort((a, b) => natural(a.name, b.name));
  }, [takas]);

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
    const l = locations.find((x) => String(x.id) === String(target)) || {};
    setMsg(`${n} taka(s) assigned to ${repo.locLabel(l.shop, l.rack, l.branch_name)}.`);
    setSelected(new Set()); setTarget('');
    await load();
  });

  const showHistory = async (t) => setHistory({ taka: t, rows: await repo.getTakaHistory(t.id) });
  const clearModal = () => { setChallanFilter(''); setRackFilter(''); };

  if (loading || loadError) return <LoadState loading={loading} error={loadError} onRetry={load} />;

  return (
    <div className="space-y-8">
      <PageHeader title="Rack / Godown" description="Grey cloth at our place: see stock by branch and rack, then assign takas to racks in bulk." />

      {/* 1 · stock by branch and rack */}
      <section>
        <SectionTitle title="Grey stock by branch and rack" hint="Tap a rack to see which takas are on it" />
        {byBranch.length === 0 ? <Card className="p-5 text-sm text-slate-500">No grey stock in our godown.</Card> : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {byBranch.map((b) => (
              <Card key={b.name} className="overflow-visible">
                <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-slate-100 bg-slate-50/60">
                  <div className="flex items-center gap-2 font-semibold text-slate-900"><MapPin className="w-4 h-4 text-slate-400" />{b.name}</div>
                  <Qty variant="inline" takas={b.count} meters={b.meters} />
                </div>
                <div className="divide-y divide-slate-100">
                  {b.racks.map((g) => {
                    const open = openRacks.has(g.key);
                    return (
                      <div key={g.key}>
                        <button type="button" className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50"
                          onClick={() => setOpenRacks((p) => { const n = new Set(p); if (n.has(g.key)) n.delete(g.key); else n.add(g.key); return n; })}>
                          <span className="min-w-0">
                            {g.rack ? <><span className="font-medium text-slate-900">{g.rack}</span><span className="ml-2 text-xs text-slate-400">{g.shop}</span></> : <Chip tone="amber">No rack assigned</Chip>}
                          </span>
                          <Qty variant="cell" takas={g.count} meters={g.meters} />
                        </button>
                        {open && <div className="px-4 pb-3 text-xs text-slate-600 flex flex-wrap gap-1.5">{g.takas.map((t) => <span key={t.id} className="px-2 py-1 bg-slate-100 rounded">{t.challan_no}/{t.taka_no} · {fmtM(t.grey_meter)} m</span>)}</div>}
                      </div>
                    );
                  })}
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* 2 · assign to a rack */}
      <section>
        <SectionTitle title="Assign takas to a rack" />
        <Card className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-sm text-slate-600"><strong className="text-slate-900">{fmtInt(selected.size)}</strong> taka selected · <strong className="text-slate-900">{fmtM(selMeters)}</strong> m</div>
            <div className="w-full sm:w-72 sm:ml-auto">
              <Select value={target} onChange={(e) => setTarget(e.target.value)} id="target-rack">
                <option value="">Move to rack…</option>
                {targetRacks.map((l) => <option key={l.id} value={l.id}>{repo.locLabel(l.shop, l.rack, l.branch_name)}</option>)}
              </Select>
            </div>
            <Button id="apply-rack" onClick={apply} disabled={busy || !target || selected.size === 0}><CheckCircle className="w-4 h-4 mr-2" />{busy ? 'Saving…' : `Apply (${selected.size})`}</Button>
          </div>
          {selBranchIds.size > 1 && <div className="text-xs text-amber-600">Selected takas are from different branches — assign one branch at a time.</div>}
          <Alert>{error}</Alert>
          <Alert tone="success">{msg}</Alert>
        </Card>
      </section>

      {/* 3 · the takas */}
      <section>
        <SectionTitle title="Takas in our godown" hint={`${fmtInt(filtered.length)} shown · tip: click one taka, then shift-click another to select the whole range`} />
        <Card>
          <div className="p-4 border-b border-slate-100 flex flex-wrap items-center gap-3">
            <Select className="w-44" value={branchFilter} onChange={(e) => { setBranchFilter(e.target.value); setRackFilter(''); }}>
              <option value="">All branches</option>
              {branches.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </Select>
            <Select className="w-44" value={qualityFilter} onChange={(e) => { setQualityFilter(e.target.value); setChallanFilter(''); }}>
              <option value="">All qualities</option>
              {qualities.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </Select>
            <Select className="w-44" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="UNASSIGNED">No rack yet</option>
              <option value="ASSIGNED">On a rack</option>
              <option value="ALL">All takas</option>
            </Select>
            <div className="ml-auto flex items-center gap-2">
              <SearchToggle value={search} onChange={setSearch} placeholder="Search challan / taka / party…" />
              <FilterButton count={modalFilterCount} onClear={clearModal} title="More filters">
                <Field label="Challan">
                  <Select value={challanFilter} onChange={(e) => setChallanFilter(e.target.value)}>
                    <option value="">All challans</option>
                    {challans.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                  </Select>
                </Field>
                <Field label="Specific rack">
                  <Select value={rackFilter} onChange={(e) => setRackFilter(e.target.value)}>
                    <option value="">Any rack</option>
                    {filterRacks.map((l) => <option key={l.id} value={l.id}>{repo.locLabel(l.shop, l.rack, branchFilter ? '' : l.branch_name)}</option>)}
                  </Select>
                </Field>
              </FilterButton>
            </div>
          </div>
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/60 flex flex-wrap items-center gap-2">
            <Input className="w-24" inputMode="numeric" placeholder="First N" value={firstN} onChange={(e) => setFirstN(e.target.value)} aria-label="First N takas" />
            <Button variant="outline" onClick={selectFirst} disabled={!firstN}>Select N</Button>
            <Button variant="outline" onClick={selectAllShown} disabled={!filtered.length}>Select all shown ({filtered.length})</Button>
            <Button variant="ghost" onClick={clear} disabled={!selected.size}>Clear selection</Button>
          </div>

          {filtered.length === 0 ? (
            <div className="p-6"><Empty icon={MapPin} title="No takas match" description="Only grey takas still in our godown can be assigned to a rack." /></div>
          ) : (
            <>
              <Table>
                <thead>
                  <tr>
                    <Th className="w-12"><input type="checkbox" className="w-5 h-5" aria-label="Select all shown" checked={filtered.length > 0 && filtered.every((t) => selected.has(t.id))} onChange={(e) => (e.target.checked ? selectAllShown() : clear())} /></Th>
                    <Th>Taka</Th><Th>Quality</Th><Th>Party</Th><Th>Branch</Th><Th className="text-right">Meters</Th><Th>Current rack</Th><Th className="w-14"></Th>
                  </tr>
                </thead>
                <tbody>
                  {paged.rows.map((t) => (
                    <tr key={t.id} className={`hover:bg-slate-50 cursor-pointer ${selected.has(t.id) ? 'bg-primary-50/50' : ''}`} onClick={(e) => toggle(t.id, e.shiftKey)}>
                      <Td><input type="checkbox" className="w-5 h-5" readOnly checked={selected.has(t.id)} aria-label={`Select ${t.challan_no}/${t.taka_no}`} /></Td>
                      <Td className="font-medium text-slate-900">{t.challan_no}/{t.taka_no}</Td>
                      <Td>{t.nick_name}</Td>
                      <Td>{t.weaver_name}</Td>
                      <Td>{t.branch_name || '—'}</Td>
                      <Td className="text-right font-semibold">{fmtM(t.grey_meter)}<span className="ml-1 text-[11px] font-normal text-slate-400">m</span></Td>
                      <Td>{t.location_id ? <>{t.shop}<div className="text-xs text-slate-400">{t.rack}</div></> : <Chip tone="amber">No rack</Chip>}</Td>
                      <Td className="text-right" onClick={(e) => e.stopPropagation()}>
                        <button type="button" className="p-2 text-slate-400 hover:text-primary-600" title="Movement history" onClick={() => showHistory(t)}><History className="w-5 h-5" /></button>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              <Pager paged={paged} />
            </>
          )}
        </Card>
      </section>

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
