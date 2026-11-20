import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader, Card, Button, Empty, LoadState, Badge, Pager, usePaged } from '../../components/ui';
import { fmtDate, fmtM } from '../../lib/format';
import { Plus, Truck, ChevronRight } from 'lucide-react';
import * as repo from '../../db/repo';
import { useDbVersion } from '../../lib/live';
import { Qty, SearchToggle, ListFilter, uniqueOptions, inDateRange } from '../../components/kit';

const STATUS = { OPEN: { label: 'Open', variant: 'primary' }, CLOSED: { label: 'Closed', variant: 'gray' }, OLD: { label: 'Old', variant: 'warning' } };

/** One card per main mill challan; the chevron shows its sub-challans (121A · weaver challan · party · quality · takas · meters). */
function ChallanCard({ d, onOpen }) {
  const [open, setOpen] = useState(false);
  const st = STATUS[d.status] || STATUS.OPEN;
  return (
    <Card className="overflow-visible">
      <div className="flex items-center gap-2 p-4">
        {d.kind === 'main' ? (
          <button type="button" aria-label={open ? 'Hide sub-challans' : 'Show sub-challans'} aria-expanded={open} onClick={() => setOpen(!open)} className="rounded p-1.5 text-slate-500 hover:bg-slate-100">
            <ChevronRight className={`h-5 w-5 transition-transform ${open ? 'rotate-90' : ''}`} />
          </button>
        ) : <span className="w-8" />}
        <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1 text-left">
          <span className="flex items-center gap-2 text-base font-semibold text-slate-900"><Truck className="h-4 w-4 text-slate-400" />{d.kind === 'main' ? `Challan ${d.main_no}` : d.label}</span>
          <span className="text-sm text-slate-600">{fmtDate(d.date)}</span>
          <span className="text-sm font-medium text-slate-900">{d.mill_name}</span>
          <Badge variant={st.variant}>{st.label}</Badge>
          {d.kind === 'main' && <span className="text-sm text-slate-500">{d.sub_count} sub-challan{d.sub_count === 1 ? '' : 's'}</span>}
          <span className="max-w-full truncate text-sm text-slate-600" title={d.qualities}>{d.qualities || ''}</span>
        </button>
        <Qty variant="cell" takas={d.taka_count} meters={d.total_m} className="shrink-0" />
      </div>
      {open && d.subs.length > 0 && (
        <ul className="divide-y divide-slate-100 border-t border-slate-100 bg-slate-50/60">
          {d.subs.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-5 py-2.5 pl-12 text-sm">
              <span className="font-bold text-primary-700">{s.dispatch_no}</span>
              <span className="text-slate-900">{s.weaver_challan || '—'}</span>
              <span className="text-slate-600">{s.weaver_name || '—'}</span>
              <span className="text-slate-600">{s.quality_nick || s.qualities || '—'}</span>
              <span className="ml-auto tabular-nums text-slate-700">{s.taka_count} takas · {fmtM(s.total_m)} m</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default function DispatchListPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [flt, setFlt] = useState({});
  const [error, setError] = useState('');

  const dbVersion = useDbVersion();
  useEffect(() => {
    (async () => {
      try { setRows(await repo.listMillChallans()); } catch (e) { setError(e.message); } finally { setLoading(false); }
    })();
  }, [dbVersion]);

  const needle = search.toLowerCase();
  const matches = (d) => [d.label, d.dispatch_no, d.mill_name, d.qualities, ...d.subs.flatMap((s) => [s.dispatch_no, s.weaver_challan, s.weaver_name, s.group_name])].some((v) => String(v || '').toLowerCase().includes(needle));
  const filtered = rows.filter((d) => matches(d)
    && (!flt.mill_id || String(d.mill_id) === flt.mill_id)
    && (!flt.quality || (d.qualities || '').split(',').includes(flt.quality))
    && (!flt.status || d.status === flt.status)
    && inDateRange(d.date, flt));
  const paged = usePaged(filtered, 30);
  if (loading || error) return <LoadState loading={loading} error={error} />;

  return (
    <div className="space-y-6">
      <PageHeader title="Mill Challans (grey sent to mills)" description="One challan per trip to the mill, with a sub-challan for every weaver challan.">
        <ListFilter values={flt} onChange={setFlt} fields={[
          { key: 'mill_id', label: 'Mill', options: uniqueOptions(rows, (x) => x.mill_id, (x) => x.mill_name) },
          { key: 'quality', label: 'Quality', options: [...new Set(rows.flatMap((x) => (x.qualities || '').split(',').filter(Boolean)))].sort().map((q) => [q, q]) },
          { key: 'status', label: 'Status', options: [['OPEN', 'Open'], ['CLOSED', 'Closed'], ['OLD', 'Old challan']] },
        ]} />
        <SearchToggle value={search} onChange={setSearch} placeholder="Search challan no, weaver challan, associated party, mill or quality..." />
        <Button onClick={() => navigate('/dispatch/new')}><Plus className="mr-2 h-4 w-4" /> New Mill Challan</Button>
      </PageHeader>

      <div className="space-y-3">
        {paged.rows.map((d) => (
          <ChallanCard key={`${d.kind}-${d.id}`} d={d} onOpen={() => navigate(d.kind === 'main' ? `/dispatch/${d.id}` : `/dispatch/old/${d.id}`)} />
        ))}
        {filtered.length === 0 && <Empty title="No mill challans found" description="Create a new mill challan to send grey from the godown to a mill." />}
        <Pager paged={paged} />
      </div>
    </div>
  );
}
