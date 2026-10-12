import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { PageHeader, Card, Button, Input, Select, Field, Empty, Alert, useAction } from '../../components/ui';
import { AvailabilityPanel, useAvailability } from './AvailabilityPanel';
import { fmtM } from '../../lib/format';
import { ArrowLeft, Save, Plus, Trash2 } from 'lucide-react';
import * as repo from '../../db/repo';

const lineId = () => Math.random().toString(36).substr(2, 9);

/** Create a customer order, or (route /orders/:id/edit) change an existing one. Lines are item codes asked in takas, meters, or both. */
export default function CreateOrderPage() {
  const navigate = useNavigate();
  const { id: editId } = useParams();
  const isEdit = !!editId;
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [qualities, setQualities] = useState([]);
  const [items, setItems] = useState([]);
  const [locked, setLocked] = useState(false); // stock already allocated: quality + lines can no longer change

  const [formData, setFormData] = useState({
    order_no: '',
    customer_id: '',
    quality_id: '',
    date: new Date().toISOString().slice(0, 10),
    notes: ''
  });

  const [lines, setLines] = useState([]);
  const [loadError, setLoadError] = useState('');
  const { busy, error, run } = useAction();

  useEffect(() => {
    async function load() {
      try {
        const [custs, quals, allItems] = await Promise.all([repo.listCustomers(), repo.listQualities(), repo.listItems()]);
        setCustomers(custs);
        setQualities(quals);
        setItems(allItems);
        if (isEdit) {
          const o = await repo.getOrder(Number(editId));
          if (!o) throw new Error('Order not found');
          setFormData({ order_no: o.order_no, customer_id: String(o.customer_id), quality_id: String(o.quality_id), date: o.date || '', notes: o.notes || '' });
          setLocked(Number(o.allocated) > 0);
          setLines(o.lines.map((l) => {
            const item = l.item_id ? allItems.find((i) => i.id === l.item_id) : allItems.find((i) => i.quality_id === o.quality_id && i.shade_id === l.shade_id);
            return { id: lineId(), item_id: item ? String(item.id) : '', taka_count: l.taka_count ? String(l.taka_count) : '', meters: l.meters ? String(l.meters) : '' };
          }));
        } else {
          const oNo = await repo.nextOrderNo();
          setFormData(p => ({ ...p, order_no: oNo }));
        }
      } catch (e) {
        setLoadError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [editId]);

  const qualityItems = useMemo(() => items.filter(i => i.shade_id && String(i.quality_id) === formData.quality_id), [items, formData.quality_id]);
  const itemById = (id) => items.find(i => String(i.id) === String(id));

  const shadeIds = lines.map(l => itemById(l.item_id)?.shade_id).filter(Boolean);
  const { data: availability } = useAvailability(formData.quality_id, shadeIds);
  const needs = Object.fromEntries(lines.filter(l => itemById(l.item_id)).map(l => [itemById(l.item_id).shade_id, parseInt(l.taka_count) || 0]));
  const usedItems = new Set(lines.map(l => l.item_id).filter(Boolean));

  const addLine = () => setLines([...lines, { id: lineId(), item_id: '', taka_count: '', meters: '' }]);
  const removeLine = (id) => setLines(lines.filter(l => l.id !== id));
  const updateLine = (id, field, value) => setLines(lines.map(l => l.id === id ? { ...l, [field]: value } : l));

  const validLines = lines.filter(l => l.item_id && (parseInt(l.taka_count) > 0 || Number(l.meters) > 0));
  const totalTakas = lines.reduce((s, l) => s + (parseInt(l.taka_count) || 0), 0);
  const totalMeters = Math.round(lines.reduce((s, l) => s + (Number(l.meters) || 0), 0) * 100) / 100;

  const handleSave = (e) => {
    e.preventDefault();
    run(async () => {
      if (!formData.customer_id || !formData.quality_id) throw new Error('Please select customer and quality');
      if (!locked && validLines.length === 0) throw new Error('Please add at least one item line with takas or meters');
      const payload = { ...formData, lines: validLines.map(l => ({ item_id: Number(l.item_id), taka_count: l.taka_count, meters: l.meters })) };
      if (isEdit) {
        await repo.updateOrder(Number(editId), payload);
        navigate(`/orders/${editId}`);
        return;
      }
      const id = await repo.createOrder(payload);
      navigate(`/orders/${id}`);
    });
  };

  const back = isEdit ? `/orders/${editId}` : '/orders';
  if (loading || loadError) return <div className="w-full">{loading ? <div className="p-12 text-center text-slate-500">Loading...</div> : <Alert>{loadError}</Alert>}</div>;

  return (
    <div className="w-full">
      <div className="space-y-6 max-w-6xl mx-auto">
        <PageHeader
          title={isEdit ? `Edit Order ${formData.order_no}` : 'Create Sales Order'}
          description={isEdit ? 'Change the order details. Quality and lines are locked once stock was allocated.' : 'Record a new customer order — in takas, in meters, or both — and check availability.'}
        >
          <Button variant="ghost" onClick={() => navigate(back)}><ArrowLeft className="w-4 h-4 mr-2" /> Back</Button>
        </PageHeader>

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Order Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Order Number *">
                <Input required value={formData.order_no} onChange={e => setFormData(p => ({ ...p, order_no: e.target.value }))} />
              </Field>
              <Field label="Order Date *">
                <Input type="date" required value={formData.date} onChange={e => setFormData(p => ({ ...p, date: e.target.value }))} />
              </Field>
              <Field label="Customer *">
                <Select required value={formData.customer_id} onChange={e => setFormData(p => ({ ...p, customer_id: e.target.value }))}>
                  <option value="">Select Customer...</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </Field>
              <Field label="Quality *">
                <Select required disabled={locked} value={formData.quality_id} onChange={e => { setFormData(p => ({ ...p, quality_id: e.target.value })); setLines([]); }}>
                  <option value="">Select Quality...</option>
                  {qualities.map(q => <option key={q.id} value={q.id}>{q.nick_name}</option>)}
                </Select>
              </Field>
              <div className="md:col-span-2">
                <Field label="Notes (Optional)">
                  <Input value={formData.notes} onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))} />
                </Field>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Order Lines <span className="text-sm font-normal text-slate-500">(item code · takas and/or meters)</span></h3>
              <Button type="button" variant="outline" size="sm" onClick={addLine} disabled={!formData.quality_id || locked || qualityItems.length === 0}>
                <Plus className="w-4 h-4 mr-2" /> Add Line
              </Button>
            </div>
            {locked && <Alert tone="info" className="mb-3">Stock has already been allocated to this order, so its lines cannot be changed. You can still edit the number, date, customer and notes.</Alert>}

            {!formData.quality_id ? (
              <div className="py-8 text-center text-slate-500 border-2 border-dashed border-slate-200 rounded-lg">
                Select a quality to add lines.
              </div>
            ) : qualityItems.length === 0 ? (
              <div className="py-8 text-center text-slate-500 border-2 border-dashed border-amber-200 bg-amber-50 rounded-lg">
                This quality has no coloured item codes yet. Create them in <Link to="/masters/items" className="text-primary-600 underline">Masters → Items</Link>.
              </div>
            ) : (
              <div className="space-y-3">
                {lines.map((l) => {
                  const item = itemById(l.item_id);
                  const stock = item && availability ? availability.shades.find(x => x.shade_id === item.shade_id)?.finished : null;
                  const reqT = parseInt(l.taka_count) || 0;
                  const reqM = Number(l.meters) || 0;
                  const canFulfill = stock && (reqT > 0 || reqM > 0) && reqT <= stock.takas && reqM <= stock.m;

                  return (
                    <div key={l.id} className="flex flex-col sm:flex-row gap-4 items-start p-4 bg-slate-50 border border-slate-200 rounded-lg">
                      <div className="flex-1 w-full">
                        <Field label="Item code">
                          <div className="relative">
                            {item && (
                              <div className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border border-slate-200 shadow-sm"
                                style={{ backgroundColor: item.hex || '#ccc' }}
                              />
                            )}
                            <Select
                              className={item ? 'pl-9' : ''}
                              disabled={locked}
                              value={l.item_id}
                              onChange={e => updateLine(l.id, 'item_id', e.target.value)}
                            >
                              <option value="">Select item...</option>
                              {qualityItems.filter(i => String(i.id) === l.item_id || !usedItems.has(String(i.id))).map(i => <option key={i.id} value={i.id}>{i.code} · {i.shade_no}{i.shade_name ? ` ${i.shade_name}` : ''}</option>)}
                            </Select>
                          </div>
                        </Field>
                      </div>
                      <div className="w-full sm:w-28">
                        <Field label="Takas">
                          <Input type="number" min="0" step="1" disabled={locked} value={l.taka_count} onChange={e => updateLine(l.id, 'taka_count', e.target.value)} placeholder="optional" />
                        </Field>
                      </div>
                      <div className="w-full sm:w-32">
                        <Field label="Meters">
                          <Input type="number" min="0" step="0.01" disabled={locked} value={l.meters} onChange={e => updateLine(l.id, 'meters', e.target.value)} placeholder="optional" />
                        </Field>
                      </div>

                      <div className="w-full sm:w-36 pt-1 sm:pt-7">
                        {item && stock ? (
                          <div className={`text-sm font-medium ${canFulfill ? 'text-emerald-600' : 'text-amber-600'}`}>
                            Finished: {stock.takas} tk · {fmtM(stock.m)} m
                          </div>
                        ) : null}
                      </div>

                      <div className="pt-1 sm:pt-7">
                        <button type="button" disabled={locked} onClick={() => removeLine(l.id)} className="p-2 text-slate-400 hover:text-red-500 rounded-lg hover:bg-white border border-transparent hover:border-slate-200 disabled:opacity-40"><Trash2 className="w-5 h-5" /></button>
                      </div>
                    </div>
                  );
                })}
                {lines.length === 0 && (
                  <Empty title="No items added" description="Add a line for each colour (item code) the customer asked for. Enter takas, meters, or both." />
                )}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6 bg-slate-50 border-slate-200 sticky top-6">
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4">Availability Panel</h3>

            <AvailabilityPanel data={availability} needs={needs} />
            <div className="mt-4 pt-4 border-t border-slate-200 text-sm flex justify-between">
              <span className="text-slate-500">Ordered</span>
              <span className="font-semibold text-slate-900">{totalTakas} tk{totalMeters > 0 ? ` · ${fmtM(totalMeters)} m` : ''}</span>
            </div>
            <Alert className="mt-4">{error}</Alert>
            <div className="mt-8 pt-6 border-t border-slate-200">
              <Button type="submit" className="w-full h-12 text-base shadow-sm" disabled={busy || (!locked && validLines.length === 0) || !formData.customer_id}>
                <Save className="w-5 h-5 mr-2" />
                {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Create Order'}
              </Button>
            </div>
          </Card>
        </div>
      </form>
      </div>
    </div>
  );
}
