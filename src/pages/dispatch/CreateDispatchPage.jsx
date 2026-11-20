import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader, Card, Button, Select, Input, Field, Drawer, Alert, Modal, useAction } from '../../components/ui';
import { fmtM, fmtDate } from '../../lib/format';
import { ShieldCheck } from 'lucide-react';
import { Qty, ActionBar } from '../../components/kit';
import * as repo from '../../db/repo';
import PartBuilder from './PartBuilder';
import { newPart, partTotals, partLabels } from './partLogic';

/** New mill challan: one main challan (e.g. 121) with one sub-challan (121A, 121B …) per weaver challan. */
export default function CreateDispatchPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [mills, setMills] = useState([]);
  const [challans, setChallans] = useState([]);
  const [form, setForm] = useState({ mill_id: '', date: new Date().toISOString().slice(0, 10), main_no: '', notes: '' });
  const [suggested, setSuggested] = useState('');
  const [parts, setParts] = useState([newPart()]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { busy, error, setError, run } = useAction();

  useEffect(() => {
    (async () => {
      try {
        const [m, c, n] = await Promise.all([repo.listMills(), repo.listGodownChallans(), repo.nextMainNo()]);
        setMills(m); setChallans(c); setForm((f) => ({ ...f, main_no: String(n) })); setSuggested(String(n));
      } catch (e) { setLoadError(e.message); } finally { setLoading(false); }
    })();
  }, []);

  const valid = useMemo(() => parts.filter((p) => p.receipt && partTotals(p).takas > 0), [parts]);
  const labels = useMemo(() => partLabels(valid, form.main_no || '?'), [valid, form.main_no]);
  const totals = valid.reduce((a, p) => { const t = partTotals(p); return { takas: a.takas + t.takas, meters: Math.round((a.meters + t.meters) * 100) / 100 }; }, { takas: 0, meters: 0 });

  const review = () => {
    try {
      if (!form.mill_id) throw new Error('Please select a mill');
      if (!form.date) throw new Error('Choose the date');
      if (!String(form.main_no).trim()) throw new Error('Enter the challan number');
      if (parts.some((p) => p.receipt && partTotals(p).takas === 0)) throw new Error('Select at least one taka in every weaver challan, or remove it');
      if (valid.length === 0) throw new Error('Add a weaver challan and select its takas');
      setError(''); setConfirmOpen(true);
    } catch (e) { setError(e.message); }
  };
  const save = () => run(async () => {
    const id = await repo.createMillChallan({
      main_no: String(form.main_no) === suggested ? undefined : form.main_no, mill_id: form.mill_id, date: form.date, notes: form.notes,
      parts: valid.map((p) => ({ receipt_id: p.receipt.id, taka_ids: p.sel })),
    });
    navigate(`/dispatch/${id}/preview`, { replace: true });
  });

  if (loading || loadError) return <Drawer isOpen>{loading ? <div className="p-12 text-center text-slate-500">Loading...</div> : <Alert>{loadError}</Alert>}</Drawer>;
  const mill = mills.find((m) => String(m.id) === String(form.mill_id));

  const summary = (
    <div className="flex items-center gap-4 lg:flex-col lg:items-stretch lg:gap-0">
      <div className="grid flex-1 grid-cols-3 gap-3 lg:mb-4 lg:flex-none">
        <div><div className="text-xs font-bold text-slate-500">Parts</div><div className="text-2xl font-bold tabular-nums text-slate-900">{valid.length}</div></div>
        <div><div className="text-xs font-bold text-slate-500">Takas</div><div className={`text-2xl font-bold tabular-nums ${totals.takas ? 'text-primary-700' : 'text-slate-400'}`}>{totals.takas}</div></div>
        <div><div className="text-xs font-bold text-slate-500">Meters</div><div className="text-2xl font-bold tabular-nums text-slate-900">{fmtM(totals.meters)}</div></div>
      </div>
      <Button type="button" className="h-12 shrink-0 text-base lg:w-full" disabled={busy || totals.takas === 0} onClick={review}>
        <ShieldCheck className="mr-2 h-5 w-5" /> Save
      </Button>
    </div>
  );

  return (
    <Drawer isOpen>
      <div className="page-w-6xl space-y-6">
        <PageHeader title="New Mill Challan" description="Sent against weaver challans — one sub-challan per weaver challan." onBack={() => navigate('/dispatch')} />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card className="p-5">
              <h3 className="mb-4 text-base font-bold text-forest">Challan details</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                <Field label="Destination mill *">
                  <Select required value={form.mill_id} onChange={(e) => setForm((f) => ({ ...f, mill_id: e.target.value }))}>
                    <option value="">Select Mill...</option>
                    {mills.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </Select>
                </Field>
                <Field label="Date *"><Input type="date" required value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} /></Field>
                <Field label="Challan no (auto, you can change it)"><Input type="number" min="1" step="1" value={form.main_no} onChange={(e) => setForm((f) => ({ ...f, main_no: e.target.value }))} /></Field>
                <Field label="Notes (optional)"><Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} /></Field>
              </div>
            </Card>

            <div>
              <h3 className="mb-3 text-base font-bold text-forest">Weaver challans</h3>
              <PartBuilder parts={parts} setParts={setParts} mainNo={form.main_no || '?'} challans={challans} error={error} setError={setError} />
            </div>
            <Alert>{error}</Alert>
          </div>

          <div className="hidden lg:block">
            <Card className="p-5 lg:sticky lg:top-6">
              <h3 className="mb-4 text-base font-bold text-forest">Summary</h3>
              {summary}
              {valid.length > 0 && (
                <ul className="mt-4 space-y-1.5 border-t border-slate-100 pt-4 text-sm">
                  {valid.map((p, i) => (
                    <li key={p.key} className="flex justify-between gap-2"><span className="font-semibold text-primary-700">{labels[i]}</span><span className="min-w-0 truncate text-slate-600">{p.receipt.challan_no}</span><span className="tabular-nums text-slate-900">{partTotals(p).takas} tk</span></li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      </div>

      {/* tablet / phone: sticky bottom bar */}
      <ActionBar>{summary}</ActionBar>

      <Modal isOpen={confirmOpen} onClose={() => !busy && setConfirmOpen(false)} title={`Confirm mill challan ${form.main_no}`} maxWidth="max-w-2xl">
        <div className="mb-4 text-sm text-slate-600">To <strong className="text-slate-900">{mill?.name}</strong> on {fmtDate(form.date)}{form.notes ? ` · ${form.notes}` : ''}</div>
        <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {valid.map((p, i) => (
            <div key={p.key} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-sm">
              <span className="font-bold text-primary-700">{labels[i]}</span>
              <span className="text-slate-900">{p.receipt.challan_no}</span>
              <span className="text-slate-600">{p.receipt.weaver_name} · {p.receipt.nick_name}</span>
              <span className="ml-auto"><Qty variant="inline" takas={partTotals(p).takas} meters={partTotals(p).meters} /></span>
            </div>
          ))}
          <div className="flex justify-between bg-slate-50 px-3 py-2.5 text-sm font-semibold"><span>Total — {valid.length} sub-challan{valid.length === 1 ? '' : 's'}</span><Qty variant="inline" takas={totals.takas} meters={totals.meters} /></div>
        </div>
        <Alert className="mt-4">{error}</Alert>
        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="outline" disabled={busy} onClick={() => setConfirmOpen(false)}>Edit again</Button>
          <Button type="button" disabled={busy} onClick={save}><ShieldCheck className="mr-2 h-4 w-4" />{busy ? 'Saving…' : 'Confirm & save'}</Button>
        </div>
      </Modal>
    </Drawer>
  );
}
