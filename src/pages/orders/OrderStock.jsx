// Order detail → "Available stock" (R-SO-5): for each order line the ready (folded) stock — the eligible kind highlighted —
// what is still to fold, in dyeing (program + lots) and at a job worker, plus the quality-level grey and open POs.
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList } from 'lucide-react';
import { Card, Alert, LoadState } from '../../components/ui';
import { Qty, Chip, ShadeSwatch } from '../../components/kit';
import { fmtInt, fmtM } from '../../lib/format';
import * as repo from '../../db/repo';
import { useDbVersion } from '../../lib/live';

const Box = ({ label, takas, m, tone = 'slate', highlight = false, children }) => (
  <div className={`rounded-lg border p-2.5 ${highlight ? 'border-emerald-300 bg-emerald-50/60 ring-1 ring-emerald-200' : 'border-slate-200 bg-white'}`}>
    <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
    <Qty tone={tone} takas={takas} meters={m} />
    {children}
  </div>
);

export default function OrderStock({ orderId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const v = useDbVersion();
  useEffect(() => {
    let live = true;
    repo.orderAvailability(orderId).then((d) => { if (live) { setData(d); setError(''); } }).catch((e) => live && setError(e.message));
    return () => { live = false; };
  }, [orderId, v]);
  if (error) return <LoadState error={error} />;
  if (!data) return <LoadState loading />;
  const { detail, lines, jobOrder, order } = data;
  const byShade = new Map(detail.shades.map((s) => [s.shade_id, s]));
  return (
    <div className="space-y-4" id="order-stock">
      {lines.map((l) => {
        const s = byShade.get(l.shade_id);
        if (!s) return null;
        const ready = jobOrder ? s.jobworked : s.plain;
        const other = jobOrder ? s.plain : s.jobworked;
        return (
          <Card key={l.line_id} className="space-y-3 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <ShadeSwatch hex={s.hex} image={s.image_url} size="md" />
              <span className="font-semibold text-slate-900">{s.shade_no}{s.shade_name ? <span className="font-normal text-slate-500"> · {s.shade_name}</span> : null}</span>
              <span className="ml-auto">
                {l.done ? <Chip tone="emerald">Fulfilled</Chip>
                  : l.covered ? <Chip tone="emerald">Covered</Chip>
                    : <Chip tone="amber">Short by {[l.shortT > 0 ? `${fmtInt(l.shortT)} taka` : null, l.shortM > 0 ? `${fmtM(l.shortM)} m` : null].filter(Boolean).join(' / ')}</Chip>}
              </span>
            </div>
            {!l.done && <div className="text-xs text-slate-500">Pending on this order: <Qty variant="inline" tone="amber" takas={l.pending.takas} meters={l.pending.meters} /></div>}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Box highlight tone="emerald" label={jobOrder ? `Ready · job-worked${order.job_type ? ` (${order.job_type})` : ''} · eligible` : 'Ready · plain · eligible'} takas={l.eligible.takas} m={l.eligible.m}>
                {jobOrder && s.jobTypes.length > 0 && <div className="mt-1.5 flex flex-wrap gap-1">{s.jobTypes.map((j) => <Chip key={j.label} tone="amber">{j.label} {j.takas}</Chip>)}</div>}
              </Box>
              <Box tone="slate" label={jobOrder ? 'Ready · plain (not for this order)' : 'Ready · job-worked (not for this order)'} takas={other.takas} m={other.m}>
                {!jobOrder && s.jobTypes.length > 0 && <div className="mt-1.5 flex flex-wrap gap-1">{s.jobTypes.map((j) => <Chip key={j.label} tone="amber">{j.label} {j.takas}</Chip>)}</div>}
              </Box>
              <Box tone="sky" label="Finished, still to fold" takas={s.unfolded.takas} m={s.unfolded.m} />
              <Box tone="amber" label="At job worker" takas={s.atJobWorker.takas} m={s.atJobWorker.m}>
                {s.jwChallans?.length > 0 && <div className="mt-1.5 flex flex-wrap gap-1">{s.jwChallans.map((n) => <Chip key={n}>JW-{n}</Chip>)}</div>}
              </Box>
              <Box tone="violet" label="In dyeing" takas={s.dyeing.takas} m={s.dyeing.m}>
                {s.programs.length > 0 && (
                  <ul className="mt-1.5 space-y-0.5 text-xs text-slate-600">
                    {s.programs.map((p) => <li key={p.label} className="flex flex-wrap justify-between gap-x-2"><span>{p.label}{p.lots?.length ? <span className="ml-1 text-slate-500">· lot {p.lots.join(', ')}</span> : null}</span><span className="tabular-nums">{p.takas} taka · {fmtM(p.m)} m</span></li>)}
                  </ul>
                )}
              </Box>
            </div>
            {ready.takas === 0 && !l.done && l.eligible.takas === 0 && <Alert tone="info">No eligible ready stock for this colour yet.</Alert>}
          </Card>
        );
      })}
      <Card className="space-y-3 p-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Grey of this quality</div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Grey at mill (not yet in a program)</div>
            <Qty className="mt-2" tone="sky" takas={detail.greyAtMill.takas} meters={detail.greyAtMill.m} />
            <ul className="mt-2 space-y-0.5 text-xs text-slate-600">{detail.greyAtMill.byMill.map((m) => <li key={m.label} className="flex justify-between gap-2"><span>{m.label}</span><span className="tabular-nums">{m.takas} taka · {fmtM(m.m)} m</span></li>)}</ul>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Grey at our place</div>
            <Qty className="mt-2" takas={detail.greyAtPlace.takas} meters={detail.greyAtPlace.m} />
            <ul className="mt-2 space-y-0.5 text-xs text-slate-600">{detail.greyAtPlace.byBranch.map((m) => <li key={m.label} className="flex justify-between gap-2"><span>{m.label}</span><span className="tabular-nums">{m.takas} taka · {fmtM(m.m)} m</span></li>)}</ul>
          </div>
        </div>
        <Link to={`/po?quality=${order.quality_id}`} className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm hover:border-primary-300 hover:bg-primary-50/40">
          <ClipboardList className="h-4 w-4 shrink-0 text-slate-400" />
          <span className="font-semibold text-slate-900">Open POs: {fmtInt(detail.openPos.count)}</span>
          <span className="text-slate-300">·</span>
          <span className="text-slate-700">Pending: <strong className="tabular-nums text-slate-900">{fmtM(detail.openPos.pending_m)} m</strong></span>
        </Link>
      </Card>
    </div>
  );
}
