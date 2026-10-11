import React from 'react';
import { Search, Plus, X, ChevronRight, AlertCircle, Edit, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Button({ variant = 'primary', size = 'md', className = '', children, ...props }) {
  const base = "inline-flex items-center justify-center font-medium transition-colors rounded-lg disabled:opacity-50 disabled:pointer-events-none";
  const variants = {
    primary: "bg-primary-600 text-white hover:bg-primary-700 shadow-sm",
    secondary: "bg-slate-100 text-slate-900 hover:bg-slate-200",
    outline: "border border-slate-300 bg-transparent hover:bg-slate-50 text-slate-700",
    ghost: "bg-transparent hover:bg-slate-100 text-slate-700",
    danger: "bg-red-50 text-red-600 hover:bg-red-100"
  };
  const sizes = {
    sm: "h-8 px-3 text-xs",
    md: "h-10 px-4 text-sm",
    lg: "h-12 px-6 text-base"
  };
  return (
    <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function Card({ className = '', children, ...props }) {
  return (
    <div className={`bg-white rounded-xl shadow-card border border-slate-200 overflow-hidden ${className}`} {...props}>
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
      className={`h-10 w-full rounded-lg border px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
        error ? 'border-red-300' : 'border-slate-300'
      } ${className}`}
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
      <div className={`relative bg-white rounded-2xl shadow-xl w-full ${maxWidth} animate-in fade-in zoom-in-95 duration-200`}>
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

export function Drawer({ isOpen, onClose, children }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex justify-end">
      <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div className="relative w-full md:w-[700px] lg:w-[900px] xl:w-[1000px] h-full bg-slate-50 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 overflow-y-auto">
        <div className="p-4 md:p-6 lg:p-8">
          {children}
        </div>
      </div>
    </div>
  );
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

export function PageHeader({ title, description, action, children }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {description && <p className="text-sm text-slate-500 mt-1">{description}</p>}
      </div>
      {(action || children) && (
        <div className="flex items-center gap-3">
          {children}
          {action}
        </div>
      )}
    </div>
  );
}

export function Empty({ icon: Icon = AlertCircle, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
      <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-sm mb-4">
        <Icon className="w-6 h-6 text-slate-400" />
      </div>
      <h3 className="text-sm font-semibold text-slate-900 mb-1">{title}</h3>
      <p className="text-sm text-slate-500 mb-4 max-w-sm">{description}</p>
      {action}
    </div>
  );
}

export function Table({ children, className = '' }) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={`w-full text-left text-sm whitespace-nowrap ${className}`}>
        {children}
      </table>
    </div>
  );
}

export function Th({ children, className = '' }) {
  return <th className={`px-4 py-3 font-medium text-slate-500 border-b border-slate-200 ${className}`}>{children}</th>;
}

export function Td({ children, className = '' }) {
  return <td className={`px-4 py-3 border-b border-slate-100 text-slate-700 ${className}`}>{children}</td>;
}
