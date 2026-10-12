import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageHeader, Card, Button, Input, Field, Table, Th, Td, Drawer, Alert, useAction } from '../../components/ui';
import { fmtM } from '../../lib/format';
import { ArrowLeft, CheckCircle, ClipboardPaste } from 'lucide-react';
import * as repo from '../../db/repo';
import { DetailList } from '../../components/kit';

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
  const [loadError, setLoadError] = useState('');
  const { busy, error, setError, run } = useAction();
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
        setLoadError(e.message);
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
    if (meters.length === 0) return setError('No valid numbers found to paste.');
    if (meters.length > rows.length) setError(`You pasted ${meters.length} meters but only ${rows.length} takas are pending - the extra ones were ignored.`);
    else setError('');

    setRows(rows.map((r, i) => {
      if (i < meters.length) {
        return { ...r, finished_meter: meters[i], selected: true };
      }
      return r;
    }));
    
    setPasteText('');
    setPasteMode(false);
  };

  const handleSave = (e) => {
    e.preventDefault();
    run(async () => {
      const selected = rows.filter(r => r.selected);
      if (selected.length === 0) throw new Error('Select at least one taka to receive.');
      for (const r of selected) {
        if (!r.finished_meter || Number(r.finished_meter) <= 0) throw new Error(`Finished meter is required for selected taka ${r.taka_no}.`);
      }
      await repo.createFinishedReceipt({ program_id: id, ...formData, rows: selected });
      navigate(`/programs/${id}`);
    });
  };

  if (loading || loadError || !program) return <Drawer isOpen onClose={() => navigate('/programs')}>{loadError ? <Alert>{loadError}</Alert> : <div className="p-12 text-center text-slate-500">Loading...</div>}</Drawer>;

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

        <Card className="p-4">
          <div className="text-xs font-bold text-slate-500 mb-2">Pending per shade</div>
          <div className="flex flex-wrap gap-3 text-sm">
            {program.lines.map(l => (
              <span key={l.id} className="inline-flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
                <span className="w-3 h-3 rounded-sm border border-slate-200" style={{ backgroundColor: l.hex }} />
                {l.item_code ? l.item_code + ' · ' : ''}Shade {l.shade_no}: <strong>{l.taka_count - l.received}</strong> pending of {l.taka_count}
              </span>
            ))}
          </div>
        </Card>

        <Card>
          <div className="p-5 border-b border-slate-100 space-y-4">
            <div className="flex justify-between items-center gap-3">
              <h3 className="font-semibold text-slate-900">Pending takas in dyeing</h3>
              <Button type="button" variant={pasteMode ? "primary" : "outline"} size="sm" onClick={() => setPasteMode(!pasteMode)}>
                <ClipboardPaste className="w-4 h-4 mr-2" /> Bulk Paste
              </Button>
            </div>
            <DetailList items={[
              { label: 'Selected takas', value: rows.filter(r => r.selected).length },
              { label: 'Grey meters', value: `${fmtM(totalGrey)} m` },
              { label: 'Finished meters', value: `${fmtM(totalFin)} m` },
              { label: 'Shrinkage', value: <span className={shrinkage > 10 ? 'text-red-600' : ''}>{fmtM(totalGrey - totalFin)} m ({shrinkage}%)</span> },
            ]} />
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
                <Th className="text-right">Loss m</Th>
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
                    <Td className="text-right font-semibold text-slate-900">{fmtM(r.grey_meter)}</Td>
                    <Td className="text-right">
                      <Input type="number" step="0.01" className="w-24 ml-auto text-right h-10" value={r.mill_grey_meter} onChange={e => updateRow(r.id, 'mill_grey_meter', e.target.value)} />
                    </Td>
                    <Td className="text-right">
                      <Input type="number" step="0.01" className="w-24 ml-auto text-right h-10 border-primary-300 focus:border-primary-500" value={r.finished_meter} onChange={e => updateRow(r.id, 'finished_meter', e.target.value)} />
                    </Td>
                    <Td className="text-right text-slate-600">{r.finished_meter !== '' && r.mill_grey_meter !== '' ? fmtM(Number(r.mill_grey_meter) - Number(r.finished_meter)) : '-'}</Td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><Td colSpan={7} className="py-8 text-center text-slate-500">No pending takas to receive for this program.</Td></tr>
              )}
            </tbody>
          </Table>
        </Card>

        <Alert>{error}</Alert>
        <div className="flex justify-end">
          <Button type="submit" size="lg" disabled={busy || rows.filter(r => r.selected).length === 0}>
            <CheckCircle className="w-5 h-5 mr-2" />
            {busy ? 'Saving…' : 'Receive Selected'}
          </Button>
        </div>
      </form>
      </div>
    </Drawer>
  );
}
