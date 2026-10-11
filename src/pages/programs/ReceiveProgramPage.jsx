import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageHeader, Card, Button, Input, Field, Table, Th, Td, Drawer } from '../../components/ui';
import { ArrowLeft, Save, CheckCircle, ClipboardPaste } from 'lucide-react';
import * as repo from '../../db/repo';

export default function ReceiveProgramPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [program, setProgram] = useState(null);

  const [formData, setFormData] = useState({
    challan_no: '',
    date: new Date().toISOString().slice(0, 10),
    notes: ''
  });

  const [rows, setRows] = useState([]);
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteText, setPasteText] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const data = await repo.getProgram(id);
        if (!data) return navigate('/programs');
        setProgram(data);
        
        // initialize rows with pending takas
        const pending = data.takas.filter(t => !t.finished_receipt_id).map(t => ({
          ...t,
          selected: false,
          mill_grey_meter: t.grey_meter,
          finished_meter: ''
        }));
        setRows(pending);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  const toggleRow = (tId) => {
    setRows(rows.map(r => r.id === tId ? { ...r, selected: !r.selected } : r));
  };

  const updateRow = (tId, field, value) => {
    setRows(rows.map(r => r.id === tId ? { ...r, [field]: value, selected: true } : r));
  };

  const handleProcessPaste = () => {
    const meters = pasteText.trim().split(/[\s,]+/).map(m => parseFloat(m)).filter(m => !isNaN(m) && m > 0);
    if (meters.length === 0) return alert('No valid numbers found to paste.');
    if (meters.length > rows.length) {
      alert(`You pasted ${meters.length} meters, but only ${rows.length} takas are pending. Only the first ${rows.length} will be populated.`);
    }

    setRows(rows.map((r, i) => {
      if (i < meters.length) {
        return { ...r, finished_meter: meters[i], selected: true };
      }
      return r;
    }));
    
    setPasteText('');
    setPasteMode(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const selected = rows.filter(r => r.selected);
      if (selected.length === 0) throw new Error('Select at least one taka to receive.');
      for (const r of selected) {
        if (!r.finished_meter || Number(r.finished_meter) <= 0) {
          throw new Error(`Finished meter is required for selected taka ${r.taka_no}.`);
        }
      }

      await repo.createFinishedReceipt({
        program_id: id,
        ...formData,
        rows: selected
      });
      navigate(`/programs/${id}`);
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading || !program) return <div className="p-12 text-center text-slate-500">Loading...</div>;

  const totalGrey = rows.filter(r => r.selected).reduce((s, r) => s + Number(r.mill_grey_meter || 0), 0);
  const totalFin = rows.filter(r => r.selected).reduce((s, r) => s + Number(r.finished_meter || 0), 0);
  const shrinkage = totalGrey > 0 ? (((totalGrey - totalFin) / totalGrey) * 100).toFixed(2) : 0;

  return (
    <Drawer isOpen={true} onClose={() => navigate(`/programs/${id}`)}>
      <div className="space-y-6 max-w-5xl mx-auto">
        <PageHeader 
          title="Receive Finished Goods" 
          description={`Receiving against Program ${program.program_no} (${program.mill_name})`}
        >
          <Button variant="ghost" onClick={() => navigate(`/programs/${id}`)}><ArrowLeft className="w-4 h-4 mr-2" /> Back</Button>
        </PageHeader>

      <form onSubmit={handleSave} className="space-y-6">
        <Card className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Field label="Mill Challan No *">
              <Input required value={formData.challan_no} onChange={e => setFormData({ ...formData, challan_no: e.target.value })} />
            </Field>
            <Field label="Date *">
              <Input type="date" required value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} />
            </Field>
            <Field label="Notes (Optional)">
              <Input value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} />
            </Field>
          </div>
        </Card>

        <Card>
          <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-xl">
            <h3 className="font-semibold text-slate-900">Pending Takas in Dyeing</h3>
            <div className="flex items-center gap-4 text-sm font-medium">
              <Button type="button" variant={pasteMode ? "primary" : "outline"} size="sm" onClick={() => setPasteMode(!pasteMode)}>
                <ClipboardPaste className="w-4 h-4 mr-2" /> Bulk Paste
              </Button>
              <div className="w-px h-4 bg-slate-200"></div>
              <div>Selected: <span className="text-primary-600">{rows.filter(r => r.selected).length}</span></div>
              <div>Shrinkage: <span className={shrinkage > 10 ? 'text-red-500' : 'text-slate-600'}>{shrinkage}%</span></div>
            </div>
          </div>
          
          {pasteMode && (
            <div className="p-5 bg-primary-50/50 border-b border-primary-100 flex gap-4">
              <div className="flex-1">
                <textarea
                  className="w-full h-24 p-3 rounded-lg border border-primary-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
                  placeholder="Paste finished meters here (separated by spaces, commas, or new lines)..."
                  value={pasteText}
                  onChange={e => setPasteText(e.target.value)}
                ></textarea>
              </div>
              <div className="flex items-end pb-1">
                <Button type="button" onClick={handleProcessPaste} disabled={!pasteText.trim()}>Process Meters</Button>
              </div>
            </div>
          )}

          <Table>
            <thead>
              <tr>
                <Th className="w-12 text-center">
                  <input type="checkbox" 
                    checked={rows.length > 0 && rows.every(r => r.selected)} 
                    onChange={e => setRows(rows.map(r => ({...r, selected: e.target.checked})))} 
                  />
                </Th>
                <Th>Shade</Th>
                <Th>Taka No</Th>
                <Th className="text-right">Grey M</Th>
                <Th className="text-right">Mill Grey M</Th>
                <Th className="text-right w-32">Finished M *</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const line = program.lines?.find(l => l.id === r.program_line_id) || {};
                return (
                  <tr key={r.id} className={r.selected ? 'bg-primary-50/30' : ''}>
                    <Td className="text-center">
                      <input type="checkbox" checked={r.selected} onChange={() => toggleRow(r.id)} />
                    </Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: line.hex || '#ccc' }}></div>
                        <span className="font-medium">{line.shade_no}</span>
                      </div>
                    </Td>
                    <Td className="font-medium text-slate-900">{r.taka_no}</Td>
                    <Td className="text-right text-slate-500">{r.grey_meter}</Td>
                    <Td className="text-right">
                      <Input type="number" step="0.01" className="w-24 ml-auto text-right h-8" value={r.mill_grey_meter} onChange={e => updateRow(r.id, 'mill_grey_meter', e.target.value)} />
                    </Td>
                    <Td className="text-right">
                      <Input type="number" step="0.01" className="w-24 ml-auto text-right h-8 border-primary-300 focus:border-primary-500" value={r.finished_meter} onChange={e => updateRow(r.id, 'finished_meter', e.target.value)} />
                    </Td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><Td colSpan={6} className="py-8 text-center text-slate-500">No pending takas to receive for this program.</Td></tr>
              )}
            </tbody>
          </Table>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" size="lg" disabled={rows.filter(r => r.selected).length === 0}>
            <CheckCircle className="w-5 h-5 mr-2" />
            Receive Selected
          </Button>
        </div>
      </form>
      </div>
    </Drawer>
  );
}
