import React, { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Home, Database, Scissors, Truck, ShoppingCart, Settings, Menu, X, CheckCircle, Store, Palette, MapPin, Boxes, TrendingDown, SearchCheck } from 'lucide-react';
import { Modal, Button, Input, Select } from './ui';
import { resetDemo, getDeadStockDays, setDeadStockDays } from '../db/repo';
import { mode, exportBackup } from '../db/client';

const DEAD_PRESETS = [
  { label: '1 day', days: 1 }, { label: '1 week', days: 7 }, { label: '1 month', days: 30 },
  { label: '3 months', days: 90 }, { label: '6 months', days: 180 }, { label: '1 year', days: 365 },
];
const UNITS = { days: 1, weeks: 7, months: 30, years: 365 };

/** Settings block: after how long without movement finished goods count as dead stock. */
function DeadStockSetting() {
  const [days, setDays] = useState(null);
  const [amount, setAmount] = useState('');
  const [unit, setUnit] = useState('days');
  const [error, setError] = useState('');
  useEffect(() => { getDeadStockDays().then(setDays).catch((e) => setError(e.message)); }, []);
  const save = async (d) => {
    try { setError(''); setDays(await setDeadStockDays(d)); } catch (e) { setError(e.message); }
  };
  const preset = DEAD_PRESETS.find((p) => p.days === days);
  return (
    <div className="p-4 border border-slate-200 rounded-lg space-y-3">
      <div>
        <div className="font-semibold text-slate-900">Dead stock</div>
        <div className="text-sm text-slate-600">Finished goods with no movement for <strong className="text-slate-900">{days ?? '…'} {days === 1 ? 'day' : 'days'}</strong>{preset ? ` (${preset.label})` : ''} or more</div>
      </div>
      <div className="flex flex-wrap gap-2">
        {DEAD_PRESETS.map((p) => (
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
    </div>
  );
}

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: Home },
  { path: '/orders', label: 'Orders', icon: ShoppingCart },
  { path: '/po', label: 'Grey PO', icon: Store },
  { path: '/receipts', label: 'Grey Challan', icon: CheckCircle },
  { path: '/dispatch', label: 'Mill Dispatch', icon: Truck },
  { path: '/programs', label: 'Dyeing', icon: Palette },
  { path: '/folding', label: 'Folding', icon: Scissors },
  { path: '/inventory', label: 'Inventory', icon: Boxes },
  { path: '/assignment', label: 'Rack/Godown', icon: MapPin },
  { path: '/availability', label: 'Availability', icon: SearchCheck },
  { path: '/reports/shrinkage', label: 'Shrinkage Report', icon: TrendingDown },
  { path: '/masters/weavers', label: 'Masters', icon: Database },
];

export function AppShell() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsError, setSettingsError] = useState('');
  // other screens can open the settings (e.g. the dead-stock rule on the Inventory page)
  useEffect(() => {
    const open = () => setSettingsOpen(true);
    window.addEventListener('vinee:open-settings', open);
    return () => window.removeEventListener('vinee:open-settings', open);
  }, []);

  const handleBackup = async () => {
    try {
      const bytes = await exportBackup();
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }));
      const a = document.createElement('a');
      a.href = url; a.download = `vinee-backup-${new Date().toISOString().slice(0, 10)}.sqlite`; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { setSettingsError(e.message); }
  };

  const handleReset = async () => {
    if (confirm('Reset all demo data? This will clear everything.')) {
      await resetDemo();
      window.location.href = '/';
    }
  };

  return (
    <div className="app-root flex h-screen bg-slate-50 overflow-hidden font-sans text-slate-900">
      {/* Desktop Sidebar */}
      <aside className="print:hidden hidden lg:flex flex-col w-64 border-r border-slate-200 bg-white shadow-sm">
        <div className="h-16 flex items-center px-6 border-b border-slate-100">
          <div className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary-600 to-primary-400">
            Vinee Creation
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-100">
          <button
            onClick={() => setSettingsOpen(true)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 w-full transition-colors"
          >
            <Settings className="w-5 h-5" />
            Settings
          </button>
        </div>
      </aside>

      {/* Mobile Header & Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="print:hidden lg:hidden flex items-center h-14 px-4 bg-white border-b border-slate-200">
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 -ml-2 mr-2 text-slate-600">
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
          <div className="text-lg font-bold text-primary-600">Vinee Creation</div>
        </header>

        {/* Mobile Menu Overlay */}
        {mobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 z-50 flex">
            <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)}></div>
            <div className="relative flex-1 flex flex-col max-w-[280px] w-full bg-white shadow-2xl h-full animate-in slide-in-from-left duration-200">
              <div className="h-14 flex items-center justify-between px-4 border-b border-slate-100">
                <div className="text-lg font-bold text-primary-600">Menu</div>
                <button onClick={() => setMobileMenuOpen(false)} className="p-2 -mr-2 text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <nav className="flex-1 overflow-y-auto p-3 space-y-1">
                {NAV_ITEMS.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium ${
                        isActive ? 'bg-primary-50 text-primary-700' : 'text-slate-600'
                      }`
                    }
                  >
                    <item.icon className="w-5 h-5" />
                    {item.label}
                  </NavLink>
                ))}
                <div className="pt-2 mt-2 border-t border-slate-100">
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setSettingsOpen(true);
                    }}
                    className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-slate-600 w-full"
                  >
                    <Settings className="w-5 h-5" />
                    Settings
                  </button>
                </div>
              </nav>
            </div>
          </div>
        )}

        <main className="app-main flex-1 overflow-y-auto p-4 sm:p-5 md:p-6 xl:p-8">
          <Outlet />
        </main>
      </div>

      <Modal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} title="System Settings">
        <div className="space-y-4">
          <DeadStockSetting />
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
            <div>
              <div className="font-medium text-slate-900">Storage Mode</div>
              <div className="text-sm text-slate-500">{mode === 'turso' ? 'Remote database (Turso)' : 'Local IndexedDB (this browser only)'}</div>
            </div>
            <div className="px-2 py-1 text-xs font-semibold bg-primary-100 text-primary-700 rounded">
              {mode === 'turso' ? 'REMOTE' : 'LOCAL'}
            </div>
          </div>
          {settingsError && <div className="text-sm text-red-600">{settingsError}</div>}
          {mode === 'local' ? (
            <>
              <button
                onClick={handleBackup}
                className="w-full py-2.5 px-4 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
              >
                Download database backup
              </button>
              <button
                onClick={handleReset}
                className="w-full py-2.5 px-4 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors"
              >
                Reset Demo Data
              </button>
            </>
          ) : (
            <div className="text-xs text-slate-500">Reset is disabled on a remote database.</div>
          )}
        </div>
      </Modal>
    </div>
  );
}
