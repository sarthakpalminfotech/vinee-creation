import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Hammer } from 'lucide-react';
import { PageHeader, Card, Button, Empty, LoadState, Badge, Pager, usePaged } from '../../components/ui';
import { fmtDate, fmtInt, fmtM } from '../../lib/format';
import * as repo from '../../db/repo';
import { useDbVersion } from '../../lib/live';
import { SearchToggle, ListFilter, uniqueOptions, inDateRange, Chip } from '../../components/kit';

function Fig({ label, takas, m, tone = '' }) {
  return (
    <div className="min-w-[6.5rem]">
      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</div>
      <div className={`text-sm font-semibold tabular-nums ${tone || 'text-slate-900'}`}>{fmtInt(takas)} <span className="text-xs font-medium text-slate-400">taka</span></div>
      <div className={`text-sm tabular-nums ${tone || 'text-slate-600'}`}>{fmtM(m)} <span className="text-xs text-slate-400">m</span></div>
    </div>
  );
}

function JobWorkCard({ c, onOpen }) {
  const st = repo.JW_STATUS_META[c.status] || repo.JW_STATUS_META.OPEN;
  return (
    <Card className="overflow-visible">
      <button type="button" onClick={onOpen} className="flex w-full flex-wrap items-center gap-x-6 gap-y-3 p-4 text-left hover:bg-slate-50/60">
        <div className="min-w-0 flex-1 basis-64">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="flex items-center gap-2 text-base font-semibold text-slate-900"><Hammer className="h-4 w-4 text-slate-400" />{c.jw_label}</span>
            <Badge variant={st.variant}>{st.label}</Badge>
            {c.job_type && <Chip tone="amber">{c.job_type}</Chip>}
            {c.order_no && <Chip tone="primary">Order {c.order_no}</Chip>}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 text-sm text-slate-600">
            <span className="font-medium text-slate-900">{c.worker_name}</span>
            <span>{fmtDate(c.date)}</span>
            {c.days_out != null && <span className={c.days_out > 30 ? 'font-medium text-amber-700' : ''}>{c.days_out} day{c.days_out === 1 ? '' : 's'} out</span>}
          </div>
          <div className="mt-0.5 truncate text-xs text-slate-500" title={c.qualities}>{c.qualities}</div>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <Fig label="Sent" takas={c.sent_takas} m={c.sent_m} />
          <Fig label="Received" takas={c.received_takas} m={c.received_m} tone="text-emerald-700" />
          <Fig label="Pending" takas={c.pending_takas} m={c.pending_m} tone={Number(c.pending_takas) ? 'text-amber-700' : 'text-slate-400'} />
        </div>
      </button>
    </Card>
  );
}

const STATUS_CHIPS = [['', 'All'], ['OPEN', 'Open'], ['PARTIAL', 'Partly received'], ['COMPLETED', 'Completed'], ['CLOSED', 'Closed (short)']];

export default function JobWorkListPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [flt, setFlt] = useState({});
  const [error, setError] = useState('');
  const dbVersion = useDbVersion();
  useEffect(() => {
    (async () => {
      try { setRows(await repo.listJobWorks()); setError(''); } catch (e) { setError(e.message); } finally { setLoading(false); }
    })();
  }, [dbVersion]);

  const needle = search.toLowerCase();
  const filtered = rows.filter((c) => [c.jw_label, String(c.jw_no), c.worker_name, c.order_no, c.job_type, c.qualities].some((v) => String(v || '').toLowerCase().includes(needle))
    && (!status || c.status === status)
    && (!flt.job_worker_id || String(c.job_worker_id) === flt.job_worker_id)
    && (!flt.quality || (c.qualities || '').split(',').includes(flt.quality))
    && inDateRange(c.date, flt));
  const paged = usePaged(filtered, 30);
  if (loading || error) return <LoadState loading={loading} error={error} />;
  const count = (s) => rows.filter((c) => !s || c.status === s).length;

  return (
    <div className="space-y-6">
      <PageHeader title="Job Work" description="Folded goods sent out for embroidery, printing or other work, and what came back.">
        <ListFilter values={flt} onChange={setFlt} fields={[
          { key: 'job_worker_id', label: 'Job worker', options: uniqueOptions(rows, (x) => x.job_worker_id, (x) => x.worker_name) },
          { key: 'quality', label: 'Quality', options: [...new Set(rows.flatMap((x) => (x.qualities || '').split(',').filter(Boolean)))].sort().map((q) => [q, q]) },
        ]} />
        <SearchToggle value={search} onChange={setSearch} placeholder="Search challan no, job worker, order or job type..." />
        <Button onClick={() => navigate('/job-work/new')}><Plus className="mr-2 h-4 w-4" /> New Job Work</Button>
      </PageHeader>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Status">
        {STATUS_CHIPS.map(([k, label]) => (
          <button key={k || 'all'} type="button" aria-pressed={status === k} onClick={() => setStatus(k)}
            className={`h-9 rounded-full border px-4 text-sm font-medium ${status === k ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'}`}>
            {label} <span className="ml-1 text-xs text-slate-400">{count(k)}</span>
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {paged.rows.map((c) => <JobWorkCard key={c.id} c={c} onOpen={() => navigate(`/job-work/${c.id}`)} />)}
        {filtered.length === 0 && <Empty icon={Hammer} title="No job work found" description="Send folded goods to a job worker with New Job Work." />}
        <Pager paged={paged} />
      </div>
    </div>
  );
}
