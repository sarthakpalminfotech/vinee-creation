import React from 'react';
import { AlertTriangle } from 'lucide-react';

/** Catches render errors of the routed page so the sidebar stays usable. Key it by location so navigating away resets it. */
export default class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error('Page crashed:', error, info?.componentStack); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="mx-auto max-w-lg rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
        <AlertTriangle className="mx-auto h-10 w-10 text-primary-600" />
        <h2 className="mt-3 text-lg font-bold text-slate-900">Something went wrong on this page</h2>
        <p className="mt-2 break-words text-xs text-slate-500">{String(this.state.error?.message || this.state.error)}</p>
        <div className="mt-5 flex justify-center gap-2">
          <button type="button" onClick={() => window.history.back()} className="h-10 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">Go back</button>
          <button type="button" onClick={() => window.location.reload()} className="h-10 rounded-md bg-primary-600 px-4 text-sm font-medium text-white hover:bg-primary-700">Reload</button>
        </div>
      </div>
    );
  }
}
