import React, { useEffect, useState } from 'react';
import { fmtM } from '../../lib/format';
import { Qty } from '../../components/kit';
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

export function AvailabilityPanel({ data, needs = {} }) {
  if (!data) return <div className="text-sm text-slate-500 py-4 text-center">Select a quality to view stock.</div>;
  return (
    <div className="space-y-4" id="availability-panel">
      {data.shades.map((s) => {
        const need = Number(needs[s.shade_id]) || 0;
        const short = need - s.finished.takas;
        return (
          <div key={s.shade_id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-full border border-slate-200" style={{ backgroundColor: s.hex }} />
              <span className="font-semibold text-slate-900">Shade {s.shade_no}{s.shade_name ? ` · ${s.shade_name}` : ''}</span>
              {need > 0 && <span className={`ml-auto text-xs font-medium ${short > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>Need {need}{short > 0 ? ` · short ${short}` : ' · covered'}</span>}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Finished goods" takas={s.finished.takas} m={s.finished.m} sub={`${s.folded.takas} folded · ${s.unfolded.takas} still to fold`} tone="emerald" />
              <Stat label="In dyeing" takas={s.dyeing.takas} m={s.dyeing.m} tone="violet" />
            </div>
            {s.programs.length > 0 && (
              <ul className="text-xs text-slate-600 space-y-0.5">
                {s.programs.map((p) => <li key={p.label} className="flex justify-between gap-2"><span>{p.label}</span><span className="tabular-nums">{p.takas} taka · {fmtM(p.m)} m</span></li>)}
              </ul>
            )}
          </div>
        );
      })}
      {data.shades.length === 0 && <div className="text-xs text-slate-400">Add shade lines to see finished goods and dyeing for each shade.</div>}

      <div className="grid grid-cols-1 gap-2">
        <div className="rounded-lg border border-slate-200 p-3 bg-white">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Grey at mill (not yet in a program)</div>
          <Qty className="mt-2" tone="sky" takas={data.greyAtMill.takas} meters={data.greyAtMill.m} />
          <ul className="mt-2 text-xs text-slate-600 space-y-0.5">{data.greyAtMill.byMill.map((m) => <li key={m.label} className="flex justify-between gap-2"><span>{m.label}</span><span className="tabular-nums">{m.takas} taka · {fmtM(m.m)} m</span></li>)}</ul>
        </div>
        <div className="rounded-lg border border-slate-200 p-3 bg-white">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Grey at our place</div>
          <Qty className="mt-2" takas={data.greyAtPlace.takas} meters={data.greyAtPlace.m} />
          <ul className="mt-2 text-xs text-slate-600 space-y-0.5">{data.greyAtPlace.byLocation.map((m) => <li key={m.label} className="flex justify-between gap-2"><span>{m.label}</span><span className="tabular-nums">{m.takas} taka · {fmtM(m.m)} m</span></li>)}</ul>
        </div>
      </div>
    </div>
  );
}
