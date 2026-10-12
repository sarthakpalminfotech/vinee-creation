import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageHeader, Card, Button, Badge, Table, Th, Td, Drawer, Alert } from '../../components/ui';
import { fmtM, fmtPct, fmtDate } from '../../lib/format';
import { ArrowLeft, CheckCircle, Package, MapPin, ExternalLink, ShieldCheck, Pencil } from 'lucide-react';
import * as repo from '../../db/repo';
import { useDbVersion } from '../../lib/live';
import { DetailList, Progress } from '../../components/kit';

export default function PoDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [po, setPo] = useState(null);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const data = await repo.getPO(id);
      if (!data) return navigate('/po');
      setPo(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const dbVersion = useDbVersion();
  useEffect(() => {
    load();
  }, [id, dbVersion]);

  const handleClosePo = async () => {
    if (!confirm('Close this PO short? No further challans can be received until you re-open it.')) return;
    try {
      await repo.setPOClosed(id, true);
      load();
    } catch (err) {
      setError(err.message);
    }
  };
  const handleReopen = async () => {
    try { await repo.setPOClosed(id, false); load(); } catch (err) { setError(err.message); }
  };

  if (loading || !po) return <Drawer isOpen onClose={() => navigate('/po')}>{error ? <Alert>{error}</Alert> : <div className="p-12 text-center text-slate-500">Loading...</div>}</Drawer>;

  const isCompleted = po.status === 'RECEIVED' || po.status === 'CLOSED';
  const meta = repo.PO_STATUS_META[po.status];
  const progressColor = isCompleted ? 'text-emerald-500' : 'text-primary-500';

  return (
    <Drawer isOpen={true} onClose={() => navigate('/po')}>
      <div className="space-y-6 max-w-5xl mx-auto">
      <PageHeader 
        title={`PO ${po.po_no}`}
        description={`Created on ${fmtDate(po.po_date)}`}
      >
        <Button variant="ghost" onClick={() => navigate('/po')}><ArrowLeft className="w-4 h-4 mr-2" /> Back</Button>
        <Button variant="outline" onClick={() => navigate(`/po/${id}/edit`)}><Pencil className="w-4 h-4 mr-2" /> Edit</Button>
        {po.closed ? <Button variant="outline" onClick={handleReopen}>Re-open PO</Button> : (po.status !== 'RECEIVED' && <Button variant="outline" onClick={handleClosePo}><CheckCircle className="w-4 h-4 mr-2" /> Close PO short</Button>)}
        <Button onClick={() => navigate(`/receipts/new?po_id=${po.id}`)} disabled={!!po.closed}>
          <Package className="w-4 h-4 mr-2" /> Receive Challan
        </Button>
      </PageHeader>

      <Alert>{error}</Alert>
      <Card className="p-6 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-slate-900">{po.group_name}</h2>
            <div className="text-sm text-slate-500">{po.original_name} ({po.nick_name})</div>
          </div>
          <Badge variant={meta.variant}>{meta.label}</Badge>
        </div>
        <DetailList items={[
          { label: 'PO date', value: fmtDate(po.po_date) },
          { label: 'Due date', value: po.due_date ? fmtDate(po.due_date) : null },
          { label: 'Ordered meters', value: `${fmtM(po.meters)} m` },
          { label: 'Received meters', value: `${fmtM(po.received_m)} m` },
          { label: 'Pending meters', value: `${fmtM(po.pending_m)} m` },
          { label: 'Rate', value: `₹${po.rate} / m` },
          { label: 'Taka length', value: `${po.taka_length} m` },
          { label: 'Expected takas', value: `~${po.expected_takas}` },
          { label: po.shortfall >= 0 ? 'Weaver shrinkage' : 'Excess received', value: isCompleted ? `${fmtM(Math.abs(po.shortfall))} m (${fmtPct(Math.abs(po.shortfall_pct))})` : null },
          { label: 'Notes', value: po.notes, wide: true },
        ]} />
        <Progress label="Received" pct={po.pct} tone={isCompleted ? 'emerald' : 'primary'} />
      </Card>

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
                <Td>{fmtDate(r.date)}</Td>
                <Td className="font-medium">{r.challan_no}</Td>
                <Td>{r.weaver_name}</Td>
                <Td>
                  {r.destination === 'MILL' ? 
                    <span className="inline-flex items-center text-sky-600 text-xs font-medium"><ShieldCheck className="w-3.5 h-3.5 mr-1" /> {r.mill_name || 'Mill'}</span> : 
                    <span className="inline-flex items-center text-slate-600 text-xs font-medium"><MapPin className="w-3.5 h-3.5 mr-1" /> Godown</span>
                  }
                </Td>
                <Td className="text-right font-medium">{r.taka_count}</Td>
                <Td className="text-right">{fmtM(r.total_m)}</Td>
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
