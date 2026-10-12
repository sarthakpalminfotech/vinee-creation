import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader, Card, Button, Input, Table, Th, Td, Empty, LoadState, Pager, usePaged } from '../../components/ui';
import { fmtM, fmtDate } from '../../lib/format';
import { Plus, Search, ChevronRight, FileText, MapPin, ShieldCheck } from 'lucide-react';
import * as repo from '../../db/repo';
import { useDbVersion } from '../../lib/live';

export default function ReceiptListPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [receipts, setReceipts] = useState([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const dbVersion = useDbVersion();
  useEffect(() => {
    async function load() {
      try {
        const data = await repo.listReceipts();
        setReceipts(data);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [dbVersion]);

  const filtered = receipts.filter(r => 
    r.challan_no.toLowerCase().includes(search.toLowerCase()) || 
    r.po_no.toLowerCase().includes(search.toLowerCase()) || 
    r.weaver_name.toLowerCase().includes(search.toLowerCase()) ||
    r.nick_name.toLowerCase().includes(search.toLowerCase()) || r.original_name.toLowerCase().includes(search.toLowerCase())
  );

  const paged = usePaged(filtered, 50);
  if (loading || error) return <LoadState loading={loading} error={error} />;

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
            {paged.rows.map(r => (
              <tr key={r.id} className="hover:bg-slate-50 transition-colors cursor-pointer group" onClick={() => navigate(`/receipts/${r.id}`)}>
                <Td className="font-medium text-slate-900">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-slate-400" />
                    {r.challan_no}
                  </div>
                </Td>
                <Td>{fmtDate(r.date)}</Td>
                <Td>
                  <div>{r.po_no}</div>
                  <div className="text-xs text-slate-500">{r.original_name}</div>
                </Td>
                <Td>{r.weaver_name}</Td>
                <Td>
                  {r.destination === 'MILL' ? 
                    <span className="inline-flex items-center text-sky-600 text-xs font-medium bg-sky-50 px-2 py-1 rounded"><ShieldCheck className="w-3.5 h-3.5 mr-1" /> {r.mill_name || 'Mill'}</span> : 
                    <span className="inline-flex items-center text-slate-600 text-xs font-medium bg-slate-100 px-2 py-1 rounded"><MapPin className="w-3.5 h-3.5 mr-1" /> {r.branch_name || 'Godown'}</span>
                  }
                </Td>
                <Td className="text-right font-medium">{r.taka_count}</Td>
                <Td className="text-right">{fmtM(r.total_m)} m</Td>
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
        <Pager paged={paged} />
      </Card>
    </div>
  );
}
