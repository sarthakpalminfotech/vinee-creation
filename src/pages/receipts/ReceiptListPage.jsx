import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader, Card, Button, Input, Table, Th, Td, Empty, LoadState, Pager, usePaged } from '../../components/ui';
import { fmtM, fmtDate } from '../../lib/format';
import { Plus, FileText, MapPin, ShieldCheck } from 'lucide-react';
import * as repo from '../../db/repo';
import { useDbVersion } from '../../lib/live';
import { Qty } from '../../components/kit';
import { SearchToggle, ListFilter, uniqueOptions, inDateRange } from '../../components/kit';

export default function ReceiptListPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [receipts, setReceipts] = useState([]);
  const [search, setSearch] = useState('');
  const [flt, setFlt] = useState({});
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

  const searched = receipts.filter(r => 
    r.challan_no.toLowerCase().includes(search.toLowerCase()) || 
    r.po_no.toLowerCase().includes(search.toLowerCase()) || 
    r.weaver_name.toLowerCase().includes(search.toLowerCase()) ||
    r.nick_name.toLowerCase().includes(search.toLowerCase()) || r.original_name.toLowerCase().includes(search.toLowerCase())
  );

  const filtered = searched.filter(r => (!flt.weaver_id || String(r.weaver_id) === flt.weaver_id) && (!flt.po_id || String(r.po_id) === flt.po_id) && (!flt.quality_id || String(r.quality_id) === flt.quality_id) && (!flt.destination || r.destination === flt.destination) && (!flt.branch_id || String(r.branch_id) === flt.branch_id) && inDateRange(r.date, flt));
  const paged = usePaged(filtered, 50);
  if (loading || error) return <LoadState loading={loading} error={error} />;

  return (
    <div className="space-y-6">
      <PageHeader title="Grey Challans (Receipts)" description="Manage incoming grey fabric from weavers.">
        <ListFilter values={flt} onChange={setFlt} fields={[{ key: 'weaver_id', label: 'Associated party', options: uniqueOptions(receipts, (x) => x.weaver_id, (x) => x.weaver_name) }, { key: 'po_id', label: 'PO', options: uniqueOptions(receipts, (x) => x.po_id, (x) => x.po_no) }, { key: 'quality_id', label: 'Quality', options: uniqueOptions(receipts, (x) => x.quality_id, (x) => x.nick_name) }, { key: 'destination', label: 'Destination', options: [['GODOWN', 'Our godown'], ['MILL', 'Direct to mill']] }, { key: 'branch_id', label: 'Branch', options: uniqueOptions(receipts, (x) => x.branch_id, (x) => x.branch_name) }]} />
        <SearchToggle value={search} onChange={setSearch} placeholder="Search challan, PO, weaver or quality..." />
        <Button onClick={() => navigate('/receipts/new')}><Plus className="w-4 h-4 mr-2" /> Receive Challan</Button>
      </PageHeader>

      <Card>
        <Table>
          <thead>
            <tr>
              <Th>Challan No</Th>
              <Th className="hidden xl:table-cell">Date</Th>
              <Th>PO & Quality</Th>
              <Th>Associated party</Th>
              <Th>Destination</Th>
              <Th className="text-right">Quantity</Th>
            </tr>
          </thead>
          <tbody>
            {paged.rows.map(r => (
              <tr key={r.id} className="hover:bg-slate-50 transition-colors cursor-pointer group" onClick={() => navigate(`/receipts/${r.id}`)}>
                <Td className="font-semibold text-slate-900">
                  <div className="flex items-center gap-2">
                    <FileText className="hidden xl:block w-4 h-4 text-slate-400" />
                    {r.challan_no}
                  </div>
                  {/* tablets: the date sits under the challan number instead of taking its own column */}
                  <div className="xl:hidden text-xs font-normal text-slate-500">{fmtDate(r.date)}</div>
                </Td>
                <Td className="hidden xl:table-cell">{fmtDate(r.date)}</Td>
                <Td>
                  <div className="font-medium text-slate-900">{r.po_no}</div>
                  <div className="text-xs text-slate-500">{r.original_name}</div>
                </Td>
                <Td className="font-medium text-slate-900">{r.weaver_name}</Td>
                <Td>
                  {r.destination === 'MILL' ? 
                    <span className="inline-flex items-center text-sky-700 text-xs font-medium bg-sky-50 px-2 py-1 rounded-full"><ShieldCheck className="w-3.5 h-3.5 mr-1" /> {r.mill_name || 'Mill'}</span> : 
                    <span className="inline-flex items-center text-slate-600 text-xs font-medium bg-slate-100 px-2 py-1 rounded-full"><MapPin className="w-3.5 h-3.5 mr-1" /> {r.branch_name || 'Godown'}</span>
                  }
                </Td>
                <Td><Qty variant="cell" takas={r.taka_count} meters={r.total_m} /></Td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <Td colSpan={7} className="py-12">
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
