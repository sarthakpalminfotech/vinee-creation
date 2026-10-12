import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader, Card, Button, Input, Table, Th, Td, Badge, Empty, LoadState, Pager, usePaged } from '../../components/ui';
import { fmtM, fmtDate } from '../../lib/format';
import { Plus, Search, ChevronRight, ShoppingCart } from 'lucide-react';
import * as repo from '../../db/repo';
import { useDbVersion } from '../../lib/live';

export default function OrderListPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const dbVersion = useDbVersion();
  useEffect(() => {
    async function load() {
      try {
        const data = await repo.listOrders();
        setOrders(data);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [dbVersion]);

  const filtered = orders.filter(o => 
    o.order_no.toLowerCase().includes(search.toLowerCase()) || 
    o.customer_name.toLowerCase().includes(search.toLowerCase()) ||
    o.nick_name.toLowerCase().includes(search.toLowerCase())
  );

  const getStatusBadge = (status) => {
    if (status === 'DONE') return <Badge variant="success">Completed</Badge>;
    return <Badge variant="primary">Open</Badge>;
  };

  const paged = usePaged(filtered, 50);
  if (loading || error) return <LoadState loading={loading} error={error} />;

  return (
    <div className="space-y-6">
      <PageHeader title="Customer Orders" description="Manage sales orders and allocate ready takas.">
        <Button onClick={() => navigate('/orders/new')}><Plus className="w-4 h-4 mr-2" /> New Order</Button>
      </PageHeader>

      <Card className="p-4 bg-slate-50 border-b-0 rounded-b-none">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input 
            className="pl-9 bg-white" 
            placeholder="Search order no, customer, or quality..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </Card>

      <Card className="rounded-t-none border-t-0">
        <Table>
          <thead>
            <tr>
              <Th>Order No</Th>
              <Th>Date</Th>
              <Th>Customer</Th>
              <Th>Quality</Th>
              <Th className="text-right">Ordered</Th>
              <Th className="text-right">Allocated</Th>
              <Th>Status</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {paged.rows.map(o => (
              <tr key={o.id} className="hover:bg-slate-50 transition-colors cursor-pointer group" onClick={() => navigate(`/orders/${o.id}`)}>
                <Td className="font-medium text-slate-900">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="w-4 h-4 text-slate-400" />
                    {o.order_no}
                  </div>
                </Td>
                <Td>{fmtDate(o.date)}</Td>
                <Td>
                  <div className="font-medium text-slate-900">{o.customer_name}</div>
                  <div className="text-xs text-slate-500">{o.customer_city}</div>
                </Td>
                <Td>
                  <div className="font-medium text-slate-900">{o.nick_name}</div>
                </Td>
                <Td className="text-right font-medium">{o.total_takas > 0 ? `${o.total_takas} tk` : ''}{o.total_takas > 0 && o.total_meters > 0 ? ' · ' : ''}{o.total_meters > 0 ? `${fmtM(o.total_meters)} m` : ''}</Td>
                <Td className="text-right">
                  <span className={`font-medium ${o.lines.length > 0 && o.lines.every(repo.orderLineDone) ? 'text-emerald-600' : 'text-slate-600'}`}>
                    {o.allocated} tk{o.total_meters > 0 ? ` · ${fmtM(o.allocated_m)} m` : ''}
                  </span>
                </Td>
                <Td>{getStatusBadge(o.status)}</Td>
                <Td className="text-right">
                  <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-primary-600 inline-block" />
                </Td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <Td colSpan={8} className="py-12">
                  <Empty title="No orders found" description="Create a new sales order for a customer." />
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
