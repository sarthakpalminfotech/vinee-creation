import React, { useState, useEffect, useMemo, useCallback, useRef, memo } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { PageHeader, Card, Button, Input, Select, Field, Th, Td, Drawer, Alert, useAction } from '../../components/ui';
import { ArrowLeft, Save, Plus, Trash2, ClipboardPaste, AlertTriangle } from 'lucide-react';
import * as repo from '../../db/repo';
import { Qty } from '../../components/kit';

const METER_RE = /^\d+(\.\d{1,2})?$/;
let seq = 0;
const newRow = (taka_no = '', meter = '', dbId = null) => ({ id: `r${++seq}`, dbId, taka_no: String(taka_no), meter: String(meter) });

/**
 * Parse pasted text (Excel / plain). Each line: "meter" or "takaNo<tab|comma|space>meter".
 * Lines with a single value are meters and get numbered from `startNo`.
 */
export function parsePaste(text, startNo) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const oneLine = lines.length === 1 && lines[0].split(/[\s,;]+/).filter(Boolean).length > 2;
  const tokens = oneLine ? lines[0].split(/[\s,;]+/).filter(Boolean).map((t) => [t]) : lines.map((l) => l.split(/[\t,;]+|\s{2,}|\s+/).filter(Boolean));
  let n = Number.parseInt(startNo, 10);
  const out = [];
  for (const parts of tokens) {
    if (parts.length >= 2) { out.push({ taka_no: parts[0], meter: parts[1] }); const p = Number.parseInt(parts[0], 10); if (!Number.isNaN(p)) n = p + 1; }
    else { out.push({ taka_no: Number.isNaN(n) ? '' : String(n), meter: parts[0] }); if (!Number.isNaN(n)) n += 1; }
  }
  return out;
}

const Row = memo(function Row({ row, idx, dup, nominal, locked, onChange, onEnter, onRemove, onPaste }) {
  const m = Number.parseFloat(row.meter);
  const badMeter = row.meter !== '' && !METER_RE.test(row.meter.trim());
  const outlier = !badMeter && m > 0 && (m < nominal * 0.9 || m > nominal * 1.1);
  return (
    <tr className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
      <Td className="text-center text-slate-400 w-12">{idx + 1}</Td>
      <Td className="p-1.5">
        <Input id={`no-${row.id}`} disabled={locked} value={row.taka_no} onChange={(e) => onChange(row.id, 'taka_no', e.target.value)} error={dup} className="h-8" aria-label={`Taka number row ${idx + 1}`}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); document.getElementById(`m-${row.id}`)?.focus(); } }} />
      </Td>
      <Td className="p-1.5">
        <Input id={`m-${row.id}`} disabled={locked} inputMode="decimal" value={row.meter} aria-label={`Meters row ${idx + 1}`}
          onChange={(e) => onChange(row.id, 'meter', e.target.value)} error={badMeter}
          onPaste={(e) => onPaste(e, row.id)}
          className={`h-8 ${outlier ? 'border-amber-300 bg-amber-50 text-amber-900' : ''}`}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onEnter(row.id); } }} />
      </Td>
      <Td className="text-center w-20">
        {dup && <span className="text-xs text-red-600 font-medium">duplicate</span>}
        {badMeter && <span className="text-xs text-red-600 font-medium">max 2 dp</span>}
        {outlier && <AlertTriangle className="w-4 h-4 text-amber-500 inline" title={`Far from the nominal ${nominal} m`} />}
      </Td>
      <Td className="text-right p-1.5 w-12">
        <button type="button" tabIndex={-1} disabled={locked} onClick={() => onRemove(row.id)} className="p-1 text-slate-400 hover:text-red-500 rounded" aria-label="Remove row"><Trash2 className="w-4 h-4" /></button>
      </Td>
    </tr>
  );
});

export default function CreateReceiptPage() {
  const navigate = useNavigate();
  const { id: editId } = useParams();
  const isEdit = !!editId;
  const [searchParams] = useSearchParams();
  const initialPoId = searchParams.get('po_id') || '';
  const { busy, error, setError, run } = useAction();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [pos, setPos] = useState([]);
  const [weavers, setWeavers] = useState([]);
  const [mills, setMills] = useState([]);
  const [locations, setLocations] = useState([]);
  const [branches, setBranches] = useState([]);
  const [locked, setLocked] = useState(false); // edit mode: takas already moved on, only the header can change
  const [editReceipt, setEditReceipt] = useState(null);

  const [formData, setFormData] = useState(() => ({
    po_id: initialPoId, weaver_id: '', challan_no: '', date: new Date().toISOString().slice(0, 10),
    destination: 'GODOWN', branch_id: '', mill_id: '', location_id: '', notes: '', image_url: '',
  }));
  const [rows, setRows] = useState([]);
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [startNo, setStartNo] = useState('1');
  const [addCount, setAddCount] = useState('10');
  const focusAfter = useRef(null);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  useEffect(() => {
    (async () => {
      try {
        const [allPos, allWeavers, allMills, allLocs, allBranches] = await Promise.all([repo.listPOs(), repo.listWeavers(), repo.listMills(), repo.listLocations(), repo.listBranches()]);
        setPos(isEdit ? allPos : allPos.filter((p) => p.status === 'OPEN' || p.status === 'PARTIAL' || p.status === 'RECEIVED'));
        setWeavers(allWeavers); setMills(allMills); setLocations(allLocs); setBranches(allBranches);
        if (isEdit) {
          const rc = await repo.getReceipt(Number(editId));
          if (!rc) throw new Error('Challan not found');
          setEditReceipt(rc);
          setFormData({
            po_id: String(rc.po_id), weaver_id: String(rc.weaver_id), challan_no: rc.challan_no, date: rc.date || '', destination: rc.destination,
            branch_id: rc.branch_id ? String(rc.branch_id) : '', mill_id: rc.mill_id ? String(rc.mill_id) : '', location_id: '', notes: rc.notes || '', image_url: rc.image_url || '',
          });
          setRows(rc.takas.map((t) => newRow(t.taka_no, t.grey_meter, t.id)));
          const okStatus = rc.destination === 'MILL' ? 'MILL_GREY' : 'GODOWN_GREY';
          setLocked(!rc.takas.every((t) => t.status === okStatus && !t.dispatch_id && !t.program_line_id));
        } else if (allBranches.length === 1) {
          setFormData((f) => ({ ...f, branch_id: String(allBranches[0].id) }));
        }
      } catch (e) { setLoadError(e.message); } finally { setLoading(false); }
    })();
  }, [editId]);

  const selectedPo = useMemo(() => pos.find((p) => String(p.id) === String(formData.po_id)), [pos, formData.po_id]);
  const availableWeavers = useMemo(() => (selectedPo ? weavers.filter((w) => w.group_id === selectedPo.group_id) : []), [weavers, selectedPo]);

  const setField = (k, v) => setFormData((p) => ({ ...p, [k]: v }));
  const branchLocations = useMemo(() => locations.filter((l) => String(l.branch_id) === String(formData.branch_id)), [locations, formData.branch_id]);
  const changePo = (id) => setFormData((p) => ({ ...p, po_id: id, weaver_id: '' }));

  // focus the meter cell of a row that was just added
  useEffect(() => {
    if (focusAfter.current) { document.getElementById(focusAfter.current)?.focus(); focusAfter.current = null; }
  });

  const nextNo = (list) => {
    const last = list.length ? Number.parseInt(list[list.length - 1].taka_no, 10) : Number.parseInt(startNo, 10) - 1;
    return Number.isNaN(last) ? '' : last + 1;
  };

  const onChange = useCallback((id, field, value) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [field]: value } : r))), []);
  const onRemove = useCallback((id) => setRows((rs) => rs.filter((r) => r.id !== id)), []);
  const onEnter = useCallback((id) => {
    const rs = rowsRef.current;
    const i = rs.findIndex((r) => r.id === id);
    if (i < rs.length - 1) { focusAfter.current = `m-${rs[i + 1].id}`; setRows([...rs]); return; }
    const r = newRow(nextNo(rs), '');
    focusAfter.current = `m-${r.id}`;
    setRows([...rs, r]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startNo]);

  const addRows = (n) => {
    const count = Math.max(1, Math.min(1000, Number.parseInt(n, 10) || 1));
    const out = [...rowsRef.current];
    const first = out.length;
    for (let i = 0; i < count; i++) out.push(newRow(nextNo(out), ''));
    focusAfter.current = `m-${out[first].id}`;
    setRows(out);
  };

  const applyPaste = (text, fromId) => {
    const entries = parsePaste(text, startNo);
    if (!entries.length) return;
    setRows((rs) => {
      let out = [...rs];
      let at = fromId ? out.findIndex((r) => r.id === fromId) : out.length;
      for (const e of entries) {
        if (at < out.length && fromId) out[at] = { ...out[at], taka_no: e.taka_no || out[at].taka_no, meter: e.meter };
        else out.push(newRow(e.taka_no, e.meter));
        at += 1;
      }
      return out;
    });
  };

  const onPaste = useCallback((e, id) => {
    const text = e.clipboardData.getData('text');
    if (/[\n\t]/.test(text.trim()) || text.trim().split(/[\s,;]+/).length > 1) { e.preventDefault(); applyPaste(text, id); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startNo]);

  const processBulkPaste = () => {
    applyPaste(pasteText, null);
    const last = parsePaste(pasteText, startNo).at(-1);
    if (last) setStartNo(String((Number.parseInt(last.taka_no, 10) || 0) + 1));
    setPasteText(''); setPasteMode(false);
  };

  // ---- derived checks (integer hundredths avoid float drift)
  const { dupSet, issues, filled, totalHundredths, minM, maxM } = useMemo(() => {
    const seen = new Map(); const dups = new Set();
    for (const r of rows) {
      const k = r.taka_no.trim().toLowerCase();
      if (!k) continue;
      if (seen.has(k)) { dups.add(k); } else seen.set(k, r.id);
    }
    let bad = 0, total = 0, count = 0, mn = Infinity, mx = 0, noNo = 0;
    for (const r of rows) {
      if (r.meter === '' && r.taka_no === '') continue;
      if (!r.taka_no.trim()) noNo += 1;
      if (!METER_RE.test(r.meter.trim()) || Number(r.meter) <= 0) { bad += 1; continue; }
      const h = Math.round(Number(r.meter) * 100);
      total += h; count += 1; mn = Math.min(mn, h); mx = Math.max(mx, h);
    }
    const list = [];
    if (dups.size) list.push(`${dups.size} duplicate taka number(s)`);
    if (bad) list.push(`${bad} row(s) with missing/invalid meters`);
    if (noNo) list.push(`${noNo} row(s) without a taka number`);
    return { dupSet: dups, issues: list, filled: count, totalHundredths: total, minM: count ? mn / 100 : 0, maxM: mx / 100 };
  }, [rows]);

  const totalMeters = totalHundredths / 100;
  const nominal = selectedPo ? Number(selectedPo.taka_length) || 100 : 100;

  const handleSave = (e) => {
    e.preventDefault();
    run(async () => {
      if (!formData.po_id) throw new Error('Choose the purchase order');
      if (!formData.weaver_id) throw new Error('Choose the party (firm) that sent this challan');
      if (!formData.challan_no.trim()) throw new Error('Enter the weaver challan number');
      if (formData.destination === 'MILL' && !formData.mill_id) throw new Error('Choose the mill it was delivered to');
      if (formData.destination === 'GODOWN' && !formData.branch_id) throw new Error('Choose the branch where this grey was received');
      if (issues.length) throw new Error(`Fix the takas first: ${issues.join('; ')}`);
      const used = rows.filter((r) => r.meter !== '' || r.taka_no !== '');
      if (!used.length) throw new Error('Add at least one taka');
      if (isEdit) {
        await repo.updateReceipt(Number(editId), { ...formData, takas: locked ? undefined : used.map((r) => ({ id: r.dbId, taka_no: r.taka_no, meter: r.meter })) });
        navigate(`/receipts/${editId}`);
        return;
      }
      const id = await repo.createReceipt({ ...formData, takas: used.map((r) => ({ taka_no: r.taka_no, meter: r.meter })) });
      navigate(`/receipts/${id}`);
    });
  };

  if (loading || loadError) {
    return (
      <Drawer isOpen onClose={() => navigate('/receipts')}>
        {loading ? <div className="p-12 text-center text-slate-500">Loading...</div> : <Alert>{loadError}</Alert>}
      </Drawer>
    );
  }

  return (
    <Drawer isOpen onClose={() => navigate('/receipts')}>
      <div className="space-y-6 max-w-5xl mx-auto">
        <PageHeader title={isEdit ? `Edit Challan ${editReceipt?.challan_no || ''}` : 'Receive Grey Challan'} description={isEdit ? 'Change the challan details. Takas can be edited only while they are still untouched.' : 'Log incoming grey fabric from a weaver. Tip: paste a column of meters (or taka no + meters) straight from Excel into any meter cell.'}>
          <Button variant="ghost" onClick={() => navigate(isEdit ? `/receipts/${editId}` : '/receipts')}><ArrowLeft className="w-4 h-4 mr-2" /> Back</Button>
        </PageHeader>

        <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Challan Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Purchase Order *">
                  <Select required disabled={isEdit} value={formData.po_id} onChange={(e) => changePo(e.target.value)}>
                    <option value="">Select PO...</option>
                    {pos.map((p) => <option key={p.id} value={p.id}>{p.po_no} · {p.group_name} · {p.original_name}</option>)}
                  </Select>
                </Field>
                <Field label="Party (firm) *">
                  <Select required value={formData.weaver_id} onChange={(e) => setField('weaver_id', e.target.value)} disabled={!selectedPo}>
                    <option value="">{selectedPo ? 'Select party...' : 'Choose a PO first'}</option>
                    {availableWeavers.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </Select>
                </Field>
                <Field label="Weaver Challan Number *">
                  <Input required value={formData.challan_no} onChange={(e) => setField('challan_no', e.target.value)} />
                </Field>
                <Field label="Challan Date *">
                  <Input type="date" required value={formData.date} onChange={(e) => setField('date', e.target.value)} />
                </Field>
              </div>
              {selectedPo && (
                <p className="text-xs text-slate-500 mt-3">
                  PO {selectedPo.po_no}: ordered {selectedPo.meters.toLocaleString('en-IN')} m, received {selectedPo.received_m.toLocaleString('en-IN')} m, pending {selectedPo.pending_m.toLocaleString('en-IN')} m.
                </p>
              )}

              <div className="mt-6 pt-6 border-t border-slate-100">
                <h4 className="text-sm font-medium text-slate-700 mb-3">Destination</h4>
                <div className="flex gap-4 mb-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="dest" disabled={isEdit} checked={formData.destination === 'GODOWN'} onChange={() => setField('destination', 'GODOWN')} />
                    <span className="text-sm font-medium">Our godown</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="dest" disabled={isEdit} checked={formData.destination === 'MILL'} onChange={() => setField('destination', 'MILL')} />
                    <span className="text-sm font-medium">Direct to mill</span>
                  </label>
                </div>
                {formData.destination === 'MILL' ? (
                  <Field label="Mill *">
                    <Select required disabled={isEdit} value={formData.mill_id} onChange={(e) => setField('mill_id', e.target.value)}>
                      <option value="">Select Mill...</option>
                      {mills.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </Select>
                  </Field>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Received at branch *">
                      <Select required disabled={isEdit && locked} value={formData.branch_id} onChange={(e) => setFormData((f) => ({ ...f, branch_id: e.target.value, location_id: '' }))}>
                        <option value="">{branches.length ? 'Select branch...' : 'No branches — add one in Masters'}</option>
                        {branches.map((b) => <option key={b.id} value={b.id}>{b.name}{b.city ? ` · ${b.city}` : ''}</option>)}
                      </Select>
                    </Field>
                    {!isEdit && (
                      <Field label="Rack (optional — assign racks later in bulk)">
                        <Select value={formData.location_id} disabled={!formData.branch_id} onChange={(e) => setField('location_id', e.target.value)}>
                          <option value="">{formData.branch_id ? 'Leave unassigned' : 'Choose a branch first'}</option>
                          {branchLocations.map((l) => <option key={l.id} value={l.id}>{repo.locLabel(l.shop, l.rack)}</option>)}
                        </Select>
                      </Field>
                    )}
                  </div>
                )}
                {isEdit && formData.destination === 'GODOWN' && !locked && <p className="text-xs text-amber-600 mt-2">Changing the branch clears the racks of these takas — assign racks again afterwards.</p>}
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
                <h3 className="text-lg font-semibold text-slate-900">Takas ({rows.length} rows)</h3>
                <div className="flex flex-wrap gap-2 items-center">
                  <Button type="button" disabled={locked} variant={pasteMode ? 'primary' : 'outline'} size="sm" onClick={() => setPasteMode(!pasteMode)}>
                    <ClipboardPaste className="w-4 h-4 mr-2" /> Bulk Paste
                  </Button>
                  <Input className="h-8 w-16" inputMode="numeric" value={addCount} onChange={(e) => setAddCount(e.target.value)} aria-label="Rows to add" />
                  <Button type="button" disabled={locked} variant="outline" size="sm" onClick={() => addRows(addCount)}><Plus className="w-4 h-4 mr-1" /> Add rows</Button>
                </div>
              </div>

              {pasteMode && (
                <div className="mb-4 p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                  <div className="flex gap-4 items-end">
                    <Field label="First taka no" className="w-32"><Input value={startNo} onChange={(e) => setStartNo(e.target.value)} /></Field>
                    <p className="text-xs text-slate-500 flex-1">One value per line = meters (numbered from the first taka no). Two columns = taka no, meters.</p>
                  </div>
                  <textarea className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" rows={4}
                    value={pasteText} onChange={(e) => setPasteText(e.target.value)} placeholder={'96.5\n102.58\n94.69\n103.5'} />
                  <Button type="button" onClick={processBulkPaste} disabled={!pasteText.trim()}>Add these takas</Button>
                </div>
              )}

              <div className="max-h-[480px] overflow-y-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-slate-50 shadow-sm z-10">
                    <tr><Th className="w-12 text-center">#</Th><Th>Taka No</Th><Th>Meters</Th><Th className="w-20"></Th><Th className="w-12"></Th></tr>
                  </thead>
                  <tbody>
                    {rows.map((r, idx) => (
                      <Row key={r.id} row={r} idx={idx} nominal={nominal} locked={locked} dup={dupSet.has(r.taka_no.trim().toLowerCase())}
                        onChange={onChange} onEnter={onEnter} onRemove={onRemove} onPaste={onPaste} />
                    ))}
                    {rows.length === 0 && (
                      <tr>
                        <Td colSpan={5} className="text-center py-8 text-slate-500">
                          <div className="flex flex-col items-center justify-center gap-1 py-2">
                            <span className="text-sm font-medium text-slate-600">No takas added yet</span>
                            <span className="text-xs text-slate-400">Use "Add rows" above or paste from Excel.</span>
                          </div>
                        </Td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {locked && <Alert tone="info" className="mt-3">Some takas of this challan were already sent to a mill or put in a program, so only the challan details can change — not the takas.</Alert>}
              <p className="text-xs text-slate-400 mt-2">Enter moves to the next row (and adds one at the end). Meters accept up to 2 decimals.</p>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="p-6 bg-slate-50 border-slate-200 lg:sticky lg:top-0">
              <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4">Receipt Summary</h3>
              <Qty className="mb-4 bg-white" takas={filled} meters={totalMeters} />
              <div className="space-y-2 pt-4 border-t border-slate-200 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Average</span><span className="font-medium">{filled ? (totalMeters / filled).toFixed(2) : '0.00'} m</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Min / Max</span><span className="font-medium">{minM.toFixed(2)} / {maxM.toFixed(2)} m</span></div>
              </div>
              {issues.length > 0 && <Alert className="mt-4">{issues.join(' · ')}</Alert>}
              <Alert className="mt-4">{error}</Alert>
              <div className="mt-6 pt-6 border-t border-slate-200">
                <Button type="submit" className="w-full h-12 text-base shadow-sm" disabled={busy || filled === 0}>
                  <Save className="w-5 h-5 mr-2" />{busy ? 'Saving…' : isEdit ? 'Save changes' : 'Save Receipt'}
                </Button>
              </div>
            </Card>
          </div>
        </form>
      </div>
    </Drawer>
  );
}
