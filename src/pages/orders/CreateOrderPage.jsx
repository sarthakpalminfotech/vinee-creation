import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader, Card, Button, Input, Select, Field, Empty, Drawer, Alert, useAction } from '../../components/ui';
import { AvailabilityPanel, useAvailability } from './AvailabilityPanel';
import { ArrowLeft, Save, Plus, Trash2 } from 'lucide-react';
import * as repo from '../../db/repo';

export default function CreateOrderPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [qualities, setQualities] = useState([]);
  const [shades, setShades] = useState([]);
  
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
        const [oNo, custs, quals, allShades] = await Promise.all([
          repo.nextOrderNo(),
          repo.listCustomers(),
          repo.listQualities(),
          repo.listShades()
        ]);
        setFormData(p => ({ ...p, order_no: oNo }));
        setCustomers(custs);
        setQualities(quals);
        setShades(allShades);
      } catch (e) {
        setLoadError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const shadeIds = lines.map(l => Number(l.shade_id)).filter(Boolean);
  const { data: availability } = useAvailability(formData.quality_id, shadeIds);
  const needs = Object.fromEntries(lines.filter(l => l.shade_id).map(l => [Number(l.shade_id), parseInt(l.taka_count) || 0]));

  const addLine = () => setLines([...lines, { id: Math.random().toString(36).substr(2, 9), shade_id: '', taka_count: '' }]);
  const removeLine = (id) => setLines(lines.filter(l => l.id !== id));
  const updateLine = (id, field, value) => setLines(lines.map(l => l.id === id ? { ...l, [field]: value } : l));

  const handleSave = (e) => {
    e.preventDefault();
    run(async () => {
      if (!formData.customer_id || !formData.quality_id) throw new Error('Please select customer and quality');
      const validLines = lines.filter(l => l.shade_id && parseInt(l.taka_count) > 0);
      if (validLines.length === 0) throw new Error('Please add at least one valid shade line');
      const id = await repo.createOrder({ ...formData, lines: validLines });
      navigate(`/orders/${id}`);
    });
  };

  const totalTakas = lines.reduce((s, l) => s + (parseInt(l.taka_count) || 0), 0);

  if (loading || loadError) return <Drawer isOpen onClose={() => navigate('/orders')}>{loading ? <div className="p-12 text-center text-slate-500">Loading...</div> : <Alert>{loadError}</Alert>}</Drawer>;

  return (
    <Drawer isOpen={true} onClose={() => navigate('/orders')}>
      <div className="space-y-6 max-w-6xl mx-auto">
        <PageHeader 
          title="Create Sales Order" 
          description="Record a new customer order and check availability."
        >
          <Button variant="ghost" onClick={() => navigate('/orders')}><ArrowLeft className="w-4 h-4 mr-2" /> Back</Button>
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
                <Select required value={formData.quality_id} onChange={e => { setFormData(p => ({ ...p, quality_id: e.target.value })); setLines([]); }}>
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
              <h3 className="text-lg font-semibold text-slate-900">Order Lines (Shades)</h3>
              <Button type="button" variant="outline" size="sm" onClick={addLine} disabled={!formData.quality_id}>
                <Plus className="w-4 h-4 mr-2" /> Add Line
              </Button>
            </div>

            {!formData.quality_id ? (
              <div className="py-8 text-center text-slate-500 border-2 border-dashed border-slate-200 rounded-xl">
                Select a quality to add lines.
              </div>
            ) : (
              <div className="space-y-3">
                {lines.map((l, idx) => {
                  const shade = shades.find(s => s.id.toString() === l.shade_id);
                  const avail = shade && availability ? (availability.shades.find(x => x.shade_id === shade.id)?.finished.takas || 0) : 0;
                  const req = parseInt(l.taka_count) || 0;
                  const canFulfill = req > 0 && req <= avail;
                  
                  return (
                    <div key={l.id} className="flex flex-col sm:flex-row gap-4 items-start p-4 bg-slate-50 border border-slate-200 rounded-xl">
                      <div className="flex-1 w-full">
                        <Field label="Shade">
                          <div className="relative">
                            {shade && (
                              <div className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border border-slate-200 shadow-sm" 
                                style={{ backgroundColor: shade.hex || '#ccc' }} 
                              />
                            )}
                            <Select 
                              className={shade ? 'pl-9' : ''}
                              value={l.shade_id} 
                              onChange={e => updateLine(l.id, 'shade_id', e.target.value)}
                            >
                              <option value="">Select shade...</option>
                              {shades.map(s => <option key={s.id} value={s.id}>{s.chart_name}: {s.number} {s.name ? `- ${s.name}` : ''}</option>)}
                            </Select>
                          </div>
                        </Field>
                      </div>
                      <div className="w-full sm:w-32">
                        <Field label="Required Takas">
                          <Input type="number" min="1" value={l.taka_count} onChange={e => updateLine(l.id, 'taka_count', e.target.value)} />
                        </Field>
                      </div>
                      
                      <div className="w-full sm:w-32 pt-1 sm:pt-7">
                        {shade ? (
                          <div className={`text-sm font-medium flex items-center ${canFulfill ? 'text-emerald-600' : 'text-amber-600'}`}>
                            Finished available: {avail}
                          </div>
                        ) : null}
                      </div>
                      
                      <div className="pt-1 sm:pt-7">
                        <button type="button" onClick={() => removeLine(l.id)} className="p-2 text-slate-400 hover:text-red-500 rounded-lg hover:bg-white border border-transparent hover:border-slate-200"><Trash2 className="w-5 h-5" /></button>
                      </div>
                    </div>
                  );
                })}
                {lines.length === 0 && (
                  <Empty title="No items added" description="Add lines for the shades requested by the customer." />
                )}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6 bg-slate-50 border-slate-200 sticky top-6">
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4">Availability Panel</h3>
            
            <AvailabilityPanel data={availability} needs={needs} />
            <Alert className="mt-4">{error}</Alert>
            <div className="mt-8 pt-6 border-t border-slate-200">
              <Button type="submit" className="w-full h-12 text-base shadow-sm" disabled={busy || totalTakas === 0 || !formData.customer_id}>
                <Save className="w-5 h-5 mr-2" />
                {busy ? 'Saving…' : 'Create Order'}
              </Button>
            </div>
          </Card>
        </div>
      </form>
      </div>
    </Drawer>
  );
}
