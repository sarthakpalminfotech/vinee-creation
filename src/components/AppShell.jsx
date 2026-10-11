import React, { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Home, Database, Scissors, Truck, ShoppingCart, Settings, Menu, X, CheckCircle, Store, Palette, MapPin } from 'lucide-react';
import { Modal } from './ui';
import { resetDemo } from '../db/repo';

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: Home },
  { path: '/masters/weavers', label: 'Masters', icon: Database },
  { path: '/po', label: 'Grey PO', icon: Store },
  { path: '/receipts', label: 'Grey Challan', icon: CheckCircle },
  { path: '/programs', label: 'Dyeing', icon: Palette },
  { path: '/dispatch', label: 'Mill Dispatch', icon: Truck },
  { path: '/folding', label: 'Folding', icon: Scissors },
  { path: '/assignment', label: 'Rack/Godown', icon: MapPin },
  { path: '/orders', label: 'Orders', icon: ShoppingCart },
];

export function AppShell() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const handleReset = async () => {
    if (confirm('Reset all demo data? This will clear everything.')) {
      await resetDemo();
      window.location.href = '/';
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans text-slate-900">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 border-r border-slate-200 bg-white shadow-sm">
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
        <header className="lg:hidden flex items-center h-14 px-4 bg-white border-b border-slate-200">
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

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>

      <Modal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} title="System Settings">
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
            <div>
              <div className="font-medium text-slate-900">Storage Mode</div>
              <div className="text-sm text-slate-500">Local IndexedDB</div>
            </div>
            <div className="px-2 py-1 text-xs font-semibold bg-primary-100 text-primary-700 rounded">
              LOCAL
            </div>
          </div>
          <button
            onClick={handleReset}
            className="w-full py-2.5 px-4 bg-red-50 text-red-600 rounded-xl text-sm font-medium hover:bg-red-100 transition-colors"
          >
            Reset Demo Data
          </button>
        </div>
      </Modal>
    </div>
  );
}
