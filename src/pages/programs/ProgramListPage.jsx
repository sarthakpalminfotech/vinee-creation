import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader, Card, Button, Input, Table, Th, Td, Badge, Empty, LoadState, Pager, usePaged } from '../../components/ui';
import { fmtM, fmtDate } from '../../lib/format';
import { Plus, Scissors } from 'lucide-react';
import * as repo from '../../db/repo';
import { useDbVersion } from '../../lib/live';
import { ShadeSwatch, Qty, SearchToggle, ListFilter, uniqueOptions, inDateRange, ViewToggle, useViewMode } from '../../components/kit';

export default function ProgramListPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [programs, setPrograms] = useState([]);
  const [search, setSearch] = useState('');
  const [flt, setFlt] = useState({});
  const [error, setError] = useState('');
  const [status, setStatus] = useState('ALL');
  const [viewMode, setViewMode] = useViewMode('programs');

  const dbVersion = useDbVersion();
  useEffect(() => {
    async function load() {
      try {
        const data = await repo.listPrograms();
        setPrograms(data);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [dbVersion]);

  const searched = programs.filter(p => 
    p.program_no.toLowerCase().includes(search.toLowerCase()) || 
    p.mill_name.toLowerCase().includes(search.toLowerCase()) ||
    p.nick_name.toLowerCase().includes(search.toLowerCase())
  );

  const filtered = searched.filter(p => (!flt.mill_id || String(p.mill_id) === flt.mill_id) && (!flt.quality_id || (p.quality_ids || '').split(',').includes(flt.quality_id)) && (status === 'ALL' || p.status === status) && inDateRange(p.date, flt))
    .sort((a, b) => (a.status === 'DONE') - (b.status === 'DONE')); // finished programs sink to the end (sort is stable)

  const getStatusBadge = (status) => {
    if (status === 'DONE') return <Badge variant="success">Done</Badge>;
    if (status === 'PARTIAL') return <Badge variant="warning">Partial</Badge>;
    return <Badge variant="primary">In Dyeing</Badge>;
  };

  const paged = usePaged(filtered, 50);
  if (loading || error) return <LoadState loading={loading} error={error} />;

  return (
    <div className="space-y-6">
      <PageHeader title="Dyeing Programs" description="Issue dyeing instructions and track progress at mills.">
        <ListFilter values={flt} onChange={setFlt} fields={[{ key: 'mill_id', label: 'Mill', options: uniqueOptions(programs, (x) => x.mill_id, (x) => x.mill_name) }, { key: 'quality_id', label: 'Quality', options: uniqueOptions(programs.flatMap((x) => x.lines), (l) => l.line_quality_id, (l) => l.quality_nick) }]} />
        <SearchToggle value={search} onChange={setSearch} placeholder="Search program no, mill, or quality..." />
        <ViewToggle mode={viewMode} onChange={setViewMode} />
        <Button onClick={() => navigate('/programs/new')}><Plus className="w-4 h-4 mr-2" /> Issue Program</Button>
      </PageHeader>

      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1" role="group" aria-label="Filter by status">
        {[['ALL', 'All'], ['PENDING', 'In dyeing'], ['PARTIAL', 'Partly received'], ['DONE', 'Done']].map(([k, label]) => {
          const n = k === 'ALL' ? searched.length : searched.filter(p => p.status === k).length;
          return (
            <button key={k} type="button" onClick={() => setStatus(k)} aria-pressed={status === k}
              className={`shrink-0 h-10 px-4 rounded-full border text-sm font-medium whitespace-nowrap transition-colors ${status === k ? 'bg-primary-600 border-primary-600 text-white' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'}`}>
              {label} <span className={status === k ? 'text-white/80' : 'text-slate-400'}>{n}</span>
            </button>
          );
        })}
      </div>

      {viewMode === 'card' ? (
        <>
          {filtered.length === 0 ? <Empty title="No programs found" description="Create a new program to instruct a mill." /> : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,19rem),1fr))] gap-4">
              {paged.rows.map(p => {
                const pct = Math.min(100, (p.received_takas / p.total_takas) * 100) || 0;
                return (
                  <button key={p.id} type="button" onClick={() => navigate(`/programs/${p.id}`)}
                    className="text-left rounded-lg border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md hover:border-primary-300 transition">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 flex items-center gap-2"><Scissors className="w-4 h-4 text-slate-400 shrink-0" />{p.program_no}</div>
                        <div className="text-sm font-medium text-slate-700 truncate">{p.mill_name}</div>
                      </div>
                      <span className="text-xs text-slate-500 shrink-0">{fmtDate(p.date)}</span>
                    </div>
                    <div className="mt-1 text-sm text-slate-500 truncate" title={p.nick_name}>{(p.nick_name || '').split(',').join(', ')}{Number(p.challan_count) > 0 ? ` · ${p.challan_count} challan${Number(p.challan_count) === 1 ? '' : 's'}` : ''}</div>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div className="flex -space-x-1">
                        {p.lines.slice(0, 5).map(l => (
                          <span key={l.id} title={l.shade_no} className="rounded-full ring-2 ring-white"><ShadeSwatch hex={l.hex} image={l.shade_image} size="md" /></span>
                        ))}
                        {p.lines.length > 5 && <div className="w-6 h-6 rounded-full bg-slate-100 border border-white flex items-center justify-center text-[10px] text-slate-600 font-medium">+{p.lines.length - 5}</div>}
                      </div>
                      <Qty variant="cell" takas={p.total_takas} meters={p.grey_m} />
                    </div>
                    <div className="mt-4">
                      <div className="w-full">
                      <div className="flex justify-between items-center mb-1">
                        {getStatusBadge(p.status)}
                        <span className="text-xs font-semibold text-slate-700">{p.received_takas}/{p.total_takas}</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-emerald-500' : 'bg-primary-500'}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          <Pager paged={paged} />
        </>
      ) : (
      <Card>
        <Table>
          <thead>
            <tr>
              <Th>Program No</Th>
              <Th>Date</Th>
              <Th>Mill</Th>
              <Th>Quality</Th>
              <Th>Colours</Th>
              <Th className="text-right">Quantity</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {paged.rows.map(p => {
              const pct = Math.min(100, (p.received_takas / p.total_takas) * 100) || 0;
              return (
                <tr key={p.id} className="hover:bg-slate-50 transition-colors cursor-pointer group" onClick={() => navigate(`/programs/${p.id}`)}>
                  <Td className="font-semibold text-slate-900">
                    <div className="flex items-center gap-2">
                      <Scissors className="w-4 h-4 text-slate-400" />
                      {p.program_no}
                    </div>
                  </Td>
                  <Td>{fmtDate(p.date)}</Td>
                  <Td className="font-medium text-slate-900">{p.mill_name}</Td>
                  <Td className="max-w-[14rem] truncate font-medium text-slate-900" title={p.nick_name}>{(p.nick_name || '').split(',').join(', ')}{Number(p.challan_count) > 0 && <div className="text-xs font-normal text-slate-500">{p.challan_count} weaver challan{Number(p.challan_count) === 1 ? '' : 's'}</div>}</Td>
                  <Td>
                    <div className="flex -space-x-1">
                      {p.lines.slice(0, 5).map(l => (
                        <span key={l.id} title={l.shade_no} className="rounded-full ring-2 ring-white"><ShadeSwatch hex={l.hex} image={l.shade_image} size="md" /></span>
                      ))}
                      {p.lines.length > 5 && <div className="w-6 h-6 rounded-full bg-slate-100 border border-white flex items-center justify-center text-[10px] text-slate-600 font-medium">+{p.lines.length - 5}</div>}
                    </div>
                  </Td>
                  <Td><Qty variant="cell" takas={p.total_takas} meters={p.grey_m} /></Td>
                  <Td>
                    <div className="w-32">
                      <div className="flex justify-between items-center mb-1">
                        {getStatusBadge(p.status)}
                        <span className="text-xs font-semibold text-slate-700">{p.received_takas}/{p.total_takas}</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-emerald-500' : 'bg-primary-500'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </Td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <Td colSpan={7} className="py-12">
                  <Empty title="No programs found" description="Create a new program to instruct a mill." />
                </Td>
              </tr>
            )}
          </tbody>
        </Table>
        <Pager paged={paged} />
      </Card>
      )}
    </div>
  );
}
