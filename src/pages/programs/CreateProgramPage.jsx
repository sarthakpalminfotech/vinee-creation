import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader, Card, Button, Input, Select, Field, Alert, LoadState, useAction } from '../../components/ui';
import { StepTabs, ActionBar } from '../../components/kit';
import { ArrowRight } from 'lucide-react';
import * as repo from '../../db/repo';
import ProgramBuilder, { ProgramSummary, ProgramConfirm, newProgPart, partsPayload, programTotals } from './ProgramBuilder';

/** Issue a dyeing program against weaver challans. Step 1: mill, date, notes. Step 2: weaver-challan cards (takas + colours). */
export default function CreateProgramPage() {
  const navigate = useNavigate();
  const [mills, setMills] = useState(null);
  const [programNo, setProgramNo] = useState('');
  const [loadError, setLoadError] = useState('');
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ mill_id: '', date: repo.today(), notes: '' });
  const [parts, setParts] = useState([newProgPart()]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { busy, error, setError, run } = useAction();

  useEffect(() => {
    Promise.all([repo.listMills(), repo.nextProgramNo()]).then(([m, n]) => { setMills(m); setProgramNo(n); }).catch((e) => setLoadError(e.message));
  }, []);
  if (loadError) return <LoadState error={loadError} />;
  if (!mills) return <LoadState loading />;

  const t = programTotals(parts);
  const mill = mills.find((m) => String(m.id) === String(form.mill_id));
  const next = () => {
    if (!form.mill_id) { setError('Please select the mill'); return; }
    if (!form.date) { setError('Choose the date'); return; }
    setError(''); setStep(2);
  };
  const review = () => {
    if (parts.some((p) => p.receipt && p.groups.length === 0)) { setError('Give the takas of every challan a colour, or remove the challan'); return; }
    if (t.takas === 0) { setError('Select takas and give them a colour'); return; }
    setError(''); setConfirmOpen(true);
  };
  const save = () => run(async () => {
    const id = await repo.createProgram({ mill_id: Number(form.mill_id), date: form.date, notes: form.notes, parts: partsPayload(parts) });
    navigate(`/programs/${id}/preview`, { replace: true });
  });
  // changing the mill invalidates the chosen takas
  const changeMill = (v) => { setForm((f) => ({ ...f, mill_id: v })); setParts([newProgPart()]); };

  return (
    <div className="page-w-6xl space-y-6">
      <PageHeader title="Issue Dyeing Program" description={`Program ${programNo} · against weaver challans, with the exact takas and colours.`} onBack={() => navigate('/programs')} />
      <StepTabs steps={['Details', 'Takas & colours']} step={step} onStep={(n) => (n === 2 ? next() : setStep(1))} />

      {step === 1 && (
        <Card className="max-w-3xl space-y-4 p-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Mill *">
              <Select value={form.mill_id} onChange={(e) => changeMill(e.target.value)}>
                <option value="">Select mill…</option>
                {mills.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </Select>
            </Field>
            <Field label="Date *"><Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} /></Field>
            <Field label="Program no (automatic)"><Input readOnly value={programNo} className="bg-slate-50" /></Field>
            <Field label="Notes (optional)"><Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} /></Field>
          </div>
          <Alert>{error}</Alert>
          <div className="flex justify-end"><Button type="button" onClick={next}>Next <ArrowRight className="ml-2 h-4 w-4" /></Button></div>
        </Card>
      )}

      {step === 2 && (
        <>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              <div className="text-sm text-slate-600">Grey at <strong className="text-slate-900">{mill?.name}</strong> — pick the takas of each weaver challan and give them a colour.</div>
              <ProgramBuilder millId={Number(form.mill_id)} parts={parts} setParts={setParts} setError={setError} />
              <Alert>{error}</Alert>
              <div><Button type="button" variant="ghost" onClick={() => setStep(1)}>Back</Button></div>
            </div>
            <div className="hidden lg:block">
              <Card className="p-5 lg:sticky lg:top-6">
                <h3 className="mb-4 text-base font-bold text-forest">Summary</h3>
                <ProgramSummary parts={parts} busy={busy} onSubmit={review} />
              </Card>
            </div>
          </div>
          <ActionBar>
            <ProgramSummary parts={parts} busy={busy} onSubmit={review} compact />
          </ActionBar>
        </>
      )}

      <ProgramConfirm open={confirmOpen} onClose={() => setConfirmOpen(false)} onConfirm={save} parts={parts} busy={busy} error={error} title={`Confirm program ${programNo} · ${mill?.name || ''}`} />
    </div>
  );
}
