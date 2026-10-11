import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageHeader, Card, Button, Badge, Table, Th, Td, Drawer } from '../../components/ui';
import { ArrowLeft, ShoppingCart, CheckCircle, PackageSearch } from 'lucide-react';
import * as repo from '../../db/repo';

export default function OrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState(null);

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

  useEffect(() => {
    load();
  }, [id]);

  const handleAllocate = async (lineId) => {
    try {
      await repo.allocateOrder(id);
      load();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleClose = async () => {
    if (!confirm('Close this order manually?')) return;
    try {
      await repo.closeOrder(id);
      load();
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading || !order) return <div className="p-12 text-center text-slate-500">Loading...</div>;

  return (
    <Drawer isOpen={true} onClose={() => navigate('/orders')}>
      <div className="space-y-6 max-w-5xl mx-auto">
      <PageHeader 
        title={`Order ${order.order_no}`}
        description={`Placed on ${new Date(order.date).toLocaleDateString()}`}
      >
        <Button variant="ghost" onClick={() => navigate('/orders')}><ArrowLeft className="w-4 h-4 mr-2" /> Back</Button>
        {order.status !== 'DONE' && <Button variant="outline" onClick={handleClose}><CheckCircle className="w-4 h-4 mr-2" /> Close Order</Button>}
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="p-6 md:col-span-3">
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center">
                <ShoppingCart className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">{order.customer_name}</h3>
                <p className="text-slate-500 text-sm">{order.customer_city}</p>
              </div>
            </div>
            {order.status === 'DONE' ? <Badge variant="success">Completed</Badge> : <Badge variant="primary">Open</Badge>}
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-slate-50 p-4 rounded-xl">
              <div className="text-sm text-slate-500 mb-1">Quality</div>
              <div className="text-lg font-bold text-slate-900">{order.nick_name}</div>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl">
              <div className="text-sm text-slate-500 mb-1">Ordered Takas</div>
              <div className="text-2xl font-bold text-slate-900">{order.total_takas}</div>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl">
              <div className="text-sm text-slate-500 mb-1">Allocated</div>
              <div className="text-2xl font-bold text-slate-900 text-emerald-600">{order.allocated}</div>
            </div>
          </div>
          
          {order.notes && (
            <div className="mt-4 text-sm bg-slate-100 text-slate-700 p-4 rounded-xl border border-slate-200">
              <strong className="block mb-1">Notes</strong>
              {order.notes}
            </div>
          )}
        </Card>

        <Card className="p-6 flex flex-col items-center justify-center text-center">
          <div className="relative w-32 h-32 flex items-center justify-center mb-4">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              <path className="text-slate-100" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
              <path className="text-emerald-500 transition-all duration-1000 ease-out" strokeDasharray={`${Math.min(100, (order.allocated / order.total_takas) * 100 || 0)}, 100`} strokeWidth="3" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-slate-900">{Math.round((order.allocated / order.total_takas) * 100) || 0}%</span>
              <span className="text-xs text-slate-500">allocated</span>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-xl">
          <h3 className="font-semibold text-slate-900">Order Items</h3>
        </div>
        <Table>
          <thead>
            <tr>
              <Th className="w-20 text-center">Swatch</Th>
              <Th>Shade No</Th>
              <Th>Name</Th>
              <Th className="text-right">Ordered Takas</Th>
              <Th className="text-right">Allocated</Th>
              <Th className="text-right">Status</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {order.lines?.map((l) => {
              const done = l.allocated >= l.taka_count;
              return (
                <tr key={l.id} className="hover:bg-slate-50">
                  <Td className="text-center">
                    <div className="w-8 h-8 mx-auto rounded-md shadow-inner border border-slate-200" style={{ backgroundColor: l.hex || '#ccc' }} />
                  </Td>
                  <Td className="font-bold text-slate-900">{l.shade_no}</Td>
                  <Td className="text-slate-600 font-medium">{l.shade_name || '-'}</Td>
                  <Td className="text-right font-medium">{l.taka_count}</Td>
                  <Td className="text-right font-medium text-emerald-600">{l.allocated}</Td>
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
      </div>
    </Drawer>
  );
}
