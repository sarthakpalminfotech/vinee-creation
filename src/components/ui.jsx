import React, { createContext, useContext, useEffect, useState } from 'react';
import { Search, Plus, X, ChevronRight, ChevronLeft, AlertCircle, Edit, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const cn = (...a) => twMerge(clsx(a));
import { createPortal } from 'react-dom';

export function Button({ variant = 'primary', size = 'md', className = '', children, ...props }) {
  const base = "inline-flex items-center justify-center font-medium transition-colors rounded-md disabled:opacity-50 disabled:pointer-events-none";
  const variants = {
    primary: "bg-primary-600 text-white hover:bg-primary-700 shadow-sm",
    secondary: "bg-slate-100 text-slate-900 hover:bg-slate-200",
    outline: "border border-slate-300 bg-transparent hover:bg-slate-50 text-slate-700",
    ghost: "bg-transparent hover:bg-slate-100 text-slate-700",
    danger: "bg-red-50 text-red-600 hover:bg-red-100"
  };
  const sizes = {
    sm: "h-9 px-3 text-xs",
    md: "h-11 px-4 text-sm",
    lg: "h-12 px-6 text-base"
  };
  return (
    <button className={cn(base, variants[variant], sizes[size], className)} {...props}>
      {children}
    </button>
  );
}

export function Card({ className = '', children, ...props }) {
  return (
    <div className={`bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden ${className}`} {...props}>
      {children}
    </div>
  );
}

export function Field({ label, error, children, className = '' }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && <label className="text-sm font-medium text-slate-700">{label}</label>}
      {children}
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}

export const Input = React.forwardRef(({ className = '', error, ...props }, ref) => {
  return (
    <input
      ref={ref}
      className={cn('h-11 w-full rounded-md border px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent', error ? 'border-red-300' : 'border-slate-300', className)}
      {...props}
    />
  );
});

export { Select } from './Select';

export function Modal({ isOpen, onClose, title, children, maxWidth = 'max-w-md' }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div className={`relative bg-white rounded-xl shadow-xl w-full ${maxWidth} animate-in fade-in zoom-in-95 duration-200`}>
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 sm:p-6">
          {children}
        </div>
      </div>
    </div>
  );
}

/** Full-screen page body (replaces the old slide-in drawer). Rendered inline inside the app shell. */
export function Drawer({ isOpen = true, children }) {
  if (!isOpen) return null;
  return <div className="w-full">{children}</div>;
}

export function Badge({ children, variant = 'gray', className = '' }) {
  const variants = {
    gray: "bg-slate-100 text-slate-700",
    primary: "bg-primary-50 text-primary-700",
    success: "bg-emerald-50 text-emerald-700",
    warning: "bg-amber-50 text-amber-700",
    danger: "bg-red-50 text-red-700"
  };
  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
}

/** Where an opened search bar is rendered: a full-width row just below the toolbar that owns the search icon. */
export const SearchSlotContext = createContext(null);

export function SearchArea({ children, className = '' }) {
  const [slot, setSlot] = useState(null);
  return (
    <SearchSlotContext.Provider value={slot}>
      <div className={className}>
        {children}
        <div ref={setSlot} />
      </div>
    </SearchSlotContext.Provider>
  );
}

export function PageHeader({ title, action, children }) {
  return (
    <SearchArea className="mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {(action || children) && (
          <div className="flex flex-wrap items-center gap-3">
            {children}
            {action}
          </div>
        )}
      </div>
    </SearchArea>
  );
}

export function Empty({ icon: Icon = AlertCircle, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center border-2 border-dashed border-slate-200 rounded-lg bg-slate-50">
      <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-sm mb-4">
        <Icon className="w-6 h-6 text-slate-400" />
      </div>
      <h3 className="text-sm font-semibold text-slate-900 mb-1">{title}</h3>
      <p className="text-sm text-slate-500 mb-4 max-w-sm">{description}</p>
      {action}
    </div>
  );
}

export function Table({ children, className = '', ...props }) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn('w-full text-left text-sm whitespace-nowrap', className)} {...props}>
        {children}
      </table>
    </div>
  );
}

export function Th({ children, className = '', ...props }) {
  return <th className={`px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 bg-slate-50/80 border-b border-slate-200 ${className}`} {...props}>{children}</th>;
}

export function Td({ children, className = '', ...props }) {
  return <td className={`px-4 py-3.5 border-b border-slate-100 text-slate-700 align-middle tabular-nums ${className}`} {...props}>{children}</td>;
}

/** Inline message (replaces alert()). tone: error | success | info */
export function Alert({ tone = 'error', children, className = '' }) {
  if (!children) return null;
  const tones = {
    error: 'bg-red-50 border-red-200 text-red-700',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    info: 'bg-sky-50 border-sky-200 text-sky-700',
  };
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${tones[tone]} ${className}`}>
      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

/** Loading / error / empty wrapper for list pages. */
export function LoadState({ loading, error, onRetry }) {
  if (loading) return <div className="p-12 text-center text-slate-500">Loading...</div>;
  if (error) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center space-y-3">
        <Alert>{error}</Alert>
        {onRetry && <Button variant="outline" onClick={onRetry}>Try again</Button>}
      </div>
    );
  }
  return null;
}

/** Client-side pagination for big lists. Resets to page 1 when the data set changes. */
export function usePaged(items, size = 50) {
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(items.length / size));
  useEffect(() => { setPage(1); }, [items.length]);
  const p = Math.min(page, pages);
  return { rows: items.slice((p - 1) * size, p * size), page: p, pages, setPage, total: items.length, size };
}

export function Pager({ paged }) {
  if (paged.pages <= 1) return null;
  const from = (paged.page - 1) * paged.size + 1;
  const to = Math.min(paged.total, paged.page * paged.size);
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-sm text-slate-500">
      <span>{from}–{to} of {paged.total}</span>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" disabled={paged.page <= 1} onClick={() => paged.setPage(paged.page - 1)}><ChevronLeft className="w-4 h-4" /></Button>
        <span>Page {paged.page} / {paged.pages}</span>
        <Button type="button" variant="outline" size="sm" disabled={paged.page >= paged.pages} onClick={() => paged.setPage(paged.page + 1)}><ChevronRight className="w-4 h-4" /></Button>
      </div>
    </div>
  );
}

/** Wrap an async submit so it can't run twice at once and surfaces its error inline. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = async (fn) => {
    if (busy) return undefined;
    setBusy(true); setError('');
    try { return await fn(); } catch (e) { setError(e?.message || String(e)); return undefined; } finally { setBusy(false); }
  };
  return { busy, error, setError, run };
}
