// Finished goods → Withdraw → Others: take folded takas out of stock with a reason (can be cancelled later).
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader, Card, Button, Field, Input, Alert, LoadState, useAction } from '../../components/ui';
import { ActionBar } from '../../components/kit';
import * as repo from '../../db/repo';
import { FgLinesEditor, PickPreview, newFgLine, cleanFgLines } from './FgLines';

export default function FgOtherForm() {
  const navigate = useNavigate();
  const [stock, setStock] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [f, setF] = useState({ reason: '', date: repo.today(), notes: '' });
  const [lines, setLines] = useState([newFgLine()]);
  const [picked, setPicked] = useState(null);
  const { busy, error, run } = useAction();

  useEffect(() => { repo.listFgStock().then(setStock).catch((e) => setLoadError(e.message)); }, []);
  if (loadError) return <LoadState error={loadError} />;
  if (!stock) return <LoadState loading />;

  const set = (k, v) => { setF((p) => ({ ...p, [k]: v })); setPicked(null); };
  const clean = cleanFgLines(lines);
  const preview = () => run(async () => {
    if (!f.reason.trim()) throw new Error('Give the reason for the withdrawal');
    if (!clean.length) throw new Error('Add at least one line with a quality, a colour and the takas or meters wanted');
    setPicked(await repo.previewFgPick(clean, { jobworkedAllowed: true }));
  });
  const confirm = () => run(async () => { const id = await repo.createFgWithdrawal({ ...f, lines: clean }); navigate(`/withdrawals/${id}`); });

  return (
    <div className="page-w space-y-6">
      <PageHeader title="Withdraw finished goods — Others" description="Samples, gifts, damage or anything else. The takas leave the stock; you can cancel the withdrawal later." onBack={() => navigate(-1)} />
      <Card className="space-y-4 p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          <Field label="Reason (required)"><Input placeholder="e.g. Sample to buyer" value={f.reason} onChange={(e) => set('reason', e.target.value)} /></Field>
          <Field label="Date"><Input type="date" value={f.date} onChange={(e) => set('date', e.target.value)} /></Field>
        </div>
        <Field label="Notes"><Input value={f.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
      </Card>
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-forest">What to withdraw</h2>
        <FgLinesEditor lines={lines} setLines={(u) => { setLines(u); setPicked(null); }} stock={stock} allowKind />
      </div>
      {picked && <PickPreview picked={picked} stock={stock} />}
      <Alert>{error}</Alert>
      <ActionBar hideFrom="never">
        <div className="flex flex-wrap justify-end gap-3">
          <Button type="button" variant="ghost" disabled={busy} onClick={() => navigate(-1)}>Cancel</Button>
          {picked
            ? <><Button type="button" variant="outline" disabled={busy} onClick={() => setPicked(null)}>Edit</Button><Button type="button" disabled={busy} onClick={confirm}>{busy ? 'Saving…' : 'Confirm withdrawal'}</Button></>
            : <Button type="button" disabled={busy} onClick={preview}>{busy ? 'Checking…' : 'Preview the takas'}</Button>}
        </div>
      </ActionBar>
    </div>
  );
}
