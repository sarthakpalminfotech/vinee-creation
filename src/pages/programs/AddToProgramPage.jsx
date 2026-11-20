import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader, Card, Alert, LoadState, useAction } from '../../components/ui';
import { ShadeSwatch, ActionBar } from '../../components/kit';
import { fmtM } from '../../lib/format';
import * as repo from '../../db/repo';
import ProgramBuilder, { ProgramSummary, ProgramConfirm, newProgPart, partsPayload, programTotals } from './ProgramBuilder';

/** Add more takas to a program that is not Done yet: the same builder, the program's mill fixed, existing lines shown read-only. */
export default function AddToProgramPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [program, setProgram] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [parts, setParts] = useState([newProgPart()]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { busy, error, setError, run } = useAction();

  useEffect(() => {
    repo.getProgram(id).then((p) => (p ? setProgram(p) : navigate('/programs'))).catch((e) => setLoadError(e.message));
  }, [id, navigate]);
  if (loadError) return <LoadState error={loadError} />;
  if (!program) return <LoadState loading />;
  if (program.status === 'DONE') {
    return <div className="page-w-3xl space-y-6"><PageHeader title={`Add takas to ${program.program_no}`} onBack={() => navigate(`/programs/${id}`)} /><Alert tone="info">This program is fully received, so no more takas can be added.</Alert></div>;
  }
  const t = programTotals(parts);
  const review = () => {
    if (parts.some((p) => p.receipt && p.groups.length === 0)) { setError('Give the takas of every challan a colour, or remove the challan'); return; }
    if (t.takas === 0) { setError('Select takas and give them a colour'); return; }
    setError(''); setConfirmOpen(true);
  };
  const save = () => run(async () => { await repo.addToProgram(program.id, partsPayload(parts)); navigate(`/programs/${id}`); });

  return (
    <div className="page-w-6xl space-y-6">
      <PageHeader title={`Add more takas to ${program.program_no}`} description={`${program.mill_name} · takas already in this program stay as they are`} onBack={() => navigate(`/programs/${id}`)} />
      <Card className="p-4">
        <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Already in this program</div>
        <ul className="space-y-1 text-sm">
          {program.lines.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
              <span className="font-semibold text-slate-900">{l.weaver_challan || 'Old program'}</span><span className="text-slate-500">{l.quality_nick}</span>
              <span className="inline-flex items-center gap-1.5"><ShadeSwatch hex={l.hex} image={l.shade_image} size="sm" />{l.shade_no}</span>
              <span className="ml-auto tabular-nums text-slate-700">{l.taka_count} taka · {fmtM(l.grey_m)} m</span>
            </li>
          ))}
        </ul>
      </Card>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <ProgramBuilder millId={program.mill_id} parts={parts} setParts={setParts} setError={setError} />
          <Alert>{error}</Alert>
        </div>
        <div className="hidden lg:block"><Card className="p-5 lg:sticky lg:top-6"><h3 className="mb-4 text-base font-bold text-forest">Adding</h3><ProgramSummary parts={parts} busy={busy} onSubmit={review} submitLabel="Add to program" /></Card></div>
      </div>
      <ActionBar>
        <ProgramSummary parts={parts} busy={busy} onSubmit={review} submitLabel="Add to program" compact />
      </ActionBar>
      <ProgramConfirm open={confirmOpen} onClose={() => setConfirmOpen(false)} onConfirm={save} parts={parts} busy={busy} error={error} title={`Add to program ${program.program_no}`} confirmLabel="Confirm & add" />
    </div>
  );
}
