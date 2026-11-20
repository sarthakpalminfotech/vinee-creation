// "Weaver challans" area of a mill challan: a vertical stack of part cards. The active card is expanded (pick the weaver
// challan, then its takas); finished ones collapse to a single line. Used by the New mill challan screen and by
// "+ Add another weaver challan" on an open main challan.
import React, { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Check, Search } from 'lucide-react';
import { Button, Input, Field, Select, Alert } from '../../components/ui';
import { fmtM } from '../../lib/format';
import * as repo from '../../db/repo';
import { newPart, partTotals, partLabels } from './partLogic';
import { TakaGrid } from '../../components/TakaGrid';

function ChallanPicker({ challans, taken, onPick }) {
  const [q, setQ] = useState('')
  const [branch, setBranch] = useState('')
  const [quality, setQuality] = useState('')
  const branches = useMemo(() => [...new Map(challans.filter((c) => c.branch_id).map((c) => [String(c.branch_id), c.branch_name])).entries()], [challans])
  const qualities = useMemo(() => [...new Map(challans.map((c) => [String(c.quality_id), c.nick_name])).entries()], [challans])
  const shown = challans.filter((c) => !taken.has(c.id) && (!branch || String(c.branch_id) === branch) && (!quality || String(c.quality_id) === quality)
    && `${c.challan_no} ${c.weaver_name} ${c.group_name} ${c.nick_name}`.toLowerCase().includes(q.toLowerCase()))
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="relative sm:col-span-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search weaver challan…" aria-label="Search weaver challan"
            className="h-11 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-base focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
        <Select value={branch} onChange={(e) => setBranch(e.target.value)}><option value="">All branches</option>{branches.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</Select>
        <Select value={quality} onChange={(e) => setQuality(e.target.value)}><option value="">All qualities</option>{qualities.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</Select>
      </div>
      <div className="max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
        {shown.map((c) => (
          <button key={c.id} type="button" onClick={() => onPick(c)} className="flex w-full flex-wrap items-center gap-x-3 gap-y-0.5 px-3 py-2.5 text-left hover:bg-primary-50">
            <span className="font-semibold text-slate-900">{c.challan_no}</span>
            <span className="text-sm text-slate-600">{c.weaver_name}</span>
            <span className="text-sm text-slate-600">{c.nick_name}</span>
            <span className="ml-auto text-sm tabular-nums text-slate-500">{c.godown_count} in godown · {fmtM(c.godown_m)} m</span>
          </button>
        ))}
        {shown.length === 0 && <div className="p-4 text-center text-sm text-slate-500">{challans.length === 0 ? 'No weaver challan has grey left in the godown.' : 'No weaver challan matches.'}</div>}
      </div>
    </div>
  )
}

function PartCard({ part, label, challans, taken, onChange, onRemove, onDone, canRemove }) {
  const [n, setN] = useState('10')
  const [err, setErr] = useState('')
  const t = partTotals(part)
  const sel = new Set(part.sel)

  const pick = async (c) => {
    setErr('')
    try {
      const takas = await repo.godownTakasOfReceipt(c.id)
      onChange({ ...part, receipt: c, takas, sel: [] })
    } catch (e) { setErr(e.message) }
  }
  const setSel = (ids) => onChange({ ...part, sel: ids })
  const toggle = (id) => setSel(sel.has(id) ? part.sel.filter((x) => x !== id) : [...part.sel, id])

  if (!part.editing && part.receipt) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-slate-200 bg-white px-4 py-3">
        <Check className="h-4 w-4 shrink-0 text-emerald-600" />
        <span className="font-bold text-primary-700">{label}</span>
        <span className="min-w-0 text-sm text-slate-700">
          <strong className="text-slate-900">{part.receipt.challan_no}</strong> · {part.receipt.weaver_name} · {part.receipt.nick_name} · <span className="tabular-nums">{t.takas} takas · {fmtM(t.meters)} m</span>
        </span>
        <span className="ml-auto flex gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ ...part, editing: true })}><Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit</Button>
          <Button type="button" variant="ghost" size="sm" onClick={onRemove}><Trash2 className="mr-1.5 h-3.5 w-3.5" /> Remove</Button>
        </span>
      </div>
    )
  }

  return (
    <div className="rounded-lg border-2 border-primary-200 bg-white p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="font-semibold text-slate-900">Weaver challan <span className="text-primary-700">{label}</span></div>
        {canRemove && <Button type="button" variant="ghost" size="sm" onClick={onRemove}><Trash2 className="mr-1.5 h-3.5 w-3.5" /> Remove</Button>}
      </div>

      {!part.receipt ? (
        <ChallanPicker challans={challans} taken={taken} onPick={pick} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Weaver challan">
              <div className="flex gap-2"><Input readOnly value={part.receipt.challan_no} className="bg-slate-50" /><Button type="button" variant="outline" onClick={() => onChange({ ...part, receipt: null, takas: [], sel: [] })}>Change</Button></div>
            </Field>
            <Field label="Associated party"><Input readOnly value={`${part.receipt.weaver_name} (${part.receipt.group_name})`} className="bg-slate-50" /></Field>
            <Field label="Quality"><Input readOnly value={part.receipt.nick_name} className="bg-slate-50" /></Field>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setSel(part.takas.map((x) => x.id))}>Select all</Button>
            <div className="flex items-center gap-1.5">
              <Button type="button" variant="outline" size="sm" onClick={() => setSel(part.takas.slice(0, Math.max(0, Number(n) || 0)).map((x) => x.id))}>First</Button>
              <input type="number" min="1" value={n} onChange={(e) => setN(e.target.value)} aria-label="How many takas" className="h-9 w-16 rounded-md border border-slate-300 px-2 text-base" />
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => setSel([])}>Clear</Button>
            <span className="ml-auto text-sm tabular-nums text-slate-600"><strong className="text-slate-900">{t.takas}</strong> of {part.takas.length} takas · <strong className="text-slate-900">{fmtM(t.meters)}</strong> m</span>
          </div>

          <div className="max-h-72 overflow-y-auto"><TakaGrid items={part.takas.map((x) => ({ id: x.id, no: x.taka_no, meters: x.grey_meter }))} sel={sel} onToggle={toggle} /></div>
          <Alert>{err}</Alert>
          <div className="flex justify-end">
            <Button type="button" disabled={t.takas === 0} onClick={onDone}><Check className="mr-2 h-4 w-4" /> Done</Button>
          </div>
        </>
      )}
      {!part.receipt && err && <Alert>{err}</Alert>}
    </div>
  )
}

/** parts/setParts: state owned by the page. challans: repo.listGodownChallans(). existing: subs already on the main (add mode). */
export default function PartBuilder({ parts, setParts, mainNo, existing = [], challans, setError }) {
  const labels = partLabels(parts, mainNo, existing)
  const taken = (i) => new Set(parts.filter((_, j) => j !== i).map((p) => p.receipt?.id).filter(Boolean))
  const update = (i, next) => setParts(parts.map((p, j) => (j === i ? next : p)))

  /** Collapse the card being edited (it needs a challan and at least one taka). Returns false when it can't be collapsed. */
  const collapseAll = () => {
    for (const p of parts) {
      if (p.editing && (!p.receipt || partTotals(p).takas === 0)) { setError?.('Choose a weaver challan and select at least one taka first'); return false }
    }
    setError?.('')
    setParts(parts.map((p) => ({ ...p, editing: false })))
    return true
  }
  const addAnother = () => {
    for (const p of parts) if (p.editing && (!p.receipt || partTotals(p).takas === 0)) { setError?.('Finish the open weaver challan first: choose it and select at least one taka'); return }
    setError?.('')
    setParts([...parts.map((p) => ({ ...p, editing: false })), newPart()])
  }

  return (
    <div className="space-y-3">
      {parts.map((p, i) => (
        <PartCard key={p.key} part={p} label={labels[i]} challans={challans} taken={taken(i)}
          canRemove={parts.length > 1 || !!p.receipt}
          onChange={(next) => (next.editing && !p.editing ? setParts(parts.map((x, j) => (j === i ? next : { ...x, editing: x.receipt && partTotals(x).takas > 0 ? false : x.editing }))) : update(i, next))}
          onRemove={() => { const rest = parts.filter((_, j) => j !== i); setParts(rest.length ? rest : [newPart()]) }}
          onDone={collapseAll}
        />
      ))}
      <Button type="button" variant="outline" onClick={addAnother}><Plus className="mr-2 h-4 w-4" /> Add another weaver challan</Button>
    </div>
  )
}
