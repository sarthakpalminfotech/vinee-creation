import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageHeader, Card, Button, Badge, Table, Th, Td, Drawer } from '../../components/ui';
import { Pencil } from 'lucide-react';
import * as repo from '../../db/repo';
import { useDbVersion, useBackTo } from '../../lib/live';
import { DetailList, Progress } from '../../components/kit';
import { fmtDate, fmtM } from '../../lib/format';

export default function ReceiptDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const back = useBackTo('/receipts');
  const [loading, setLoading] = useState(true);
  const [receipt, setReceipt] = useState(null);

  const dbVersion = useDbVersion();
  useEffect(() => {
    async function load() {
      try {
        const data = await repo.getReceipt(id);
        if (!data) return navigate('/receipts');
        setReceipt(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, dbVersion]);

  if (loading || !receipt) return <div className="p-12 text-center text-slate-500">Loading...</div>;

  const isMill = receipt.destination === 'MILL';

  return (
    <Drawer isOpen={true} onClose={() => navigate('/receipts')}>
      <div className="space-y-6 page-w">
        <PageHeader
          title={`Challan ${receipt.challan_no}`}
          description={`Received on ${new Date(receipt.date).toLocaleDateString()}`}
          onBack={back}
        >
          <Button variant="outline" onClick={() => navigate(`/receipts/${id}/edit`)}><Pencil className="w-4 h-4 mr-2" /> Edit</Button>
        </PageHeader>

      <Card className="p-6 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-forest">{receipt.weaver_name}</h2>
            <div className="text-sm text-slate-500">{receipt.group_name}</div>
          </div>
          {isMill ? <Badge variant="primary" className="bg-sky-50 text-sky-700">Direct to mill</Badge> : <Badge variant="gray">Godown</Badge>}
        </div>
        <DetailList items={[
          { label: 'Date', value: fmtDate(receipt.date) },
          { label: 'PO number', value: <button type="button" className="text-primary-700 hover:underline" onClick={() => navigate(`/po/${receipt.po_id}`)}>{receipt.po_no}</button> },
          { label: 'Quality', value: receipt.original_name },
          { label: 'Nickname', value: receipt.nick_name },
          { label: isMill ? 'Mill' : 'Branch', value: isMill ? receipt.mill_name : receipt.branch_name || '—' },
          { label: 'Takas', value: receipt.taka_count },
          { label: 'Total meters', value: `${fmtM(receipt.total_m)} m` },
          { label: 'Notes', value: receipt.notes, wide: true },
        ]} />
      </Card>

      <Card>
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-xl">
          <h3 className="font-bold text-forest">Takas Detail</h3>
        </div>
        <div className="max-h-[600px] overflow-y-auto">
          <Table>
            <thead className="sticky top-0 bg-white shadow-sm z-10">
              <tr>
                <Th>Taka No</Th>
                <Th>Meters</Th>
                <Th>Status</Th>
                <Th>Branch / Mill</Th>
              </tr>
            </thead>
            <tbody>
              {receipt.takas?.map(t => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <Td className="w-24 text-xs text-slate-400">#{t.taka_no}</Td>
                  <Td className="text-base font-semibold tabular-nums text-slate-900">{fmtM(t.grey_meter)} <span className="text-[11px] font-normal text-slate-400">m</span></Td>
                  <Td>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${repo.STATUS_META[t.status]?.cls || 'bg-slate-100 text-slate-700'}`}>
                      {repo.STATUS_META[t.status]?.label || t.status}
                    </span>
                  </Td>
                  <Td>
                    {t.status === 'GODOWN_GREY' ? (
                      <span className="text-sm text-slate-700">{t.branch_name || '-'}</span>
                    ) : (
                      t.mill_id ? <span className="text-sm text-slate-700">{t.mill_name}{t.dispatch_no ? <span className="ml-2 font-semibold text-primary-700">{t.dispatch_no}</span> : null}</span> : '-'
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </Card>
      </div>
    </Drawer>
  );
}
