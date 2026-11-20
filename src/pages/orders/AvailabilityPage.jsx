import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader, Card, Select, Input, Button, Field, Alert, LoadState } from '../../components/ui';
import { ColourSelect } from '../../components/kit';
import { Plus, Trash2 } from 'lucide-react';
import { AvailabilityPanel, useAvailability } from './AvailabilityPanel';
import * as repo from '../../db/repo';

let n = 0;
export default function AvailabilityPage() {
  const [qualities, setQualities] = useState([]);
  const [colours, setColours] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [qualityId, setQualityId] = useState('');
  const [lines, setLines] = useState([]);

  useEffect(() => {
    repo.listQualities().then(setQualities).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, []);
  // choose the quality first, then its colours
  useEffect(() => {
    let live = true;
    setLines([]);
    if (!qualityId) { setColours([]); return undefined; }
    repo.listQualityColours(qualityId).then((c) => live && setColours(c)).catch((e) => live && setError(e.message));
    return () => { live = false; };
  }, [qualityId]);

  const ids = lines.map((l) => Number(l.shade_id)).filter(Boolean);
  const { data, error: aErr } = useAvailability(qualityId, ids);
  const needs = Object.fromEntries(lines.filter((l) => l.shade_id).map((l) => [Number(l.shade_id), l.takas]));
  const upd = (id, k, v) => setLines((ls) => ls.map((l) => (l.id === id ? { ...l, [k]: v } : l)));
  const used = new Set(lines.map((l) => l.shade_id).filter(Boolean));

  if (loading || (error && !qualities.length)) return <LoadState loading={loading} error={error} />;

  return (
    <div className="space-y-6 max-w-4xl xl:max-w-[1800px]">
      <PageHeader title="Customer availability" description="Before taking an order: what we can give for a quality (by nickname) in each colour." />
      <Card className="p-6 space-y-4">
        <Field label="Quality (nickname)">
          <Select id="avail-quality" value={qualityId} onChange={(e) => setQualityId(e.target.value)}>
            <option value="">Select quality…</option>
            {qualities.map((q) => <option key={q.id} value={q.id}>{q.nick_name}</option>)}
          </Select>
        </Field>
        {qualityId && (
          <div className="space-y-2">
            {lines.map((l) => (
              <div key={l.id} className="flex gap-3 items-end">
                <div className="flex-1 min-w-0">
                  <ColourSelect colours={colours} value={l.shade_id} exclude={used} onChange={(v) => upd(l.id, 'shade_id', v)} />
                </div>
                <div className="w-32"><Input type="number" min="0" placeholder="Takas wanted" value={l.takas} onChange={(e) => upd(l.id, 'takas', e.target.value)} /></div>
                <button type="button" className="p-2 text-slate-400 hover:text-red-500" onClick={() => setLines((ls) => ls.filter((x) => x.id !== l.id))} aria-label="Remove colour"><Trash2 className="w-5 h-5" /></button>
              </div>
            ))}
            {colours.length === 0
              ? <p className="text-sm text-amber-700">This quality has no colours yet — add them in <Link to="/masters/qualities" className="underline">Masters → Qualities → Colours</Link>.</p>
              : <Button type="button" variant="outline" size="sm" onClick={() => setLines((ls) => [...ls, { id: ++n, shade_id: '', takas: '' }])}><Plus className="w-4 h-4 mr-1" /> Add colour</Button>}
          </div>
        )}
        <Alert>{aErr}</Alert>
      </Card>
      {qualityId && <Card className="p-6"><AvailabilityPanel data={data} needs={needs} qualityId={qualityId} /></Card>}
    </div>
  );
}
