import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader, Card, Button, Input, Select, Field, Th, Td, Drawer } from '../../components/ui';
import { ArrowLeft, Save, Plus, Trash2, ClipboardPaste, AlertTriangle } from 'lucide-react';
import * as repo from '../../db/repo';

export default function CreateReceiptPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialPoId = searchParams.get('po_id');
  
  const [loading, setLoading] = useState(true);
  const [pos, setPos] = useState([]);
  const [weavers, setWeavers] = useState([]);
  const [mills, setMills] = useState([]);
  const [locations, setLocations] = useState([]);
  
  const [formData, setFormData] = useState({
    po_id: initialPoId || '',
    weaver_id: '',
    challan_no: '',
    date: new Date().toISOString().slice(0, 10),
    destination: 'GODOWN',
    mill_id: '',
    location_id: '',
    notes: '',
  });

  const [takas, setTakas] = useState([]);
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [startNo, setStartNo] = useState('1');

  useEffect(() => {
    async function load() {
      try {
        const [allPos, allWeavers, allMills, allLocs] = await Promise.all([
          repo.listPOs(),
          repo.listWeavers(),
          repo.listMills(),
          repo.listLocations(),
        ]);
        // Only show OPEN or PARTIAL POs
        setPos(allPos.filter(p => p.status !== 'COMPLETED'));
        setWeavers(allWeavers);
        setMills(allMills);
        setLocations(allLocs);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const selectedPo = useMemo(() => pos.find(p => p.id.toString() === formData.po_id), [pos, formData.po_id]);
  
  // Filter weavers by the selected PO's group
  const availableWeavers = useMemo(() => {
    if (!selectedPo) return [];
    return weavers.filter(w => w.group_id === selectedPo.group_id);
  }, [weavers, selectedPo]);

  // Reset weaver when PO changes
  useEffect(() => {
    if (selectedPo && availableWeavers.length > 0) {
      if (!availableWeavers.find(w => w.id.toString() === formData.weaver_id)) {
        setFormData(p => ({ ...p, weaver_id: availableWeavers[0].id.toString() }));
      }
    } else {
      setFormData(p => ({ ...p, weaver_id: '' }));
    }
  }, [selectedPo, availableWeavers]);

  const handlePasteProcess = () => {
    const meters = pasteText.trim().split(/[\s,]+/).map(m => parseFloat(m)).filter(m => !isNaN(m) && m > 0);
    let currentNo = parseInt(startNo) || 1;
    const newTakas = meters.map(m => ({
      id: Math.random().toString(36).substr(2, 9),
      taka_no: (currentNo++).toString(),
      meter: m.toString()
    }));
    setTakas(prev => [...prev, ...newTakas]);
    setPasteText('');
    setPasteMode(false);
    setStartNo(currentNo.toString());
  };

  const addRow = () => {
    const lastNo = takas.length > 0 ? parseInt(takas[takas.length - 1].taka_no) || 0 : (parseInt(startNo) || 0) - 1;
    setTakas([...takas, { id: Math.random().toString(36).substr(2, 9), taka_no: (lastNo + 1).toString(), meter: '' }]);
  };

  const removeRow = (id) => {
    setTakas(takas.filter(t => t.id !== id));
  };

  const updateTaka = (id, field, value) => {
    setTakas(takas.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (!formData.po_id || !formData.weaver_id || !formData.challan_no) {
        throw new Error('Please fill all required fields');
      }
      if (formData.destination === 'MILL' && !formData.mill_id) {
        throw new Error('Please select a mill');
      }
      const validTakas = takas.filter(t => t.taka_no && parseFloat(t.meter) > 0);
      if (validTakas.length === 0) {
        throw new Error('Please add at least one valid taka with meters > 0');
      }
      
      const id = await repo.createReceipt({
        ...formData,
        takas: validTakas.map(t => ({ taka_no: t.taka_no, meter: parseFloat(t.meter) }))
      });
      navigate(`/receipts/${id}`);
    } catch (err) {
      alert(err.message);
    }
  };

  // Stats
  const validTakas = takas.filter(t => parseFloat(t.meter) > 0);
  const totalMeters = validTakas.reduce((s, t) => s + parseFloat(t.meter), 0);
  const avgMeter = validTakas.length > 0 ? (totalMeters / validTakas.length).toFixed(2) : 0;
  const minMeter = validTakas.length > 0 ? Math.min(...validTakas.map(t => parseFloat(t.meter))) : 0;
  const maxMeter = validTakas.length > 0 ? Math.max(...validTakas.map(t => parseFloat(t.meter))) : 0;
  
  const nominal = selectedPo ? Number(selectedPo.taka_length) || 100 : 100;

  if (loading) return <div className="p-12 text-center text-slate-500">Loading...</div>;

  return (
    <Drawer isOpen={true} onClose={() => navigate('/receipts')}>
      <div className="space-y-6 max-w-5xl mx-auto">
        <PageHeader 
          title="Receive Grey Challan" 
          description="Log incoming grey fabric from weavers (bulk taka entry)."
        >
          <Button variant="ghost" onClick={() => navigate('/receipts')}><ArrowLeft className="w-4 h-4 mr-2" /> Back</Button>
        </PageHeader>

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Challan Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Purchase Order *">
                <Select required value={formData.po_id} onChange={e => setFormData(p => ({ ...p, po_id: e.target.value }))}>
                  <option value="">Select PO...</option>
                  {pos.map(p => <option key={p.id} value={p.id}>{p.po_no} ({p.group_name})</option>)}
                </Select>
              </Field>
              <Field label="Weaver Firm *">
                <Select required value={formData.weaver_id} onChange={e => setFormData(p => ({ ...p, weaver_id: e.target.value }))} disabled={!selectedPo}>
                  <option value="">Select Firm...</option>
                  {availableWeavers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </Select>
              </Field>
              <Field label="Challan Number *">
                <Input required value={formData.challan_no} onChange={e => setFormData(p => ({ ...p, challan_no: e.target.value }))} />
              </Field>
              <Field label="Receipt Date *">
                <Input type="date" required value={formData.date} onChange={e => setFormData(p => ({ ...p, date: e.target.value }))} />
              </Field>
            </div>
            
            <div className="mt-6 pt-6 border-t border-slate-100">
              <h4 className="text-sm font-medium text-slate-700 mb-3">Destination</h4>
              <div className="flex gap-4 mb-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="dest" checked={formData.destination === 'GODOWN'} onChange={() => setFormData(p => ({ ...p, destination: 'GODOWN' }))} className="text-primary-600 focus:ring-primary-500" />
                  <span className="text-sm font-medium">Godown Storage</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="dest" checked={formData.destination === 'MILL'} onChange={() => setFormData(p => ({ ...p, destination: 'MILL' }))} className="text-primary-600 focus:ring-primary-500" />
                  <span className="text-sm font-medium">Direct to Mill</span>
                </label>
              </div>
              
              {formData.destination === 'MILL' ? (
                <Field label="Select Mill *">
                  <Select required value={formData.mill_id} onChange={e => setFormData(p => ({ ...p, mill_id: e.target.value }))}>
                    <option value="">Select Mill...</option>
                    {mills.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </Select>
                </Field>
              ) : (
                <Field label="Assign Location (Optional)">
                  <Select value={formData.location_id} onChange={e => setFormData(p => ({ ...p, location_id: e.target.value }))}>
                    <option value="">Leave Unassigned</option>
                    {locations.map(l => <option key={l.id} value={l.id}>Shop {l.shop} - Rack {l.rack}</option>)}
                  </Select>
                </Field>
              )}
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Takas Entry</h3>
              <div className="flex gap-2">
                <Button type="button" variant={pasteMode ? "primary" : "outline"} size="sm" onClick={() => setPasteMode(!pasteMode)}>
                  <ClipboardPaste className="w-4 h-4 mr-2" /> Bulk Paste
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={addRow}>
                  <Plus className="w-4 h-4 mr-2" /> Add Row
                </Button>
              </div>
            </div>

            {pasteMode && (
              <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                <div className="flex gap-4">
                  <Field label="Start Taka No" className="w-32">
                    <Input value={startNo} onChange={e => setStartNo(e.target.value)} />
                  </Field>
                  <div className="flex-1">
                    <p className="text-xs text-slate-500 mt-6">Paste meters separated by spaces, commas, or new lines.</p>
                  </div>
                </div>
                <textarea 
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" 
                  rows={4} 
                  value={pasteText}
                  onChange={e => setPasteText(e.target.value)}
                  placeholder="e.g. 96.5 102.58 94.69 103.5"
                />
                <Button type="button" onClick={handleProcessPaste} disabled={!pasteText.trim()}>Process Meters</Button>
              </div>
            )}

            <div className="max-h-[400px] overflow-y-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="sticky top-0 bg-slate-50 shadow-sm">
                  <tr>
                    <Th className="w-16 text-center">#</Th>
                    <Th className="w-32">Taka No</Th>
                    <Th>Meters</Th>
                    <Th className="w-24 text-center">Check</Th>
                    <Th className="w-16"></Th>
                  </tr>
                </thead>
                <tbody>
                  {takas.map((t, idx) => {
                    const m = parseFloat(t.meter);
                    const isOutlier = m > 0 && (m < nominal * 0.94 || m > nominal * 1.06);
                    return (
                      <tr key={t.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                        <Td className="text-center text-slate-400">{idx + 1}</Td>
                        <Td className="p-2"><Input value={t.taka_no} onChange={e => updateTaka(t.id, 'taka_no', e.target.value)} className="h-8" /></Td>
                        <Td className="p-2">
                          <Input 
                            type="number" step="0.01" 
                            value={t.meter} 
                            onChange={e => updateTaka(t.id, 'meter', e.target.value)} 
                            className={`h-8 ${isOutlier ? 'border-amber-300 bg-amber-50 text-amber-900' : ''}`}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                addRow();
                              }
                            }}
                          />
                        </Td>
                        <Td className="text-center">
                          {isOutlier && <AlertTriangle className="w-4 h-4 text-amber-500 inline" title={`Outlier: nominal is ${nominal}m`} />}
                        </Td>
                        <Td className="text-right p-2">
                          <button type="button" onClick={() => removeRow(t.id)} className="p-1 text-slate-400 hover:text-red-500 rounded"><Trash2 className="w-4 h-4" /></button>
                        </Td>
                      </tr>
                    );
                  })}
                  {takas.length === 0 && !pasteMode && (
                    <tr>
                      <Td colSpan={5} className="text-center py-8 text-slate-500">
                        No takas added yet. Click "Add Row" or "Bulk Paste".
                      </Td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6 bg-slate-50 border-slate-200">
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4">Receipt Summary</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <div className="text-sm text-slate-500">Takas</div>
                <div className="text-2xl font-bold text-slate-900">{validTakas.length}</div>
              </div>
              <div>
                <div className="text-sm text-slate-500">Total Meters</div>
                <div className="text-2xl font-bold text-slate-900">{totalMeters.toFixed(2)}</div>
              </div>
            </div>
            
            <div className="space-y-2 pt-4 border-t border-slate-200 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Average</span>
                <span className="font-medium text-slate-900">{avgMeter} m</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Min / Max</span>
                <span className="font-medium text-slate-900">{minMeter} / {maxMeter} m</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">PO Nominal</span>
                <span className="font-medium text-slate-900">{nominal} m</span>
              </div>
            </div>
            
            <div className="mt-8 pt-6 border-t border-slate-200">
              <Button type="submit" className="w-full h-12 text-base shadow-sm">
                <Save className="w-5 h-5 mr-2" />
                Save Receipt
              </Button>
            </div>
          </Card>
        </div>
      </form>
      </div>
    </Drawer>
  );
}
