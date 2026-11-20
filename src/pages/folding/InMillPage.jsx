// Folding → In mill: every program that still has takas in dyeing, grouped by mill. Tapping one opens "Receive from mill"
// in the restricted folding mode (R-FD-5 — a simplified screen for the folding person, not a security feature).
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Factory, Search } from 'lucide-react';
import { PageHeader, Card, Input, Select, Empty, LoadState } from '../../components/ui';
import { Chip, ShadeSwatch } from '../../components/kit';
import { fmtDate, fmtInt, fmtM } from '../../lib/format';
import * as repo from '../../db/repo';
import { useDbVersion } from '../../lib/live';

function ProgramCard({ p, onOpen }) {
  return (
    <button type="button" onClick={onOpen} className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-primary-300 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold text-slate-900">{p.program_no}</div>
          <div className="text-xs text-slate-500">{fmtDate(p.date)}</div>
        </div>
        <Chip tone={p.days >= 15 ? 'amber' : 'slate'}>{p.days === 0 ? 'today' : `${p.days} day${p.days === 1 ? '' : 's'} in mill`}</Chip>
      </div>
      <div className="truncate text-sm font-medium text-slate-700">{p.qualities.join(', ')}</div>
      <div className="flex flex-wrap gap-1.5">
        {p.colours.map((c) => (
          <span key={c.shade_id} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white py-0.5 pl-0.5 pr-2.5 text-sm">
            <ShadeSwatch hex={c.hex} image={c.shade_image} size="sm" /><span className="font-medium text-slate-900">{c.shade_no}</span><span className="text-slate-500">× {c.takas}</span>
          </span>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-sm tabular-nums">
        <div><div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Issued</div><div className="font-semibold text-slate-900">{fmtInt(p.issued)}</div></div>
        <div><div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Received</div><div className="font-semibold text-emerald-700">{fmtInt(p.received)}</div></div>
        <div><div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Pending</div><div className="font-semibold text-amber-700">{fmtInt(p.pending)} <span className="text-xs font-normal text-slate-500">· {fmtM(p.pending_m)} m</span></div></div>
      </div>
    </button>
  );
}

export default function InMillPage() {
  const navigate = useNavigate();
  const v = useDbVersion();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [mill, setMill] = useState('');
  useEffect(() => { repo.inMillPrograms().then((d) => { setData(d); setError(''); }).catch((e) => setError(e.message)); }, [v]);
  const needle = q.trim().toLowerCase();
  const groups = useMemo(() => (data || []).filter((g) => !mill || String(g.mill_id) === mill).map((g) => ({
    ...g,
    programs: g.programs.filter((p) => !needle || `${p.program_no} ${p.qualities.join(' ')} ${p.challans.join(' ')} ${p.lots.join(' ')} ${p.colours.map((c) => c.shade_no).join(' ')}`.toLowerCase().includes(needle)),
  })).filter((g) => g.programs.length), [data, needle, mill]);
  if (error) return <LoadState error={error} />;
  if (!data) return <LoadState loading />;
  const pendingTakas = groups.reduce((s, g) => s + g.programs.reduce((a, p) => a + p.pending, 0), 0);
  return (
    <div className="page-w space-y-6">
      <PageHeader title="In mill" description="Programs with takas still in dyeing — tap one to receive its takas from the mill." onBack={() => navigate('/folding')} />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input className="pl-10" placeholder="Search program, quality, weaver challan, lot…" aria-label="Search programs" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select aria-label="Mill" value={mill} onChange={(e) => setMill(e.target.value)}><option value="">All mills</option>{data.map((g) => <option key={g.mill_id} value={g.mill_id}>{g.mill_name}</option>)}</Select>
      </div>
      <div className="text-sm text-slate-500">{groups.reduce((s, g) => s + g.programs.length, 0)} programs · {fmtInt(pendingTakas)} takas still in the mill</div>
      {groups.length === 0 ? <Empty icon={Factory} title="Nothing in the mill" description="Every issued program has been received, or nothing matches the search." /> : groups.map((g) => (
        <section key={g.mill_id} className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-bold text-forest"><Factory className="h-4 w-4 text-slate-400" />{g.mill_name}
            <span className="text-xs font-normal text-slate-500">{g.programs.length} program{g.programs.length === 1 ? '' : 's'} · {fmtInt(g.programs.reduce((s, p) => s + p.pending, 0))} takas pending</span></h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {g.programs.map((p) => <ProgramCard key={p.id} p={p} onOpen={() => navigate(`/folding/in-mill/${p.id}/receive`)} />)}
          </div>
        </section>
      ))}
    </div>
  );
}
