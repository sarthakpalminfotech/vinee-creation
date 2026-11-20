// Pick grey takas (at our place) for a direct sell / "Others" withdrawal: filters by branch and quality,
// Select all / First N / tap to pick, with the selected takas and meters shown live.
import React, { useMemo, useState } from 'react';
import { Button, Card, Field, Input, Select } from '../../components/ui';
import { fmtInt, fmtM } from '../../lib/format';
import { TakaGrid } from '../../components/TakaGrid';

const r2 = (n) => Math.round(Number(n) * 100) / 100;

/** takas: repo.greyGodownTakas() rows; sel: Set of taka ids; setSel: state setter. */
export default function GreyTakaPicker({ takas, sel, setSel }) {
  const [branch, setBranch] = useState('');
  const [quality, setQuality] = useState('');
  const [n, setN] = useState('');
  const branches = useMemo(() => [...new Map(takas.filter((t) => t.branch_id).map((t) => [String(t.branch_id), t.branch_name])).entries()], [takas]);
  const qualities = useMemo(() => [...new Map(takas.map((t) => [String(t.quality_id), t.nick_name])).entries()], [takas]);
  const shown = takas.filter((t) => (!branch || String(t.branch_id) === branch) && (!quality || String(t.quality_id) === quality));
  const chosen = takas.filter((t) => sel.has(t.id));
  const chosenM = r2(chosen.reduce((s, t) => s + Number(t.grey_meter), 0));
  const toggle = (id) => setSel((s) => { const x = new Set(s); if (x.has(id)) x.delete(id); else x.add(id); return x; });
  const add = (ids) => setSel((s) => new Set([...s, ...ids]));
  return (
    <Card className="overflow-visible">
      <div className="space-y-3 border-b border-slate-100 bg-slate-50/60 px-4 py-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Branch"><Select value={branch} onChange={(e) => setBranch(e.target.value)}><option value="">All branches</option>{branches.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</Select></Field>
          <Field label="Quality"><Select value={quality} onChange={(e) => setQuality(e.target.value)}><option value="">All qualities</option>{qualities.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</Select></Field>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => add(shown.map((t) => t.id))}>Select all ({fmtInt(shown.length)})</Button>
          <Input type="number" min="1" inputMode="numeric" aria-label="First N takas" placeholder="N" className="h-9 w-20 px-2" value={n} onChange={(e) => setN(e.target.value)} />
          <Button type="button" size="sm" variant="outline" onClick={() => add(shown.slice(0, Number(n) || 0).map((t) => t.id))}>First N</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setSel(new Set())} disabled={sel.size === 0}>Clear</Button>
          <span className="ml-auto text-sm tabular-nums text-slate-700"><strong>{fmtInt(chosen.length)}</strong> taka · <strong>{fmtM(chosenM)}</strong> m selected</span>
        </div>
      </div>
      {shown.length === 0 ? (
        <div className="p-6 text-sm text-slate-500">No grey takas at our place match.</div>
      ) : (
        <div className="max-h-[28rem] overflow-y-auto p-3">
          <TakaGrid items={shown.map((t) => ({ id: t.id, no: `${t.challan_no}/${t.taka_no}`, meters: t.grey_meter, badges: [{ text: t.nick_name }] }))} sel={sel} onToggle={toggle} />
        </div>
      )}
    </Card>
  );
}
