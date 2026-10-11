import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageHeader, Card, Button, Badge, Table, Th, Td, Drawer } from '../../components/ui';
import { ArrowLeft, MapPin, ShieldCheck, FileText, CheckCircle2 } from 'lucide-react';
import * as repo from '../../db/repo';

export default function ReceiptDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [receipt, setReceipt] = useState(null);

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
  }, [id]);

  if (loading || !receipt) return <div className="p-12 text-center text-slate-500">Loading...</div>;

  const isMill = receipt.destination === 'MILL';

  return (
    <Drawer isOpen={true} onClose={() => navigate('/receipts')}>
      <div className="space-y-6 max-w-5xl mx-auto">
        <PageHeader 
          title={`Challan ${receipt.challan_no}`}
          description={`Received on ${new Date(receipt.date).toLocaleDateString()}`}
        >
          <Button variant="ghost" onClick={() => navigate('/receipts')}><ArrowLeft className="w-4 h-4 mr-2" /> Back</Button>
        </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 md:col-span-2 space-y-6">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-xl font-bold text-slate-900">{receipt.weaver_name}</h3>
              <p className="text-slate-500">Group: {receipt.group_name}</p>
            </div>
            {isMill ? 
              <Badge variant="primary" className="bg-sky-50 text-sky-700">Sent Direct to Mill</Badge> : 
              <Badge variant="gray">Godown Storage</Badge>
            }
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-slate-50 p-3 rounded-lg">
              <div className="text-xs text-slate-500 mb-1">PO Number</div>
              <div className="font-semibold text-slate-900 cursor-pointer text-primary-600 hover:underline" onClick={() => navigate(`/po/${receipt.po_id}`)}>{receipt.po_no}</div>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg">
              <div className="text-xs text-slate-500 mb-1">Quality</div>
              <div className="font-semibold text-slate-900">{receipt.original_name}</div>
              <div className="text-xs text-slate-500">nickname: {receipt.nick_name}</div>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg">
              <div className="text-xs text-slate-500 mb-1">Destination</div>
              <div className="font-semibold text-slate-900 flex items-center">
                {isMill ? <><ShieldCheck className="w-3.5 h-3.5 mr-1 text-sky-500" /> {receipt.mill_name}</> : <><MapPin className="w-3.5 h-3.5 mr-1 text-slate-500" /> Godown</>}
              </div>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg">
              <div className="text-xs text-slate-500 mb-1">Total Meters</div>
              <div className="font-semibold text-slate-900">{receipt.total_m.toLocaleString()} m</div>
            </div>
          </div>
          
          {receipt.notes && (
            <div className="text-sm bg-amber-50 text-amber-800 p-3 rounded-lg border border-amber-100">
              <strong className="block mb-1">Notes</strong>
              {receipt.notes}
            </div>
          )}
        </Card>

        <Card className="p-6 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="text-2xl font-bold text-slate-900 mb-1">{receipt.taka_count}</h3>
          <p className="text-slate-500 text-sm">Takas Received</p>
          
          {!isMill && receipt.unassigned_count > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100 w-full">
              <div className="text-xs font-medium text-amber-600 bg-amber-50 py-1.5 px-3 rounded-full inline-block">
                {receipt.unassigned_count} unassigned to rack
              </div>
            </div>
          )}
        </Card>
      </div>

      <Card>
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-xl">
          <h3 className="font-semibold text-slate-900">Takas Detail</h3>
        </div>
        <div className="max-h-[600px] overflow-y-auto">
          <Table>
            <thead className="sticky top-0 bg-white shadow-sm z-10">
              <tr>
                <Th>Taka No</Th>
                <Th>Meters</Th>
                <Th>vs nominal</Th>
                <Th>Status</Th>
                <Th>Location/Mill</Th>
              </tr>
            </thead>
            <tbody>
              {receipt.takas?.map(t => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <Td className="font-medium text-slate-900">{t.taka_no}</Td>
                  <Td>{t.grey_meter} m</Td>
                  <Td>
                    {t.weaverLoss === null ? '-' : (
                      <span className={`text-xs font-medium ${t.weaverLoss > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                        {t.weaverLoss > 0 ? `-${t.weaverLoss}m` : `+${Math.abs(t.weaverLoss)}m`}
                      </span>
                    )}
                  </Td>
                  <Td>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${repo.STATUS_META[t.status]?.cls || 'bg-slate-100 text-slate-700'}`}>
                      {repo.STATUS_META[t.status]?.label || t.status}
                    </span>
                  </Td>
                  <Td>
                    {t.status === 'GODOWN_GREY' ? (
                      t.location_id ? <span className="text-sm text-slate-700">{repo.locLabel(t.shop, t.rack)}</span> : <span className="text-xs text-amber-600 font-medium">Unassigned</span>
                    ) : (
                      t.mill_id ? <span className="text-sm text-slate-700">{t.mill_name}</span> : '-'
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
