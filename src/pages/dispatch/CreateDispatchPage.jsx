import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader, Card, Button, Select, Input, Field, Table, Th, Td, Empty, Badge, Drawer } from '../../components/ui';
import { ArrowLeft, Save, ShieldCheck } from 'lucide-react';
import * as repo from '../../db/repo';

export default function CreateDispatchPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [mills, setMills] = useState([]);
  const [availableTakas, setAvailableTakas] = useState([]);
  
  const [formData, setFormData] = useState({
    mill_id: '',
    date: new Date().toISOString().slice(0, 10),
    notes: ''
  });
  
  const [selectedTakaIds, setSelectedTakaIds] = useState(new Set());
  const [qualityFilter, setQualityFilter] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const [allMills, godownTakas] = await Promise.all([
          repo.listMills(),
          repo.listTakas("WHERE t.status='GODOWN_GREY'")
        ]);
        setMills(allMills);
        setAvailableTakas(godownTakas);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const qualities = useMemo(() => {
    const qs = new Map();
    availableTakas.forEach(t => qs.set(t.quality_id, t.nick_name));
    return Array.from(qs.entries()).map(([id, name]) => ({ id, name }));
  }, [availableTakas]);

  const filteredTakas = useMemo(() => {
    if (!qualityFilter) return availableTakas;
    return availableTakas.filter(t => t.quality_id.toString() === qualityFilter);
  }, [availableTakas, qualityFilter]);

  const toggleTaka = (id) => {
    const next = new Set(selectedTakaIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedTakaIds(next);
  };

  const selectAllFiltered = () => {
    const next = new Set(selectedTakaIds);
    filteredTakas.forEach(t => next.add(t.id));
    setSelectedTakaIds(next);
  };

  const selectFirstN = (n) => {
    const next = new Set(selectedTakaIds);
    filteredTakas.slice(0, n).forEach(t => next.add(t.id));
    setSelectedTakaIds(next);
  };

  const clearSelection = () => {
    setSelectedTakaIds(new Set());
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (!formData.mill_id) throw new Error('Please select a mill');
      if (selectedTakaIds.size === 0) throw new Error('Please select at least one taka to dispatch');
      
      const id = await repo.createDispatch({
        ...formData,
        taka_ids: Array.from(selectedTakaIds)
      });
      navigate(`/dispatch/${id}`);
    } catch (err) {
      alert(err.message);
    }
  };

  const selectedMeters = availableTakas
    .filter(t => selectedTakaIds.has(t.id))
    .reduce((sum, t) => sum + Number(t.grey_meter), 0);

  if (loading) return <div className="p-12 text-center text-slate-500">Loading...</div>;

  return (
    <Drawer isOpen={true} onClose={() => navigate('/dispatch')}>
      <div className="space-y-6 max-w-5xl mx-auto">
        <PageHeader 
          title="New Mill Dispatch" 
          description="Select godown inventory to send to a mill for dyeing."
        >
          <Button variant="ghost" onClick={() => navigate('/dispatch')}><ArrowLeft className="w-4 h-4 mr-2" /> Back</Button>
        </PageHeader>

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Dispatch Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Destination Mill *">
                <Select required value={formData.mill_id} onChange={e => setFormData(p => ({ ...p, mill_id: e.target.value }))}>
                  <option value="">Select Mill...</option>
                  {mills.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </Select>
              </Field>
              <Field label="Dispatch Date *">
                <Input type="date" required value={formData.date} onChange={e => setFormData(p => ({ ...p, date: e.target.value }))} />
              </Field>
              <div className="md:col-span-2">
                <Field label="Notes (Optional)">
                  <Input value={formData.notes} onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))} />
                </Field>
              </div>
            </div>
          </Card>

          <Card className="p-0 overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row gap-4 justify-between items-center">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-slate-900">Select Takas</h3>
                <Badge variant="primary">{availableTakas.length} in Godown</Badge>
              </div>
              <Select className="w-full sm:w-48 bg-white" value={qualityFilter} onChange={e => setQualityFilter(e.target.value)}>
                <option value="">All Qualities</option>
                {qualities.map(q => <option key={q.id} value={q.id}>{q.name}</option>)}
              </Select>
            </div>
            
            <div className="p-3 border-b border-slate-100 flex flex-wrap gap-2 items-center bg-white">
              <Button type="button" variant="outline" size="sm" onClick={selectAllFiltered}>Select All Shown</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => selectFirstN(10)}>Select 10</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => selectFirstN(25)}>Select 25</Button>
              <Button type="button" variant="ghost" size="sm" onClick={clearSelection}>Clear Selection</Button>
            </div>
            
            <div className="max-h-[500px] overflow-y-auto">
              <Table>
                <thead className="sticky top-0 bg-slate-50 shadow-sm z-10">
                  <tr>
                    <Th className="w-12 text-center">
                      <input 
                        type="checkbox" 
                        className="rounded text-primary-600 focus:ring-primary-500"
                        checked={filteredTakas.length > 0 && filteredTakas.every(t => selectedTakaIds.has(t.id))}
                        onChange={(e) => e.target.checked ? selectAllFiltered() : clearSelection()}
                      />
                    </Th>
                    <Th>Taka No</Th>
                    <Th>Quality</Th>
                    <Th>Meters</Th>
                    <Th>Location</Th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTakas.map(t => (
                    <tr key={t.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => toggleTaka(t.id)}>
                      <Td className="text-center">
                        <input 
                          type="checkbox" 
                          className="rounded text-primary-600 focus:ring-primary-500 cursor-pointer"
                          checked={selectedTakaIds.has(t.id)}
                          readOnly
                        />
                      </Td>
                      <Td className="font-medium text-slate-900">{t.challan_no}/{t.taka_no}</Td>
                      <Td>{t.nick_name}</Td>
                      <Td>{t.grey_meter} m</Td>
                      <Td>
                        {t.location_id ? <span className="text-slate-600 text-sm">Shop {t.shop}-{t.rack}</span> : <span className="text-amber-600 text-xs font-medium">Unassigned</span>}
                      </Td>
                    </tr>
                  ))}
                  {filteredTakas.length === 0 && (
                    <tr>
                      <Td colSpan={5} className="py-8">
                        <Empty title="No takas available" description={qualityFilter ? "No takas matching this quality." : "Godown is empty."} />
                      </Td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6 bg-slate-50 border-slate-200 sticky top-6">
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4">Dispatch Summary</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <div className="text-sm text-slate-500">Selected Takas</div>
                <div className={`text-3xl font-bold ${selectedTakaIds.size > 0 ? 'text-primary-700' : 'text-slate-400'}`}>
                  {selectedTakaIds.size}
                </div>
              </div>
              <div>
                <div className="text-sm text-slate-500">Total Meters</div>
                <div className={`text-2xl font-bold ${selectedTakaIds.size > 0 ? 'text-slate-900' : 'text-slate-400'}`}>
                  {selectedMeters.toFixed(2)}
                </div>
              </div>
            </div>
            
            <div className="mt-8 pt-6 border-t border-slate-200">
              <Button type="submit" className="w-full h-12 text-base shadow-sm" disabled={selectedTakaIds.size === 0 || !formData.mill_id}>
                <ShieldCheck className="w-5 h-5 mr-2" />
                Dispatch to Mill
              </Button>
            </div>
          </Card>
        </div>
      </form>
      </div>
    </Drawer>
  );
}
