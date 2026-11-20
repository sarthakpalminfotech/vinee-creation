import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import ErrorBoundary from './ErrorBoundary';
import { Home, Database, Scissors, Truck, ShoppingCart, Settings, Menu, X, CheckCircle, Store, Palette, Boxes, TrendingDown, SearchCheck, Hammer } from 'lucide-react';
import logo from '../assets/logo.png';

// Grouped the way the goods move: sales → grey → processing → stock. Setup (masters, settings) sits at the bottom.
// `short` is the label under the icon on the tablet rail (portrait), where only ~10 characters fit.
// Sized so the whole menu fits a landscape tablet (≈ 750 px tall) without scrolling.
const NAV_GROUPS = [
  { label: '', items: [
    { path: '/', label: 'Dashboard', short: 'Home', icon: Home },
  ] },
  { label: 'Sales', items: [
    { path: '/orders', label: 'Orders', short: 'Orders', icon: ShoppingCart },
    { path: '/availability', label: 'Availability', short: 'Availability', icon: SearchCheck },
  ] },
  { label: 'Grey', items: [
    { path: '/po', label: 'Grey PO', short: 'Grey PO', icon: Store },
    { path: '/receipts', label: 'Grey Challan', short: 'Challan', icon: CheckCircle },
  ] },
  { label: 'Processing', items: [
    { path: '/dispatch', label: 'Mill Dispatch', short: 'Dispatch', icon: Truck },
    { path: '/programs', label: 'Dyeing', short: 'Dyeing', icon: Palette },
    { path: '/folding', label: 'Folding', short: 'Folding', icon: Scissors },
    { path: '/job-work', label: 'Job Work', short: 'Job Work', icon: Hammer },
  ] },
  { label: 'Stock & reports', items: [
    { path: '/inventory', label: 'Inventory', short: 'Inventory', icon: Boxes },
    { path: '/reports/shrinkage', label: 'Shrinkage Report', short: 'Shrinkage', icon: TrendingDown },
  ] },
];
const SETUP = [
  { path: '/masters', label: 'Masters', short: 'Masters', icon: Database },
  { path: '/settings', label: 'Settings', short: 'Settings', icon: Settings },
];

function Brand({ compact = false }) {
  if (compact) return <img src={logo} alt="Vinee Creations" className="w-12 h-12 rounded-full shadow-md ring-1 ring-gold/40" />;
  return (
    <div className="flex items-center gap-3 min-w-0">
      <img src={logo} alt="" className="w-11 h-11 shrink-0 rounded-full shadow-md ring-1 ring-gold/40" />
      <div className="min-w-0 leading-tight">
        <div className="font-display text-[17px] font-extrabold tracking-[0.14em] text-white">VINEE</div>
        <div className="text-[10px] font-semibold tracking-[0.2em] text-gold-light">CREATIONS ERP</div>
      </div>
    </div>
  );
}

/** Full sidebar row (landscape tablets, desktops, phone drawer). */
function SideLink({ item, onClick }) {
  return (
    <NavLink
      to={item.path}
      end={item.path === '/'}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-3 h-10 px-3 rounded-lg text-[14px] font-medium transition-colors ${
          isActive ? 'bg-forest-lighter text-white shadow-sm' : 'text-white/70 hover:bg-forest-light hover:text-white'
        }`
      }
    >
      <item.icon className="w-5 h-5 shrink-0" strokeWidth={1.9} />
      <span className="truncate">{item.label}</span>
    </NavLink>
  );
}

/** Icon-over-label tile on the tablet rail (portrait). */
function RailLink({ item }) {
  return (
    <NavLink
      to={item.path}
      end={item.path === '/'}
      className={({ isActive }) =>
        `flex flex-col items-center justify-center gap-1 h-[60px] w-full rounded-xl text-[11px] font-medium leading-none transition-colors ${
          isActive ? 'bg-forest-lighter text-white shadow-sm' : 'text-white/65 hover:bg-forest-light hover:text-white'
        }`
      }
    >
      <item.icon className="w-[22px] h-[22px]" strokeWidth={1.9} />
      <span className="max-w-full truncate px-1">{item.short}</span>
    </NavLink>
  );
}

function SideNav({ onNavigate }) {
  return (
    <>
      <nav className="flex-1 overflow-y-auto dark-scroll px-3 py-3">
        {NAV_GROUPS.map((g) => (
          <div key={g.label || 'home'} className="mb-2">
            {g.label && <div className="px-3 pt-1.5 pb-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/45">{g.label}</div>}
            <div className="space-y-0.5">{g.items.map((item) => <SideLink key={item.path} item={item} onClick={onNavigate} />)}</div>
          </div>
        ))}
      </nav>
      <div className="px-3 py-2.5 border-t border-white/10 space-y-0.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
        {SETUP.map((item) => <SideLink key={item.path} item={item} onClick={onNavigate} />)}
      </div>
    </>
  );
}

export function AppShell() {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  // other screens can open the settings (e.g. the dead-stock rule on the Inventory page)
  useEffect(() => {
    const open = () => navigate('/settings');
    window.addEventListener('vinee:open-settings', open);
    return () => window.removeEventListener('vinee:open-settings', open);
  }, [navigate]);
  useEffect(() => { setMobileMenuOpen(false); }, [location.pathname]);

  return (
    <div className="app-root flex h-[100dvh] bg-ivory overflow-hidden font-sans text-slate-900">
      {/* Tablet portrait (768–1023): slim forest rail, always visible — every module one tap away */}
      <aside className="print:hidden hidden md:flex lg:hidden flex-col items-center w-[92px] shrink-0 bg-forest pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <NavLink to="/" className="mb-3 shrink-0" aria-label="Dashboard"><Brand compact /></NavLink>
        <nav className="flex-1 w-full overflow-y-auto dark-scroll px-2 space-y-1">
          {NAV_GROUPS.map((g, gi) => (
            <React.Fragment key={g.label}>
              {gi > 0 && <div className="mx-4 my-1.5 h-px bg-white/10" />}
              {g.items.map((item) => <RailLink key={item.path} item={item} />)}
            </React.Fragment>
          ))}
        </nav>
        <div className="w-full px-2 pt-2 mt-1 border-t border-white/10 space-y-1">{SETUP.map((item) => <RailLink key={item.path} item={item} />)}</div>
      </aside>

      {/* Tablet landscape and desktop (≥1024): full forest sidebar */}
      <aside className="print:hidden hidden lg:flex flex-col w-60 shrink-0 bg-forest pt-[env(safe-area-inset-top)]">
        <NavLink to="/" className="h-[72px] shrink-0 flex items-center px-5 border-b border-white/10"><Brand /></NavLink>
        <SideNav />
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Phone: forest top bar + drawer */}
        <header className="print:hidden md:hidden flex items-center gap-3 h-14 px-3 bg-forest pt-[env(safe-area-inset-top)] box-content">
          <button type="button" onClick={() => setMobileMenuOpen(true)} aria-label="Open menu" className="w-11 h-11 grid place-items-center rounded-lg text-white/85 hover:bg-forest-light">
            <Menu className="w-6 h-6" />
          </button>
          <img src={logo} alt="" className="w-8 h-8 rounded-full ring-1 ring-gold/40" />
          <div className="font-display text-[15px] font-extrabold tracking-[0.12em] text-white">VINEE <span className="text-gold-light font-semibold">CREATIONS</span></div>
        </header>

        {mobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-50 flex">
            <div className="fixed inset-0 bg-forest-dark/40 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
            <div className="relative flex flex-col w-[280px] max-w-[85vw] bg-forest shadow-2xl h-full animate-in slide-in-from-left duration-200">
              <div className="h-[72px] shrink-0 flex items-center justify-between pl-5 pr-2 border-b border-white/10">
                <Brand />
                <button type="button" onClick={() => setMobileMenuOpen(false)} aria-label="Close menu" className="w-11 h-11 grid place-items-center rounded-lg text-white/70 hover:bg-forest-light hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <SideNav onNavigate={() => setMobileMenuOpen(false)} />
            </div>
          </div>
        )}

        <main className="app-main flex-1 overflow-y-auto thin-scroll p-4 sm:p-5 md:px-7 md:py-6 xl:p-8 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <ErrorBoundary key={location.pathname + location.search}><Outlet /></ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
