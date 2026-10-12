import React, { useEffect, useState } from 'react';
import { PageHeader, Card, Select, Input, Button, Field, Alert, LoadState } from '../../components/ui';
import { Plus, Trash2 } from 'lucide-react';
import { AvailabilityPanel, useAvailability } from './AvailabilityPanel';
import * as repo from '../../db/repo';
import { useDbVersion } from '../../lib/live';

let n = 0;
export default function AvailabilityPage() {
  const [qualities, setQualities] = useState([]);
  const [shades, setShades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [qualityId, setQualityId] = useState('');
  const [lines, setLines] = useState([]);

  const dbVersion = useDbVersion();
  useEffect(() => {
    Promise.all([repo.listQualities(), repo.listShades()]).then(([q, s]) => { setQualities(q); setShades(s); }).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [dbVersion]);

  const ids = lines.map((l) => Number(l.shade_id)).filter(Boolean);
  const { data, error: aErr } = useAvailability(qualityId, ids);
  const needs = Object.fromEntries(lines.filter((l) => l.shade_id).map((l) => [Number(l.shade_id), l.takas]));
  const upd = (id, k, v) => setLines((ls) => ls.map((l) => (l.id === id ? { ...l, [k]: v } : l)));

  if (loading || (error && !qualities.length)) return <LoadState loading={loading} error={error} />;

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader title="Customer availability" description="Before taking an order: what we can give for a quality (by nickname) in each shade." />
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
                <div className="flex-1">
                  <Select value={l.shade_id} onChange={(e) => upd(l.id, 'shade_id', e.target.value)}>
                    <option value="">Select shade…</option>
                    {shades.map((s) => <option key={s.id} value={s.id}>{s.chart_name}: {s.number}{s.name ? ` - ${s.name}` : ''}</option>)}
                  </Select>
                </div>
                <div className="w-32"><Input type="number" min="0" placeholder="Takas wanted" value={l.takas} onChange={(e) => upd(l.id, 'takas', e.target.value)} /></div>
                <button type="button" className="p-2 text-slate-400 hover:text-red-500" onClick={() => setLines((ls) => ls.filter((x) => x.id !== l.id))} aria-label="Remove shade"><Trash2 className="w-5 h-5" /></button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => setLines((ls) => [...ls, { id: ++n, shade_id: '', takas: '' }])}><Plus className="w-4 h-4 mr-1" /> Add shade</Button>
          </div>
        )}
        <Alert>{aErr}</Alert>
      </Card>
      {qualityId && <Card className="p-6"><AvailabilityPanel data={data} needs={needs} /></Card>}
    </div>
  );
}
