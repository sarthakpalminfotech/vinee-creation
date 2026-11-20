// Grey → Withdraw → Others: take grey at our place out of stock with a reason (can be cancelled later).
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader, Card, Button, Field, Input, Select, Modal, Alert, LoadState, useAction } from '../../components/ui';
import { ActionBar } from '../../components/kit';
import { fmtDate, fmtInt, fmtM } from '../../lib/format';
import * as repo from '../../db/repo';
import GreyTakaPicker from './GreyTakaPicker';

export default function GreyOtherForm() {
  const navigate = useNavigate();
  const [ref, setRef] = useState(null); // {weavers, challans}
  const [loadError, setLoadError] = useState('');
  const [party, setParty] = useState('');
  const [challan, setChallan] = useState('');
  const [takas, setTakas] = useState([]);
  const [sel, setSel] = useState(() => new Set());
  const [f, setF] = useState({ reason: '', date: repo.today(), notes: '' });
  const [confirming, setConfirming] = useState(false);
  const { busy, error, setError, run } = useAction();

  useEffect(() => {
    Promise.all([repo.listWeavers(), repo.listGodownChallans()]).then(([weavers, challans]) => setRef({ weavers, challans })).catch((e) => setLoadError(e.message));
  }, []);
  useEffect(() => {
    let live = true;
    repo.greyGodownTakas({ weaver_id: party ? Number(party) : undefined, receipt_ids: challan ? [Number(challan)] : undefined })
      .then((t) => { if (live) { setTakas(t); setSel(new Set()); } }).catch((e) => live && setError(e.message));
    return () => { live = false; };
  }, [party, challan]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loadError) return <LoadState error={loadError} />;
  if (!ref) return <LoadState loading />;

  const chosen = takas.filter((t) => sel.has(t.id));
  const m = Math.round(chosen.reduce((s, t) => s + Number(t.grey_meter), 0) * 100) / 100;
  const challanChoices = ref.challans.filter((c) => !party || String(c.weaver_id) === party);
  const review = () => run(async () => {
    if (!chosen.length) throw new Error('Select at least one taka');
    if (!f.reason.trim()) throw new Error('Give the reason for the withdrawal');
    setConfirming(true);
  });
  const save = () => run(async () => { const id = await repo.createGreyWithdrawal({ ...f, taka_ids: chosen.map((t) => t.id) }); navigate(`/withdrawals/${id}`); });

  return (
    <div className="page-w space-y-6">
      <PageHeader title="Withdraw grey — Others" description="Grey at our place only. The takas leave the stock; you can cancel the withdrawal later." onBack={() => navigate(-1)} />
      <Card className="space-y-4 p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          <Field label="Associated party (optional filter)">
            <Select value={party} onChange={(e) => { setParty(e.target.value); setChallan(''); }}>
              <option value="">All associated parties</option>
              {ref.weavers.map((w) => <option key={w.id} value={w.id}>{w.name} · {w.group_name}</option>)}
            </Select>
          </Field>
          <Field label="Weaver challan (optional filter)">
            <Select value={challan} onChange={(e) => setChallan(e.target.value)}>
              <option value="">All challans</option>
              {challanChoices.map((c) => <option key={c.id} value={c.id}>{c.challan_no} · {c.weaver_name} · {fmtInt(c.godown_count)} taka</option>)}
            </Select>
          </Field>
        </div>
      </Card>
      <div className="space-y-2">
        <h2 className="text-sm font-bold text-forest">Takas to withdraw</h2>
        <GreyTakaPicker takas={takas} sel={sel} setSel={setSel} />
      </div>
      <Card className="space-y-4 p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          <Field label="Reason (required)"><Input placeholder="e.g. Returned to weaver" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></Field>
          <Field label="Date"><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        </div>
        <Field label="Notes"><Input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
      </Card>
      <Alert>{confirming ? '' : error}</Alert>
      <ActionBar hideFrom="never">
        <div className="flex flex-wrap justify-end gap-3">
          <Button type="button" variant="ghost" disabled={busy} onClick={() => navigate(-1)}>Cancel</Button>
          <Button type="button" disabled={busy} onClick={review}>Review and confirm</Button>
        </div>
      </ActionBar>
      <Modal isOpen={confirming} onClose={() => !busy && setConfirming(false)} title="Confirm withdrawal">
        <div className="space-y-4">
          <p className="text-sm text-slate-700">Withdraw <strong>{fmtInt(chosen.length)} taka · {fmtM(m)} m</strong> of grey on {fmtDate(f.date)}? Reason: <strong>{f.reason}</strong></p>
          <Alert>{error}</Alert>
          <div className="flex justify-end gap-3"><Button variant="ghost" disabled={busy} onClick={() => setConfirming(false)}>Back</Button><Button disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Confirm withdrawal'}</Button></div>
        </div>
      </Modal>
    </div>
  );
}
