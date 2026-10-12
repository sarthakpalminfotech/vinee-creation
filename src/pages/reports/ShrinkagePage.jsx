import React, { useEffect, useMemo, useState } from 'react';
import { PageHeader, Card, Table, Th, Td, Input, Select, Empty, LoadState, Pager, usePaged, Badge } from '../../components/ui';
import { TrendingDown } from 'lucide-react';
import { fmtM, fmtPct } from '../../lib/format';
import * as repo from '../../db/repo';
import { useDbVersion } from '../../lib/live';

const TABS = [['taka', 'Per taka'], ['byPo', 'By PO'], ['byParty', 'By party'], ['byQuality', 'By quality'], ['byMill', 'By mill'], ['byProgram', 'By program']];
const lossCls = (v) => (v > 0 ? 'text-red-600' : v < 0 ? 'text-emerald-600' : 'text-slate-600');
const natural = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true });

function SummaryTable({ rows, label, showPo }) {
  if (!rows.length) return <div className="p-6"><Empty icon={TrendingDown} title="Nothing to report yet" description="Shrinkage appears once takas come back from the mill." /></div>;
  return (
    <Table>
      <thead>
        <tr>
          <Th>{label}</Th>
          {showPo && <><Th className="text-right">Ordered m</Th><Th className="text-right">Received m</Th><Th className="text-right">Weaver shrinkage</Th></>}
          <Th className="text-right">Takas</Th><Th className="text-right">Start m</Th><Th className="text-right">Finished m</Th>
          <Th className="text-right">Dyeing loss</Th><Th className="text-right">Folding loss</Th><Th className="text-right">Total loss m</Th><Th className="text-right">Total %</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((g) => (
          <tr key={g.key} className="hover:bg-slate-50">
            <Td className="font-medium text-slate-900">{g.label}</Td>
            {showPo && (
              <>
                <Td className="text-right">{fmtM(g.po.meters)}</Td>
                <Td className="text-right">{fmtM(g.po.received_m)}</Td>
                <Td className="text-right">{g.po.shortfall == null ? <span className="text-slate-400">open</span> : <span className={lossCls(g.po.shortfall)}>{fmtM(g.po.shortfall)} m ({fmtPct(g.po.shortfall_pct)})</span>} {g.po.status === 'CLOSED' && <Badge variant="danger">closed short</Badge>}</Td>
              </>
            )}
            <Td className="text-right">{g.takas}</Td><Td className="text-right">{fmtM(g.start)}</Td><Td className="text-right">{fmtM(g.finished)}</Td>
            <Td className="text-right">{fmtM(g.finishLoss)}</Td><Td className="text-right">{g.foldedTakas ? fmtM(g.foldLoss) : '—'}</Td>
            <Td className={`text-right font-semibold ${lossCls(g.totalLoss)}`}>{fmtM(g.totalLoss)}</Td><Td className="text-right">{fmtPct(g.totalPct)}</Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

export default function ShrinkagePage() {
  const [tab, setTab] = useState('taka');
  const [rep, setRep] = useState(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [quality, setQuality] = useState('');
  const [path, setPath] = useState('');

  const dbVersion = useDbVersion();
  useEffect(() => { repo.shrinkageReport().then(setRep).catch((e) => setError(e.message)); }, [dbVersion]);

  const rows = useMemo(() => {
    if (!rep) return [];
    const q = search.trim().toLowerCase();
    return rep.rows.filter((t) =>
      (!quality || String(t.quality_id) === quality) &&
      (!path || (path === 'direct') === t.direct) &&
      (!q || `${t.label} ${t.weaver_name} ${t.po_no} ${t.program_no}`.toLowerCase().includes(q)),
    ).sort((a, b) => natural(a.challan_no, b.challan_no) || natural(a.taka_no, b.taka_no));
  }, [rep, search, quality, path]);
  const paged = usePaged(rows, 100);

  if (!rep) return <LoadState loading={!error} error={error} />;
  const qualities = [...new Map(rep.rows.map((t) => [t.quality_id, t.nick_name])).entries()];
  const sum = (f) => Math.round(rows.reduce((s, t) => s + (f(t) ?? 0), 0) * 100) / 100;

  return (
    <div className="space-y-6">
      <PageHeader title="Shrinkage / wastage report" description="Weaver challan meters → finished (mill) → folded, with the loss at each step. Direct-to-mill takas start at the mill's grey meter." />

      <div className="flex overflow-x-auto no-scrollbar gap-1 border-b border-slate-200">
        {TABS.map(([k, label]) => (
          <button key={k} type="button" onClick={() => setTab(k)} className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap ${tab === k ? 'border-primary-600 text-primary-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>{label}</button>
        ))}
      </div>

      <Card>
        {tab === 'taka' ? (
          <>
            <div className="p-4 border-b border-slate-100 flex flex-wrap gap-3 bg-slate-50/50">
              <Input className="w-56" placeholder="Search taka, party, PO, program…" value={search} onChange={(e) => setSearch(e.target.value)} />
              <Select className="w-44" value={quality} onChange={(e) => setQuality(e.target.value)}>
                <option value="">All qualities</option>
                {qualities.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
              </Select>
              <Select className="w-48" value={path} onChange={(e) => setPath(e.target.value)}>
                <option value="">All takas</option><option value="godown">Via our godown</option><option value="direct">Direct to mill</option>
              </Select>
            </div>
            {rows.length === 0 ? <div className="p-6"><Empty icon={TrendingDown} title="No takas" description="Takas appear here after the mill returns them." /></div> : (
              <>
                <Table>
                  <thead>
                    <tr>
                      <Th>Taka</Th><Th>Party / PO</Th><Th>Program</Th>
                      <Th className="text-right">Weaver grey</Th><Th className="text-right">Mill grey</Th><Th className="text-right">Finished</Th><Th className="text-right">Folded</Th>
                      <Th className="text-right">Dyeing loss</Th><Th className="text-right">Folding loss</Th><Th className="text-right">Total m</Th><Th className="text-right">Total %</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.rows.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50">
                        <Td className="font-medium text-slate-900">{t.label}</Td>
                        <Td>{t.weaver_name}<div className="text-xs text-slate-500">{t.po_no}</div></Td>
                        <Td>{t.program_no}</Td>
                        <Td className="text-right">{t.direct ? <span className="text-slate-400" title="Delivered directly to the mill — weaver step left out">direct</span> : fmtM(t.grey_meter)}</Td>
                        <Td className="text-right">{fmtM(t.millGrey)}</Td>
                        <Td className="text-right">{fmtM(t.finished_meter)}</Td>
                        <Td className="text-right">{t.folded_meter != null ? fmtM(t.folded_meter) : <span className="text-slate-400">—</span>}</Td>
                        <Td className={`text-right ${lossCls(t.finishLoss)}`}>{fmtM(t.finishLoss)} <span className="text-xs text-slate-400">{fmtPct(t.finishPct)}</span></Td>
                        <Td className={`text-right ${lossCls(t.foldLoss)}`}>{t.foldLoss != null ? <>{fmtM(t.foldLoss)} <span className="text-xs text-slate-400">{fmtPct(t.foldPct)}</span></> : '—'}</Td>
                        <Td className={`text-right font-semibold ${lossCls(t.totalLoss)}`}>{fmtM(t.totalLoss)}</Td>
                        <Td className="text-right">{fmtPct(t.totalPct)}</Td>
                      </tr>
                    ))}
                    <tr className="bg-slate-50 font-bold">
                      <Td colSpan={3}>Total — {rows.length} takas</Td>
                      <Td className="text-right">{fmtM(sum((t) => (t.direct ? 0 : t.grey_meter)))}</Td>
                      <Td className="text-right">{fmtM(sum((t) => t.millGrey))}</Td>
                      <Td className="text-right">{fmtM(sum((t) => t.finished_meter))}</Td>
                      <Td className="text-right">{fmtM(sum((t) => t.folded_meter))}</Td>
                      <Td className="text-right">{fmtM(sum((t) => t.finishLoss))}</Td>
                      <Td className="text-right">{fmtM(sum((t) => t.foldLoss))}</Td>
                      <Td className="text-right">{fmtM(sum((t) => t.totalLoss))}</Td>
                      <Td className="text-right">{fmtPct(sum((t) => t.start) ? (sum((t) => t.totalLoss) / sum((t) => t.start)) * 100 : null)}</Td>
                    </tr>
                  </tbody>
                </Table>
                <Pager paged={paged} />
              </>
            )}
          </>
        ) : (
          <SummaryTable rows={rep[tab]} showPo={tab === 'byPo'} label={{ byPo: 'PO', byParty: 'Party', byQuality: 'Quality', byMill: 'Mill', byProgram: 'Program' }[tab]} />
        )}
      </Card>
      <p className="text-xs text-slate-500">Total loss = start − folded (or finished while not yet folded). Start is the weaver challan meter, or the mill's grey meter for direct-to-mill takas. Weaver shrinkage at PO level = ordered − received.</p>
    </div>
  );
}
