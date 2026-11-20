import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { PageHeader, Card, Button, Input, Select, Field, Empty, Alert, Modal, useAction } from '../../components/ui';
import { AvailabilityPanel, useAvailability } from './AvailabilityPanel';
import { ColourSelect, ActionBar } from '../../components/kit';
import { fmtM, fmtMoney } from '../../lib/format';
import { ArrowLeft, Save, Plus, Trash2 } from 'lucide-react';
import * as repo from '../../db/repo';
import { GstField } from '../masters/MasterForm';

const lineId = () => Math.random().toString(36).substr(2, 9);

/** Create a customer order, or (route /orders/:id/edit) change an existing one. Lines are colours of the quality asked in takas, meters, or both. */
export default function CreateOrderPage() {
  const navigate = useNavigate();
  const { id: editId } = useParams();
  const isEdit = !!editId;
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [qualities, setQualities] = useState([]);
  const [colours, setColours] = useState([]); // every colour linked to the chosen quality (inactive ones stay for old lines)
  const [custOpen, setCustOpen] = useState(false); // quick-add customer popup
  const [newCust, setNewCust] = useState({ name: '', contact: '', phone: '', city: '', gstin: '' });
  const [custErr, setCustErr] = useState('');
  const [custBusy, setCustBusy] = useState(false);
  const [locked, setLocked] = useState(false); // stock already allocated: quality + lines can no longer change

  const [formData, setFormData] = useState({
    order_no: '',
    customer_id: '',
    quality_id: '',
    date: new Date().toISOString().slice(0, 10),
    notes: '',
    job_work: false, job_type: '', job_notes: '',
    rate: '', payment_days: '' // empty reminder days = the default from Settings
  });
  const [defaultDays, setDefaultDays] = useState(null);

  const [lines, setLines] = useState([]);
  const [loadError, setLoadError] = useState('');
  const { busy, error, run } = useAction();

  const addCustomer = async (e) => {
    e.preventDefault(); e.stopPropagation();
    if (custBusy) return;
    setCustBusy(true); setCustErr('');
    try {
      const id = await repo.saveMaster('customers', newCust);
      setCustomers(await repo.listCustomers());
      setFormData((p) => ({ ...p, customer_id: String(id) }));
      setCustOpen(false); setNewCust({ name: '', contact: '', phone: '', city: '', gstin: '' });
    } catch (err) { setCustErr(err.message); } finally { setCustBusy(false); }
  };

  useEffect(() => {
    async function load() {
      try {
        const [custs, quals, days] = await Promise.all([repo.listCustomers(), repo.listQualities(), repo.getPaymentDays()]);
        setCustomers(custs);
        setQualities(quals);
        setDefaultDays(days);
        if (isEdit) {
          const o = await repo.getOrder(Number(editId));
          if (!o) throw new Error('Order not found');
          setFormData({ order_no: o.order_no, customer_id: String(o.customer_id), quality_id: String(o.quality_id), date: o.date || '', notes: o.notes || '', job_work: Number(o.job_work) === 1, job_type: o.job_type || '', job_notes: o.job_notes || '', rate: o.rate != null ? String(o.rate) : '', payment_days: o.payment_days != null ? String(o.payment_days) : '' });
          setLocked(Number(o.allocated) > 0);
          setLines(o.lines.map((l) => ({ id: lineId(), shade_id: String(l.shade_id), taka_count: l.taka_count ? String(l.taka_count) : '', meters: l.meters ? String(l.meters) : '' })));
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

  // the colours of the chosen quality
  useEffect(() => {
    let live = true;
    if (!formData.quality_id) { setColours([]); return undefined; }
    repo.listQualityColours(formData.quality_id).then((c) => live && setColours(c)).catch(() => {});
    return () => { live = false; };
  }, [formData.quality_id]);
  // new lines pick active colours; a colour already on a line stays selectable even if it was made inactive since
  const pickable = useMemo(() => colours.filter((c) => c.active || lines.some((l) => String(l.shade_id) === String(c.shade_id))), [colours, lines]);
  const colourById = (id) => colours.find((c) => String(c.shade_id) === String(id));

  const shadeIds = lines.map((l) => Number(l.shade_id)).filter(Boolean);
  const { data: availability } = useAvailability(formData.quality_id, shadeIds);
  const needs = Object.fromEntries(lines.filter((l) => l.shade_id).map((l) => [Number(l.shade_id), parseInt(l.taka_count) || 0]));
  const usedColours = new Set(lines.map((l) => l.shade_id).filter(Boolean));

  const addLine = () => setLines([...lines, { id: lineId(), shade_id: '', taka_count: '', meters: '' }]);
  const removeLine = (id) => setLines(lines.filter(l => l.id !== id));
  const updateLine = (id, field, value) => setLines(lines.map(l => l.id === id ? { ...l, [field]: value } : l));

  const validLines = lines.filter(l => l.shade_id && (parseInt(l.taka_count) > 0 || Number(l.meters) > 0));
  const totalTakas = lines.reduce((s, l) => s + (parseInt(l.taka_count) || 0), 0);
  const totalMeters = Math.round(lines.reduce((s, l) => s + (Number(l.meters) || 0), 0) * 100) / 100;
  // amount to receive: rate × ordered meters (a line in takas only counts takas × the quality's taka length)
  const takaLen = Number(qualities.find((q) => String(q.id) === String(formData.quality_id))?.taka_length) || 100;
  const estMeters = Math.round(validLines.reduce((s, l) => s + (Number(l.meters) > 0 ? Number(l.meters) : (parseInt(l.taka_count) || 0) * takaLen), 0) * 100) / 100;
  const estimated = validLines.some((l) => !(Number(l.meters) > 0));
  const rateN = Number(formData.rate);
  const expectedAmount = rateN > 0 ? Math.round(rateN * estMeters * 100) / 100 : null;

  const handleSave = (e) => {
    e.preventDefault();
    run(async () => {
      if (!formData.customer_id || !formData.quality_id) throw new Error('Please select customer and quality');
      if (!isEdit && !(Number(formData.rate) > 0)) throw new Error('Enter the rate per meter');
      if (!locked && validLines.length === 0) throw new Error('Please add at least one colour line with takas or meters');
      const payload = { ...formData, lines: validLines.map(l => ({ shade_id: Number(l.shade_id), taka_count: l.taka_count, meters: l.meters })) };
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

  // one save button, shown in the side card on wide screens and in the bottom bar on tablets / phones
  const submit = (cls) => (
    <Button type="submit" className={`shadow-sm ${cls}`} disabled={busy || (!locked && validLines.length === 0) || !formData.customer_id}>
      <Save className="w-5 h-5 mr-2" />
      {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Create Order'}
    </Button>
  );

  return (
    <div className="w-full">
      <div className="space-y-6 page-w-6xl">
        <PageHeader
          title={isEdit ? `Edit Order ${formData.order_no}` : 'Create Sales Order'}
          description={isEdit ? 'Change the order details. Quality and lines are locked once stock was allocated.' : 'Record a new customer order — in takas, in meters, or both — and check availability.'}
          onBack={() => navigate(back)}
        >
        </PageHeader>

      <form onSubmit={handleSave}>
      <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-[minmax(0,1fr)_340px] gap-6">
        <div className="lg:col-span-2 xl:col-span-1 min-w-0 space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-bold text-forest mb-4">Order Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
              <Field label="Order Number *">
                <Input required value={formData.order_no} onChange={e => setFormData(p => ({ ...p, order_no: e.target.value }))} />
              </Field>
              <Field label="Order Date *">
                <Input type="date" required value={formData.date} onChange={e => setFormData(p => ({ ...p, date: e.target.value }))} />
              </Field>
              <Field label="Customer *">
                <div className="flex gap-2">
                  <div className="flex-1 min-w-0">
                    <Select required value={formData.customer_id} onChange={e => setFormData(p => ({ ...p, customer_id: e.target.value }))}>
                      <option value="">Select Customer...</option>
                      {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </Select>
                  </div>
                  <Button type="button" variant="outline" className="h-11 w-11 px-0 shrink-0" title="Add new customer" aria-label="Add new customer" onClick={() => { setCustErr(''); setCustOpen(true); }}><Plus className="w-5 h-5" /></Button>
                </div>
              </Field>
              <Field label="Quality *">
                <Select required disabled={locked} value={formData.quality_id} onChange={e => { setFormData(p => ({ ...p, quality_id: e.target.value })); setLines([]); }}>
                  <option value="">Select Quality...</option>
                  {qualities.map(q => <option key={q.id} value={q.id}>{q.nick_name}</option>)}
                </Select>
              </Field>
              <Field label={isEdit ? 'Rate per meter (₹)' : 'Rate per meter (₹) *'}>
                <Input type="number" min="0" step="0.01" required={!isEdit} placeholder="e.g. 42.50" value={formData.rate} onChange={e => setFormData(p => ({ ...p, rate: e.target.value }))} />
                {isEdit && !formData.rate && <span className="text-xs text-amber-600">No rate yet — payments cannot be worked out until it is entered</span>}
              </Field>
              <Field label="Payment reminder (days)">
                <Input type="number" min="1" step="1" placeholder={defaultDays ? `Default: ${defaultDays} days` : ''} value={formData.payment_days} onChange={e => setFormData(p => ({ ...p, payment_days: e.target.value }))} />
                <span className="text-xs text-slate-500">Leave empty to use the default from Settings</span>
              </Field>
              <div className="sm:col-span-2 rounded-lg border border-slate-200 bg-slate-50/60 p-4 space-y-3">
                <label className="flex items-center gap-3 text-sm font-medium text-slate-800">
                  <input type="checkbox" role="switch" className="h-5 w-5" disabled={locked} checked={formData.job_work} onChange={e => setFormData(p => ({ ...p, job_work: e.target.checked }))} />
                  Job work required <span className="font-normal text-slate-500">(embroidery, printing … done on the folded goods)</span>
                </label>
                {formData.job_work && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                    <Field label="Job type (optional)"><Input disabled={locked} placeholder="e.g. Embroidery" value={formData.job_type} onChange={e => setFormData(p => ({ ...p, job_type: e.target.value }))} /></Field>
                    <Field label="Job work note"><Input disabled={locked} value={formData.job_notes} onChange={e => setFormData(p => ({ ...p, job_notes: e.target.value }))} /></Field>
                  </div>
                )}
              </div>
              <div className="sm:col-span-2">
                <Field label="Notes (Optional)">
                  <Input value={formData.notes} onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))} />
                </Field>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-forest">Order Lines <span className="text-sm font-normal text-slate-500">(colour · takas and/or meters)</span></h3>
              <Button type="button" variant="outline" size="sm" onClick={addLine} disabled={!formData.quality_id || locked || pickable.length === 0}>
                <Plus className="w-4 h-4 mr-2" /> Add Line
              </Button>
            </div>
            {locked && <Alert tone="info" className="mb-3">Stock has already been allocated to this order, so its lines cannot be changed. You can still edit the number, date, customer and notes.</Alert>}

            {!formData.quality_id ? (
              <div className="py-8 text-center text-slate-500 border-2 border-dashed border-slate-200 rounded-lg">
                Select a quality to add lines.
              </div>
            ) : pickable.length === 0 ? (
              <div className="py-8 text-center text-slate-500 border-2 border-dashed border-amber-200 bg-amber-50 rounded-lg">
                This quality has no active colours yet. Add them in <Link to="/masters/qualities" className="text-primary-600 underline">Masters → Qualities → Colours</Link>.
              </div>
            ) : (
              <div className="space-y-3">
                {lines.map((l) => {
                  const item = colourById(l.shade_id);
                  const sh = item && availability ? availability.shades.find(x => x.shade_id === item.shade_id) : null;
                  const stock = sh ? (formData.job_work ? sh.jobworked : sh.plain) : null;
                  const reqT = parseInt(l.taka_count) || 0;
                  const reqM = Number(l.meters) || 0;
                  const canFulfill = stock && (reqT > 0 || reqM > 0) && reqT <= stock.takas && reqM <= stock.m;

                  return (
                    <div key={l.id} className="flex flex-col sm:flex-row gap-4 items-start p-4 bg-slate-50 border border-slate-200 rounded-lg">
                      <div className="flex-1 w-full">
                        <Field label="Colour">
                          <ColourSelect colours={pickable} value={l.shade_id} exclude={usedColours} disabled={locked} onChange={(v) => updateLine(l.id, 'shade_id', v)} />
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
                            {formData.job_work ? 'Job-worked' : 'Plain'}: {stock.takas} tk · {fmtM(stock.m)} m
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
                  <Empty title="No items added" description="Add a line for each colour the customer asked for. Enter takas, meters, or both." />
                )}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6 bg-white border-slate-200 lg:sticky lg:top-6">
            <h3 className="text-sm font-bold text-forest uppercase tracking-wider mb-4">Availability Panel</h3>

            <AvailabilityPanel data={availability} needs={needs} qualityId={formData.quality_id} jobOrder={formData.job_work} />
            <div className="mt-4 pt-4 border-t border-slate-200 text-sm flex justify-between">
              <span className="text-slate-500">Ordered</span>
              <span className="font-semibold text-slate-900">{totalTakas} tk{totalMeters > 0 ? ` · ${fmtM(totalMeters)} m` : ''}</span>
            </div>
            <div className="mt-2 text-sm flex justify-between gap-3">
              <span className="text-slate-500">Amount to receive{estimated && expectedAmount != null ? ' (approx.)' : ''}</span>
              <span className="font-semibold text-slate-900 text-right">{expectedAmount != null ? fmtMoney(expectedAmount) : '—'}</span>
            </div>
            {expectedAmount != null && <div className="text-xs text-slate-500 text-right">{fmtM(estMeters)} m × {fmtMoney(rateN)}{estimated ? ' · takas counted at the taka length' : ''}</div>}
            <Alert className="mt-4">{error}</Alert>
            <div className="hidden lg:block mt-8 pt-6 border-t border-slate-200">{submit('w-full h-12 text-base')}</div>
          </Card>
        </div>
      </div>
      {/* tablet / phone: totals + create pinned to the bottom of the screen */}
      <ActionBar>
        <div className="flex items-center gap-x-8 gap-y-2 flex-wrap">
          <div>
            <div className="text-xs font-bold text-slate-500">Ordered</div>
            <div className="text-base font-semibold text-slate-900 tabular-nums">{totalTakas} tk{totalMeters > 0 ? ` · ${fmtM(totalMeters)} m` : ''}</div>
          </div>
          <div>
            <div className="text-xs font-bold text-slate-500">Amount{estimated && expectedAmount != null ? ' (approx.)' : ''}</div>
            <div className="text-base font-semibold text-slate-900 tabular-nums">{expectedAmount != null ? fmtMoney(expectedAmount) : '—'}</div>
          </div>
          <div className="ml-auto">{submit('h-12 px-6 text-base')}</div>
        </div>
      </ActionBar>
      </form>
      </div>
      <Modal isOpen={custOpen} onClose={() => setCustOpen(false)} title="Add Customer">
        <form onSubmit={addCustomer} className="space-y-4">
          <Field label="Name *"><Input required autoFocus value={newCust.name} onChange={e => setNewCust(p => ({ ...p, name: e.target.value }))} /></Field>
          <Field label="Contact Person"><Input value={newCust.contact} onChange={e => setNewCust(p => ({ ...p, contact: e.target.value }))} /></Field>
          <Field label="Phone"><Input value={newCust.phone} onChange={e => setNewCust(p => ({ ...p, phone: e.target.value }))} /></Field>
          <Field label="City"><Input value={newCust.city} onChange={e => setNewCust(p => ({ ...p, city: e.target.value }))} /></Field>
          <GstField value={newCust.gstin} onChange={v => setNewCust(p => ({ ...p, gstin: v }))} />
          <Alert>{custErr}</Alert>
          <div className="pt-2 flex justify-end gap-3">
            <Button variant="ghost" type="button" onClick={() => setCustOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={custBusy}>{custBusy ? 'Saving…' : 'Save'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
