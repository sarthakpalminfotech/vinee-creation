// Grey → Withdraw → Direct sell: sell grey that lies at our place straight to a customer.
// Party (weaver) → optional weaver challans → takas → customer (quick add) → rate → confirm → sale GS-n.
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { PageHeader, Card, Button, Field, Input, Select, Modal, Alert, LoadState, useAction } from '../../components/ui';
import { ActionBar } from '../../components/kit';
import { fmtDate, fmtInt, fmtM, fmtMoney } from '../../lib/format';
import * as repo from '../../db/repo';
import { GstField } from '../masters/MasterForm';
import GreyTakaPicker from './GreyTakaPicker';

export function QuickAddCustomer({ open, onClose, onSaved }) {
  const [f, setF] = useState({ name: '', phone: '', city: '', gstin: '' });
  const { busy, error, setError, run } = useAction();
  useEffect(() => { if (open) { setF({ name: '', phone: '', city: '', gstin: '' }); setError(''); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const save = (e) => { e.preventDefault(); run(async () => { const id = await repo.saveMaster('customers', f); onSaved(id); onClose(); }); };
  return (
    <Modal isOpen={open} onClose={onClose} title="Add customer">
      <form onSubmit={save} className="space-y-4">
        <Field label="Name"><Input required autoFocus value={f.name} onChange={(e) => set('name', e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone"><Input value={f.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
          <Field label="City"><Input value={f.city} onChange={(e) => set('city', e.target.value)} /></Field>
        </div>
        <GstField value={f.gstin} onChange={(v) => set('gstin', v)} />
        <Alert>{error}</Alert>
        <div className="flex justify-end gap-3"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button></div>
      </form>
    </Modal>
  );
}

export default function GreySellForm() {
  const navigate = useNavigate();
  const [ref, setRef] = useState(null); // {weavers, customers}
  const [loadError, setLoadError] = useState('');
  const [weaverId, setWeaverId] = useState('');
  const [challans, setChallans] = useState([]);
  const [chosenChallans, setChosenChallans] = useState(() => new Set());
  const [takas, setTakas] = useState([]);
  const [sel, setSel] = useState(() => new Set());
  const [f, setF] = useState({ customer_id: '', rate: '', date: repo.today(), notes: '' });
  const [adding, setAdding] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const { busy, error, setError, run } = useAction();

  const loadRef = async () => {
    try { const [weavers, customers] = await Promise.all([repo.listWeavers(), repo.listCustomers()]); setRef({ weavers, customers }); } catch (e) { setLoadError(e.message); }
  };
  useEffect(() => { loadRef(); }, []);
  useEffect(() => {
    let live = true;
    if (!weaverId) { setChallans([]); return undefined; }
    repo.listGodownChallans({ weaver_id: Number(weaverId) }).then((c) => live && setChallans(c)).catch((e) => live && setError(e.message));
    return () => { live = false; };
  }, [weaverId]); // eslint-disable-line react-hooks/exhaustive-deps
  const chosenKey = [...chosenChallans].sort().join(',');
  useEffect(() => {
    let live = true;
    if (!weaverId) { setTakas([]); return undefined; }
    repo.greyGodownTakas({ weaver_id: Number(weaverId), receipt_ids: chosenKey ? chosenKey.split(',').map(Number) : undefined })
      .then((t) => { if (live) { setTakas(t); setSel(new Set()); } }).catch((e) => live && setError(e.message));
    return () => { live = false; };
  }, [weaverId, chosenKey]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loadError) return <LoadState error={loadError} />;
  if (!ref) return <LoadState loading />;

  const chosen = takas.filter((t) => sel.has(t.id));
  const m = Math.round(chosen.reduce((s, t) => s + Number(t.grey_meter), 0) * 100) / 100;
  const rate = f.rate === '' ? null : Number(f.rate);
  const amount = rate > 0 ? Math.round(rate * m * 100) / 100 : null;
  const customer = ref.customers.find((c) => String(c.id) === String(f.customer_id));
  const weaver = ref.weavers.find((w) => String(w.id) === String(weaverId));
  const toggleChallan = (id) => setChosenChallans((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const review = () => run(async () => {
    if (!weaverId) throw new Error('Choose the associated party whose grey is sold');
    if (!chosen.length) throw new Error('Select at least one taka');
    if (!f.customer_id) throw new Error('Choose the customer');
    if (f.rate !== '' && !(rate > 0)) throw new Error('Rate must be greater than 0');
    setConfirming(true);
  });
  const save = () => run(async () => {
    const id = await repo.createGreySale({ weaver_id: Number(weaverId), customer_id: Number(f.customer_id), taka_ids: chosen.map((t) => t.id), receipt_ids: chosenKey ? chosenKey.split(',').map(Number) : undefined, rate: f.rate, date: f.date, notes: f.notes });
    navigate(`/grey-sales/${id}`);
  });

  return (
    <div className="page-w space-y-6">
      <PageHeader title="Sell grey directly to a customer" description="Grey at our place only. The sale gets a number (GS-1, GS-2 …) and a sale challan you can print." onBack={() => navigate(-1)} />

      <Card className="space-y-4 p-5">
        <Field label="Associated party (weaver) whose grey is sold">
          <Select value={weaverId} onChange={(e) => { setWeaverId(e.target.value); setChosenChallans(new Set()); setSel(new Set()); }}>
            <option value="">Select associated party…</option>
            {ref.weavers.map((w) => <option key={w.id} value={w.id}>{w.name} · {w.group_name}</option>)}
          </Select>
        </Field>
        {weaverId && (
          <div>
            <div className="mb-1.5 text-sm font-medium text-slate-700">Weaver challans <span className="font-normal text-slate-400">(optional — none selected means all of this party&apos;s grey)</span></div>
            {challans.length === 0 ? <div className="text-sm text-slate-500">This associated party has no grey at our place.</div> : (
              <div className="flex flex-wrap gap-2">
                {challans.map((c) => {
                  const on = chosenChallans.has(String(c.id));
                  return (
                    <button key={c.id} type="button" aria-pressed={on} onClick={() => toggleChallan(String(c.id))}
                      className={`rounded-lg border px-3 py-2 text-left text-sm ${on ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-100' : 'border-slate-300 bg-white hover:bg-slate-50'}`}>
                      <div className="font-semibold text-slate-900">{c.challan_no}</div>
                      <div className="text-xs text-slate-500">{fmtDate(c.date)} · {c.nick_name}{c.branch_name ? ` · ${c.branch_name}` : ''}</div>
                      <div className="text-xs tabular-nums text-slate-600">{fmtInt(c.godown_count)} taka · {fmtM(c.godown_m)} m</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </Card>

      {weaverId && (
        <div className="space-y-2">
          <h2 className="text-sm font-bold text-forest">Takas to sell</h2>
          <GreyTakaPicker takas={takas} sel={sel} setSel={setSel} />
        </div>
      )}

      <Card className="space-y-4 p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          <Field label="Customer (receiver)">
            <div className="flex gap-2">
              <Select className="min-w-0 flex-1" value={String(f.customer_id)} onChange={(e) => setF({ ...f, customer_id: e.target.value })}>
                <option value="">Select customer…</option>
                {ref.customers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.city ? ` · ${c.city}` : ''}</option>)}
              </Select>
              <Button type="button" variant="outline" onClick={() => setAdding(true)} aria-label="Add customer"><Plus className="h-4 w-4" /></Button>
            </div>
          </Field>
          <Field label="Date"><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
          <Field label="Rate per meter (optional)"><Input type="number" min="0" step="0.01" inputMode="decimal" placeholder="e.g. 28.50" value={f.rate} onChange={(e) => setF({ ...f, rate: e.target.value })} /></Field>
          <Field label="Notes"><Input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
        </div>
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 border-t border-slate-100 pt-3 text-sm tabular-nums text-slate-700">
          <span><strong className="text-lg text-slate-900">{fmtInt(chosen.length)}</strong> taka</span>
          <span><strong className="text-lg text-slate-900">{fmtM(m)}</strong> m</span>
          {amount != null && <span>Amount <strong className="text-lg text-slate-900">{fmtMoney(amount)}</strong></span>}
        </div>
      </Card>

      <Alert>{confirming ? '' : error}</Alert>
      <ActionBar hideFrom="never">
        <div className="flex flex-wrap justify-end gap-3">
          <Button type="button" variant="ghost" disabled={busy} onClick={() => navigate(-1)}>Cancel</Button>
          <Button type="button" disabled={busy} onClick={review}>Review and confirm</Button>
        </div>
      </ActionBar>

      <Modal isOpen={confirming} onClose={() => !busy && setConfirming(false)} title="Confirm grey sale">
        <div className="space-y-4">
          <p className="text-sm text-slate-700">Sell <strong>{fmtInt(chosen.length)} taka · {fmtM(m)} m</strong> of <strong>{weaver?.name}</strong>&apos;s grey to <strong>{customer?.name}</strong> on {fmtDate(f.date)}{amount != null ? <> for <strong>{fmtMoney(amount)}</strong></> : null}?</p>
          <p className="text-sm text-slate-500">These takas stop being stock. This cannot be undone from the app.</p>
          <Alert>{error}</Alert>
          <div className="flex justify-end gap-3"><Button variant="ghost" disabled={busy} onClick={() => setConfirming(false)}>Back</Button><Button disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Confirm sale'}</Button></div>
        </div>
      </Modal>
      <QuickAddCustomer open={adding} onClose={() => setAdding(false)} onSaved={async (id) => { await loadRef(); setF((p) => ({ ...p, customer_id: String(id) })); }} />
    </div>
  );
}
