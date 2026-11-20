import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { PageHeader, Card, Button, Input, Select, Badge, Empty, Table, Th, Td, LoadState, Pager, usePaged } from '../../components/ui';
import { fmtM, fmtPct, fmtDate } from '../../lib/format';
import { Plus, FileText } from 'lucide-react';
import * as repo from '../../db/repo';
import { useDbVersion } from '../../lib/live';
import { SearchToggle, ListFilter, uniqueOptions, inDateRange, ViewToggle, useViewMode, Progress } from '../../components/kit';

export default function PoListPage() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useViewMode('po');
  const [loading, setLoading] = useState(true);
  const [pos, setPos] = useState([]);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [params] = useSearchParams();
  const [flt, setFlt] = useState(() => (params.get('quality') ? { quality_id: params.get('quality') } : {})); // ?quality=ID comes from the availability panel

  const dbVersion = useDbVersion();
  useEffect(() => {
    async function load() {
      try {
        const data = await repo.listPOs();
        setPos(data);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [dbVersion]);

  const filtered = pos.filter(p => {
    const sMatch = p.po_no.toLowerCase().includes(search.toLowerCase()) || 
                   p.group_name.toLowerCase().includes(search.toLowerCase()) || 
                   p.nick_name.toLowerCase().includes(search.toLowerCase());
    const fMatch = (!flt.status || p.status === flt.status) && (!flt.group_id || String(p.group_id) === flt.group_id) && (!flt.quality_id || String(p.quality_id) === flt.quality_id) && inDateRange(p.po_date, flt);
    return sMatch && fMatch;
  });

  const getStatusBadge = (status) => <Badge variant={repo.PO_STATUS_META[status].variant}>{repo.PO_STATUS_META[status].label}</Badge>;
  const paged = usePaged(filtered, 50);
  if (loading || error) return <LoadState loading={loading} error={error} />;

  return (
    <div className="space-y-6">
      <PageHeader title="Grey Purchase Orders" description="Manage all fabric orders placed to weavers.">
        <ListFilter values={flt} onChange={setFlt} fields={[{ key: 'status', label: 'Status', options: Object.entries(repo.PO_STATUS_META).map(([k, v]) => [k, v.label]) }, { key: 'group_id', label: 'Firm', options: uniqueOptions(pos, (x) => x.group_id, (x) => x.group_name) }, { key: 'quality_id', label: 'Quality', options: uniqueOptions(pos, (x) => x.quality_id, (x) => x.nick_name) }]} />
        <SearchToggle value={search} onChange={setSearch} placeholder="Search PO, weaver, or quality..." />
        <ViewToggle mode={viewMode} onChange={setViewMode} />
        <Button onClick={() => navigate('/po/new')}><Plus className="w-4 h-4 mr-2" /> Create PO</Button>
      </PageHeader>

      {viewMode === 'card' ? (
        <>
          {filtered.length === 0 ? <Empty title="No POs found" description="Create a new PO or change your filters." /> : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
              {paged.rows.map(p => (
                <button key={p.id} type="button" onClick={() => navigate(`/po/${p.id}`)}
                  className="text-left rounded-lg border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md hover:border-primary-300 transition">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900">{p.po_no}</div>
                      <div className="text-sm font-medium text-slate-700 truncate">{p.group_name}</div>
                    </div>
                    {getStatusBadge(p.status)}
                  </div>
                  <div className="mt-1 text-sm text-slate-500 truncate">{p.original_name} · {p.nick_name}</div>
                  <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
                    {[
                      ['PO date', fmtDate(p.po_date)],
                      ['Due date', p.due_date ? fmtDate(p.due_date) : '—'],
                      ['Ordered', `${fmtM(p.meters)} m`],
                      ['Received', `${fmtM(p.received_m)} m`],
                      ['Pending', `${fmtM(p.pending_m)} m`],
                      ['Rate', `₹${p.rate} / m`],
                    ].map(([label, value]) => (
                      <div key={label} className="min-w-0">
                        <dt className="text-xs font-bold text-slate-500">{label}</dt>
                        <dd className="text-sm font-semibold text-slate-900 tabular-nums truncate">{value}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="mt-4"><Progress label="Received" pct={p.pct} tone={p.pct >= 100 ? 'emerald' : 'primary'} /></div>
                  {p.shortfall_pct != null && p.shortfall !== 0 && <div className="mt-2 text-xs font-medium text-amber-700">{p.shortfall > 0 ? 'Short' : 'Excess'} {fmtM(Math.abs(p.shortfall))} m ({fmtPct(Math.abs(p.shortfall_pct))})</div>}
                </button>
              ))}
            </div>
          )}
          <Pager paged={paged} />
        </>
      ) : (
      <Card>
        <Table>
          <thead>
            <tr>
              <Th>PO Number</Th>
              <Th>Date</Th>
              <Th>Firm</Th>
              <Th>Quality</Th>
              <Th className="text-right">Meters</Th>
              <Th>Progress</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {paged.rows.map(p => (
              <tr key={p.id} className="hover:bg-slate-50 transition-colors cursor-pointer group" onClick={() => navigate(`/po/${p.id}`)}>
                <Td className="font-semibold text-slate-900">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-slate-400" />
                    {p.po_no}
                  </div>
                </Td>
                <Td>{fmtDate(p.po_date)}</Td>
                <Td className="font-medium text-slate-900">{p.group_name}</Td>
                <Td>
                  <div className="font-medium text-slate-900">{p.original_name}</div>
                  <div className="text-xs text-slate-500">{p.nick_name}</div>
                </Td>
                <Td className="text-right">
                  <div className="font-semibold text-slate-900">{fmtM(p.meters)} <span className="text-xs font-medium text-slate-400">m</span></div>
                  <div className="text-xs text-slate-500">@ ₹{p.rate}</div>
                </Td>
                <Td>
                  <div className="w-32">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium text-slate-700">{fmtM(p.received_m)} m</span>
                      <span className="font-semibold text-slate-900">{Math.round(p.pct)}%</span>
                    </div>
                    {p.shortfall_pct != null && p.shortfall !== 0 && <div className="text-[11px] text-amber-600 mt-1">{p.shortfall > 0 ? 'short' : 'excess'} {fmtM(Math.abs(p.shortfall))} m ({fmtPct(Math.abs(p.shortfall_pct))})</div>}
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all ${p.pct >= 100 ? 'bg-emerald-500' : 'bg-primary-500'}`}
                        style={{ width: `${Math.min(100, p.pct)}%` }}
                      />
                    </div>
                  </div>
                </Td>
                <Td>{getStatusBadge(p.status)}</Td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <Td colSpan={7} className="py-12">
                  <Empty title="No POs found" description="Create a new PO or change your search filters." />
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
