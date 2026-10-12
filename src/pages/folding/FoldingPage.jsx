import React, { useState, useEffect } from 'react';
import { PageHeader, Card, Button, Input, Select, Table, Th, Td, Alert, LoadState, Pager, usePaged, useAction } from '../../components/ui';
import { fmtM } from '../../lib/format';
import { Search, Scissors } from 'lucide-react';
import * as repo from '../../db/repo';
import { useDbVersion } from '../../lib/live';
import { DetailList, SearchToggle } from '../../components/kit';
import { SearchArea } from '../../components/ui';

export default function FoldingPage() {
  const [loading, setLoading] = useState(true);
  const [takas, setTakas] = useState([]);
  const [search, setSearch] = useState('');
  const [qualityFilter, setQualityFilter] = useState('');
  const [loadError, setLoadError] = useState('');
  const [okMsg, setOkMsg] = useState('');
  const { busy, error, run } = useAction();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  async function load() {
    try {
      const all = await repo.listTakas("WHERE t.status='FINISHED'");
      // Group them logically or just show in list. Spec: "grouped by quality+shade"
      // we'll just sort them by quality and shade for now
      all.sort((a, b) => {
        const q = (a.nick_name || '').localeCompare(b.nick_name || '');
        if (q !== 0) return q;
        return (a.shade_no || '').localeCompare(b.shade_no || '');
      });

      setTakas(all.map(t => ({
        ...t,
        selected: false,
        input_folded_meter: t.finished_meter
      })));
    } catch (e) {
      setLoadError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const dbVersion = useDbVersion();
  useEffect(() => {
    load();
  }, [dbVersion]);

  const toggleRow = (tId) => {
    setTakas(takas.map(r => r.id === tId ? { ...r, selected: !r.selected } : r));
  };

  const updateRow = (tId, val) => {
    setTakas(takas.map(r => r.id === tId ? { ...r, input_folded_meter: val, selected: true } : r));
  };

  const handleSave = (e) => {
    e.preventDefault();
    run(async () => {
      const selected = takas.filter(r => r.selected);
      if (selected.length === 0) throw new Error('Select at least one taka to fold.');
      const rows = selected.map(r => {
        if (!r.input_folded_meter || Number(r.input_folded_meter) <= 0) throw new Error(`Folded meter required for Taka ${r.label}`);
        return { id: r.id, folded_meter: r.input_folded_meter };
      });
      const n = await repo.foldTakas(rows, date);
      setOkMsg(`${n} takas folded - they are now ready stock.`);
      await load();
    });
  };

  const qualityOptions = [...new Map(takas.map(t => [String(t.quality_id), t.nick_name])).entries()].sort((a, b) => String(a[1]).localeCompare(String(b[1])));
  const filtered = takas.filter(t => (!qualityFilter || String(t.quality_id) === qualityFilter) && (
    `${t.challan_no}/${t.taka_no}`.toLowerCase().includes(search.toLowerCase()) || 
    (t.nick_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (t.shade_no || '').toLowerCase().includes(search.toLowerCase()) ||
    (t.item_code || '').toLowerCase().includes(search.toLowerCase())
  ));

  const paged = usePaged(filtered, 100);
  const selectedRows = takas.filter(r => r.selected);
  const totalFin = selectedRows.reduce((s, r) => s + Number(r.finished_meter || 0), 0);
  const totalFold = selectedRows.reduce((s, r) => s + Number(r.input_folded_meter || 0), 0);
  const shrinkage = totalFin > 0 ? (((totalFin - totalFold) / totalFin) * 100).toFixed(2) : 0;

  if (loadError) return <LoadState error={loadError} onRetry={load} />;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <PageHeader 
        title="Folding" 
        description="Cut and fold finished takas to ready stock"
      >
        <div className="flex items-center gap-3">
          <Select className="w-44" value={qualityFilter} onChange={e => setQualityFilter(e.target.value)}>
            <option value="">All qualities</option>
            {qualityOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </Select>
          <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-40" />
          <Button onClick={handleSave} disabled={busy || selectedRows.length === 0}>
            <Scissors className="w-4 h-4 mr-2" /> Fold Selected
          </Button>
        </div>
      </PageHeader>

      <Card>
        <SearchArea className="p-5 border-b border-slate-100">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <DetailList className="flex-1" items={[
              { label: 'Pending to fold', value: takas.length },
              { label: 'Selected', value: selectedRows.length },
              { label: 'Fold shrinkage', value: <span className={shrinkage > 5 ? 'text-red-600' : ''}>{fmtM(totalFin - totalFold)} m ({shrinkage}%)</span> },
            ]} />
            <SearchToggle value={search} onChange={setSearch} placeholder="Search takas, quality..." />
          </div>
        </SearchArea>

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
              <Th>Item / shade</Th>
              <Th>Taka No</Th>
              <Th className="text-right">Finished M</Th>
              <Th className="text-right w-32">Folded M *</Th>
            </tr>
          </thead>
          <tbody>
            {paged.rows.map(r => (
              <tr key={r.id} className={r.selected ? 'bg-primary-50/30' : ''}>
                <Td className="text-center">
                  <input type="checkbox" checked={r.selected} onChange={() => toggleRow(r.id)} />
                </Td>
                <Td className="font-medium text-slate-900">{r.nick_name}</Td>
                <Td>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-sm border border-slate-200" style={{ backgroundColor: r.shade_hex || '#ccc' }}></div>
                    <span className="font-mono font-semibold text-slate-900">{r.item_code || r.shade_no}</span>{r.item_code && <span className="text-xs text-slate-500">{r.shade_no}</span>}
                  </div>
                </Td>
                <Td className="font-medium">{r.label}</Td>
                <Td className="text-right font-semibold text-slate-900">{fmtM(r.finished_meter)}</Td>
                <Td className="text-right">
                  <Input 
                    type="number" step="0.01" 
                    className="w-24 ml-auto text-right h-10 border-primary-300 focus:border-primary-500" 
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
        <Pager paged={paged} />
      </Card>
      <Alert>{error}</Alert>
      <Alert tone="success">{okMsg}</Alert>
    </div>
  );
}
