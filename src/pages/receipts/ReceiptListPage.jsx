import React, { useState, useEffect } from 'react';
import { useNavigate, Outlet } from 'react-router-dom';
import { PageHeader, Card, Button, Input, Badge, Table, Th, Td, Empty } from '../../components/ui';
import { Plus, Search, ChevronRight, FileText, MapPin, ShieldCheck } from 'lucide-react';
import * as repo from '../../db/repo';

export default function ReceiptListPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [receipts, setReceipts] = useState([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const data = await repo.listReceipts();
        setReceipts(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <div className="p-12 text-center text-slate-500">Loading...</div>;

  const filtered = receipts.filter(r => 
    r.challan_no.toLowerCase().includes(search.toLowerCase()) || 
    r.po_no.toLowerCase().includes(search.toLowerCase()) || 
    r.weaver_name.toLowerCase().includes(search.toLowerCase()) ||
    r.nick_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Grey Challans (Receipts)" description="Manage incoming grey fabric from weavers.">
        <Button onClick={() => navigate('/receipts/new')}><Plus className="w-4 h-4 mr-2" /> Receive Challan</Button>
      </PageHeader>

      <Card className="p-4 bg-slate-50 border-b-0 rounded-b-none">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input 
            className="pl-9 bg-white" 
            placeholder="Search challan, PO, weaver or quality..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </Card>

      <Card className="rounded-t-none border-t-0">
        <Table>
          <thead>
            <tr>
              <Th>Challan No</Th>
              <Th>Date</Th>
              <Th>PO & Quality</Th>
              <Th>Weaver Firm</Th>
              <Th>Destination</Th>
              <Th className="text-right">Takas</Th>
              <Th className="text-right">Total Meters</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.id} className="hover:bg-slate-50 transition-colors cursor-pointer group" onClick={() => navigate(`/receipts/${r.id}`)}>
                <Td className="font-medium text-slate-900">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-slate-400" />
                    {r.challan_no}
                  </div>
                </Td>
                <Td>{new Date(r.date).toLocaleDateString()}</Td>
                <Td>
                  <div>{r.po_no}</div>
                  <div className="text-xs text-slate-500">{r.nick_name}</div>
                </Td>
                <Td>{r.weaver_name}</Td>
                <Td>
                  {r.destination === 'MILL' ? 
                    <span className="inline-flex items-center text-sky-600 text-xs font-medium bg-sky-50 px-2 py-1 rounded"><ShieldCheck className="w-3.5 h-3.5 mr-1" /> {r.mill_name || 'Mill'}</span> : 
                    <span className="inline-flex items-center text-slate-600 text-xs font-medium bg-slate-100 px-2 py-1 rounded"><MapPin className="w-3.5 h-3.5 mr-1" /> Godown</span>
                  }
                </Td>
                <Td className="text-right font-medium">{r.taka_count}</Td>
                <Td className="text-right">{r.total_m.toLocaleString()} m</Td>
                <Td className="text-right">
                  <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-primary-600 inline-block" />
                </Td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <Td colSpan={8} className="py-12">
                  <Empty title="No challans found" description="Try a different search term or receive a new challan." />
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
