// Receive takas back from the job worker: pick the takas that came back (Select all / First N / tap) and confirm the
// received meters of each (prefilled with the sent meters). Partial receipts are fine, any number of times.
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check } from 'lucide-react';
import { PageHeader, Card, Button, Field, Input, Alert, LoadState, useAction } from '../../components/ui';
import { ShadeSwatch, Chip, ActionBar } from '../../components/kit';
import { fmtInt, fmtM } from '../../lib/format';
import * as repo from '../../db/repo';

const r2 = (n) => Math.round(Number(n) * 100) / 100;

export default function ReceiveJobWorkPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [c, setC] = useState(null);
  const [error, setError] = useState('');
  const [sel, setSel] = useState(() => new Set());
  const [got, setGot] = useState({}); // taka_id → received meters (string)
  const [firstN, setFirstN] = useState({}); // line key → "N"
  const [f, setF] = useState({ date: repo.today(), ref_no: '', notes: '' });
  const { busy, error: actError, run } = useAction();

  useEffect(() => {
    (async () => {
      try {
        const data = await repo.getJobWork(id);
        if (!data) { navigate('/job-work'); return; }
        setC(data);
        setGot(Object.fromEntries(data.takas.filter((t) => t.status === 'SENT').map((t) => [t.taka_id, String(t.sent_m)])));
      } catch (e) { setError(e.message); }
    })();
  }, [id, navigate]);

  const groups = useMemo(() => {
    if (!c) return [];
    return c.lines.map((l) => ({ ...l, key: `${l.quality_id}-${l.shade_id}`, takas: c.takas.filter((t) => t.status === 'SENT' && t.quality_id === l.quality_id && t.shade_id === l.shade_id) })).filter((g) => g.takas.length);
  }, [c]);

  if (error) return <LoadState error={error} />;
  if (!c) return <LoadState loading />;
  if (c.status !== 'OPEN' && c.status !== 'PARTIAL') {
    return (
      <div className="page-w-3xl space-y-6">
        <PageHeader title={`Receive ${c.jw_label}`} onBack={() => navigate(`/job-work/${c.id}`)} />
        <Alert tone="info">{c.status === 'CLOSED' ? 'This challan is closed (short). Re-open it to receive more.' : 'Everything was already received on this challan.'}</Alert>
      </div>
    );
  }

  const toggle = (tid) => setSel((s) => { const n = new Set(s); if (n.has(tid)) n.delete(tid); else n.add(tid); return n; });
  const setMany = (ids, on) => setSel((s) => { const n = new Set(s); ids.forEach((x) => (on ? n.add(x) : n.delete(x))); return n; });
  const chosen = groups.flatMap((g) => g.takas).filter((t) => sel.has(t.taka_id));
  const rows = chosen.map((t) => ({ taka_id: t.taka_id, sent: t.sent_m, received: Number(got[t.taka_id]) }));
  const totals = { takas: rows.length, sent: r2(rows.reduce((s, r) => s + r.sent, 0)), received: r2(rows.reduce((s, r) => s + (r.received || 0), 0)) };
  const badRow = rows.find((r) => !(r.received > 0) || r.received > r.sent);
  const submit = () => run(async () => {
    await repo.receiveJobWork(c.id, { date: f.date, ref_no: f.ref_no, notes: f.notes, rows: rows.map((r) => ({ taka_id: r.taka_id, received_m: r.received })) });
    navigate(`/job-work/${c.id}`);
  });

  return (
    <div className="page-w space-y-6">
      <PageHeader title={`Receive from ${c.worker_name}`} description={`${c.jw_label} · ${c.pending_takas} taka (${fmtM(c.pending_m)} m) still at the job worker`} onBack={() => navigate(`/job-work/${c.id}`)} />
      <Card className="p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Receipt date"><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
          <Field label="Job worker challan / ref no"><Input value={f.ref_no} onChange={(e) => setF({ ...f, ref_no: e.target.value })} /></Field>
          <Field label="Notes"><Input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
        </div>
      </Card>

      {groups.map((g) => {
        const ids = g.takas.map((t) => t.taka_id);
        const picked = ids.filter((x) => sel.has(x)).length;
        return (
          <Card key={g.key} className="overflow-visible">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-slate-100 bg-slate-50/60 px-4 py-3">
              <ShadeSwatch hex={g.hex} image={g.image_url} size="md" />
              <span className="font-semibold text-slate-900">{g.nick_name}</span>
              <span className="text-slate-600">{g.shade_no}{g.shade_name ? ` · ${g.shade_name}` : ''}</span>
              <Chip tone="amber">{g.takas.length} pending</Chip>
              <span className="text-sm text-slate-500">{picked} selected</span>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => setMany(ids, true)}>Select all</Button>
                <div className="flex items-center gap-1">
                  <Input type="number" min="1" inputMode="numeric" aria-label="First N takas" placeholder="N" className="h-9 w-16 px-2" value={firstN[g.key] || ''} onChange={(e) => setFirstN({ ...firstN, [g.key]: e.target.value })} />
                  <Button type="button" size="sm" variant="outline" onClick={() => setMany(ids.slice(0, Number(firstN[g.key]) || 0), true)}>First N</Button>
                </div>
                <Button type="button" size="sm" variant="ghost" onClick={() => setMany(ids, false)}>Clear</Button>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-x-6 gap-y-1 p-3 md:grid-cols-2">
              {g.takas.map((t) => {
                const on = sel.has(t.taka_id);
                const v = Number(got[t.taka_id]);
                const invalid = on && (!(v > 0) || v > t.sent_m);
                return (
                  <div key={t.taka_id} className={`flex items-center gap-3 rounded-md border px-3 py-2 ${on ? 'border-primary-300 bg-primary-50/40' : 'border-slate-200'}`}>
                    <button type="button" role="checkbox" aria-checked={on} aria-label={`Taka ${t.label}`} onClick={() => toggle(t.taka_id)}
                      className={`grid h-6 w-6 shrink-0 place-items-center rounded border ${on ? 'border-primary-600 bg-primary-600 text-white' : 'border-slate-300 bg-white'}`}>{on && <Check className="h-4 w-4" />}</button>
                    <button type="button" onClick={() => toggle(t.taka_id)} className="min-w-0 flex-1 text-left">
                      <div className="truncate text-[11px] leading-none text-slate-400">#{t.label}</div>
                      <div className="mt-1 text-base font-semibold tabular-nums text-slate-900">{fmtM(t.sent_m)} <span className="text-[11px] font-normal text-slate-400">m sent</span></div>
                    </button>
                    <Input type="number" step="0.01" min="0" inputMode="decimal" aria-label={`Received meters of ${t.label}`} disabled={!on} error={invalid}
                      className="h-11 w-28 text-right text-base font-semibold" value={got[t.taka_id] ?? ''} onChange={(e) => setGot({ ...got, [t.taka_id]: e.target.value })} />
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}

      <ActionBar hideFrom="never">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <div className="text-sm tabular-nums text-slate-700">
            <strong>{fmtInt(totals.takas)}</strong> taka · sent <strong>{fmtM(totals.sent)}</strong> m · received <strong>{fmtM(totals.received)}</strong> m
            {totals.takas > 0 && <span className="ml-2 text-red-600">shortage {fmtM(r2(totals.sent - totals.received))} m</span>}
          </div>
          {actError && <span className="text-sm text-red-600">{actError}</span>}
          {badRow && <span className="text-sm text-amber-700">Received meters must be more than 0 and not more than what was sent.</span>}
          <Button className="ml-auto" disabled={busy || totals.takas === 0 || !!badRow} onClick={submit}>{busy ? 'Saving…' : `Receive ${totals.takas} taka`}</Button>
        </div>
      </ActionBar>
    </div>
  );
}
