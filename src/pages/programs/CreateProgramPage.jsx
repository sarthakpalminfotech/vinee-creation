import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { PageHeader, Card, Button, Input, Select, Field, Empty, Drawer, Alert, useAction } from '../../components/ui';
import { ArrowLeft, Save, Plus, Trash2, Scissors } from 'lucide-react';
import * as repo from '../../db/repo';

export default function CreateProgramPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [mills, setMills] = useState([]);
  const [qualities, setQualities] = useState([]);
  const [charts, setCharts] = useState([]);
  const [items, setItems] = useState([]);
  
  const [formData, setFormData] = useState({
    mill_id: '',
    quality_id: '',
    chart_id: '',
    date: new Date().toISOString().slice(0, 10),
    notes: ''
  });

  const [availableTakas, setAvailableTakas] = useState([]);
  const [lines, setLines] = useState([]);
  const [programTotal, setProgramTotal] = useState('');
  const [loadError, setLoadError] = useState('');
  const { busy, error, run } = useAction();

  useEffect(() => {
    async function load() {
      try {
        const [allMills, allQualities, allCharts, allItems] = await Promise.all([
          repo.listMills(),
          repo.listQualities(),
          repo.listCharts(),
          repo.listItems()
        ]);
        setMills(allMills);
        setQualities(allQualities);
        setCharts(allCharts);
        setItems(allItems);
      } catch (e) {
        setLoadError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // When mill or quality changes, check availability
  useEffect(() => {
    async function checkAvailability() {
      if (formData.mill_id && formData.quality_id) {
        const takas = await repo.millGreyTakas(formData.mill_id, formData.quality_id);
        setAvailableTakas(takas);
      } else {
        setAvailableTakas([]);
      }
    }
    checkAvailability();
  }, [formData.mill_id, formData.quality_id]);

  // an item = quality + colour with a unique code; the program is written in item codes
  const availableItems = useMemo(() => {
    if (!formData.chart_id || !formData.quality_id) return [];
    return items.filter(i => i.shade_id && String(i.quality_id) === formData.quality_id && String(i.chart_id) === formData.chart_id);
  }, [items, formData.chart_id, formData.quality_id]);

  const addLine = () => {
    setLines([...lines, { id: Math.random().toString(36).substr(2, 9), item_id: '', taka_count: '' }]);
  };

  const removeLine = (id) => {
    setLines(lines.filter(l => l.id !== id));
  };

  const updateLine = (id, field, value) => {
    setLines(lines.map(l => l.id === id ? { ...l, [field]: value } : l));
  };

  const totalTakas = lines.reduce((s, l) => s + (parseInt(l.taka_count) || 0), 0);

  const splitDiff = programTotal === '' ? 0 : (parseInt(programTotal) || 0) - totalTakas;
  const usedItems = new Set(lines.map(l => l.item_id).filter(Boolean));

  const handleSave = (e) => {
    e.preventDefault();
    run(async () => {
      if (!formData.mill_id || !formData.quality_id || !formData.chart_id) throw new Error('Please select mill, quality, and shade chart');
      const validLines = lines.filter(l => l.item_id && parseInt(l.taka_count) > 0);
      if (validLines.length === 0) throw new Error('Please add at least one item line');
      if (programTotal !== '' && splitDiff !== 0) throw new Error(`The shade split adds up to ${totalTakas} but the program is for ${programTotal} takas`);
      if (totalTakas > availableTakas.length) throw new Error(`Only ${availableTakas.length} takas available. You assigned ${totalTakas}.`);
      const id = await repo.createProgram({ ...formData, total_takas: programTotal, lines: validLines });
      navigate(`/programs/${id}`);
    });
  };

  if (loading || loadError) return <Drawer isOpen onClose={() => navigate('/programs')}>{loading ? <div className="p-12 text-center text-slate-500">Loading...</div> : <Alert>{loadError}</Alert>}</Drawer>;

  return (
    <Drawer isOpen={true} onClose={() => navigate('/programs')}>
      <div className="space-y-6 max-w-5xl mx-auto">
        <PageHeader 
          title="Issue Dyeing Program" 
          description="Instruct a mill to dye grey fabric into specific shades."
        >
          <Button variant="ghost" onClick={() => navigate('/programs')}><ArrowLeft className="w-4 h-4 mr-2" /> Back</Button>
        </PageHeader>

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Program Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Mill *">
                <Select required value={formData.mill_id} onChange={e => setFormData(p => ({ ...p, mill_id: e.target.value }))}>
                  <option value="">Select Mill...</option>
                  {mills.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </Select>
              </Field>
              <Field label="Quality *">
                <Select required value={formData.quality_id} onChange={e => { setFormData(p => ({ ...p, quality_id: e.target.value })); setLines([]); }}>
                  <option value="">Select Quality...</option>
                  {qualities.map(q => <option key={q.id} value={q.id}>{q.nick_name}</option>)}
                </Select>
              </Field>
              <Field label="Program Date *">
                <Input type="date" required value={formData.date} onChange={e => setFormData(p => ({ ...p, date: e.target.value }))} />
              </Field>
              <Field label="Shade Chart *">
                <Select required value={formData.chart_id} onChange={e => { setFormData(p => ({ ...p, chart_id: e.target.value })); setLines([]); }}>
                  <option value="">Select Chart...</option>
                  {charts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </Field>
              <Field label="Takas in this program (optional check)">
                <Input type="number" min="1" value={programTotal} onChange={e => setProgramTotal(e.target.value)} placeholder="e.g. 48" />
              </Field>
              <div className="md:col-span-2">
                <Field label="Notes (Optional)">
                  <Input value={formData.notes} onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))} placeholder="Special instructions for dyeing..." />
                </Field>
              </div>
            </div>
            
            {(formData.mill_id && formData.quality_id) && (
              <div className={`mt-6 p-4 rounded-lg border flex items-center justify-between ${
                availableTakas.length > 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    availableTakas.length > 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'
                  }`}>
                    <Scissors className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className={`font-semibold ${availableTakas.length > 0 ? 'text-emerald-900' : 'text-red-900'}`}>
                      Available Grey Takas
                    </h4>
                    <p className={`text-sm ${availableTakas.length > 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                      At {mills.find(m => m.id.toString() === formData.mill_id)?.name || 'this mill'}
                    </p>
                  </div>
                </div>
                <div className={`text-3xl font-bold ${availableTakas.length > 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                  {availableTakas.length}
                </div>
              </div>
            )}
          </Card>

          <Card className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Item Lines <span className="text-sm font-normal text-slate-500">(item code = quality + colour)</span></h3>
              <Button type="button" variant="outline" size="sm" onClick={addLine} disabled={!formData.chart_id || !formData.quality_id || availableItems.length === 0}>
                <Plus className="w-4 h-4 mr-2" /> Add Line
              </Button>
            </div>

            {!formData.chart_id || !formData.quality_id ? (
              <div className="py-8 text-center text-slate-500 border-2 border-dashed border-slate-200 rounded-lg">
                Select the quality and a shade chart above to add lines.
              </div>
            ) : availableItems.length === 0 ? (
              <div className="py-8 text-center text-slate-500 border-2 border-dashed border-amber-200 bg-amber-50 rounded-lg">
                No item codes exist for this quality in this chart. Create them in <Link to="/masters/items" className="text-primary-600 underline">Masters → Items</Link> (there is a one-click generator).
              </div>
            ) : (
              <div className="space-y-3">
                {lines.map((l, idx) => (
                  <div key={l.id} className="flex gap-4 items-start p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <div className="w-8 pt-2 text-center font-medium text-slate-400">{idx + 1}</div>
                    <div className="flex-1">
                      <Field label="Item code">
                        <div className="relative">
                          {l.item_id && (
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border border-slate-200 shadow-sm" 
                              style={{ backgroundColor: availableItems.find(i => i.id.toString() === l.item_id)?.hex || '#ccc' }} 
                            />
                          )}
                          <Select 
                            className={l.item_id ? 'pl-9' : ''}
                            value={l.item_id} 
                            onChange={e => updateLine(l.id, 'item_id', e.target.value)}
                          >
                            <option value="">Select item...</option>
                            {availableItems.filter(i => i.id.toString() === l.item_id || !usedItems.has(i.id.toString())).map(i => <option key={i.id} value={i.id}>{i.code} · {i.shade_no}{i.shade_name ? ` ${i.shade_name}` : ''}</option>)}
                          </Select>
                        </div>
                      </Field>
                    </div>
                    <div className="w-32">
                      <Field label="Takas">
                        <Input type="number" min="1" value={l.taka_count} onChange={e => updateLine(l.id, 'taka_count', e.target.value)} placeholder="e.g. 24" />
                      </Field>
                    </div>
                    <div className="pt-7">
                      <button type="button" onClick={() => removeLine(l.id)} className="p-2 text-slate-400 hover:text-red-500 rounded-lg hover:bg-white border border-transparent hover:border-slate-200"><Trash2 className="w-5 h-5" /></button>
                    </div>
                  </div>
                ))}
                {lines.length === 0 && (
                  <Empty title="No items added" description="Add lines to instruct which item codes (colours) to dye." />
                )}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6 bg-slate-50 border-slate-200 sticky top-6">
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4">Allocation Summary</h3>
            <div className="space-y-4">
              <div>
                <div className="text-sm text-slate-500">Available at Mill</div>
                <div className="text-2xl font-bold text-slate-900">{availableTakas.length}</div>
              </div>
              <div className="pt-4 border-t border-slate-200">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-slate-500">To be dyed (Takas)</span>
                  <span className={`text-2xl font-bold ${totalTakas > availableTakas.length ? 'text-red-600' : 'text-primary-700'}`}>
                    {totalTakas}
                  </span>
                </div>
                <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden mt-2">
                  <div 
                    className={`h-full rounded-full transition-all ${totalTakas > availableTakas.length ? 'bg-red-500' : 'bg-primary-500'}`}
                    style={{ width: `${Math.min(100, (totalTakas / Math.max(1, availableTakas.length)) * 100)}%` }}
                  />
                </div>
                {totalTakas > availableTakas.length && (
                  <p className="text-xs text-red-600 mt-2">Exceeds available takas!</p>
                )}
                {programTotal !== '' && (
                  <p className={`text-xs mt-2 ${splitDiff === 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {splitDiff === 0 ? 'Shade split matches the program total.' : splitDiff > 0 ? `${splitDiff} takas still to split across shades.` : `Split is ${-splitDiff} over the program total.`}
                  </p>
                )}
              </div>
            </div>
            
            <Alert className="mt-4">{error}</Alert>
            <div className="mt-8 pt-6 border-t border-slate-200">
              <Button type="submit" className="w-full h-12 text-base shadow-sm" disabled={busy || totalTakas === 0 || totalTakas > availableTakas.length || (programTotal !== '' && splitDiff !== 0)}>
                <Save className="w-5 h-5 mr-2" />
                {busy ? 'Saving…' : 'Issue Program'}
              </Button>
            </div>
          </Card>
        </div>
      </form>
      </div>
    </Drawer>
  );
}
