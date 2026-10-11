import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader, Card, Button, Input, Select, Field, Drawer, Alert, useAction } from '../../components/ui';
import { ArrowLeft, Save, FileImage } from 'lucide-react';
import * as repo from '../../db/repo';

export default function CreatePoPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const { busy, error, run } = useAction();
  const [groups, setGroups] = useState([]);
  const [qualities, setQualities] = useState([]);
  
  const [formData, setFormData] = useState({
    po_no: '',
    po_date: new Date().toISOString().slice(0, 10),
    group_id: '',
    quality_id: '',
    meters: '',
    rate: '',
    taka_length: '100',
    due_date: '',
    notes: '',
    image_url: ''
  });

  useEffect(() => {
    async function load() {
      try {
        const [grps, quals] = await Promise.all([repo.listWeaverGroups(), repo.listQualities()]);
        setGroups(grps);
        setQualities(quals);
      } catch (e) {
        setLoadError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleQualityChange = (e) => {
    const qid = e.target.value;
    const q = qualities.find(x => x.id.toString() === qid);
    setFormData(p => ({
      ...p,
      quality_id: qid,
      taka_length: q ? q.taka_length : p.taka_length
    }));
  };

  const handleSave = (e) => {
    e.preventDefault();
    run(async () => {
      if (!formData.po_no.trim()) throw new Error('Enter the PO number from the paper PO');
      if (!formData.group_id || !formData.quality_id || !formData.meters || !formData.rate) throw new Error('Please fill all required fields');
      const id = await repo.createPO(formData);
      navigate(`/po/${id}`);
    });
  };

  if (loading || loadError) return <Drawer isOpen onClose={() => navigate('/po')}>{loading ? <div className="p-12 text-center text-slate-500">Loading...</div> : <Alert>{loadError}</Alert>}</Drawer>;

  const meters = Number(formData.meters) || 0;
  const rate = Number(formData.rate) || 0;
  const takaLen = Number(formData.taka_length) || 100;
  const amount = (meters * rate).toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
  const takas = Math.round(meters / takaLen);

  return (
    <Drawer isOpen={true} onClose={() => navigate('/po')}>
      <div className="space-y-6 max-w-4xl mx-auto">
        <PageHeader 
          title="Create Grey PO" 
          description="Issue a new grey fabric purchase order to a weaver."
        >
          <Button variant="ghost" onClick={() => navigate('/po')}><ArrowLeft className="w-4 h-4 mr-2" /> Back</Button>
        </PageHeader>

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Order Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="PO Number (from the paper PO) *">
                <Input required placeholder="e.g. GT/118" value={formData.po_no} onChange={e => setFormData(p => ({ ...p, po_no: e.target.value }))} />
              </Field>
              <Field label="PO Date *">
                <Input type="date" required value={formData.po_date} onChange={e => setFormData(p => ({ ...p, po_date: e.target.value }))} />
              </Field>
              <Field label="Party Group *">
                <Select required value={formData.group_id} onChange={e => setFormData(p => ({ ...p, group_id: e.target.value }))}>
                  <option value="">Select Group...</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </Select>
              </Field>
              <Field label="Due Date">
                <Input type="date" value={formData.due_date} onChange={e => setFormData(p => ({ ...p, due_date: e.target.value }))} />
              </Field>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Item & Pricing</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Quality *">
                <Select required value={formData.quality_id} onChange={handleQualityChange}>
                  <option value="">Select Quality...</option>
                  {qualities.map(q => <option key={q.id} value={q.id}>{q.original_name} ({q.nick_name})</option>)}
                </Select>
              </Field>
              <Field label="Total Meters *">
                <Input type="number" step="0.01" min="0.1" required value={formData.meters} onChange={e => setFormData(p => ({ ...p, meters: e.target.value }))} placeholder="e.g. 50000" />
              </Field>
              <Field label="Rate per meter (₹) *">
                <Input type="number" step="0.01" min="0.01" required value={formData.rate} onChange={e => setFormData(p => ({ ...p, rate: e.target.value }))} placeholder="e.g. 3.50" />
              </Field>
              <Field label="Taka Length (m)">
                <Input type="number" step="0.1" required value={formData.taka_length} onChange={e => setFormData(p => ({ ...p, taka_length: e.target.value }))} />
              </Field>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Additional Info</h3>
            <div className="space-y-4">
              <Field label="Notes">
                <textarea 
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" 
                  rows={3} 
                  value={formData.notes} 
                  onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}
                />
              </Field>
              <Field label="Paper PO Photo URL">
                <div className="flex gap-2">
                  <Input value={formData.image_url} onChange={e => setFormData(p => ({ ...p, image_url: e.target.value }))} placeholder="https://..." />
                  <Button type="button" variant="outline"><FileImage className="w-4 h-4" /></Button>
                </div>
              </Field>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6 bg-primary-50 border-primary-100">
            <h3 className="text-sm font-semibold text-primary-900 uppercase tracking-wider mb-4">Order Summary</h3>
            <div className="space-y-4">
              <div>
                <div className="text-sm text-primary-700 mb-1">Total Amount</div>
                <div className="text-3xl font-bold text-primary-900">{amount}</div>
              </div>
              <div className="pt-4 border-t border-primary-200/50">
                <div className="text-sm text-primary-700 mb-1">Estimated Takas</div>
                <div className="text-xl font-semibold text-primary-900">~{takas} <span className="text-sm font-normal text-primary-700">takas</span></div>
                <div className="text-xs text-primary-600 mt-1">Based on {takaLen}m per taka</div>
              </div>
            </div>
            
            <Alert className="mt-4">{error}</Alert>
            <div className="mt-8 pt-6 border-t border-primary-200/50">
              <Button type="submit" disabled={busy} className="w-full h-12 text-base shadow-lg shadow-primary-500/20">
                <Save className="w-5 h-5 mr-2" />
                {busy ? 'Saving…' : 'Create PO'}
              </Button>
            </div>
          </Card>
        </div>
      </form>
      </div>
    </Drawer>
  );
}
