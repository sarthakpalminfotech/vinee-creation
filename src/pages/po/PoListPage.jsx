import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { PageHeader, Card, Button, Input, Select, Badge, Empty, Table, Th, Td, LoadState, Pager, usePaged } from '../../components/ui';
import { fmtM, fmtPct, fmtDate } from '../../lib/format';
import { Plus, FileText } from 'lucide-react';
import * as repo from '../../db/repo';
import { useDbVersion } from '../../lib/live';
import { SearchToggle } from '../../components/kit';

export default function PoListPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [pos, setPos] = useState([]);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

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
    const fMatch = statusFilter ? p.status === statusFilter : true;
    return sMatch && fMatch;
  });

  const getStatusBadge = (status) => <Badge variant={repo.PO_STATUS_META[status].variant}>{repo.PO_STATUS_META[status].label}</Badge>;
  const paged = usePaged(filtered, 50);
  if (loading || error) return <LoadState loading={loading} error={error} />;

  return (
    <div className="space-y-6">
      <PageHeader title="Grey Purchase Orders" description="Manage all fabric orders placed to weavers.">
        <SearchToggle value={search} onChange={setSearch} placeholder="Search PO, weaver, or quality..." />
        <Select className="w-44 sm:w-52" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          <option value="OPEN">Open</option>
          <option value="PARTIAL">Partly received</option>
          <option value="RECEIVED">Received</option>
          <option value="CLOSED">Closed (short)</option>
        </Select>
        <Button onClick={() => navigate('/po/new')}><Plus className="w-4 h-4 mr-2" /> Create PO</Button>
      </PageHeader>

      <Card>
        <Table>
          <thead>
            <tr>
              <Th>PO Number</Th>
              <Th>Date</Th>
              <Th>Party Group</Th>
              <Th>Quality</Th>
              <Th className="text-right">Meters</Th>
              <Th>Progress</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {paged.rows.map(p => (
              <tr key={p.id} className="hover:bg-slate-50 transition-colors cursor-pointer group" onClick={() => navigate(`/po/${p.id}`)}>
                <Td className="font-medium text-slate-900">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-slate-400" />
                    {p.po_no}
                  </div>
                </Td>
                <Td>{fmtDate(p.po_date)}</Td>
                <Td>{p.group_name}</Td>
                <Td>
                  <div>{p.original_name}</div>
                  <div className="text-xs text-slate-500">{p.nick_name}</div>
                </Td>
                <Td className="text-right">
                  <div>{fmtM(p.meters)} m</div>
                  <div className="text-xs text-slate-500">@ ₹{p.rate}</div>
                </Td>
                <Td>
                  <div className="w-32">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-500">{fmtM(p.received_m)} m</span>
                      <span className="font-medium">{Math.round(p.pct)}%</span>
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
    </div>
  );
}
