import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PageHeader, Card, Button, Input, Select, Table, Th, Td, Alert, LoadState, Pager, usePaged, useAction, Modal } from '../../components/ui';
import { fmtM, fmtDate } from '../../lib/format';
import { Scissors, Factory, FileText, ChevronDown, ChevronLeft, AlertTriangle, Mic, Image as ImageIcon } from 'lucide-react';
import * as repo from '../../db/repo';
import { useDbVersion } from '../../lib/live';
import { DetailList, SearchToggle, ShadeSwatch } from '../../components/kit';
import { SearchArea } from '../../components/ui';
import { uploadMedia } from '../../lib/cloudinary';
import { saveVoice } from '../../lib/voiceStore';
import { DamageTag, DamageDetailsModal } from '../../components/DamageDetails';
import DamageModal from './DamageModal';

export default function FoldingPage() {
  const [loading, setLoading] = useState(true);
  const [takas, setTakas] = useState([]);
  const [search, setSearch] = useState('');
  const [qualityFilter, setQualityFilter] = useState('');
  const [loadError, setLoadError] = useState('');
  const [okMsg, setOkMsg] = useState('');
  const { busy, error, setError, run } = useAction();
  const [foldedAll, setFoldedAll] = useState([]); // every taka of the open challan that is already folded
  const [showFolded, setShowFolded] = useState(false);
  const [openKey, setOpenKey] = useState(null); // challan being folded; null = challan list
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [damageRow, setDamageRow] = useState(null); // taka whose damage is being marked
  const [details, setDetails] = useState(null); // damaged taka whose details are shown
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [params] = useSearchParams();
  const wantOpen = params.get('open'); // ?open=<mill return challan id>: straight into that challan ("Fold these takas now")

  async function load() {
    try {
      const all = await repo.listTakas("WHERE t.status='FINISHED'");
      all.sort((a, b) => {
        const q = (a.nick_name || '').localeCompare(b.nick_name || '');
        if (q !== 0) return q;
        return (a.shade_no || '').localeCompare(b.shade_no || '');
      });
      // keep what the user already did to takas that are still pending (selection, folded meters, damage)
      setTakas(prev => {
        const old = new Map(prev.map(t => [t.id, t]));
        return all.map(t => {
          const o = old.get(t.id);
          return { ...t, selected: o ? o.selected : false, input_folded_meter: o ? o.input_folded_meter : t.finished_meter, damage: o ? o.damage : null };
        });
      });
    } catch (e) {
      setLoadError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const dbVersion = useDbVersion();
  useEffect(() => {
    load();
  }, [dbVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  // folded takas of the open challan (collapsed section + the "folded 2/10" figure)
  useEffect(() => {
    setShowFolded(false);
    if (!openKey || !/^[0-9]+$/.test(openKey)) { setFoldedAll([]); return undefined; }
    let live = true;
    repo.listTakas("WHERE t.finished_receipt_id=? AND t.status<>'FINISHED'", [Number(openKey)])
      .then(r => live && setFoldedAll(r)).catch(() => live && setFoldedAll([]));
    return () => { live = false; };
  }, [openKey, dbVersion]);

  const keyOf = t => String(t.finished_receipt_id ?? `r${t.receipt_id}`);
  /** Opening a challan selects ALL its pending takas (folded meters default to the finished meters); the user deselects what is not ready. */
  const openChallan = (k) => {
    setOkMsg(''); setError('');
    setTakas(prev => prev.map(t => (keyOf(t) === k ? { ...t, selected: true } : t)));
    setOpenKey(k);
  };

  useEffect(() => { // eslint-disable-line react-hooks/exhaustive-deps
    if (wantOpen && !loading && openKey !== wantOpen && takas.some(t => keyOf(t) === wantOpen)) openChallan(wantOpen);
  }, [wantOpen, loading, takas.length]);

  const toggleRow = (tId) => setTakas(takas.map(r => r.id === tId ? { ...r, selected: !r.selected } : r));
  const updateRow = (tId, val) => setTakas(takas.map(r => r.id === tId ? { ...r, input_folded_meter: val, selected: true } : r));
  const setDamage = (tId, damage) => setTakas(takas.map(r => r.id === tId ? { ...r, damage, selected: true } : r));

  const selectedRows = takas.filter(r => r.selected);
  const totalFin = selectedRows.reduce((s, r) => s + Number(r.finished_meter || 0), 0);
  const totalFold = selectedRows.reduce((s, r) => s + Number(r.input_folded_meter || 0), 0);
  const shortagePct = totalFin > 0 ? (((totalFin - totalFold) / totalFin) * 100).toFixed(2) : 0;
  const damaged = selectedRows.filter(r => r.damage);
  const damagedM = damaged.reduce((s, r) => s + Number(r.damage.meters || 0), 0);

  /** Validate, then show the confirm popup. */
  const review = () => {
    try {
      if (selectedRows.length === 0) throw new Error('Select at least one taka to fold.');
      for (const r of selectedRows) {
        if (!r.input_folded_meter || Number(r.input_folded_meter) <= 0) throw new Error(`Folded meter required for Taka ${r.label}`);
        if (r.damage && Number(r.damage.meters) > Number(r.input_folded_meter)) throw new Error(`Taka ${r.label}: damaged meters are more than the folded meters`);
      }
      setError(''); setConfirmOpen(true);
    } catch (e) { setError(e.message); }
  };

  const doSave = () => run(async () => {
    const locals = [];
    const rows = [];
    for (const r of selectedRows) {
      let damage = null;
      if (r.damage) {
        damage = { meters: r.damage.meters, image_url: r.damage.image_url, notes: r.damage.notes };
        if (r.damage.voice) {
          try { damage.voice_url = await uploadMedia(r.damage.voice); } catch { damage.voice_local = true; locals.push({ takaId: r.id, blob: r.damage.voice }); }
        }
      }
      rows.push({ id: r.id, folded_meter: r.input_folded_meter, damage });
    }
    const res = await repo.foldTakas(rows, date);
    // voice notes that could not be uploaded stay on this device, keyed by the damage id
    for (const l of locals) {
      const d = res.damages.find(x => x.taka_id === l.takaId);
      if (d) { try { await saveVoice(d.id, l.blob); } catch { /* the damage itself is saved; only the local audio is lost */ } }
    }
    setConfirmOpen(false);
    setOkMsg(`${res.count} takas folded - they are now ready stock.`);
    await load();
  });

  const qualityOptions = [...new Map(takas.map(t => [String(t.quality_id), t.nick_name])).entries()].sort((a, b) => String(a[1]).localeCompare(String(b[1])));
  const filtered = takas.filter(t => (!qualityFilter || String(t.quality_id) === qualityFilter) && (
    `${t.challan_no}/${t.taka_no} ${t.finished_challan || ''} ${t.program_no || ''} ${t.lot_no || ''}`.toLowerCase().includes(search.toLowerCase()) ||
    (t.nick_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (t.shade_no || '').toLowerCase().includes(search.toLowerCase())
  ));

  // one card per mill (finished) challan; the quality filter narrows the takas, the search narrows the challans
  const challans = [...filtered.reduce((m, t) => {
    const k = keyOf(t);
    if (!m.has(k)) m.set(k, { key: k, challan: t.finished_challan || t.challan_no, program: t.program_no, mill: t.program_mill_name || t.mill_name, date: t.finished_date || t.receipt_date, takas: 0, fin: 0, selected: 0, shades: new Map(), qualities: new Set(), lots: new Set() });
    const c = m.get(k);
    c.takas += 1; c.fin += Number(t.finished_meter || 0); if (t.selected) c.selected += 1;
    if (t.shade_id) c.shades.set(t.shade_id, { hex: t.shade_hex, image: t.shade_image }); c.qualities.add(t.nick_name); if (t.lot_no) c.lots.add(t.lot_no);
    return m;
  }, new Map()).values()].sort((a, b) => String(a.challan).localeCompare(String(b.challan), undefined, { numeric: true }));
  useEffect(() => { if (openKey && !loading && !takas.some(t => keyOf(t) === openKey)) setOpenKey(null); }, [takas, loading]); // eslint-disable-line react-hooks/exhaustive-deps
  const current = openKey ? challans.find(c => c.key === openKey) : null;
  const visible = openKey ? filtered.filter(t => keyOf(t) === openKey) : filtered;
  const paged = usePaged(visible, 100);
  const foldedCount = foldedAll.length;
  const totalCount = foldedCount + takas.filter(t => keyOf(t) === openKey).length;
  const foldedShown = foldedAll.filter(t => !qualityFilter || String(t.quality_id) === qualityFilter);

  if (loadError) return <LoadState error={loadError} onRetry={load} />;

  return (
    <div className="space-y-6 page-w-6xl">
      {openKey ? (
        <div className="space-y-4">
          {/* row 1: challan info, always fully visible */}
          <div className="flex items-start gap-3">
            <button type="button" onClick={() => setOpenKey(null)} aria-label="Back to challans"
              className="shrink-0 mt-0.5 w-8 h-8 flex items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 shadow-sm">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-semibold tracking-tight text-slate-900 break-words">Challan {current ? current.challan : ''}</h1>
              {current && <p className="text-sm text-slate-500 mt-0.5 break-words">{current.mill || ''}{current.program ? ` · Program ${current.program}` : ''}</p>}
            </div>
            <div className="shrink-0 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700 tabular-nums whitespace-nowrap">
              {foldedCount}/{totalCount} folded
            </div>
          </div>
          {/* row 2: quality, date */}
          <div className="flex flex-wrap items-center gap-3">
            <Select className="w-44" value={qualityFilter} onChange={e => setQualityFilter(e.target.value)}>
              <option value="">All qualities</option>
              {qualityOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </Select>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-44" />
          </div>
        </div>
      ) : (
        <PageHeader title="Folding" description="Pick a challan to cut and fold its takas into ready stock">
          <Link to="/folding/in-mill" className="inline-flex h-11 items-center justify-center rounded-md border border-slate-300 bg-transparent px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"><Factory className="mr-2 h-4 w-4" /> In mill</Link>
          <Select className="w-44" value={qualityFilter} onChange={e => setQualityFilter(e.target.value)}>
            <option value="">All qualities</option>
            {qualityOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </Select>
        </PageHeader>
      )}

      {!openKey && (
        <>
          <SearchArea>
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm text-slate-500">{challans.length} challan{challans.length === 1 ? '' : 's'} · {filtered.length} takas pending to fold</div>
              <SearchToggle value={search} onChange={setSearch} placeholder="Search challan, program, quality..." />
            </div>
          </SearchArea>
          <Alert tone="success">{okMsg}</Alert>
          {challans.length === 0 ? (
            <Card><div className="py-12 text-center text-slate-500">{loading ? 'Loading...' : 'No finished takas ready for folding.'}</div></Card>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,19rem),1fr))] gap-4">
              {challans.map(c => (
                <button key={c.key} type="button" onClick={() => openChallan(c.key)}
                  className="text-left rounded-lg border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md hover:border-primary-300 transition">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 flex items-center gap-2"><FileText className="w-4 h-4 text-slate-400 shrink-0" /><span className="truncate">{c.challan}</span></div>
                      <div className="text-sm font-medium text-slate-700 truncate">{c.mill || '—'}</div>
                    </div>
                    {c.date && <span className="text-xs text-slate-500 shrink-0">{fmtDate(c.date)}</span>}
                  </div>
                  <div className="mt-1 text-sm text-slate-500 truncate">{[...c.qualities].join(', ')}{c.program ? ` · ${c.program}` : ''}</div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="flex -space-x-1">
                      {[...c.shades.values()].slice(0, 6).map((s, i) => <span key={i} className="rounded-full ring-2 ring-white"><ShadeSwatch hex={s.hex} image={s.image} size="md" /></span>)}
                    </div>
                    <div className="text-right tabular-nums"><strong className="text-slate-900">{c.takas}</strong> <span className="text-xs text-slate-400">taka</span> <span className="text-slate-300">·</span> <strong className="text-slate-900">{fmtM(c.fin)}</strong> <span className="text-xs text-slate-400">m</span></div>
                  </div>
                  {c.lots.size > 0 && <div className="mt-2 flex flex-wrap gap-1">{[...c.lots].slice(0, 4).map((l) => <span key={l} className="rounded bg-slate-100 px-1.5 text-[11px] font-medium leading-5 text-slate-600">Lot {l}</span>)}{c.lots.size > 4 && <span className="text-[11px] text-slate-400">+{c.lots.size - 4}</span>}</div>}
                  {c.selected > 0 && <div className="mt-2 text-xs font-medium text-primary-700">{c.selected} selected</div>}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {openKey && (
      <Card>
        <SearchArea className="p-5 border-b border-slate-100">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <DetailList className="flex-1" items={[
              { label: 'Pending to fold', value: visible.length },
              { label: 'Selected', value: selectedRows.length },
              { label: 'Folding shortage', value: <span className={shortagePct > 5 ? 'text-red-600' : ''}>{fmtM(totalFin - totalFold)} m ({shortagePct}%)</span> },
              { label: 'Damaged', value: damaged.length ? <span className="text-red-600">{damaged.length} taka · {fmtM(damagedM)} m</span> : null },
            ]} />
            <SearchToggle value={search} onChange={setSearch} placeholder="Search takas, shade..." />
          </div>
        </SearchArea>

        <Table>
          <thead>
            <tr>
              <Th className="w-12 text-center">
                <input type="checkbox"
                  checked={visible.length > 0 && visible.every(r => r.selected)}
                  onChange={e => {
                    const checked = e.target.checked;
                    setTakas(takas.map(t => visible.find(f => f.id === t.id) ? { ...t, selected: checked } : t));
                  }}
                />
              </Th>
              <Th>Quality</Th>
              <Th>Shade</Th>
              <Th>Lot</Th>
              <Th>Taka</Th>
              <Th className="text-right">Finished M</Th>
              <Th className="text-right w-32">Folded M *</Th>
              <Th className="w-40">Damage</Th>
            </tr>
          </thead>
          <tbody>
            {paged.rows.map(r => (
              <tr key={r.id} className={r.selected ? 'bg-primary-50/30' : ''}>
                <Td className="text-center">
                  <input type="checkbox" checked={r.selected} onChange={() => toggleRow(r.id)} />
                </Td>
                <Td className="font-medium text-slate-900">{r.nick_name}</Td>
                <Td>
                  <div className="flex items-center gap-2">
                    <ShadeSwatch hex={r.shade_hex} image={r.shade_image} size="sm" />
                    <span className="font-semibold text-slate-900">{r.shade_no}</span>
                  </div>
                </Td>
                <Td className="text-sm text-slate-600">{r.lot_no || '—'}</Td>
                <Td className="text-xs text-slate-400">#{r.taka_no}</Td>
                <Td className="text-right text-base font-semibold tabular-nums text-slate-900">{fmtM(r.finished_meter)}</Td>
                <Td className="text-right">
                  <Input
                    type="number" step="0.01"
                    className="w-28 ml-auto text-right h-11 font-semibold border-primary-300 focus:border-primary-500"
                    value={r.input_folded_meter}
                    onChange={e => updateRow(r.id, e.target.value)}
                  />
                </Td>
                <Td>
                  {r.damage ? (
                    <button type="button" onClick={() => setDamageRow(r)} title="Edit or remove the damage" className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 ring-1 ring-red-200 hover:bg-red-100">
                      Damaged {fmtM(r.damage.meters)} m {r.damage.image_url && <ImageIcon className="h-3 w-3" />}{r.damage.voice && <Mic className="h-3 w-3" />}
                    </button>
                  ) : (
                    <Button type="button" variant="outline" size="sm" onClick={() => setDamageRow(r)}><AlertTriangle className="mr-1.5 h-3.5 w-3.5" /> Damage</Button>
                  )}
                </Td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr><Td colSpan={8} className="py-12 text-center text-slate-500">
                {loading ? 'Loading...' : 'No finished takas ready for folding.'}
              </Td></tr>
            )}
          </tbody>
        </Table>
        <Pager paged={paged} />
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-t border-slate-100">
          <div className="text-sm text-slate-500 tabular-nums">{selectedRows.length} selected · {fmtM(totalFold)} m folded</div>
          <Button onClick={review} disabled={busy || selectedRows.length === 0}>
            <Scissors className="w-4 h-4 mr-2" /> Fold Selected
          </Button>
        </div>
      </Card>
      )}

      {openKey && (
        <Card>
          <button type="button" onClick={() => setShowFolded(v => !v)} aria-expanded={showFolded}
            className="w-full flex items-center justify-between gap-3 p-4 text-left">
            <span className="font-semibold text-slate-900">Folded takas <span className="ml-1 text-sm font-medium text-slate-500">({foldedShown.length})</span></span>
            <ChevronDown className={`w-5 h-5 text-slate-500 transition-transform ${showFolded ? 'rotate-180' : ''}`} />
          </button>
          {showFolded && (
            foldedShown.length === 0 ? <div className="px-4 pb-6 text-sm text-slate-500">Nothing folded from this challan yet.</div> : (
              <Table>
                <thead>
                  <tr><Th>Quality</Th><Th>Shade</Th><Th>Lot</Th><Th>Taka</Th><Th className="text-right">Finished M</Th><Th className="text-right">Folded M</Th><Th>Damage</Th></tr>
                </thead>
                <tbody>
                  {foldedShown.map(r => (
                    <tr key={r.id}>
                      <Td className="font-medium text-slate-900">{r.nick_name}</Td>
                      <Td>
                        <div className="flex items-center gap-2">
                          <ShadeSwatch hex={r.shade_hex} image={r.shade_image} size="sm" />
                          <span className="font-semibold text-slate-900">{r.shade_no}</span>
                        </div>
                      </Td>
                      <Td className="text-sm text-slate-600">{r.lot_no || '—'}</Td>
                      <Td className="text-xs text-slate-400">#{r.taka_no}</Td>
                      <Td className="text-right text-base font-semibold tabular-nums text-slate-900">{fmtM(r.finished_meter)}</Td>
                      <Td className="text-right text-base font-semibold tabular-nums text-slate-900">{fmtM(r.folded_meter)}</Td>
                      <Td><DamageTag t={r} onClick={setDetails} /></Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )
          )}
        </Card>
      )}
      <Alert>{!confirmOpen && error}</Alert>
      {openKey && <Alert tone="success">{okMsg}</Alert>}

      {damageRow && (
        <DamageModal
          row={damageRow}
          foldedMeters={damageRow.input_folded_meter || damageRow.finished_meter}
          damage={damageRow.damage}
          onClose={() => setDamageRow(null)}
          onSave={(d) => { setDamage(damageRow.id, d); setDamageRow(null); }}
          onRemove={() => { setDamage(damageRow.id, null); setDamageRow(null); }}
        />
      )}
      <DamageDetailsModal t={details} onClose={() => setDetails(null)} />

      <Modal isOpen={confirmOpen} onClose={() => !busy && setConfirmOpen(false)} title="Confirm folding" maxWidth="max-w-lg">
        <DetailList items={[
          { label: 'Takas to fold', value: selectedRows.length },
          { label: 'Folded meters', value: `${fmtM(totalFold)} m` },
          { label: 'Date', value: fmtDate(date) },
          { label: 'Total folding shortage', value: `${fmtM(totalFin - totalFold)} m (${shortagePct}%)` },
          { label: 'Damaged takas', value: damaged.length },
          { label: 'Damaged meters', value: <span className={damaged.length ? 'text-red-600' : ''}>{fmtM(damagedM)} m</span> },
        ]} />
        <Alert className="mt-4">{error}</Alert>
        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="outline" disabled={busy} onClick={() => setConfirmOpen(false)}>Edit again</Button>
          <Button type="button" disabled={busy} onClick={doSave}><Scissors className="mr-2 h-4 w-4" />{busy ? 'Saving…' : 'Confirm & fold'}</Button>
        </div>
      </Modal>
    </div>
  );
}
