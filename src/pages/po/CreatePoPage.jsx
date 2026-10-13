import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader, Card, Button, Input, Select, Field, Drawer, Alert, useAction } from '../../components/ui';
import { ArrowLeft, Save, FileImage, ChevronDown } from 'lucide-react';
import * as repo from '../../db/repo';

export default function CreatePoPage() {
  const navigate = useNavigate();
  const { id: editId } = useParams();
  const isEdit = !!editId;
  const [receiptsExist, setReceiptsExist] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
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
        if (isEdit) {
          const po = await repo.getPO(Number(editId));
          if (!po) throw new Error('PO not found');
          setReceiptsExist(po.receipt_count > 0);
          setFormData({
            po_no: po.po_no, po_date: po.po_date || '', group_id: String(po.group_id), quality_id: String(po.quality_id), meters: String(po.meters),
            rate: String(po.rate), taka_length: String(po.taka_length || 100), due_date: po.due_date || '', notes: po.notes || '', image_url: po.image_url || '',
          });
        }
      } catch (e) {
        setLoadError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [editId]);

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
      if (isEdit) {
        await repo.updatePO(Number(editId), formData);
        navigate(`/po/${editId}`);
        return;
      }
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

  const set = (k) => (e) => setFormData(p => ({ ...p, [k]: e.target.value }));
  const summary = (
    <>
      <Alert>{error}</Alert>
      <Button type="submit" disabled={busy}>
        <Save className="w-5 h-5 mr-2" />
        {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Create PO'}
      </Button>
    </>
  );

  return (
    <div className="w-full">
      <div className="max-w-5xl mx-auto">
        <PageHeader title={isEdit ? `Edit PO ${formData.po_no}` : 'Create Grey PO'}>
          <Button variant="ghost" onClick={() => navigate(isEdit ? `/po/${editId}` : '/po')}><ArrowLeft className="w-4 h-4 mr-2" /> Back</Button>
        </PageHeader>

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Card className="p-5">
            <h3 className="text-base font-semibold text-slate-900 mb-4">Order details</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-2 gap-4">
              <Field label="PO number *">
                <Input required placeholder="e.g. GT/118" value={formData.po_no} onChange={set('po_no')} />
              </Field>
              <Field label="PO date *">
                <Input type="date" required value={formData.po_date} onChange={set('po_date')} />
              </Field>
              <Field label="Party group *">
                <Select required disabled={receiptsExist} value={formData.group_id} onChange={set('group_id')}>
                  <option value="">Select group...</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </Select>
              </Field>
              <Field label="Due date">
                <Input type="date" value={formData.due_date} onChange={set('due_date')} />
              </Field>
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="text-base font-semibold text-slate-900 mb-4">Item & pricing</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-2 gap-4">
              <Field label="Quality *">
                <Select required disabled={receiptsExist} value={formData.quality_id} onChange={handleQualityChange}>
                  <option value="">Select quality...</option>
                  {qualities.map(q => <option key={q.id} value={q.id}>{q.original_name} ({q.nick_name})</option>)}
                </Select>
              </Field>
              <Field label="Total meters *">
                <Input type="number" step="0.01" min="0.1" required value={formData.meters} onChange={set('meters')} placeholder="e.g. 50000" />
              </Field>
              <Field label="Rate per meter (₹) *">
                <Input type="number" step="0.01" min="0.01" required value={formData.rate} onChange={set('rate')} placeholder="e.g. 3.50" />
              </Field>
              <Field label="Taka length (m)">
                <Input type="number" step="0.1" required value={formData.taka_length} onChange={set('taka_length')} />
              </Field>
            </div>
          </Card>

          {/* additional info: closed by default */}
          <Card>
            <button type="button" onClick={() => setInfoOpen(o => !o)} aria-expanded={infoOpen}
              className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50">
              <span className="text-base font-semibold text-slate-900">Additional info</span>
              <ChevronDown className={`w-5 h-5 text-slate-500 transition-transform ${infoOpen ? 'rotate-180' : ''}`} />
            </button>
            {infoOpen && (
              <div className="px-5 pb-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Notes">
                  <Input value={formData.notes} onChange={set('notes')} />
                </Field>
                <Field label="Paper PO photo URL">
                  <div className="flex gap-2">
                    <Input value={formData.image_url} onChange={set('image_url')} placeholder="https://..." />
                    <Button type="button" variant="outline"><FileImage className="w-4 h-4" /></Button>
                  </div>
                </Field>
              </div>
            )}
          </Card>

          {/* tablet / phone: one compact summary row instead of the tall side card */}
          <Card className="p-4 lg:hidden">
            <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
              <div>
                <div className="text-xs font-bold text-slate-500">Total amount</div>
                <div className="text-lg font-semibold text-slate-900 tabular-nums">{amount}</div>
              </div>
              <div>
                <div className="text-xs font-bold text-slate-500">Estimated takas</div>
                <div className="text-lg font-semibold text-slate-900 tabular-nums">~{takas}</div>
              </div>
              <div className="ml-auto flex flex-wrap items-center gap-3">{summary}</div>
            </div>
          </Card>
        </div>

        <div className="hidden lg:block">
          <Card className="p-6 space-y-5">
            <h3 className="text-base font-semibold text-slate-900">Order summary</h3>
            <div>
              <div className="text-xs font-bold text-slate-500">Total amount</div>
              <div className="text-2xl font-semibold text-slate-900 tabular-nums">{amount}</div>
            </div>
            <div>
              <div className="text-xs font-bold text-slate-500">Estimated takas</div>
              <div className="text-xl font-semibold text-slate-900 tabular-nums">~{takas} <span className="text-sm font-normal text-slate-500">at {takaLen} m each</span></div>
            </div>
            <div className="pt-4 border-t border-slate-100 space-y-3 [&_button]:w-full [&_button]:h-12">{summary}</div>
          </Card>
        </div>
      </form>
      </div>
    </div>
  );
}
