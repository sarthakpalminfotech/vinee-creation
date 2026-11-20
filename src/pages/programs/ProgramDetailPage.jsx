import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageHeader, Card, Button, Badge, Table, Th, Td, LoadState } from '../../components/ui';
import { Printer, PackageCheck, PlusCircle, ChevronRight } from 'lucide-react';
import { fmtM, fmtPct, fmtDate, fmtInt } from '../../lib/format';
import * as repo from '../../db/repo';
import { useDbVersion, useBackTo } from '../../lib/live';
import { DetailList, Progress, ShadeSwatch, Chip, SectionTitle } from '../../components/kit';
import { TakaList } from '../../components/TakaGrid';
import { ProgramPreview, ProgramPreviewPage, groupProgramLines } from './ProgramDocs';

export { ProgramPreview, ProgramPreviewPage };

const STATUS = { DONE: ['success', 'Done'], PARTIAL: ['warning', 'Partly received'], PENDING: ['primary', 'Pending'] };

/** One colour row of a weaver-challan section: issued / received / pending, grey, finished, mill shortage, with a taka list. */
function ShadeRow({ line, takas }) {
  const [open, setOpen] = useState(false);
  const received = takas.filter((t) => t.finished_receipt_id);
  const grey = received.reduce((s, t) => s + Number(t.grey), 0), fin = received.reduce((s, t) => s + Number(t.finished_meter), 0);
  const short = Math.round((grey - fin) * 100) / 100;
  const pending = Number(line.taka_count) - Number(line.received);
  return (
    <div className="border-t border-slate-100">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex w-full flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3 text-left hover:bg-slate-50">
        <ChevronRight className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-90' : ''}`} />
        <span className="flex min-w-[9rem] items-center gap-2"><ShadeSwatch hex={line.hex} image={line.shade_image} size="md" /><span className="font-semibold text-slate-900">{line.shade_no}</span><span className="hidden truncate text-sm text-slate-500 md:inline">{line.shade_name}</span></span>
        <span className="text-sm text-slate-600">Lot <strong className="text-slate-900">{line.lot_no || '—'}</strong></span>
        <span className="ml-auto flex flex-wrap items-center gap-x-5 gap-y-1 text-sm tabular-nums">
          <span className="text-slate-600">Issued <strong className="text-slate-900">{line.taka_count}</strong></span>
          <span className="text-slate-600">Received <strong className="text-emerald-700">{line.received}</strong></span>
          <span className="text-slate-600">Pending <strong className={pending ? 'text-amber-700' : 'text-slate-400'}>{pending}</strong></span>
          <span className="text-slate-600">Grey <strong className="text-slate-900">{fmtM(line.grey_m)}</strong> m</span>
          <span className="text-slate-600">Finished <strong className="text-slate-900">{received.length ? fmtM(fin) : '—'}</strong>{received.length ? ' m' : ''}</span>
          <span className="text-slate-600">Shortage <strong className={short > 0 ? 'text-red-600' : 'text-slate-900'}>{received.length ? `${fmtM(short)} m · ${fmtPct(grey ? (short / grey) * 100 : null)}` : '—'}</strong></span>
        </span>
      </button>
      {open && (
        <div className="border-t border-slate-100 bg-slate-50/50 p-4">
          <TakaList showTotal items={takas.map((t) => ({ id: t.id, no: t.taka_no, meters: t.grey, tag: t.finished_receipt_id ? `fin ${fmtM(t.finished_meter)}` : 'in dyeing' }))} />
        </div>
      )}
    </div>
  );
}

function ChallanSection({ c, takas }) {
  const [open, setOpen] = useState(true);
  const totalT = c.lines.reduce((s, l) => s + Number(l.taka_count), 0), totalR = c.lines.reduce((s, l) => s + Number(l.received), 0);
  return (
    <Card className="overflow-visible">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 bg-slate-50/70 px-4 py-3 text-left">
        <ChevronRight className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-90' : ''}`} />
        <span className="font-semibold text-slate-900">{c.challan_no ? `Weaver challan ${c.challan_no}` : 'Old program (no weaver challan)'}</span>
        {c.party && <span className="text-sm text-slate-600">{c.party}</span>}
        {c.challan_no && <Chip tone={c.direct ? 'sky' : 'slate'}>{c.direct ? 'direct to mill' : c.sub_nos ? `via ${c.sub_nos}` : 'via mill challan'}</Chip>}
        <span className="ml-auto text-sm tabular-nums text-slate-600">{totalR}/{totalT} received</span>
      </button>
      {open && c.lines.map((l) => <ShadeRow key={l.id} line={l} takas={takas.filter((t) => t.program_line_id === l.id)} />)}
    </Card>
  );
}

export default function ProgramDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const back = useBackTo('/programs');
  const [program, setProgram] = useState(null);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(false);
  const dbVersion = useDbVersion();
  useEffect(() => {
    (async () => {
      try { const d = await repo.getProgram(id); if (!d) { navigate('/programs'); return; } setProgram(d); setError(''); } catch (e) { setError(e.message); }
    })();
  }, [id, navigate, dbVersion]);

  if (error) return <LoadState error={error} />;
  if (!program) return <LoadState loading />;
  const [variant, label] = STATUS[program.status];
  const groups = groupProgramLines(program);
  const byShade = [];
  for (const l of program.lines) {
    let s = byShade.find((x) => x.shade_id === l.shade_id);
    if (!s) { s = { shade_id: l.shade_id, shade_no: l.shade_no, hex: l.hex, image: l.shade_image, issued: 0, received: 0 }; byShade.push(s); }
    s.issued += Number(l.taka_count); s.received += Number(l.received);
  }
  const pending = program.total_takas - program.received_takas;

  return (
    <div className="page-w space-y-6">
      <PageHeader title={`Program ${program.program_no}`} description={`Issued on ${fmtDate(program.date)}`} onBack={back}>
        <Button variant="outline" onClick={() => setPreview(true)}><Printer className="mr-2 h-4 w-4" /> Print / Share</Button>
        {program.status !== 'DONE' && <Button variant="outline" onClick={() => navigate(`/programs/${id}/add`)}><PlusCircle className="mr-2 h-4 w-4" /> Add more takas</Button>}
        <Button onClick={() => navigate(`/programs/${id}/receive`)} disabled={program.status === 'DONE'}><PackageCheck className="mr-2 h-4 w-4" /> Receive from mill</Button>
      </PageHeader>

      <Card className="space-y-6 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-forest">{program.mill_name}{program.mill_gstin && <span className="ml-3 font-mono text-sm font-normal text-slate-600">GSTIN {program.mill_gstin}</span>}</h2>
            <div className="text-sm text-slate-500">{program.nick_name?.split(',').join(', ')}</div>
          </div>
          <Badge variant={variant}>{label}</Badge>
        </div>
        <DetailList items={[
          { label: 'Issued on', value: fmtDate(program.date) },
          { label: 'Takas issued', value: fmtInt(program.total_takas) },
          { label: 'Received', value: fmtInt(program.received_takas) },
          { label: 'Pending', value: fmtInt(pending) },
          { label: 'Grey meters', value: `${fmtM(program.grey_m)} m` },
          { label: 'Notes', value: program.notes, wide: true },
        ]} />
        <Progress label="Received" pct={(program.received_takas / program.total_takas) * 100 || 0} tone="emerald" />
        <div className="flex flex-wrap gap-2">
          {byShade.map((s) => (
            <span key={s.shade_id} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white py-0.5 pl-1 pr-2.5 text-xs">
              <ShadeSwatch hex={s.hex} image={s.image} size="sm" /><span className="font-semibold text-slate-900">{s.shade_no}</span>
              <span className="tabular-nums text-slate-600">{s.issued} <span className="text-slate-400">· rec {s.received} · pend {s.issued - s.received}</span></span>
            </span>
          ))}
        </div>
      </Card>

      {groups.map((g) => (
        <section key={g.quality_id} className="space-y-3">
          <SectionTitle title={g.quality_nick} />
          {g.challans.map((c) => <ChallanSection key={c.key} c={c} takas={program.takas} />)}
        </section>
      ))}

      <section>
        <SectionTitle title={`Mill receipts (${program.receipts.length})`} />
        <Card>
          {program.receipts.length === 0 ? <div className="p-6 text-sm text-slate-500">Nothing received from the mill yet.</div> : (
            <Table>
              <thead><tr><Th>Return challan</Th><Th>Date</Th><Th className="text-right">Takas</Th><Th>Lot no</Th><Th className="text-right">Finished m</Th></tr></thead>
              <tbody>
                {program.receipts.map((r) => (
                  <tr key={r.id}><Td className="font-medium text-slate-900">{r.challan_no}</Td><Td>{fmtDate(r.date)}</Td><Td className="text-right">{r.taka_count}</Td><Td>{r.lots ? r.lots.split(',').join(', ') : '—'}</Td><Td className="text-right font-semibold">{fmtM(r.finished_m)}</Td></tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </section>
      {preview && <ProgramPreview id={id} onClose={() => setPreview(false)} />}
    </div>
  );
}
