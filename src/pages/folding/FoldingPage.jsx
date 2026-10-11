import React, { useState, useEffect } from 'react';
import { PageHeader, Card, Button, Input, Table, Th, Td } from '../../components/ui';
import { CheckCircle, Search, Scissors } from 'lucide-react';
import * as repo from '../../db/repo';

export default function FoldingPage() {
  const [loading, setLoading] = useState(true);
  const [takas, setTakas] = useState([]);
  const [search, setSearch] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  async function load() {
    try {
      const all = await repo.listTakas("WHERE t.status='FINISHED'");
      // Group them logically or just show in list. Spec: "grouped by quality+shade"
      // we'll just sort them by quality and shade for now
      all.sort((a, b) => {
        const q = (a.quality_name || '').localeCompare(b.quality_name || '');
        if (q !== 0) return q;
        return (a.shade_no || '').localeCompare(b.shade_no || '');
      });

      setTakas(all.map(t => ({
        ...t,
        selected: false,
        input_folded_meter: t.finished_meter
      })));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const toggleRow = (tId) => {
    setTakas(takas.map(r => r.id === tId ? { ...r, selected: !r.selected } : r));
  };

  const updateRow = (tId, val) => {
    setTakas(takas.map(r => r.id === tId ? { ...r, input_folded_meter: val, selected: true } : r));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const selected = takas.filter(r => r.selected);
      if (selected.length === 0) throw new Error('Select at least one taka to fold.');
      
      const rows = selected.map(r => {
        if (!r.input_folded_meter || Number(r.input_folded_meter) <= 0) {
          throw new Error(`Folded meter required for Taka ${r.taka_no}`);
        }
        return { id: r.id, folded_meter: Number(r.input_folded_meter) };
      });

      await repo.foldTakas(rows, date);
      alert('Successfully folded selected takas.');
      load();
    } catch (err) {
      alert(err.message);
    }
  };

  const filtered = takas.filter(t => 
    t.taka_no.toLowerCase().includes(search.toLowerCase()) || 
    (t.quality_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (t.shade_no || '').toLowerCase().includes(search.toLowerCase())
  );

  const selectedRows = takas.filter(r => r.selected);
  const totalFin = selectedRows.reduce((s, r) => s + Number(r.finished_meter || 0), 0);
  const totalFold = selectedRows.reduce((s, r) => s + Number(r.input_folded_meter || 0), 0);
  const shrinkage = totalFin > 0 ? (((totalFin - totalFold) / totalFin) * 100).toFixed(2) : 0;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <PageHeader 
        title="Folding" 
        description="Cut and fold finished takas to ready stock"
      >
        <div className="flex items-center gap-3">
          <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-40" />
          <Button onClick={handleSave} disabled={selectedRows.length === 0}>
            <Scissors className="w-4 h-4 mr-2" /> Fold Selected
          </Button>
        </div>
      </PageHeader>

      <Card>
        <div className="p-5 border-b border-slate-100 flex flex-wrap gap-4 justify-between items-center bg-slate-50/50 rounded-t-xl">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <Input className="pl-9 bg-white" placeholder="Search takas, quality..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-6 text-sm font-medium items-center">
            <div>Pending to fold: <span className="text-slate-900">{takas.length}</span></div>
            <div className="w-px h-4 bg-slate-300"></div>
            <div>Selected: <span className="text-primary-600">{selectedRows.length}</span></div>
            <div>Fold Shrinkage: <span className={shrinkage > 5 ? 'text-red-500' : 'text-slate-600'}>{shrinkage}%</span></div>
          </div>
        </div>

        <Table>
          <thead>
            <tr>
              <Th className="w-12 text-center">
                <input type="checkbox" 
                  checked={filtered.length > 0 && filtered.every(r => r.selected)} 
                  onChange={e => {
                    const checked = e.target.checked;
                    setTakas(takas.map(t => filtered.find(f => f.id === t.id) ? { ...t, selected: checked } : t));
                  }} 
                />
              </Th>
              <Th>Quality</Th>
              <Th>Shade</Th>
              <Th>Taka No</Th>
              <Th className="text-right">Finished M</Th>
              <Th className="text-right w-32">Folded M *</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.id} className={r.selected ? 'bg-primary-50/30' : ''}>
                <Td className="text-center">
                  <input type="checkbox" checked={r.selected} onChange={() => toggleRow(r.id)} />
                </Td>
                <Td className="font-medium text-slate-900">{r.quality_name}</Td>
                <Td>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-sm border border-slate-200" style={{ backgroundColor: r.shade_hex || '#ccc' }}></div>
                    <span>{r.shade_no}</span>
                  </div>
                </Td>
                <Td className="font-medium">{r.taka_no}</Td>
                <Td className="text-right text-slate-500">{r.finished_meter}</Td>
                <Td className="text-right">
                  <Input 
                    type="number" step="0.01" 
                    className="w-24 ml-auto text-right h-8 border-primary-300 focus:border-primary-500" 
                    value={r.input_folded_meter} 
                    onChange={e => updateRow(r.id, e.target.value)} 
                  />
                </Td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><Td colSpan={6} className="py-12 text-center text-slate-500">
                {loading ? 'Loading...' : 'No finished takas ready for folding.'}
              </Td></tr>
            )}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
