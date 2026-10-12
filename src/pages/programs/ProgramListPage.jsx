import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader, Card, Button, Input, Table, Th, Td, Badge, Empty, LoadState, Pager, usePaged } from '../../components/ui';
import { fmtM, fmtDate } from '../../lib/format';
import { Plus, Search, ChevronRight, Scissors } from 'lucide-react';
import * as repo from '../../db/repo';
import { useDbVersion } from '../../lib/live';

export default function ProgramListPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [programs, setPrograms] = useState([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

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

  const filtered = programs.filter(p => 
    p.program_no.toLowerCase().includes(search.toLowerCase()) || 
    p.mill_name.toLowerCase().includes(search.toLowerCase()) ||
    p.nick_name.toLowerCase().includes(search.toLowerCase())
  );

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
        <Button onClick={() => navigate('/programs/new')}><Plus className="w-4 h-4 mr-2" /> Issue Program</Button>
      </PageHeader>

      <Card className="p-4 bg-slate-50 border-b-0 rounded-b-none">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input 
            className="pl-9 bg-white" 
            placeholder="Search program no, mill, or quality..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </Card>

      <Card className="rounded-t-none border-t-0">
        <Table>
          <thead>
            <tr>
              <Th>Program No</Th>
              <Th>Date</Th>
              <Th>Mill</Th>
              <Th>Quality</Th>
              <Th>Shades</Th>
              <Th className="text-right">Takas</Th>
              <Th>Status</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {paged.rows.map(p => {
              const pct = Math.min(100, (p.received_takas / p.total_takas) * 100) || 0;
              return (
                <tr key={p.id} className="hover:bg-slate-50 transition-colors cursor-pointer group" onClick={() => navigate(`/programs/${p.id}`)}>
                  <Td className="font-medium text-slate-900">
                    <div className="flex items-center gap-2">
                      <Scissors className="w-4 h-4 text-slate-400" />
                      {p.program_no}
                    </div>
                  </Td>
                  <Td>{fmtDate(p.date)}</Td>
                  <Td className="font-medium">{p.mill_name}</Td>
                  <Td>{p.nick_name}</Td>
                  <Td>
                    <div className="flex -space-x-1">
                      {p.lines.slice(0, 5).map(l => (
                        <div key={l.id} className="w-6 h-6 rounded-full border border-white shadow-sm" style={{ backgroundColor: l.hex || '#ccc' }} title={`${l.item_code ? l.item_code + ' · ' : ''}${l.shade_no}`}></div>
                      ))}
                      {p.lines.length > 5 && <div className="w-6 h-6 rounded-full bg-slate-100 border border-white flex items-center justify-center text-[10px] text-slate-600 font-medium">+{p.lines.length - 5}</div>}
                    </div>
                  </Td>
                  <Td className="text-right">
                    <div className="font-medium text-slate-900">{p.total_takas}</div>
                    <div className="text-xs text-slate-500">{p.grey_m.toLocaleString()} m</div>
                  </Td>
                  <Td>
                    <div className="w-32">
                      <div className="flex justify-between items-center mb-1">
                        {getStatusBadge(p.status)}
                        <span className="text-xs font-medium text-slate-500">{p.received_takas}/{p.total_takas}</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-emerald-500' : 'bg-primary-500'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </Td>
                  <Td className="text-right">
                    <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-primary-600 inline-block" />
                  </Td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <Td colSpan={8} className="py-12">
                  <Empty title="No programs found" description="Create a new program to instruct a mill." />
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
