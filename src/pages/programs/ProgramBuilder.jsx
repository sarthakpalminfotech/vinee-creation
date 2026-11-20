// Step 2 of a dyeing program (and "Add more takas"): cards of one weaver challan each. Pick quality → weaver → weaver challan,
// tap the takas, choose a colour for the selected ones (they move to "Assigned"), repeat for more colours, then "Done with this challan".
import React, { useEffect, useMemo, useState } from 'react';
import { Check, Palette, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { Button, Field, Select, Alert, Modal } from '../../components/ui';
import { ShadeSwatch } from '../../components/kit';
import { TakaGrid } from '../../components/TakaGrid';
import { fmtDate, fmtInt, fmtM } from '../../lib/format';
import * as repo from '../../db/repo';

let seq = 0;
export const newProgPart = () => ({ key: `pp${++seq}`, quality: null, weaverId: '', weavers: [], receipt: null, takas: [], sel: [], groups: [], editing: true });
const r2 = (n) => Math.round(Number(n) * 100) / 100;

/** Per-colour groups of a part with their takas and meters: [{shade, ids, takas, m}]. */
export function groupStats(part) {
  const byId = new Map(part.takas.map((t) => [t.id, t]));
  return part.groups.map((g) => ({ ...g, takas: g.ids.length, m: r2(g.ids.reduce((s, id) => s + Number(byId.get(id)?.grey_meter || 0), 0)) }));
}
export const partDone = (p) => !!p.receipt && p.groups.length > 0;
/** Totals of the whole program: {challans, takas, m, byShade:[{shade, takas, m}]}. */
export function programTotals(parts) {
  const by = new Map();
  let takas = 0, m = 0, challans = 0;
  for (const p of parts) {
    if (!partDone(p)) continue;
    challans += 1;
    for (const g of groupStats(p)) {
      takas += g.takas; m = r2(m + g.m);
      const k = g.shade.shade_id;
      if (!by.has(k)) by.set(k, { shade: g.shade, takas: 0, m: 0 });
      const x = by.get(k); x.takas += g.takas; x.m = r2(x.m + g.m);
    }
  }
  return { challans, takas, m, byShade: [...by.values()] };
}
/** Payload of repo.createProgram / addToProgram. */
export const partsPayload = (parts) => parts.filter(partDone).map((p) => ({ receipt_id: p.receipt.id, lines: p.groups.map((g) => ({ shade_id: g.shade.shade_id, taka_ids: g.ids })) }));

const ShadeChip = ({ shade, children }) => (
  <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-slate-200 bg-white py-0.5 pl-1 pr-2.5 text-xs">
    <ShadeSwatch hex={shade.hex} image={shade.image_url} size="sm" /><span className="font-semibold text-slate-900">{shade.number}</span>{children}
  </span>
);
export { ShadeChip };

/** The colour sheet: the quality's active colours as big tiles, with search. */
function ColourSheet({ open, qualityId, qualityName, onPick, onClose }) {
  const [colours, setColours] = useState([]);
  const [q, setQ] = useState('');
  useEffect(() => {
    let live = true;
    if (!open || !qualityId) return undefined;
    setQ('');
    repo.listQualityColours(qualityId).then((c) => live && setColours(c.filter((x) => x.active))).catch(() => {});
    return () => { live = false; };
  }, [open, qualityId]);
  const shown = colours.filter((c) => `${c.number} ${c.name || ''}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <Modal isOpen={open} onClose={onClose} title={`Choose colour · ${qualityName || ''}`} maxWidth="max-w-2xl">
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search colour…" aria-label="Search colour" className="h-11 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-base focus:outline-none focus:ring-2 focus:ring-primary-500" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {shown.map((c) => (
          <button key={c.shade_id} type="button" onClick={() => onPick(c)} className="overflow-hidden rounded-lg border border-slate-200 bg-white text-left hover:border-primary-400 hover:shadow-md">
            <div className="aspect-[4/3] w-full"><ShadeSwatch hex={c.hex} image={c.image_url} size="xl" shape="square" className="!rounded-none !border-0" /></div>
            <div className="p-2"><div className="truncate font-semibold text-slate-900">{c.number}</div><div className="truncate text-xs text-slate-500">{c.name || ' '}</div></div>
          </button>
        ))}
        {shown.length === 0 && <div className="col-span-full p-6 text-center text-sm text-slate-500">{colours.length === 0 ? 'This quality has no active colours. Add them in Masters → Qualities → Colours.' : 'No colour matches.'}</div>}
      </div>
    </Modal>
  );
}

function ChallanCard({ part, millId, qualities, takenBy, onChange, onRemove, onDone, onReopen, canRemove, setError }) {
  const [n, setN] = useState('10');
  const [sheet, setSheet] = useState(null); // {mode:'assign'} | {mode:'change', shadeId}
  const [err, setErr] = useState('');
  const sel = useMemo(() => new Set(part.sel), [part.sel]);
  const assignedIds = useMemo(() => new Set(part.groups.flatMap((g) => g.ids)), [part.groups]);
  const free = part.takas.filter((t) => !assignedIds.has(t.id));
  const stats = groupStats(part);
  const selM = r2(free.filter((t) => sel.has(t.id)).reduce((s, t) => s + Number(t.grey_meter), 0));
  const set = (patch) => onChange({ ...part, ...patch });

  const pickQuality = async (qid) => {
    setErr('');
    const quality = qualities.find((x) => String(x.quality_id) === qid) || null;
    if (!quality) { set({ quality: null, weaverId: '', weavers: [], receipt: null, takas: [], sel: [], groups: [] }); return; }
    try { set({ quality, weaverId: '', weavers: await repo.millChallansForProgram(millId, quality.quality_id), receipt: null, takas: [], sel: [], groups: [] }); } catch (e) { setErr(e.message); }
  };
  const pickChallan = async (rid) => {
    setErr('');
    if (!rid) { set({ receipt: null, takas: [], sel: [], groups: [] }); return; }
    const other = takenBy(Number(rid));
    if (other != null) { onReopen(other); return; }
    const w = part.weavers.find((x) => String(x.weaver_id) === part.weaverId);
    const c = w?.challans.find((x) => String(x.id) === rid);
    if (!c) return;
    try { set({ receipt: { ...c, weaver_name: w.weaver_name, group_name: w.group_name }, takas: await repo.programTakasOfReceipt(millId, c.id), sel: [], groups: [] }); } catch (e) { setErr(e.message); }
  };
  const toggle = (id) => set({ sel: sel.has(id) ? part.sel.filter((x) => x !== id) : [...part.sel, id] });
  const assign = (shade, ids, replaceShadeId) => {
    const sh = { shade_id: shade.shade_id, number: shade.number, name: shade.name, hex: shade.hex, image_url: shade.image_url };
    let groups = part.groups;
    if (replaceShadeId != null) { const old = groups.find((g) => g.shade.shade_id === replaceShadeId); ids = old ? old.ids : ids; groups = groups.filter((g) => g.shade.shade_id !== replaceShadeId); }
    const ex = groups.find((g) => g.shade.shade_id === sh.shade_id);
    groups = ex ? groups.map((g) => (g === ex ? { ...g, ids: [...g.ids, ...ids] } : g)) : [...groups, { shade: sh, ids }];
    set({ groups, sel: replaceShadeId != null ? part.sel : [] });
  };
  const removeGroup = (shadeId) => set({ groups: part.groups.filter((g) => g.shade.shade_id !== shadeId) });

  if (!part.editing && partDone(part)) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-slate-200 bg-white px-4 py-3">
        <Check className="h-4 w-4 shrink-0 text-emerald-600" />
        <span className="min-w-0 truncate text-sm text-slate-700"><strong className="text-slate-900">{part.receipt.challan_no}</strong> · {part.receipt.weaver_name} · {part.quality.nick_name}</span>
        <span className="flex flex-wrap gap-1.5">{stats.map((g) => <ShadeChip key={g.shade.shade_id} shade={g.shade}><span className="tabular-nums text-slate-600">× {g.takas} <span className="text-slate-400">({fmtM(g.m)} m)</span></span></ShadeChip>)}</span>
        <span className="ml-auto flex gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ ...part, editing: true })}><Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit</Button>
          <Button type="button" variant="ghost" size="sm" onClick={onRemove}><Trash2 className="mr-1.5 h-3.5 w-3.5" /> Remove</Button>
        </span>
      </div>
    );
  }

  const weaver = part.weavers.find((x) => String(x.weaver_id) === part.weaverId);
  return (
    <div className="space-y-4 rounded-lg border-2 border-primary-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="font-semibold text-slate-900">Weaver challan</div>
        {canRemove && <Button type="button" variant="ghost" size="sm" onClick={onRemove}><Trash2 className="mr-1.5 h-3.5 w-3.5" /> Remove</Button>}
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        <Field label="Quality">
          <Select value={part.quality ? String(part.quality.quality_id) : ''} onChange={(e) => pickQuality(e.target.value)}>
            <option value="">Select quality…</option>
            {qualities.map((x) => <option key={x.quality_id} value={x.quality_id}>{x.nick_name} · {x.takas} takas</option>)}
          </Select>
        </Field>
        <Field label="Weaver (associated party)">
          <Select disabled={!part.quality} value={part.weaverId} onChange={(e) => set({ weaverId: e.target.value, receipt: null, takas: [], sel: [], groups: [] })}>
            <option value="">{part.quality ? 'Select weaver…' : 'Pick a quality first'}</option>
            {part.weavers.map((w) => <option key={w.weaver_id} value={w.weaver_id}>{w.weaver_name} · {w.group_name}</option>)}
          </Select>
        </Field>
        <Field label="Weaver challan" className="md:col-span-2 lg:col-span-1">
          <Select disabled={!weaver} value={part.receipt ? String(part.receipt.id) : ''} onChange={(e) => pickChallan(e.target.value)}>
            <option value="">{weaver ? 'Select challan…' : 'Pick a weaver first'}</option>
            {weaver?.challans.map((c) => <option key={c.id} value={c.id}>{c.challan_no} · {fmtDate(c.date)} · {c.takas} takas · {fmtM(c.m)} m · {c.direct ? 'direct' : `via ${c.sub_no || 'mill challan'}`}</option>)}
          </Select>
        </Field>
      </div>

      {part.receipt && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => set({ sel: free.map((t) => t.id) })}>Select all</Button>
            <div className="flex items-center gap-1.5">
              <Button type="button" variant="outline" size="sm" onClick={() => set({ sel: free.slice(0, Math.max(0, Number(n) || 0)).map((t) => t.id) })}>First</Button>
              <input type="number" min="1" value={n} onChange={(e) => setN(e.target.value)} aria-label="How many takas" className="h-9 w-16 rounded-md border border-slate-300 px-2 text-base" />
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => set({ sel: [] })}>Clear</Button>
            <span className="ml-auto text-sm tabular-nums text-slate-600"><strong className="text-slate-900">{part.sel.length}</strong> selected · <strong className="text-slate-900">{fmtM(selM)}</strong> m <span className="text-slate-400">({free.length} available)</span></span>
          </div>
          {free.length === 0
            ? <div className="rounded-md border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">Every taka of this challan has a colour.</div>
            : <div className="max-h-80 overflow-y-auto"><TakaGrid items={free.map((t) => ({ id: t.id, no: t.taka_no, meters: t.grey_meter }))} sel={sel} onToggle={toggle} /></div>}
          <div className="flex justify-end">
            <Button type="button" disabled={part.sel.length === 0} onClick={() => setSheet({ mode: 'assign' })}><Palette className="mr-2 h-4 w-4" /> Choose colour for {part.sel.length || ''} selected</Button>
          </div>

          {stats.length > 0 && (
            <div>
              <div className="mb-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">Assigned</div>
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                {stats.map((g) => (
                  <li key={g.shade.shade_id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                    <ShadeSwatch hex={g.shade.hex} image={g.shade.image_url} size="md" />
                    <span className="font-semibold text-slate-900">{g.shade.number}</span><span className="hidden text-sm text-slate-500 sm:inline">{g.shade.name}</span>
                    <span className="ml-auto text-sm tabular-nums text-slate-700"><strong>{g.takas}</strong> taka · <strong>{fmtM(g.m)}</strong> m</span>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setSheet({ mode: 'change', shadeId: g.shade.shade_id })}>Change colour</Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeGroup(g.shade.shade_id)}><Trash2 className="h-3.5 w-3.5" /><span className="sr-only">Remove</span></Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <Alert>{err}</Alert>
          <div className="flex justify-end">
            <Button type="button" disabled={stats.length === 0} onClick={() => { setError?.(''); onDone(); }}><Check className="mr-2 h-4 w-4" /> Done with this challan</Button>
          </div>
        </>
      )}
      {!part.receipt && err && <Alert>{err}</Alert>}
      <ColourSheet open={!!sheet} qualityId={part.quality?.quality_id} qualityName={part.quality?.nick_name} onClose={() => setSheet(null)}
        onPick={(c) => { if (sheet?.mode === 'change') assign(c, [], sheet.shadeId); else assign(c, part.sel.filter((id) => !assignedIds.has(id))); setSheet(null); }} />
    </div>
  );
}

/** parts/setParts: state owned by the page. millId is fixed. */
export default function ProgramBuilder({ millId, parts, setParts, setError }) {
  const [qualities, setQualities] = useState(null);
  const [loadErr, setLoadErr] = useState('');
  useEffect(() => {
    let live = true;
    repo.qualitiesAtMill(millId).then((q) => live && setQualities(q)).catch((e) => live && setLoadErr(e.message));
    return () => { live = false; };
  }, [millId]);

  const update = (i, next) => setParts(parts.map((p, j) => (j === i ? next : p)));
  const takenBy = (i) => (rid) => { const j = parts.findIndex((p, k) => k !== i && p.receipt && p.receipt.id === rid); return j >= 0 ? j : null; };
  const reopen = (from) => (j) => {
    // the card the user was filling is empty: drop it and open the card that already has this challan
    setParts(parts.filter((p, k) => !(k === from && !p.receipt)).map((p, k) => (k === j ? { ...p, editing: true } : (p.editing && partDone(p) ? { ...p, editing: false } : p))));
  };
  const addAnother = () => {
    if (parts.some((p) => p.editing && !partDone(p) && p.receipt)) { setError?.('Give the takas of the open challan a colour (or remove it) first'); return; }
    setError?.('');
    setParts([...parts.filter((p) => p.receipt).map((p) => ({ ...p, editing: false })), newProgPart()]);
  };
  if (loadErr) return <Alert>{loadErr}</Alert>;
  if (!qualities) return <div className="p-6 text-center text-slate-500">Loading…</div>;
  if (qualities.length === 0) return <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">There is no grey at this mill right now. Send grey to the mill with a mill challan first.</div>;
  return (
    <div className="space-y-3">
      {parts.map((p, i) => (
        <ChallanCard key={p.key} part={p} millId={millId} qualities={qualities} takenBy={takenBy(i)} setError={setError}
          canRemove={parts.length > 1 || !!p.receipt}
          onChange={(next) => (next.editing && !p.editing ? setParts(parts.map((x, j) => (j === i ? next : { ...x, editing: partDone(x) ? false : x.editing }))) : update(i, next))}
          onRemove={() => { const rest = parts.filter((_, j) => j !== i); setParts(rest.length ? rest : [newProgPart()]); }}
          onDone={() => setParts(parts.map((x) => ({ ...x, editing: false })))}
          onReopen={reopen(i)} />
      ))}
      <Button type="button" variant="outline" onClick={addAnother}><Plus className="mr-2 h-4 w-4" /> Add another weaver challan</Button>
    </div>
  );
}

/** Challans / takas / meters and the per-colour chips (right column on desktop, sticky bottom bar on tablet). */
export function ProgramSummary({ parts, onSubmit, busy, submitLabel = 'Submit', compact = false }) {
  const t = programTotals(parts);
  return (
    <div className={compact ? 'space-y-2' : 'space-y-4'}>
      <div className="grid grid-cols-3 gap-3">
        <div><div className="text-xs font-bold text-slate-500">Challans</div><div className="text-2xl font-bold tabular-nums text-slate-900">{t.challans}</div></div>
        <div><div className="text-xs font-bold text-slate-500">Takas</div><div className={`text-2xl font-bold tabular-nums ${t.takas ? 'text-primary-700' : 'text-slate-400'}`}>{fmtInt(t.takas)}</div></div>
        <div><div className="text-xs font-bold text-slate-500">Meters</div><div className="text-2xl font-bold tabular-nums text-slate-900">{fmtM(t.m)}</div></div>
      </div>
      {t.byShade.length > 0 && <div className="flex flex-wrap gap-1.5">{t.byShade.map((s) => <ShadeChip key={s.shade.shade_id} shade={s.shade}><span className="tabular-nums text-slate-600">× {s.takas}</span></ShadeChip>)}</div>}
      <Button type="button" className="h-12 w-full text-base" disabled={busy || t.takas === 0} onClick={onSubmit}>{submitLabel}</Button>
    </div>
  );
}

/** Confirmation: quality → weaver challan → colour rows, subtotal per challan, totals per colour, grand total. */
export function ProgramConfirm({ open, onClose, onConfirm, parts, busy, error, title, confirmLabel = 'Confirm & issue' }) {
  const done = parts.filter(partDone);
  const t = programTotals(parts);
  const byQuality = [];
  for (const p of done) {
    let g = byQuality.find((x) => x.quality.quality_id === p.quality.quality_id);
    if (!g) { g = { quality: p.quality, parts: [] }; byQuality.push(g); }
    g.parts.push(p);
  }
  return (
    <Modal isOpen={open} onClose={() => !busy && onClose()} title={title} maxWidth="max-w-2xl">
      <div className="space-y-4">
        {byQuality.map((g) => (
          <div key={g.quality.quality_id}>
            <div className="mb-1.5 text-sm font-bold text-slate-900">{g.quality.nick_name}</div>
            <div className="space-y-2">
              {g.parts.map((p) => {
                const st = groupStats(p);
                return (
                  <div key={p.key} className="rounded-lg border border-slate-200">
                    <div className="flex flex-wrap items-center gap-x-3 border-b border-slate-100 bg-slate-50 px-3 py-1.5 text-sm"><strong className="text-slate-900">{p.receipt.challan_no}</strong><span className="text-slate-600">{p.receipt.weaver_name}</span></div>
                    {st.map((s) => (
                      <div key={s.shade.shade_id} className="flex items-center gap-3 px-3 py-1.5 text-sm">
                        <ShadeSwatch hex={s.shade.hex} image={s.shade.image_url} size="sm" /><span className="font-semibold text-slate-900">{s.shade.number}</span><span className="hidden truncate text-slate-500 sm:inline">{s.shade.name}</span>
                        <span className="ml-auto tabular-nums text-slate-700"><strong>{s.takas}</strong> taka · <strong>{fmtM(s.m)}</strong> m</span>
                      </div>
                    ))}
                    <div className="flex justify-between border-t border-slate-100 px-3 py-1.5 text-xs font-semibold tabular-nums text-slate-600"><span>Subtotal</span><span>{st.reduce((a, s) => a + s.takas, 0)} taka · {fmtM(st.reduce((a, s) => a + s.m, 0))} m</span></div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <div className="rounded-lg border border-slate-200 p-3">
          <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Total per colour</div>
          <div className="space-y-1">
            {t.byShade.map((s) => <div key={s.shade.shade_id} className="flex items-center gap-3 text-sm"><ShadeSwatch hex={s.shade.hex} image={s.shade.image_url} size="sm" /><span className="font-semibold">{s.shade.number}</span><span className="ml-auto tabular-nums"><strong>{s.takas}</strong> taka · <strong>{fmtM(s.m)}</strong> m</span></div>)}
          </div>
        </div>
        <div className="flex justify-between rounded-lg bg-slate-100 px-3 py-2 text-sm font-bold tabular-nums"><span>Total — {t.challans} challan{t.challans === 1 ? '' : 's'}</span><span>{fmtInt(t.takas)} taka · {fmtM(t.m)} m</span></div>
        <Alert>{error}</Alert>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>Edit again</Button>
          <Button type="button" disabled={busy} onClick={onConfirm}>{busy ? 'Saving…' : confirmLabel}</Button>
        </div>
      </div>
    </Modal>
  );
}
