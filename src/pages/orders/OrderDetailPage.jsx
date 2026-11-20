import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { PageHeader, Card, Button, Badge, Table, Th, Td, Drawer, Alert } from '../../components/ui';
import { fmtM } from '../../lib/format';
import { ArrowLeft, ShoppingCart, CheckCircle, PackageSearch, Pencil, HandCoins } from 'lucide-react';
import OrderStock from './OrderStock';
import { OrderPaymentsCard } from './OrderPayments';
import * as repo from '../../db/repo';
import { useDbVersion, useBackTo } from '../../lib/live';
import { Qty, Chip } from '../../components/kit';
import { DetailList, Progress, ShadeSwatch } from '../../components/kit';
import { fmtDate } from '../../lib/format';

export default function OrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const back = useBackTo('/orders');
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState(null);
  const [msg, setMsg] = useState({ tone: 'error', text: '' });

  const load = async () => {
    try {
      const data = await repo.getOrder(id);
      if (!data) return navigate('/orders');
      setOrder(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const dbVersion = useDbVersion();
  useEffect(() => {
    load();
  }, [id, dbVersion]);

  const handleAllocate = async (lineId) => {
    try {
      setMsg({ tone: 'error', text: '' });
      const res = await repo.allocateOrder(id);
      setMsg({ tone: res.short ? 'info' : 'success', text: res.allocated ? `${res.allocated} taka(s) allocated${res.short ? `; ${res.short} line(s) could not be fully covered — not enough ready (folded) stock.` : '.'}` : 'No ready (folded) stock is available for the pending lines.' });
      load();
    } catch (err) {
      setMsg({ tone: 'error', text: err.message });
    }
  };

  const handleClose = async () => {
    if (!confirm('Close this order manually?')) return;
    try {
      await repo.closeOrder(id);
      load();
    } catch (err) {
      setMsg({ tone: 'error', text: err.message });
    }
  };

  if (loading || !order) return <div className="p-12 text-center text-slate-500">Loading...</div>;

  // progress: by takas when the order has takas, otherwise by meters
  const pct = order.total_takas > 0 ? Math.min(100, (order.allocated / order.total_takas) * 100) : order.total_meters > 0 ? Math.min(100, (order.allocated_m / order.total_meters) * 100) : 0;

  return (
    <Drawer isOpen={true} onClose={() => navigate('/orders')}>
      <div className="space-y-6 page-w">
      <PageHeader 
        title={`Order ${order.order_no}`}
        description={`Placed on ${new Date(order.date).toLocaleDateString()}`}
        onBack={back}
      >
        {order.status !== 'DONE' && <Button onClick={() => navigate(`/inventory/withdraw/fg-order?order=${id}`)}><HandCoins className="w-4 h-4 mr-2" /> Allocate now</Button>}
        <Button variant="outline" onClick={() => navigate(`/orders/${id}/edit`)}><Pencil className="w-4 h-4 mr-2" /> Edit</Button>
        {order.status !== 'DONE' && <Button variant="outline" onClick={handleClose}><CheckCircle className="w-4 h-4 mr-2" /> Close Order</Button>}
      </PageHeader>

      <Alert tone={msg.tone}>{msg.text}</Alert>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.8fr)] xl:items-start">
      <div className="space-y-6 min-w-0">
      <Card className="p-6 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-forest">{order.customer_name}</h2>
            <div className="text-sm text-slate-500">{order.customer_city}</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {Number(order.job_work) === 1 && <Chip tone="amber">Job work: {order.job_type || 'required'}</Chip>}
            {order.status === 'DONE' ? <Badge variant="success">Completed</Badge> : <Badge variant="primary">Open</Badge>}
          </div>
        </div>
        <DetailList items={[
          { label: 'Order date', value: fmtDate(order.date) },
          { label: 'Quality', value: order.nick_name },
          { label: 'Ordered takas', value: order.total_takas > 0 ? order.total_takas : null },
          { label: 'Ordered meters', value: order.total_meters > 0 ? `${fmtM(order.total_meters)} m` : null },
          { label: 'Allocated takas', value: order.allocated },
          { label: 'Allocated meters', value: `${fmtM(order.allocated_m)} m` },
          { label: 'Rate', value: order.rate != null ? `₹${Number(order.rate).toLocaleString('en-IN')} / m` : null },
          { label: 'Job work note', value: Number(order.job_work) === 1 ? order.job_notes : null, wide: true },
          { label: 'Notes', value: order.notes, wide: true },
        ]} />
        <Progress label="Allocated" pct={pct} tone="emerald" />
      </Card>

      <Card>
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-xl">
          <h3 className="font-bold text-forest">Order Colours</h3>
        </div>
        <Table className="whitespace-normal">
          <thead>
            <tr>
              <Th className="w-20 text-center">Colour</Th>
              <Th>Shade</Th>
              <Th className="text-right">Ordered</Th>
              <Th className="text-right">Allocated</Th>
              <Th className="text-right">Status</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {order.lines?.map((l) => {
              const done = repo.orderLineDone(l);
              return (
                <tr key={l.id} className="hover:bg-slate-50">
                  <Td className="text-center">
                    <div className="w-9 h-9 mx-auto"><ShadeSwatch hex={l.hex} image={l.shade_image} size="xl" shape="square" /></div>
                  </Td>
                  <Td className="font-semibold text-slate-900">{l.shade_no}{l.shade_name ? <span className="font-normal text-slate-500"> · {l.shade_name}</span> : ''}</Td>
                  <Td><Qty variant="cell" takas={l.taka_count > 0 ? l.taka_count : null} meters={l.meters > 0 ? l.meters : null} /></Td>
                  <Td><Qty variant="cell" tone="emerald" takas={l.allocated} meters={l.allocated_m} /></Td>
                  <Td className="text-right">
                    {done ? <span className="text-xs font-bold text-emerald-500 uppercase">Fulfilled</span> : <span className="text-xs font-bold text-amber-500 uppercase">Pending</span>}
                  </Td>
                  <Td className="text-right">
                    {!done && (
                      <Button size="sm" variant="outline" onClick={() => handleAllocate(l.id)}>
                        <PackageSearch className="w-3.5 h-3.5 mr-1.5" /> Auto-Allocate
                      </Button>
                    )}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>

      <OrderPaymentsCard order={order} onChanged={load} />

      {Number(order.job_work) === 1 && (
        <Card>
          <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-xl">
            <h3 className="font-bold text-forest">Job work challans</h3>
            <Button size="sm" variant="outline" onClick={() => navigate(`/job-work/new?order=${order.id}`)}>New job work</Button>
          </div>
          {order.jobWorks.length === 0 ? <div className="p-5 text-sm text-slate-500">No job work challan is linked to this order yet. Link one from the Job Work module.</div> : (
            <Table className="whitespace-normal">
              <thead><tr><Th>Challan</Th><Th>Job worker</Th><Th>Status</Th><Th className="text-right">Sent</Th><Th className="text-right">Received</Th><Th className="text-right">Pending</Th></tr></thead>
              <tbody>
                {order.jobWorks.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <Td className="font-semibold"><Link className="text-primary-700 hover:underline" to={`/job-work/${c.id}`}>{c.jw_label}</Link></Td>
                    <Td>{c.worker_name}{c.job_type ? <span className="text-slate-500"> · {c.job_type}</span> : ''}</Td>
                    <Td><Badge variant={repo.JW_STATUS_META[c.status].variant}>{repo.JW_STATUS_META[c.status].label}</Badge></Td>
                    <Td><Qty variant="cell" takas={c.sent_takas} meters={c.sent_m} /></Td>
                    <Td><Qty variant="cell" tone="emerald" takas={c.received_takas} meters={c.received_m} /></Td>
                    <Td><Qty variant="cell" tone="amber" takas={c.pending_takas} meters={c.pending_m} /></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      )}
      </div>
      <section className="min-w-0 space-y-3">
        <h3 className="text-base font-bold text-forest">Available stock</h3>
        <OrderStock orderId={order.id} />
      </section>
      </div>
      </div>
    </Drawer>
  );
}
