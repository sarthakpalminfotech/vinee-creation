// Shared by the job work form and the "Others" form: lines of quality + colour with takas and/or meters wanted,
// and the preview of the takas the system picked (oldest folded first).
import React, { useState } from 'react';
import { ChevronRight, Plus, Trash2 } from 'lucide-react';
import { Button, Card, Field, Input, Select } from '../../components/ui';
import { ColourSelect, Chip, ShadeSwatch } from '../../components/kit';
import { fmtInt, fmtM } from '../../lib/format';
import { TakaList } from '../../components/TakaGrid';

let seq = 0;
export const newFgLine = (over = {}) => ({ key: `l${++seq}`, quality_id: '', shade_id: '', takas: '', meters: '', kind: 'plain', ...over });
/** Lines with a quality + colour and something wanted, shaped for the repo. */
export const cleanFgLines = (lines) => lines.filter((l) => l.quality_id && l.shade_id && (Number(l.takas) > 0 || Number(l.meters) > 0))
  .map((l) => ({ quality_id: Number(l.quality_id), shade_id: Number(l.shade_id), takas: l.takas === '' ? 0 : Number(l.takas), meters: l.meters === '' ? 0 : Number(l.meters), kind: l.kind }));

/** stock: repo.listFgStock() rows. kind 'plain' | 'jobworked' decides which figures count as available. */
const availOf = (r, kind) => (kind === 'jobworked' ? { takas: r.jw_takas, m: r.jw_m } : { takas: r.plain_takas, m: r.plain_m });

export function FgLinesEditor({ lines, setLines, stock, allowKind = false }) {
  const set = (key, patch) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const qualities = (kind) => {
    const m = new Map();
    for (const r of stock) if (availOf(r, kind).takas > 0 && !m.has(r.quality_id)) m.set(r.quality_id, r.nick_name);
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  };
  return (
    <div className="space-y-3">
      {lines.map((l, i) => {
        const rows = stock.filter((r) => String(r.quality_id) === String(l.quality_id) && availOf(r, l.kind).takas > 0);
        const colours = rows.map((r) => ({ shade_id: r.shade_id, number: r.shade_no, name: r.shade_name, hex: r.hex, image_url: r.image_url }));
        const cur = stock.find((r) => String(r.quality_id) === String(l.quality_id) && String(r.shade_id) === String(l.shade_id));
        const av = cur ? availOf(cur, l.kind) : null;
        return (
          <div key={l.key} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Line {i + 1}</span>
              <div className="flex items-center gap-2">
                {allowKind && (
                  <div className="inline-flex rounded-md border border-slate-300 bg-white p-0.5" role="group" aria-label="Which stock">
                    {[['plain', 'Plain'], ['jobworked', 'Job-worked']].map(([k, label]) => (
                      <button key={k} type="button" aria-pressed={l.kind === k} onClick={() => set(l.key, { kind: k, shade_id: '' })}
                        className={`h-8 rounded px-3 text-xs font-medium ${l.kind === k ? 'bg-primary-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{label}</button>
                    ))}
                  </div>
                )}
                {lines.length > 1 && (
                  <button type="button" aria-label={`Remove line ${i + 1}`} onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} className="rounded p-2 text-slate-400 hover:bg-slate-100 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Quality">
                <Select value={String(l.quality_id)} onChange={(e) => set(l.key, { quality_id: e.target.value, shade_id: '' })}>
                  <option value="">Select quality…</option>
                  {qualities(l.kind).map(([id, nick]) => <option key={id} value={id}>{nick}</option>)}
                </Select>
              </Field>
              <Field label="Colour">
                <ColourSelect colours={colours} value={String(l.shade_id)} disabled={!l.quality_id} onChange={(v) => set(l.key, { shade_id: v })} placeholder={l.quality_id ? 'Select colour…' : 'Pick a quality first'} />
              </Field>
              <Field label="Takas wanted"><Input type="number" min="0" step="1" inputMode="numeric" placeholder="e.g. 10" value={l.takas} onChange={(e) => set(l.key, { takas: e.target.value })} /></Field>
              <Field label="Meters wanted"><Input type="number" min="0" step="0.01" inputMode="decimal" placeholder="e.g. 500" value={l.meters} onChange={(e) => set(l.key, { meters: e.target.value })} /></Field>
            </div>
            {av && (
              <div className="mt-3 text-sm text-slate-600">
                Available {l.kind === 'jobworked' ? 'job-worked' : 'plain'} stock: <strong className="tabular-nums text-slate-900">{fmtInt(av.takas)} taka · {fmtM(av.m)} m</strong>
                <span className="ml-2 text-xs text-slate-400">The system picks the oldest takas; the last taka may go a little over the meters.</span>
              </div>
            )}
          </div>
        );
      })}
      <Button type="button" variant="outline" onClick={() => setLines((ls) => [...ls, newFgLine()])}><Plus className="mr-2 h-4 w-4" /> Add line</Button>
    </div>
  );
}

/** picked: repo.previewFgPick() result; stock: repo.listFgStock() (for the quality / colour names). */
export function PickPreview({ picked, stock }) {
  const [open, setOpen] = useState(() => new Set());
  const totals = picked.reduce((a, l) => ({ takas: a.takas + l.takas, m: Math.round((a.m + l.m) * 100) / 100 }), { takas: 0, m: 0 });
  return (
    <Card className="overflow-visible">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/60 px-4 py-3">
        <h3 className="font-bold text-forest">What the system picked</h3>
        <span className="text-sm tabular-nums text-slate-700"><strong>{fmtInt(totals.takas)}</strong> taka · <strong>{fmtM(totals.m)}</strong> m in total</span>
      </div>
      <ul className="divide-y divide-slate-100">
        {picked.map((l, i) => {
          const r = stock.find((x) => x.quality_id === l.quality_id && x.shade_id === l.shade_id);
          const on = open.has(i);
          return (
            <li key={i}>
              <button type="button" aria-expanded={on} onClick={() => setOpen((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; })}
                className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-left hover:bg-slate-50">
                <ChevronRight className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${on ? 'rotate-90' : ''}`} />
                <ShadeSwatch hex={r?.hex} image={r?.image_url} size="md" />
                <span className="font-semibold text-slate-900">{r?.nick_name}</span>
                <span className="text-slate-600">{r?.shade_no}{r?.shade_name ? ` · ${r.shade_name}` : ''}</span>
                {l.kind === 'jobworked' && <Chip tone="amber">Job-worked</Chip>}
                <span className="ml-auto tabular-nums text-sm text-slate-700"><strong>{fmtInt(l.takas)}</strong> taka · <strong>{fmtM(l.m)}</strong> m</span>
              </button>
              {on && (
                <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-3"><TakaList items={l.picks.map((t) => ({ id: t.id, no: t.label, meters: t.m }))} /></div>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
