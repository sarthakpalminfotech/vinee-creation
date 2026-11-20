import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList } from 'lucide-react';
import { fmtM, fmtInt } from '../../lib/format';
import { Qty, ShadeSwatch } from '../../components/kit';
import * as repo from '../../db/repo';

/** Loads and shows stock for one quality (nickname) and the requested shades. needs: {shadeId: takasWanted} */
export function useAvailability(qualityId, shadeIds) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const key = (shadeIds || []).join(',');
  useEffect(() => {
    let live = true;
    if (!qualityId) { setData(null); return undefined; }
    repo.availabilityDetail(qualityId, shadeIds || []).then((d) => live && (setData(d), setError(''))).catch((e) => live && setError(e.message));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qualityId, key]);
  return { data, error };
}

const Stat = ({ label, takas, m, tone = 'slate', sub }) => (
  <div className="bg-white p-2.5 rounded-lg border border-slate-100">
    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">{label}</div>
    <Qty tone={tone} takas={takas} meters={m} />
    {sub && <div className="mt-1.5 text-[11px] text-slate-500">{sub}</div>}
  </div>
);

/** "Open POs: 3 · Pending: 4,500.00 m" — only the count and the total pending meters (POs that are Open or Partly received). */
function OpenPos({ openPos, qualityId }) {
  const body = (
    <>
      <ClipboardList className="h-4 w-4 shrink-0 text-slate-400" />
      <span className="font-semibold text-slate-900">Open POs: {fmtInt(openPos.count)}</span>
      <span className="text-slate-300">·</span>
      <span className="text-slate-700">Pending: <strong className="tabular-nums text-slate-900">{fmtM(openPos.pending_m)} m</strong></span>
    </>
  );
  const cls = 'flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm';
  return qualityId
    ? <Link to={`/po?quality=${qualityId}`} className={`${cls} hover:border-primary-300 hover:bg-primary-50/40`} title="Show the POs of this quality">{body}</Link>
    : <div className={cls}>{body}</div>;
}

export function AvailabilityPanel({ data, needs = {}, qualityId, jobOrder = false }) {
  if (!data) return <div className="text-sm text-slate-500 py-4 text-center">Select a quality to view stock.</div>;
  return (
    <div className="space-y-4" id="availability-panel">
      <OpenPos openPos={data.openPos} qualityId={qualityId} />
      {data.shades.map((s) => {
        const need = Number(needs[s.shade_id]) || 0;
        const mine = jobOrder ? s.jobworked : s.plain;
        const short = need - mine.takas;
        return (
          <div key={s.shade_id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <ShadeSwatch hex={s.hex} image={s.image_url} size="md" />
              <span className="font-semibold text-slate-900">{s.shade_no}{s.shade_name ? ` · ${s.shade_name}` : ''}</span>
              {need > 0 && <span className={`ml-auto text-xs font-medium ${short > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>Need {need}{short > 0 ? ` · short ${short}` : ' · covered'}</span>}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(jobOrder ? [0, 1] : [1, 0]).map((k) => k === 1
                ? <Stat key="plain" label="Plain (ready to sell)" takas={s.plain.takas} m={s.plain.m} sub={`${s.unfolded.takas} still to fold`} tone="emerald" />
                : <Stat key="jw" label="Job-worked" takas={s.jobworked.takas} m={s.jobworked.m} sub={s.jobTypes.map((j) => `${j.label} ${j.takas}`).join(' · ') || 'none yet'} tone="amber" />)}
              <Stat label="At job worker" takas={s.atJobWorker.takas} m={s.atJobWorker.m} tone="amber" />
              <Stat label="In dyeing" takas={s.dyeing.takas} m={s.dyeing.m} tone="violet" />
            </div>
            {s.lots?.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
                <span className="font-semibold text-slate-500">Lots in stock</span>
                {s.lots.map((l) => <span key={l.lot} className="rounded bg-white px-1.5 py-0.5 ring-1 ring-slate-200 tabular-nums">{l.lot} · {l.takas}</span>)}
              </div>
            )}
            {s.programs.length > 0 && (
              <ul className="text-xs text-slate-600 space-y-0.5">
                {s.programs.map((p) => <li key={p.label} className="flex justify-between gap-2"><span>{p.label}</span><span className="tabular-nums">{p.takas} taka · {fmtM(p.m)} m</span></li>)}
              </ul>
            )}
          </div>
        );
      })}
      {data.shades.length === 0 && <div className="text-xs text-slate-400">Add colour lines to see finished goods and dyeing for each colour.</div>}

      <div className="grid grid-cols-1 gap-2">
        <div className="rounded-lg border border-slate-200 p-3 bg-white">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Grey at mill (not yet in a program)</div>
          <Qty className="mt-2" tone="sky" takas={data.greyAtMill.takas} meters={data.greyAtMill.m} />
          <ul className="mt-2 text-xs text-slate-600 space-y-0.5">{data.greyAtMill.byMill.map((m) => <li key={m.label} className="flex justify-between gap-2"><span>{m.label}</span><span className="tabular-nums">{m.takas} taka · {fmtM(m.m)} m</span></li>)}</ul>
        </div>
        <div className="rounded-lg border border-slate-200 p-3 bg-white">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Grey at our place</div>
          <Qty className="mt-2" takas={data.greyAtPlace.takas} meters={data.greyAtPlace.m} />
          <ul className="mt-2 text-xs text-slate-600 space-y-0.5">{data.greyAtPlace.byBranch.map((m) => <li key={m.label} className="flex justify-between gap-2"><span>{m.label}</span><span className="tabular-nums">{m.takas} taka · {fmtM(m.m)} m</span></li>)}</ul>
        </div>
      </div>
    </div>
  );
}
