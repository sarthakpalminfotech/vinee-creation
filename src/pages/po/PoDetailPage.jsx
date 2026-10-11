import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageHeader, Card, Button, Badge, Table, Th, Td, Drawer } from '../../components/ui';
import { ArrowLeft, CheckCircle, Package, MapPin, ExternalLink, ShieldCheck } from 'lucide-react';
import * as repo from '../../db/repo';

export default function PoDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [po, setPo] = useState(null);

  const load = async () => {
    try {
      const data = await repo.getPO(id);
      if (!data) return navigate('/po');
      setPo(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const handleClosePo = async () => {
    if (!confirm('Are you sure you want to manually close this PO? It will be marked as Completed.')) return;
    try {
      await repo.setPOClosed(id, true);
      load();
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading || !po) return <div className="p-12 text-center text-slate-500">Loading...</div>;

  const isCompleted = po.status === 'COMPLETED';
  const progressColor = isCompleted ? 'text-emerald-500' : 'text-primary-500';

  return (
    <Drawer isOpen={true} onClose={() => navigate('/po')}>
      <div className="space-y-6 max-w-5xl mx-auto">
      <PageHeader 
        title={`PO ${po.po_no}`}
        description={`Created on ${new Date(po.po_date).toLocaleDateString()}`}
      >
        <Button variant="ghost" onClick={() => navigate('/po')}><ArrowLeft className="w-4 h-4 mr-2" /> Back</Button>
        {!isCompleted && <Button variant="outline" onClick={handleClosePo}><CheckCircle className="w-4 h-4 mr-2" /> Close PO Short</Button>}
        <Button onClick={() => navigate(`/receipts/new?po_id=${po.id}`)} disabled={isCompleted}>
          <Package className="w-4 h-4 mr-2" /> Receive Challan
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 md:col-span-2 space-y-6">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-xl font-bold text-slate-900">{po.group_name}</h3>
              <p className="text-slate-500">{po.nick_name} <span className="text-xs">({po.original_name})</span></p>
            </div>
            {isCompleted ? <Badge variant="success">Completed</Badge> : (po.status === 'PARTIAL' ? <Badge variant="warning">Partial</Badge> : <Badge variant="primary">Open</Badge>)}
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-slate-50 p-3 rounded-lg">
              <div className="text-xs text-slate-500 mb-1">Ordered Meters</div>
              <div className="font-semibold text-slate-900">{po.meters.toLocaleString()}</div>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg">
              <div className="text-xs text-slate-500 mb-1">Rate (₹)</div>
              <div className="font-semibold text-slate-900">{po.rate} /m</div>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg">
              <div className="text-xs text-slate-500 mb-1">Taka Length</div>
              <div className="font-semibold text-slate-900">{po.taka_length}m</div>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg">
              <div className="text-xs text-slate-500 mb-1">Expected Takas</div>
              <div className="font-semibold text-slate-900">~{po.expected_takas}</div>
            </div>
          </div>
          
          {po.notes && (
            <div className="text-sm bg-amber-50 text-amber-800 p-3 rounded-lg border border-amber-100">
              <strong className="block mb-1">Notes</strong>
              {po.notes}
            </div>
          )}
        </Card>

        <Card className="p-6 flex flex-col items-center justify-center text-center">
          <div className="relative w-32 h-32 flex items-center justify-center mb-4">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              <path className="text-slate-100" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
              <path className={`${progressColor} transition-all duration-1000 ease-out`} strokeDasharray={`${Math.min(100, po.pct)}, 100`} strokeWidth="3" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-slate-900">{Math.round(po.pct)}%</span>
              <span className="text-xs text-slate-500">received</span>
            </div>
          </div>
          
          <div className="w-full space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Received</span>
              <span className="font-medium text-slate-900">{po.received_m.toLocaleString()} m</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Pending</span>
              <span className="font-medium text-slate-900">{po.pending_m.toLocaleString()} m</span>
            </div>
            {isCompleted && po.shortfall > 0 && (
              <div className="flex justify-between text-amber-600 font-medium pt-2 border-t border-slate-100">
                <span>Shortfall</span>
                <span>{po.shortfall.toLocaleString()} m</span>
              </div>
            )}
          </div>
        </Card>
      </div>

      <Card>
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-xl">
          <h3 className="font-semibold text-slate-900">Receipts ({po.receipt_count})</h3>
        </div>
        <Table>
          <thead>
            <tr>
              <Th>Date</Th>
              <Th>Challan No</Th>
              <Th>Weaver Firm</Th>
              <Th>Destination</Th>
              <Th className="text-right">Takas</Th>
              <Th className="text-right">Meters</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {po.receipts?.map(r => (
              <tr key={r.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => navigate(`/receipts/${r.id}`)}>
                <Td>{new Date(r.date).toLocaleDateString()}</Td>
                <Td className="font-medium">{r.challan_no}</Td>
                <Td>{r.weaver_name}</Td>
                <Td>
                  {r.destination === 'MILL' ? 
                    <span className="inline-flex items-center text-sky-600 text-xs font-medium"><ShieldCheck className="w-3.5 h-3.5 mr-1" /> {r.mill_name || 'Mill'}</span> : 
                    <span className="inline-flex items-center text-slate-600 text-xs font-medium"><MapPin className="w-3.5 h-3.5 mr-1" /> Godown</span>
                  }
                </Td>
                <Td className="text-right font-medium">{r.taka_count}</Td>
                <Td className="text-right">{r.total_m.toLocaleString()}</Td>
                <Td className="text-right"><ExternalLink className="w-4 h-4 text-slate-400 inline" /></Td>
              </tr>
            ))}
            {(!po.receipts || po.receipts.length === 0) && (
              <tr>
                <Td colSpan={7} className="py-8 text-center text-slate-500">
                  No receipts yet. Click "Receive Challan" to add one.
                </Td>
              </tr>
            )}
          </tbody>
        </Table>
      </Card>
      </div>
    </Drawer>
  );
}
