import React, { useEffect, useState } from 'react';
import { PageHeader, Card, Button, Input, Select } from '../components/ui';
import { resetDemo, getDeadStockDays, setDeadStockDays, getPaymentDays, setPaymentDays } from '../db/repo';
import { mode, exportBackup } from '../db/client';

const UNITS = { days: 1, weeks: 7, months: 30, years: 365 };
const DEAD_PRESETS = [
  { label: '1 day', days: 1 }, { label: '1 week', days: 7 }, { label: '1 month', days: 30 },
  { label: '3 months', days: 90 }, { label: '6 months', days: 180 }, { label: '1 year', days: 365 },
];
const PAY_PRESETS = [
  { label: '30 days', days: 30 }, { label: '45 days', days: 45 }, { label: '60 days', days: 60 },
  { label: '90 days', days: 90 }, { label: '120 days', days: 120 }, { label: '180 days', days: 180 },
];

/** A "number of days" rule: presets + a custom amount in days / weeks / months / years. */
function DaysSetting({ title, describe, presets, load, save: store }) {
  const [days, setDays] = useState(null);
  const [amount, setAmount] = useState('');
  const [unit, setUnit] = useState('days');
  const [error, setError] = useState('');
  useEffect(() => { load().then(setDays).catch((e) => setError(e.message)); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const save = async (d) => {
    try { setError(''); setDays(await store(d)); } catch (e) { setError(e.message); }
  };
  const preset = presets.find((p) => p.days === days);
  return (
    <Card className="p-5 space-y-3">
      <div>
        <div className="font-semibold text-slate-900">{title}</div>
        <div className="text-sm text-slate-600">{describe(days, preset)}</div>
      </div>
      <div className="flex flex-wrap gap-2">
        {presets.map((p) => (
          <button key={p.days} type="button" onClick={() => save(p.days)}
            className={`h-10 px-3 rounded-md border text-sm font-medium ${days === p.days ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}>{p.label}</button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Input type="number" min="1" className="w-24" placeholder="Custom" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <Select className="w-32" value={unit} onChange={(e) => setUnit(e.target.value)}>
          {Object.keys(UNITS).map((u) => <option key={u} value={u}>{u}</option>)}
        </Select>
        <Button type="button" variant="outline" disabled={!amount} onClick={() => { save(Math.round(Number(amount) * UNITS[unit])); setAmount(''); }}>Set</Button>
      </div>
      {error && <div className="text-sm text-red-600">{error}</div>}
    </Card>
  );
}

const dayWord = (d) => `${d ?? '…'} ${d === 1 ? 'day' : 'days'}`;

/** Full Settings screen (was a popup): stock and payment rules, storage, backup and demo reset. */
export default function SettingsPage() {
  const [error, setError] = useState('');

  const handleBackup = async () => {
    try {
      const bytes = await exportBackup();
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }));
      const a = document.createElement('a');
      a.href = url; a.download = `vinee-backup-${new Date().toISOString().slice(0, 10)}.sqlite`; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { setError(e.message); }
  };

  const handleReset = async () => {
    if (confirm('Reset all demo data? This will clear everything.')) {
      await resetDemo();
      window.location.href = '/';
    }
  };

  return (
    <div className="page-w space-y-8">
      <PageHeader title="Settings" description="Rules used across the app, storage and backup." />

      <section className="space-y-3">
        <h2 className="text-sm font-bold text-forest">Payments</h2>
        <DaysSetting
          title="Payment reminder"
          describe={(d) => <>An order shows <strong className="text-slate-900">Payment due</strong> when no payment was logged for <strong className="text-slate-900">{dayWord(d)}</strong>, counted from its first dispatch (or from its last payment). This is the default for every order; an order can have its own days.</>}
          presets={PAY_PRESETS} load={getPaymentDays} save={setPaymentDays}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold text-forest">Stock</h2>
        <DaysSetting
          title="Dead stock"
          describe={(d, preset) => <>Finished goods with no movement for <strong className="text-slate-900">{dayWord(d)}</strong>{preset ? ` (${preset.label})` : ''} or more</>}
          presets={DEAD_PRESETS} load={getDeadStockDays} save={setDeadStockDays}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold text-forest">Data</h2>
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-medium text-slate-900">Storage Mode</div>
              <div className="text-sm text-slate-500">{mode === 'turso' ? 'Remote database (Turso)' : 'Local IndexedDB (this browser only)'}</div>
            </div>
            <div className="px-2 py-1 text-xs font-semibold bg-primary-100 text-primary-700 rounded">{mode === 'turso' ? 'REMOTE' : 'LOCAL'}</div>
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
          {mode === 'local' ? (
            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" onClick={handleBackup}>Download database backup</Button>
              <Button variant="danger" onClick={handleReset}>Reset Demo Data</Button>
            </div>
          ) : (
            <div className="text-xs text-slate-500">Reset is disabled on a remote database.</div>
          )}
        </Card>
      </section>
    </div>
  );
}
