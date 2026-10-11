import React, { useState, useEffect } from 'react';
import { useNavigate, Outlet } from 'react-router-dom';
import { PageHeader, Card, Button, Input, Table, Th, Td, Empty } from '../../components/ui';
import { Plus, Search, ChevronRight, Truck } from 'lucide-react';
import * as repo from '../../db/repo';

export default function DispatchListPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [dispatches, setDispatches] = useState([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const data = await repo.listDispatches();
        setDispatches(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <div className="p-12 text-center text-slate-500">Loading...</div>;

  const filtered = dispatches.filter(d => 
    d.dispatch_no.toLowerCase().includes(search.toLowerCase()) || 
    d.mill_name.toLowerCase().includes(search.toLowerCase()) ||
    (d.qualities || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Mill Dispatches" description="Send grey fabric from godown to mills for dyeing.">
        <Button onClick={() => navigate('/dispatch/new')}><Plus className="w-4 h-4 mr-2" /> New Dispatch</Button>
      </PageHeader>

      <Card className="p-4 bg-slate-50 border-b-0 rounded-b-none">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input 
            className="pl-9 bg-white" 
            placeholder="Search dispatch no, mill, or quality..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </Card>

      <Card className="rounded-t-none border-t-0">
        <Table>
          <thead>
            <tr>
              <Th>Dispatch No</Th>
              <Th>Date</Th>
              <Th>Mill</Th>
              <Th>Qualities Sent</Th>
              <Th className="text-right">Takas</Th>
              <Th className="text-right">Total Meters</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(d => (
              <tr key={d.id} className="hover:bg-slate-50 transition-colors cursor-pointer group" onClick={() => navigate(`/dispatch/${d.id}`)}>
                <Td className="font-medium text-slate-900">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-slate-400" />
                    {d.dispatch_no}
                  </div>
                </Td>
                <Td>{new Date(d.date).toLocaleDateString()}</Td>
                <Td className="font-medium">{d.mill_name}</Td>
                <Td>
                  <div className="max-w-[200px] truncate text-slate-600" title={d.qualities}>{d.qualities || '-'}</div>
                </Td>
                <Td className="text-right font-medium">{d.taka_count}</Td>
                <Td className="text-right">{d.total_m.toLocaleString()} m</Td>
                <Td className="text-right">
                  <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-primary-600 inline-block" />
                </Td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <Td colSpan={7} className="py-12">
                  <Empty title="No dispatches found" description="Create a new dispatch to send fabric to a mill." />
                </Td>
              </tr>
            )}
          </tbody>
        </Table>
      </Card>
      <Outlet />
    </div>
  );
}
