import React, { useEffect, useState } from 'react';
import { fmtM } from '../../lib/format';
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

const Stat = ({ label, value, sub, tone = 'text-slate-900' }) => (
  <div className="bg-white p-2.5 rounded-lg border border-slate-100">
    <div className="text-[11px] text-slate-500">{label}</div>
    <div className={`font-semibold ${tone}`}>{value}</div>
    {sub && <div className="text-[11px] text-slate-500">{sub}</div>}
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
          <div key={s.shade_id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-full border border-slate-200" style={{ backgroundColor: s.hex }} />
              <span className="font-semibold text-slate-900">Shade {s.shade_no}{s.shade_name ? ` · ${s.shade_name}` : ''}</span>
              {need > 0 && <span className={`ml-auto text-xs font-medium ${short > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>Need {need}{short > 0 ? ` · short ${short}` : ' · covered'}</span>}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Finished goods" value={`${s.finished.takas} tk`} sub={`${fmtM(s.finished.m)} m · ${s.folded.takas} folded, ${s.unfolded.takas} to fold`} tone="text-emerald-700" />
              <Stat label="In dyeing" value={`${s.dyeing.takas} tk`} sub={`${fmtM(s.dyeing.m)} m`} tone="text-violet-700" />
            </div>
            {s.programs.length > 0 && (
              <ul className="text-xs text-slate-600 space-y-0.5">
                {s.programs.map((p) => <li key={p.label}>{p.label}: {p.takas} tk · {fmtM(p.m)} m</li>)}
              </ul>
            )}
          </div>
        );
      })}
      {data.shades.length === 0 && <div className="text-xs text-slate-400">Add shade lines to see finished goods and dyeing for each shade.</div>}

      <div className="grid grid-cols-1 gap-2">
        <div className="rounded-xl border border-slate-200 p-3 bg-white">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Grey at mill (not yet in a program)</div>
          <div className="font-semibold text-sky-700">{data.greyAtMill.takas} tk · {fmtM(data.greyAtMill.m)} m</div>
          <ul className="text-xs text-slate-600">{data.greyAtMill.byMill.map((m) => <li key={m.label}>{m.label}: {m.takas} tk · {fmtM(m.m)} m</li>)}</ul>
        </div>
        <div className="rounded-xl border border-slate-200 p-3 bg-white">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Grey at our place</div>
          <div className="font-semibold text-slate-800">{data.greyAtPlace.takas} tk · {fmtM(data.greyAtPlace.m)} m</div>
          <ul className="text-xs text-slate-600">{data.greyAtPlace.byLocation.map((m) => <li key={m.label}>{m.label}: {m.takas} tk · {fmtM(m.m)} m</li>)}</ul>
        </div>
      </div>
    </div>
  );
}
