// Finished goods → Withdraw → Job work. One screen: job worker, job type, date, notes, optional order, lines of quality + colour.
// The system picks the takas; the user previews them and confirms. Opened from Inventory → Withdraw and from the Job Work module.
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { PageHeader, Card, Button, Field, Input, Select, Modal, Alert, LoadState, useAction } from '../../components/ui';
import { ActionBar } from '../../components/kit';
import * as repo from '../../db/repo';
import { GstField } from '../masters/MasterForm';
import { FgLinesEditor, PickPreview, newFgLine, cleanFgLines } from '../withdraw/FgLines';

export function QuickAddJobWorker({ open, onClose, onSaved }) {
  const [f, setF] = useState({ name: '', phone: '', city: '', gstin: '' });
  const { busy, error, setError, run } = useAction();
  useEffect(() => { if (open) { setF({ name: '', phone: '', city: '', gstin: '' }); setError(''); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const save = (e) => { e.preventDefault(); run(async () => { const id = await repo.saveMaster('job_workers', f); onSaved(id); onClose(); }); };
  return (
    <Modal isOpen={open} onClose={onClose} title="Add job worker">
      <form onSubmit={save} className="space-y-4">
        <Field label="Name"><Input required autoFocus placeholder="e.g. Shree Embroidery" value={f.name} onChange={(e) => set('name', e.target.value)} /></Field>
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

export default function JobWorkForm() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [ref, setRef] = useState(null); // {workers, stock, orders, types}
  const [loadError, setLoadError] = useState('');
  const [f, setF] = useState({ job_worker_id: '', job_type: '', date: repo.today(), notes: '', order_id: params.get('order') || '' });
  const [lines, setLines] = useState([newFgLine()]);
  const [picked, setPicked] = useState(null);
  const [adding, setAdding] = useState(false);
  const { busy, error, setError, run } = useAction();
  const set = (k, v) => { setF((p) => ({ ...p, [k]: v })); setPicked(null); };

  const load = async () => {
    try {
      const [workers, stock, orders, types] = await Promise.all([repo.listJobWorkers(), repo.listFgStock(), repo.listJobOrders(), repo.jobTypeSuggestions()]);
      setRef({ workers, stock, orders, types });
    } catch (e) { setLoadError(e.message); }
  };
  useEffect(() => { load(); }, []);

  if (loadError) return <LoadState error={loadError} />;
  if (!ref) return <LoadState loading />;

  const clean = cleanFgLines(lines);
  const payload = () => ({ job_worker_id: Number(f.job_worker_id), job_type: f.job_type, date: f.date, notes: f.notes, order_id: f.order_id ? Number(f.order_id) : null, lines: clean });
  const preview = () => run(async () => {
    if (!f.job_worker_id) throw new Error('Choose the job worker');
    if (!clean.length) throw new Error('Add at least one line with a quality, a colour and the takas or meters wanted');
    setPicked(await repo.previewFgPick(clean, { jobworkedAllowed: false }));
  });
  const confirm = () => run(async () => { const id = await repo.createJobWork(payload()); navigate(`/job-work/${id}`); });

  return (
    <div className="page-w space-y-6">
      <PageHeader title="Send folded goods to a job worker" description="Embroidery, printing or any other work on finished goods. Only plain folded takas can be sent." onBack={() => navigate(-1)} />
      <Card className="space-y-4 p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          <Field label="Job worker">
            <div className="flex gap-2">
              <Select className="min-w-0 flex-1" value={String(f.job_worker_id)} onChange={(e) => set('job_worker_id', e.target.value)}>
                <option value="">Select job worker…</option>
                {ref.workers.map((w) => <option key={w.id} value={w.id}>{w.name}{w.city ? ` · ${w.city}` : ''}</option>)}
              </Select>
              <Button type="button" variant="outline" onClick={() => setAdding(true)} aria-label="Add job worker"><Plus className="h-4 w-4" /></Button>
            </div>
          </Field>
          <Field label="Job type (optional)">
            <Input list="jw-types" placeholder="e.g. Embroidery, Printing" value={f.job_type} onChange={(e) => set('job_type', e.target.value)} />
            <datalist id="jw-types">{ref.types.map((t) => <option key={t} value={t} />)}</datalist>
          </Field>
          <Field label="Date"><Input type="date" value={f.date} onChange={(e) => set('date', e.target.value)} /></Field>
          <Field label="Link to order (optional)">
            <Select value={String(f.order_id)} onChange={(e) => set('order_id', e.target.value)}>
              <option value="">Not linked</option>
              {ref.orders.map((o) => <option key={o.id} value={o.id}>{o.order_no} · {o.customer_name}{o.job_type ? ` · ${o.job_type}` : ''}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Notes"><Input placeholder="Anything the job worker should know" value={f.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
      </Card>

      <div className="space-y-3">
        <h2 className="text-sm font-bold text-forest">What to send</h2>
        {ref.stock.length === 0 && <Alert tone="info">There are no plain folded takas in stock to send.</Alert>}
        <FgLinesEditor lines={lines} setLines={(u) => { setLines(u); setPicked(null); }} stock={ref.stock} />
      </div>

      {picked && <PickPreview picked={picked} stock={ref.stock} />}
      <Alert>{error}</Alert>
      <ActionBar hideFrom="never">
        <div className="flex flex-wrap justify-end gap-3">
          <Button type="button" variant="ghost" disabled={busy} onClick={() => navigate(-1)}>Cancel</Button>
          {picked
            ? <><Button type="button" variant="outline" disabled={busy} onClick={() => setPicked(null)}>Edit</Button><Button type="button" disabled={busy} onClick={confirm}>{busy ? 'Saving…' : 'Confirm and create challan'}</Button></>
            : <Button type="button" disabled={busy} onClick={preview}>{busy ? 'Checking…' : 'Preview the takas'}</Button>}
        </div>
      </ActionBar>
      <QuickAddJobWorker open={adding} onClose={() => setAdding(false)} onSaved={async (id) => { await load(); set('job_worker_id', String(id)); }} />
    </div>
  );
}
