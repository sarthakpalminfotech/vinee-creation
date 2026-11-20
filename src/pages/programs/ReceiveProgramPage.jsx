// Receive from the mill (the mill's return challan), in three steps + a confirmation:
//   1  Mill challan        – return challan no, date, notes, photo
//   2  Takas and lots      – weaver-challan cards; pending takas by shade, a lot no per shade (locked once the line has one). No meters here.
//   3  Finished meters     – one collapsible card per LOT no (lines that share a lot text share a card), one open at a time.
// Same screen for both entry points: the program detail (mode "full") and Folding → In mill (mode "folding": no program actions).
// Repo rules are unchanged: createFinishedReceipt({ program_id, challan_no, date, notes, image_url, lines }) in one transaction.
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, Check, ChevronRight, ClipboardPaste, Lock, Pencil, Plus, Scissors, Trash2 } from 'lucide-react';
import { PageHeader, Card, Button, Input, Select, Field, Alert, Modal, LoadState, useAction } from '../../components/ui';
import { ShadeSwatch, StepTabs, ActionBar } from '../../components/kit';
import { TakaGrid } from '../../components/TakaGrid';
import ImagePicker from '../../components/ImagePicker';
import { fmtM, fmtInt } from '../../lib/format';
import * as repo from '../../db/repo';

const r2 = (n) => Math.round(Number(n) * 100) / 100;
const pct = (v, base) => (base ? `${r2((v / base) * 100).toFixed(2)}%` : '—');
let seq = 0;
const newPart = () => ({ key: `rp${++seq}`, groupKey: '', editing: true, lines: {} });
const validMeter = (v) => /^\d+(\.\d{1,2})?$/.test(String(v ?? '').trim()) && Number(v) > 0;

/** The pending (IN_DYEING) takas of a program grouped by weaver challan: [{key, challan_no, party, quality, lines:[{line, takas}]}]. Old lines are their own group. */
function pendingGroups(program) {
  const out = [];
  for (const l of program.lines) {
    const takas = program.takas.filter((t) => t.program_line_id === l.id && t.status === 'IN_DYEING');
    if (!takas.length) continue;
    const key = l.receipt_id ? `r${l.receipt_id}` : `o${l.id}`;
    let g = out.find((x) => x.key === key);
    if (!g) { g = { key, challan_no: l.weaver_challan, party: l.weaver_name, quality: l.quality_nick, old: !l.receipt_id, lines: [] }; out.push(g); }
    g.lines.push({ line: l, takas });
  }
  return out;
}
const lineState = (part, line) => part.lines[line.id] || { lot: line.lot_no || '', sel: [] };
const selectedOf = (part, line, takas) => { const st = lineState(part, line); return takas.filter((t) => st.sel.includes(t.id)); };

/** Warn before the browser closes / a link inside the app is followed while there are unsaved entries. */
function useUnsavedGuard(dirty) {
  useEffect(() => {
    if (!dirty) return undefined;
    const beforeUnload = (e) => { e.preventDefault(); e.returnValue = ''; };
    const onClick = (e) => {
      const a = e.target.closest?.('a[href]');
      if (!a || a.target === '_blank' || !a.getAttribute('href')?.startsWith('/')) return;
      if (!window.confirm('You have unsaved entries on this screen. Leave without saving?')) { e.preventDefault(); e.stopPropagation(); }
    };
    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('click', onClick, true);
    return () => { window.removeEventListener('beforeunload', beforeUnload); document.removeEventListener('click', onClick, true); };
  }, [dirty]);
}

/** Step 2: one shade of a weaver challan — lot no + tap grid of the pending takas. */
function LineGroup({ line, takas, part, onChange }) {
  const [n, setN] = useState('10');
  const st = lineState(part, line);
  const locked = !!line.lot_no;
  const set = (patch) => onChange({ ...st, ...patch });
  const sel = new Set(st.sel);
  const toggle = (id) => set({ sel: sel.has(id) ? st.sel.filter((x) => x !== id) : [...st.sel, id] });
  const chosen = takas.filter((t) => sel.has(t.id));
  const grey = r2(chosen.reduce((s, t) => s + Number(t.grey_meter), 0));
  const missingLot = chosen.length > 0 && !st.lot.trim();
  return (
    <div className="space-y-3 rounded-lg border border-slate-200 p-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <ShadeSwatch hex={line.hex} image={line.shade_image} size="md" />
        <span className="font-semibold text-slate-900">{line.shade_no}</span><span className="hidden text-sm text-slate-500 sm:inline">{line.shade_name}</span>
        <span className="text-sm text-slate-500">{takas.length} pending</span>
        <label className="ml-auto flex items-center gap-2 text-sm font-medium text-slate-700">
          Lot no *
          <span className="relative">
            <Input value={st.lot} readOnly={locked} onChange={(e) => set({ lot: e.target.value })} aria-label={`Lot number of ${line.shade_no}`} error={missingLot}
              className={`h-10 w-40 ${locked ? 'bg-slate-50 pr-8' : ''}`} placeholder="e.g. L-778" />
            {locked && <Lock className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-label="Lot number is locked" />}
          </span>
        </label>
      </div>
      {missingLot && <div className="text-sm font-medium text-red-600">Enter the lot number for {line.shade_no} — takas of it are selected.</div>}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => set({ sel: takas.map((t) => t.id) })}>Select all</Button>
        <div className="flex items-center gap-1.5">
          <Button type="button" variant="outline" size="sm" onClick={() => set({ sel: takas.slice(0, Math.max(0, Number(n) || 0)).map((t) => t.id) })}>First</Button>
          <input type="number" min="1" value={n} onChange={(e) => setN(e.target.value)} aria-label="How many takas" className="h-9 w-16 rounded-md border border-slate-300 px-2 text-base" />
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => set({ sel: [] })}>Clear</Button>
        <span className="ml-auto text-sm tabular-nums text-slate-600"><strong className="text-slate-900">{chosen.length}</strong> selected · grey <strong className="text-slate-900">{fmtM(grey)}</strong> m</span>
      </div>
      <div className="max-h-72 overflow-y-auto"><TakaGrid items={takas.map((t) => ({ id: t.id, no: t.taka_no, meters: t.grey_meter }))} sel={sel} onToggle={toggle} /></div>
    </div>
  );
}

function ReceiveCard({ part, groups, taken, onChange, onRemove, onDone, canRemove }) {
  const group = groups.find((g) => g.key === part.groupKey);
  if (!part.editing && group) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-slate-200 bg-white px-4 py-3">
        <Check className="h-4 w-4 shrink-0 text-emerald-600" />
        <span className="min-w-0 text-sm text-slate-700"><strong className="text-slate-900">{group.challan_no || 'Old program'}</strong> · {group.quality}{' · '}
          {group.lines.map(({ line, takas }) => ({ line, n: selectedOf(part, line, takas).length })).filter((x) => x.n).map(({ line, n }, i) => <span key={line.id}>{i > 0 ? ' · ' : ''}{line.shade_no}: {n} takas, lot {lineState(part, line).lot || '—'}</span>)}
        </span>
        <span className="ml-auto flex gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ ...part, editing: true })}><Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit</Button>
          <Button type="button" variant="ghost" size="sm" onClick={onRemove}><Trash2 className="mr-1.5 h-3.5 w-3.5" /> Remove</Button>
        </span>
      </div>
    );
  }
  return (
    <div className="space-y-4 rounded-lg border-2 border-primary-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <Field label="Weaver challan" className="min-w-0 max-w-xl flex-1">
          <Select value={part.groupKey} onChange={(e) => onChange({ ...part, groupKey: e.target.value, lines: {} })}>
            <option value="">Select weaver challan…</option>
            {groups.filter((g) => g.key === part.groupKey || !taken.has(g.key)).map((g) => (
              <option key={g.key} value={g.key}>{g.old ? `${g.lines.map((x) => `Shade ${x.line.shade_no}`).join(', ')} (old program)` : `${g.challan_no} · ${g.party} · ${g.quality}`} · {g.lines.reduce((s, x) => s + x.takas.length, 0)} pending</option>
            ))}
          </Select>
        </Field>
        {canRemove && <Button type="button" variant="ghost" size="sm" onClick={onRemove}><Trash2 className="mr-1.5 h-3.5 w-3.5" /> Remove</Button>}
      </div>
      {group && group.lines.map(({ line, takas }) => (
        <LineGroup key={line.id} line={line} takas={takas} part={part} onChange={(st) => onChange({ ...part, lines: { ...part.lines, [line.id]: st } })} />
      ))}
      {group && <div className="flex justify-end"><Button type="button" onClick={onDone}><Check className="mr-2 h-4 w-4" /> Done with this challan</Button></div>}
    </div>
  );
}

const lotTotals = (lot, fm) => {
  const grey = r2(lot.rows.reduce((s, r) => s + Number(r.taka.grey_meter), 0));
  const filled = lot.rows.filter((r) => validMeter(fm[r.taka.id]));
  const fin = r2(filled.reduce((s, r) => s + Number(fm[r.taka.id]), 0));
  const missing = lot.rows.length - filled.length;
  return { grey, fin, missing, short: r2(grey - fin), complete: missing === 0 };
};

/** Step 3: one lot — a list with one row per taka (grey m, finished m input, live shortage). Collapsed it shows a one-line summary. */
function LotCard({ lot, fm, setFm, open, onOpen, onEnterLast, onPaste }) {
  const t = lotTotals(lot, fm);
  const head = (
    <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 text-sm tabular-nums">
      <strong className="text-base text-slate-900">{lot.lot}</strong>
      <span className="text-slate-600">{fmtInt(lot.rows.length)} takas</span>
      <span className="text-slate-600">grey <strong className="text-slate-900">{fmtM(t.grey)}</strong> m</span>
      {t.fin > 0 && <span className="text-slate-600">finished <strong className="text-slate-900">{fmtM(t.fin)}</strong> m</span>}
      {t.fin > 0 && t.complete && <span className="text-slate-600">shortage <strong className={t.short > 0 ? 'text-red-600' : 'text-slate-900'}>{fmtM(t.short)}</strong> m ({pct(t.short, t.grey)})</span>}
      {t.complete ? <span className="font-medium text-emerald-700">✓ complete</span> : <span className="font-medium text-amber-700">{t.missing} meter{t.missing === 1 ? '' : 's'} missing</span>}
    </span>
  );
  const subs = [...new Set(lot.rows.map((r) => r.sub))];
  return (
    <div className={`rounded-lg border bg-white ${open ? 'border-2 border-primary-200' : 'border-slate-200'}`}>
      <button type="button" aria-expanded={open} onClick={onOpen} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <ChevronRight className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-90' : ''}`} />
        {head}
      </button>
      {open && (
        <div className="space-y-3 border-t border-slate-100 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onPaste}><ClipboardPaste className="mr-1.5 h-3.5 w-3.5" /> Paste</Button>
            <span className="text-sm text-slate-500">Enter moves to the next taka.</span>
          </div>
          {subs.map((sub) => {
            const rows = lot.rows.filter((r) => r.sub === sub);
            const first = rows[0];
            return (
              <div key={sub} className="rounded-md border border-slate-200">
                {subs.length > 1 && <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700">{first.challan} · <ShadeSwatch hex={first.line.hex} image={first.line.shade_image} size="sm" /> {first.line.shade_no}</div>}
                <div className="divide-y divide-slate-100">
                  {rows.map((r) => {
                    const v = fm[r.taka.id] ?? '';
                    const bad = v !== '' && !validMeter(v);
                    const over = !bad && v !== '' && Number(v) > Number(r.taka.grey_meter);
                    const rowShort = !bad && v !== '' ? r2(Number(r.taka.grey_meter) - Number(v)) : null;
                    return (
                      <div key={r.taka.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-1.5">
                        <span className="w-12 text-xs text-slate-400">#{r.taka.taka_no}</span>
                        <span className="w-28 text-sm tabular-nums text-slate-600">grey <strong className="text-slate-900">{fmtM(r.taka.grey_meter)}</strong></span>
                        <Input id={`fm-${r.taka.id}`} type="text" inputMode="decimal" autoComplete="off" aria-label={`Finished meters of taka ${r.taka.taka_no}`} error={bad}
                          className="h-11 w-32 text-right text-lg font-semibold" value={v}
                          onChange={(e) => setFm({ ...fm, [r.taka.id]: e.target.value.replace(',', '.') })}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const nxt = lot.rows[lot.rows.indexOf(r) + 1]; if (nxt) document.getElementById(`fm-${nxt.taka.id}`)?.focus(); else onEnterLast(); } }} />
                        <span className="min-w-[8rem] text-sm tabular-nums">
                          {bad ? <span className="text-red-600">Max 2 decimals, above 0</span>
                            : rowShort != null ? <span className={rowShort > 0 ? 'text-red-600' : 'text-slate-500'}>shortage {fmtM(rowShort)} m{over ? <span className="ml-1 text-amber-600">· more than grey</span> : null}</span> : null}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          <div className="flex flex-wrap justify-between gap-2 rounded-md bg-slate-100 px-3 py-2 text-sm font-semibold tabular-nums text-slate-800">
            <span>{fmtInt(lot.rows.length)} takas · grey {fmtM(t.grey)} m</span>
            <span>finished {fmtM(t.fin)} m · shortage <span className={t.short > 0 && t.complete ? 'text-red-600' : ''}>{t.complete ? `${fmtM(t.short)} m (${pct(t.short, t.grey)})` : '—'}</span></span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReceiveProgramPage({ mode = 'full' }) {
  const folding = mode === 'folding';
  const { id } = useParams();
  const navigate = useNavigate();
  const backTo = folding ? '/folding/in-mill' : `/programs/${id}`;
  const [program, setProgram] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ challan_no: '', date: repo.today(), notes: '', image_url: '' });
  const [parts, setParts] = useState([newPart()]);
  const [fm, setFm] = useState({}); // finished meter by taka id (strings)
  const [openLot, setOpenLot] = useState(null);
  const [focusId, setFocusId] = useState(null);
  const [paste, setPaste] = useState(null); // { lot, text, error }
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [saved, setSaved] = useState(null); // receipt id after a save in folding mode
  const { busy, error, setError, run } = useAction();

  useEffect(() => {
    repo.getProgram(id).then((p) => (p ? setProgram(p) : navigate(folding ? '/folding/in-mill' : '/programs'))).catch((e) => setLoadError(e.message));
  }, [id, navigate, folding]);
  const groups = useMemo(() => (program ? pendingGroups(program) : []), [program]);

  // every selected (challan, shade) with its takas — the basis of steps 2 and 3
  const entries = useMemo(() => parts.flatMap((p) => {
    const g = groups.find((x) => x.key === p.groupKey);
    return (g ? g.lines : []).map(({ line, takas }) => ({ part: p, group: g, line, chosen: selectedOf(p, line, takas), lot: lineState(p, line).lot.trim() })).filter((e) => e.chosen.length);
  }), [parts, groups]);
  // step 3: one card per lot text, lines sharing a lot text merge
  const lots = useMemo(() => {
    const m = new Map();
    for (const e of entries) {
      if (!m.has(e.lot)) m.set(e.lot, { lot: e.lot, rows: [] });
      for (const taka of e.chosen) m.get(e.lot).rows.push({ taka, line: e.line, challan: e.group.challan_no || 'Old program', sub: `${e.group.key}:${e.line.id}` });
    }
    return [...m.values()];
  }, [entries]);
  const totals = useMemo(() => {
    const grey = r2(entries.reduce((s, e) => s + e.chosen.reduce((a, t) => a + Number(t.grey_meter), 0), 0));
    const takas = entries.reduce((s, e) => s + e.chosen.length, 0);
    const fin = r2(lots.reduce((s, l) => s + lotTotals(l, fm).fin, 0));
    const missing = lots.reduce((s, l) => s + lotTotals(l, fm).missing, 0);
    return { grey, takas, fin, missing };
  }, [entries, lots, fm]);

  const dirty = !saved && (form.challan_no.trim() !== '' || form.notes.trim() !== '' || !!form.image_url || entries.length > 0 || Object.keys(fm).length > 0);
  useUnsavedGuard(dirty);
  const activeLot = openLot === '' ? '' : (lots.some((l) => l.lot === openLot) ? openLot : (lots.find((l) => !lotTotals(l, fm).complete) || lots[0])?.lot);
  useEffect(() => { if (focusId != null) { document.getElementById(`fm-${focusId}`)?.focus(); setFocusId(null); } }, [focusId, openLot]);

  if (loadError) return <LoadState error={loadError} />;
  if (!program) return <LoadState loading />;
  if (saved) {
    return (
      <div className="page-w-4xl space-y-6">
        <PageHeader title="Received from the mill" description={`Program ${program.program_no} · ${program.mill_name}`} />
        <Card className="space-y-4 p-6">
          <Alert tone="success">Receipt {form.challan_no} saved — {fmtInt(totals.takas)} takas are now finished and waiting to be folded.</Alert>
          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="outline" onClick={() => navigate('/folding/in-mill')}>Back to In mill</Button>
            <Button onClick={() => navigate(`/folding?open=${saved}`)}><Scissors className="mr-2 h-4 w-4" /> Fold these takas now</Button>
          </div>
        </Card>
      </div>
    );
  }
  if (program.status === 'DONE' || groups.length === 0) {
    return <div className="page-w-3xl space-y-6"><PageHeader title={`Receive ${program.program_no}`} onBack={() => navigate(backTo)} /><Alert tone="info">Everything in this program was already received.</Alert></div>;
  }

  const leave = () => (dirty ? setLeaveOpen(true) : navigate(backTo));
  const taken = (i) => new Set(parts.filter((_, j) => j !== i).map((p) => p.groupKey).filter(Boolean));
  const check1 = () => {
    if (!form.challan_no.trim()) return 'Enter the mill return challan number';
    if (!form.date) return 'Choose the date';
    return '';
  };
  const check2 = () => {
    if (entries.length === 0) return 'Select the takas that came back';
    const noLot = entries.find((e) => !e.lot);
    if (noLot) return `Enter the lot number of colour ${noLot.line.shade_no}`;
    return '';
  };
  const check3 = () => {
    if (totals.missing > 0) return `${totals.missing} finished meter${totals.missing === 1 ? ' is' : 's are'} still missing or invalid`;
    return '';
  };
  const goto = (n) => {
    if (n > 1) { const e = check1(); if (e) { setError(e); setStep(1); return; } }
    if (n > 2) { const e = check2(); if (e) { setError(e); setStep(2); return; } }
    setError('');
    setStep(n);
  };
  const review = () => { const e = check3(); if (e) { setError(e); return; } setError(''); setConfirmOpen(true); };
  const save = () => run(async () => {
    const receiptId = await repo.createFinishedReceipt({
      program_id: program.id, challan_no: form.challan_no, date: form.date, notes: form.notes, image_url: form.image_url,
      lines: entries.map((e) => ({ program_line_id: e.line.id, lot_no: e.lot, rows: e.chosen.map((t) => ({ id: t.id, finished_meter: fm[t.id] })) })),
    });
    if (folding) { setConfirmOpen(false); setSaved(receiptId); } else navigate(`/programs/${id}`);
  });
  const addAnother = () => {
    if (parts.some((p) => p.editing && p.groupKey && !entries.some((e) => e.part === p))) { setError('Select takas in the open challan first, or remove it'); return; }
    setError(''); setParts([...parts.map((p) => ({ ...p, editing: false })), newPart()]);
  };
  const enterLast = (lot) => {
    const i = lots.findIndex((l) => l.lot === lot.lot);
    const nxt = lots[i + 1];
    if (nxt) { setOpenLot(nxt.lot); setFocusId(nxt.rows[0].taka.id); }
  };
  const doPaste = () => {
    const lot = lots.find((l) => l.lot === paste.lot);
    const vals = paste.text.split(/\r?\n/).map((x) => x.trim().replace(',', '.')).filter(Boolean);
    if (vals.length !== lot.rows.length) { setPaste({ ...paste, error: `You pasted ${vals.length} value${vals.length === 1 ? '' : 's'} but lot ${lot.lot} has ${lot.rows.length} takas — nothing was filled. Paste exactly one value per line.` }); return; }
    const badAt = vals.findIndex((v) => !validMeter(v));
    if (badAt >= 0) { setPaste({ ...paste, error: `Line ${badAt + 1} (“${vals[badAt]}”) is not a valid meter — use a number above 0 with at most 2 decimals.` }); return; }
    setFm({ ...fm, ...Object.fromEntries(lot.rows.map((r, i) => [r.taka.id, vals[i]])) });
    setPaste(null);
  };

  const summary = (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <div><div className="text-xs font-bold text-slate-500">Takas</div><div className="text-2xl font-bold tabular-nums text-primary-700">{fmtInt(totals.takas)}</div></div>
        <div><div className="text-xs font-bold text-slate-500">Grey m</div><div className="text-lg font-bold tabular-nums text-slate-900">{fmtM(totals.grey)}</div></div>
        <div><div className="text-xs font-bold text-slate-500">{step === 3 ? 'Finished m' : 'Lots'}</div><div className="text-lg font-bold tabular-nums text-slate-900">{step === 3 ? fmtM(totals.fin) : lots.length}</div></div>
      </div>
      {step === 3 && totals.missing > 0 && <div className="text-xs font-medium text-amber-700">{totals.missing} meter{totals.missing === 1 ? '' : 's'} still to enter</div>}
      {step === 2 && <Button type="button" className="h-12 w-full text-base" disabled={busy || totals.takas === 0} onClick={() => goto(3)}>Next — finished meters <ArrowRight className="ml-2 h-4 w-4" /></Button>}
      {step === 3 && <Button type="button" className="h-12 w-full text-base" disabled={busy || totals.missing > 0 || totals.takas === 0} onClick={review}>Review &amp; receive {totals.takas} takas</Button>}
    </div>
  );

  return (
    <div className="page-w-6xl space-y-6">
      <PageHeader title="Receive from the mill" description={`Program ${program.program_no} · ${program.mill_name}`} onBack={leave} />
      <StepTabs steps={['Mill challan', 'Takas & lots', 'Finished meters']} step={step} onStep={goto} />
      {step === 1 && (
        <Card className="max-w-3xl space-y-4 p-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Mill return challan no *"><Input value={form.challan_no} onChange={(e) => setForm({ ...form, challan_no: e.target.value })} /></Field>
            <Field label="Date *"><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
            <Field label="Notes (optional)" className="md:col-span-2"><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          </div>
          <ImagePicker label="Photo of the challan (optional)" value={form.image_url} onChange={(url) => setForm({ ...form, image_url: url })} />
          <Alert>{error}</Alert>
          <div className="flex justify-end"><Button type="button" onClick={() => goto(2)}>Next <ArrowRight className="ml-2 h-4 w-4" /></Button></div>
        </Card>
      )}
      {step >= 2 && (
        <>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-3">
              {step === 2 && (
                <>
                  {parts.map((p, i) => (
                    <ReceiveCard key={p.key} part={p} groups={groups} taken={taken(i)} canRemove={parts.length > 1 || !!p.groupKey}
                      onChange={(next) => setParts(parts.map((x, j) => (j === i ? next : (next.editing && !p.editing && x.groupKey && entries.some((e) => e.part === x) ? { ...x, editing: false } : x))))}
                      onRemove={() => { const rest = parts.filter((_, j) => j !== i); setParts(rest.length ? rest : [newPart()]); }}
                      onDone={() => { if (!entries.some((e) => e.part === p)) { setError('Select at least one taka of this challan, or remove it'); return; } setError(''); setParts(parts.map((x) => ({ ...x, editing: false }))); }} />
                  ))}
                  {parts.length < groups.length && <Button type="button" variant="outline" onClick={addAnother}><Plus className="mr-2 h-4 w-4" /> Add another weaver challan</Button>}
                </>
              )}
              {step === 3 && lots.map((l) => (
                <LotCard key={l.lot} lot={l} fm={fm} setFm={setFm} open={activeLot === l.lot} onOpen={() => setOpenLot(activeLot === l.lot ? '' : l.lot)}
                  onEnterLast={() => enterLast(l)} onPaste={() => setPaste({ lot: l.lot, text: '', error: '' })} />
              ))}
              <Alert>{error}</Alert>
              <div><Button type="button" variant="ghost" onClick={() => goto(step - 1)}>Back</Button></div>
            </div>
            <div className="hidden xl:block"><Card className="p-5 xl:sticky xl:top-6"><h3 className="mb-4 text-base font-bold text-forest">Summary</h3>{summary}</Card></div>
          </div>
          <ActionBar hideFrom="xl">{summary}</ActionBar>
        </>
      )}

      <Modal isOpen={paste !== null} onClose={() => setPaste(null)} title={`Paste finished meters · lot ${paste?.lot || ''}`}>
        <p className="mb-2 text-sm text-slate-600">One value per line, in the order of the takas shown ({lots.find((l) => l.lot === paste?.lot)?.rows.length || 0} takas).</p>
        <textarea autoFocus value={paste?.text || ''} onChange={(e) => setPaste({ ...paste, text: e.target.value, error: '' })} className="h-40 w-full rounded-md border border-slate-300 p-3 text-base focus:outline-none focus:ring-2 focus:ring-primary-500" />
        <Alert className="mt-3">{paste?.error}</Alert>
        <div className="mt-4 flex justify-end gap-3"><Button type="button" variant="ghost" onClick={() => setPaste(null)}>Cancel</Button><Button type="button" disabled={!paste?.text?.trim()} onClick={doPaste}>Fill meters</Button></div>
      </Modal>

      <Modal isOpen={leaveOpen} onClose={() => setLeaveOpen(false)} title="Leave without saving?">
        <p className="text-sm text-slate-700">The entries on this screen have not been saved. If you leave now they are lost.</p>
        <div className="mt-4 flex justify-end gap-3"><Button type="button" variant="outline" onClick={() => setLeaveOpen(false)}>Keep working</Button><Button type="button" onClick={() => navigate(backTo)}>Leave</Button></div>
      </Modal>

      <Modal isOpen={confirmOpen} onClose={() => !busy && setConfirmOpen(false)} title={`Confirm receipt ${form.challan_no}`} maxWidth="max-w-2xl">
        <div className="space-y-3">
          {lots.map((l) => {
            const t = lotTotals(l, fm);
            const byLine = [...new Map(l.rows.map((r) => [r.sub, r])).values()];
            return (
              <div key={l.lot} className="rounded-lg border border-slate-200">
                <div className="border-b border-slate-100 bg-slate-50 px-3 py-1.5 text-sm"><strong className="text-slate-900">Lot {l.lot}</strong></div>
                {byLine.map((first) => {
                  const rows = l.rows.filter((r) => r.sub === first.sub);
                  const lt = lotTotals({ rows }, fm);
                  return (
                    <div key={first.sub} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-1.5 text-sm">
                      <span className="inline-flex items-center gap-2"><ShadeSwatch hex={first.line.hex} image={first.line.shade_image} size="sm" /><strong>{first.line.shade_no}</strong><span className="text-slate-500">{first.challan}</span></span>
                      <span className="ml-auto tabular-nums text-slate-700">{rows.length} taka · grey {fmtM(lt.grey)} · finished <strong>{fmtM(lt.fin)}</strong> · shortage <strong className={lt.short > 0 ? 'text-red-600' : ''}>{fmtM(lt.short)}</strong> m</span>
                    </div>
                  );
                })}
                {byLine.length > 1 && <div className="flex justify-between border-t border-slate-100 px-3 py-1 text-xs font-semibold tabular-nums text-slate-600"><span>Lot total</span><span>{l.rows.length} taka · grey {fmtM(t.grey)} · finished {fmtM(t.fin)} · shortage {fmtM(t.short)} m</span></div>}
              </div>
            );
          })}
          <div className="flex justify-between rounded-lg bg-slate-100 px-3 py-2 text-sm font-bold tabular-nums"><span>Total</span><span>{totals.takas} taka · grey {fmtM(totals.grey)} · finished {fmtM(totals.fin)} · shortage {fmtM(r2(totals.grey - totals.fin))} m ({pct(r2(totals.grey - totals.fin), totals.grey)})</span></div>
          <Alert>{error}</Alert>
          <div className="flex justify-end gap-3"><Button type="button" variant="outline" disabled={busy} onClick={() => setConfirmOpen(false)}>Edit again</Button><Button type="button" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Confirm & receive'}</Button></div>
        </div>
      </Modal>
    </div>
  );
}
