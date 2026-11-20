import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader, Alert, LoadState, Empty, Card, Button, Modal, Badge } from '../../components/ui';
import { Qty, StatTile, Chip, ShadeSwatch, SectionTitle, ListFilter, uniqueOptions } from '../../components/kit';
import { Boxes, MapPin, AlertTriangle, ArrowUpFromLine, Hammer, ShoppingBag, ScrollText, ChevronRight, ShoppingCart } from 'lucide-react';
import { fmtDate, fmtInt, fmtM, fmtMoney } from '../../lib/format';
import * as repo from '../../db/repo';
import { useDbVersion } from '../../lib/live';

const VIEWS = ['godown', 'mill', 'dyeing', 'finished', 'jobwork'];
const VIEW_META = {
  godown: { tone: 'slate', accent: 'bg-slate-400', hint: 'Grey cloth lying in our own godowns' },
  mill: { tone: 'sky', accent: 'bg-sky-500', hint: 'Grey cloth sent to mills, not yet in a program' },
  dyeing: { tone: 'violet', accent: 'bg-violet-500', hint: 'Takas under a dyeing program' },
  finished: { tone: 'emerald', accent: 'bg-emerald-500', hint: 'Dyed takas back from the mill (folded or not)' },
  jobwork: { tone: 'amber', accent: 'bg-orange-500', hint: 'Folded goods out at a job worker' },
};
const MODES = [['Live stock', 'live'], ['Dead stock', 'dead'], ['Damaged stock', 'damaged'], ['Sell history', 'history'], ['Withdrawals', 'withdrawals']];
const MODE_ACTIVE = { live: 'bg-primary-600 text-white', dead: 'bg-amber-600 text-white', damaged: 'bg-red-600 text-white', history: 'bg-emerald-600 text-white', withdrawals: 'bg-slate-700 text-white' };
const natural = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true });

/** The "Withdraw" chooser: Finished goods → Job work / Others / Sell to order, Grey → Direct sell / Others. */
function WithdrawChooser({ open, onClose }) {
  const navigate = useNavigate();
  const go = (to) => { onClose(); navigate(to); };
  const Opt = ({ icon: Icon, title, hint, to }) => (
    <button type="button" onClick={() => go(to)} className="flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 text-left hover:border-primary-300 hover:bg-primary-50/40">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-600"><Icon className="h-5 w-5" /></span>
      <span className="min-w-0 flex-1"><span className="block font-semibold text-slate-900">{title}</span><span className="block text-xs text-slate-500">{hint}</span></span>
      <ChevronRight className="h-4 w-4 text-slate-400" />
    </button>
  );
  return (
    <Modal isOpen={open} onClose={onClose} title="Withdraw stock" maxWidth="max-w-lg">
      <div className="space-y-5">
        <div className="space-y-2">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Finished goods</div>
          <Opt icon={Hammer} title="Job work" hint="Send folded goods to a job worker (embroidery, printing …)" to="/inventory/withdraw/fg-job" />
          <Opt icon={ArrowUpFromLine} title="Others" hint="Samples, gifts, damage … with a reason (can be cancelled)" to="/inventory/withdraw/fg-other" />
          <Opt icon={ShoppingCart} title="Sell to order" hint="Give folded goods to an open customer order" to="/inventory/withdraw/fg-order" />
        </div>
        <div className="space-y-2">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Grey</div>
          <Opt icon={ShoppingBag} title="Direct sell" hint="Sell grey at our place straight to a customer" to="/inventory/withdraw/grey-sell" />
          <Opt icon={ArrowUpFromLine} title="Others" hint="Take grey out with a reason (can be cancelled)" to="/inventory/withdraw/grey-other" />
        </div>
      </div>
    </Modal>
  );
}

function SellHistory({ dbVersion }) {
  const navigate = useNavigate();
  const [flt, setFlt] = useState({});
  const [ref, setRef] = useState({ customers: [], qualities: [] });
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { Promise.all([repo.listCustomers(), repo.listQualities()]).then(([customers, qualities]) => setRef({ customers, qualities })).catch(() => {}); }, []);
  useEffect(() => {
    let live = true;
    repo.sellHistory({ type: flt.type, customer_id: flt.customer_id ? Number(flt.customer_id) : undefined, quality_id: flt.quality_id ? Number(flt.quality_id) : undefined, from: flt.from, to: flt.to })
      .then((d) => live && (setData(d), setError(''))).catch((e) => live && setError(e.message));
    return () => { live = false; };
  }, [flt, dbVersion]);
  if (error) return <LoadState error={error} />;
  if (!data) return <LoadState loading />;
  const t = data.totals;
  return (
    <>
      <section>
        <SectionTitle title="Sell history" right={<ListFilter values={flt} onChange={setFlt} title="Filter sell history" fields={[
          { key: 'type', label: 'Type', options: [['ORDER', 'Order'], ['GREY', 'Grey sell']] },
          { key: 'customer_id', label: 'Customer', options: ref.customers.map((c) => [String(c.id), c.name]) },
          { key: 'quality_id', label: 'Quality', options: ref.qualities.map((q) => [String(q.id), q.nick_name]) },
        ]} />} />
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <StatTile label="Entries" tone="emerald" accent="bg-emerald-500" value={fmtInt(t.entries)} />
          <StatTile label="Takas" value={fmtInt(t.takas)} unit="taka" />
          <StatTile label="Meters" value={fmtM(t.meters)} unit="m" />
          <StatTile label="Amount (where known)" value={t.amount != null ? fmtMoney(t.amount) : '—'} />
        </div>
      </section>
      <section>
        <SectionTitle title="Closed orders and grey sales — newest first" />
        {data.rows.length === 0 ? <Empty icon={ScrollText} title="Nothing sold yet" description="Closed (Done) orders and grey direct sales appear here." /> : (
          <div className="space-y-3">
            {data.rows.map((r) => (
              <Card key={`${r.type}-${r.id}`} className="overflow-visible">
                <button type="button" onClick={() => navigate(r.to)} className="flex w-full flex-wrap items-center gap-x-6 gap-y-2 p-4 text-left hover:bg-slate-50/60">
                  <div className="min-w-0 flex-1 basis-60">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-semibold text-slate-900">{r.no}</span>
                      <Badge variant={r.type === 'ORDER' ? 'primary' : 'warning'}>{r.type === 'ORDER' ? 'Order' : 'Grey sell'}</Badge>
                      {r.job_work && <Chip tone="amber">Job work: {r.job_work}</Chip>}
                    </div>
                    <div className="mt-1 text-sm text-slate-600"><span className="font-medium text-slate-900">{r.customer_name}</span> · {fmtDate(r.date)}</div>
                    <div className="truncate text-xs text-slate-500">{r.qualities}</div>
                  </div>
                  <Qty variant="inline" takas={r.takas} meters={r.meters} />
                  <div className="w-28 text-right text-sm font-semibold tabular-nums text-slate-900">{r.amount != null ? fmtMoney(r.amount) : <span className="font-normal text-slate-300">—</span>}</div>
                </button>
              </Card>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function Withdrawals({ dbVersion }) {
  const navigate = useNavigate();
  const [flt, setFlt] = useState({});
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    repo.listWithdrawals({ kind: flt.kind, status: flt.status, from: flt.from, to: flt.to }).then((r) => live && (setRows(r), setError(''))).catch((e) => live && setError(e.message));
    return () => { live = false; };
  }, [flt, dbVersion]);
  if (error) return <LoadState error={error} />;
  if (!rows) return <LoadState loading />;
  const active = rows.filter((w) => w.status === 'ACTIVE');
  return (
    <>
      <section>
        <SectionTitle title="Withdrawals" right={<ListFilter values={flt} onChange={setFlt} title="Filter withdrawals" fields={[
          { key: 'kind', label: 'Type', options: [['FG_OTHER', 'Finished goods'], ['GREY_OTHER', 'Grey']] },
          { key: 'status', label: 'Status', options: [['ACTIVE', 'Active'], ['CANCELLED', 'Cancelled']] },
        ]} />} />
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <StatTile label="Withdrawals" value={fmtInt(rows.length)} />
          <StatTile label="Active takas" tone="amber" value={fmtInt(active.reduce((s, w) => s + w.takas, 0))} unit="taka" sub={`${fmtM(active.reduce((s, w) => s + w.meters, 0))} m`} />
        </div>
      </section>
      <section>
        {rows.length === 0 ? <Empty icon={ArrowUpFromLine} title="No withdrawals" description="Withdrawals made with “Others” (finished goods or grey) appear here." /> : (
          <div className="space-y-3">
            {rows.map((w) => (
              <Card key={w.id} className="overflow-visible">
                <button type="button" onClick={() => navigate(`/withdrawals/${w.id}`)} className="flex w-full flex-wrap items-center gap-x-6 gap-y-2 p-4 text-left hover:bg-slate-50/60">
                  <div className="min-w-0 flex-1 basis-60">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-semibold text-slate-900">{w.wd_label}</span>
                      <Chip tone={w.kind === 'FG_OTHER' ? 'emerald' : 'slate'}>{w.kind_label}</Chip>
                      <Badge variant={w.status === 'ACTIVE' ? 'warning' : 'gray'}>{w.status === 'ACTIVE' ? 'Active' : 'Cancelled'}</Badge>
                    </div>
                    <div className="mt-1 text-sm text-slate-600"><span className="font-medium text-slate-900">{w.reason}</span> · {fmtDate(w.date)}</div>
                    <div className="truncate text-xs text-slate-500">{w.qualities}</div>
                  </div>
                  <Qty variant="inline" takas={w.takas} meters={w.meters} />
                </button>
              </Card>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

/** Inventory overview: five stage tiles → branch wise godown stock → one card per quality. A card opens the detail page. */
export default function InventoryPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const view = VIEWS.includes(params.get('view')) ? params.get('view') : 'godown';
  const branchId = view === 'godown' ? params.get('branch') || '' : '';
  const mode = ['dead', 'damaged', 'history', 'withdrawals'].includes(params.get('mode')) ? params.get('mode') : 'live';
  const dead = mode === 'dead';
  const damaged = mode === 'damaged';
  const stockMode = mode !== 'history' && mode !== 'withdrawals';
  const [deadDays, setDeadDays] = useState(null);
  const [counts, setCounts] = useState(null);
  const [byBranch, setByBranch] = useState([]);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const dbVersion = useDbVersion();

  useEffect(() => {
    let live = true;
    setLoading(true);
    Promise.all([repo.inventoryCounts(), repo.godownByBranch(), repo.getDeadStockDays()])
      .then(async ([c, b, d]) => {
        let r = [];
        if (mode === 'dead') r = await repo.deadStock(d);
        else if (mode === 'damaged') r = await repo.damagedStock();
        else if (stockMode) r = await repo.inventoryList(view, { branch_id: branchId });
        if (live) { setCounts(c); setByBranch(b); setDeadDays(d); setRows(r); setError(''); }
      })
      .catch((e) => live && setError(e.message))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [view, branchId, mode, stockMode, dbVersion]);

  const switchMode = (m) => { if (m === 'live') setParams({}); else setParams({ mode: m }); };
  const go = (next) => setParams(Object.fromEntries(Object.entries(next).filter(([, v]) => v)));

  // one card per quality; coloured stages also count the colours that have stock
  const cards = useMemo(() => {
    const m = new Map();
    for (const t of rows) {
      if (!m.has(t.quality_id)) m.set(t.quality_id, { id: t.quality_id, nick: t.nick_name, original: t.original_name, takas: 0, m: 0, shades: new Map(), mills: new Set(), branches: new Set(), workers: new Set(), jw: new Map() });
      const g = m.get(t.quality_id);
      g.takas += 1; g.m = Math.round((g.m + t.stock_m) * 100) / 100;
      if (t.shade_id) g.shades.set(t.shade_id, { hex: t.shade_hex, image: t.shade_image, no: t.shade_no });
      g.idle = Math.max(g.idle || 0, t.idle_days || 0);
      if (t.mill_name) g.mills.add(t.mill_name);
      if (t.branch_name) g.branches.add(t.branch_name);
      if (t.jw_worker_name && t.status === 'JOB_WORK') g.workers.add(t.jw_worker_name);
      // job-worked finished goods are shown apart from plain ones
      if (t.status === 'FOLDED' && t.jw_type != null) {
        const j = g.jw.get(t.jw_type) || { takas: 0, m: 0 };
        j.takas += 1; j.m = Math.round((j.m + t.stock_m) * 100) / 100; g.jw.set(t.jw_type, j);
      }
    }
    return [...m.values()].sort((a, b) => natural(a.nick, b.nick));
  }, [rows]);

  if (error && !counts) return <LoadState error={error} />;
  const coloured = dead || view === 'dyeing' || view === 'finished' || view === 'jobwork';
  const deadTotals = { takas: rows.length, m: Math.round(rows.reduce((s, t) => s + t.stock_m, 0) * 100) / 100 };
  const damagedTotals = { takas: rows.length, m: Math.round(rows.reduce((s, t) => s + t.stock_m, 0) * 100) / 100 };
  const branchName = byBranch.find((b) => String(b.id) === String(branchId))?.name;
  const live = mode === 'live';

  return (
    <div className="space-y-8">
      <PageHeader title="Inventory">
        <Button onClick={() => setWithdrawOpen(true)}><ArrowUpFromLine className="mr-2 h-4 w-4" /> Withdraw</Button>
      </PageHeader>
      {/* stock views: their own row under the title so they never squeeze it on a tablet */}
      <div className="-mt-2 mb-6 flex max-w-full overflow-x-auto no-scrollbar">
        <div className="inline-flex shrink-0 rounded-lg border border-slate-200 bg-white p-1 shadow-soft" role="tablist">
          {MODES.map(([label, m]) => {
            const isActive = mode === m;
            return (
              <button key={label} type="button" role="tab" aria-selected={isActive}
                onClick={() => switchMode(m)}
                className={`h-10 shrink-0 px-4 rounded-md text-sm font-semibold whitespace-nowrap transition ${isActive ? MODE_ACTIVE[m] : 'text-slate-600 hover:bg-primary-50'}`}>
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {mode === 'history' && <SellHistory dbVersion={dbVersion} />}
      {mode === 'withdrawals' && <Withdrawals dbVersion={dbVersion} />}

      {live && counts && (counts.reconciled
        ? <Alert tone="success"><span>Stock is reconciled — the five stages add up to all {fmtInt(counts.sum)} active takas ({fmtInt(counts.inactive)} sold, withdrawn or not returned are not stock).</span></Alert>
        : <Alert>Stock does not reconcile: stages add up to {counts.sum} takas but {counts.active} takas are active{counts.other ? ` (${counts.other} in an unknown state)` : ''}.</Alert>)}

      {dead && (
        <section>
          <SectionTitle title="Dead stock" right={<button type="button" className="text-xs font-medium text-primary-700 hover:underline" onClick={() => window.dispatchEvent(new Event('vinee:open-settings'))}>Change rule</button>} />
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <StatTile label="Dead takas" tone="amber" accent="bg-amber-500" value={fmtInt(deadTotals.takas)} unit="taka" />
            <StatTile label="Dead meters" tone="amber" accent="bg-amber-500" value={fmtM(deadTotals.m)} unit="m" />
            <StatTile label="No movement for" value={deadDays ?? '…'} unit={deadDays === 1 ? 'day or more' : 'days or more'} />
          </div>
        </section>
      )}

      {damaged && (
        <section>
          <SectionTitle title="Damaged stock" />
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <StatTile label="Damaged takas" tone="red" accent="bg-red-500" value={fmtInt(damagedTotals.takas)} unit="taka" />
            <StatTile label="Total damaged meters" tone="red" accent="bg-red-500" value={fmtM(damagedTotals.m)} unit="m" />
          </div>
        </section>
      )}

      {/* 1 · the five stages */}
      {live && <section>
        <SectionTitle title="Stock by stage" />
        <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
          {VIEWS.map((v) => (
            <StatTile key={v} label={repo.INVENTORY_VIEWS[v].label} tone={VIEW_META[v].tone} accent={VIEW_META[v].accent}
              value={counts ? fmtInt(counts.views[v].takas) : '—'} unit="taka"
              sub={<><span className="font-semibold text-slate-800">{counts ? fmtM(counts.views[v].m) : '—'}</span> <span className="text-slate-400 text-xs">meters</span></>}
              active={view === v} onClick={() => go({ view: v })} />
          ))}
        </div>
      </section>}

      {/* 2 · grey in our godowns, branch wise (only meaningful for this stage) */}
      {live && view === 'godown' && <section>
        <SectionTitle title="Grey at our place — branch wise" />
        {byBranch.length === 0 ? (
          <Card className="p-5 text-sm text-slate-500">No grey in our godowns right now.</Card>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,16rem),1fr))] gap-4">
            {byBranch.map((b) => {
              const on = view === 'godown' && String(branchId) === String(b.id);
              return (
                <button key={b.id ?? 'none'} type="button" onClick={() => go({ view: 'godown', branch: on ? '' : String(b.id ?? '') })}
                  className={`text-left rounded-lg border bg-white p-4 transition hover:shadow-md ${on ? 'border-primary-500 ring-2 ring-primary-100' : 'border-slate-200 hover:border-slate-300'}`}>
                  <div className="flex items-center gap-2 text-slate-800 font-semibold"><MapPin className="w-4 h-4 text-slate-400" />{b.name}</div>
                  <Qty className="mt-3" takas={b.takas} meters={b.m} />
                </button>
              );
            })}
          </div>
        )}
      </section>}

      {/* 3 · one card per quality for the chosen stage */}
      {stockMode && <section>
        <SectionTitle
          title={dead ? 'Dead stock — by quality' : damaged ? 'Damaged stock — by quality' : `${repo.INVENTORY_VIEWS[view].label} — by quality`}
          right={branchName && <button className="text-xs text-primary-600 hover:underline" onClick={() => go({ view })}>Clear branch filter</button>} />
        {loading ? <div className="p-12 text-center text-slate-500">Loading...</div> : cards.length === 0 ? (
          <Empty icon={damaged ? AlertTriangle : Boxes}
            title={dead ? 'No dead stock' : damaged ? 'No damaged stock' : 'No stock here'}
            description={dead ? `No finished goods have been idle for ${deadDays} days or more.` : damaged ? 'No takas have been marked as damaged.' : 'Nothing is held at this stage right now.'} />
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,19rem),1fr))] gap-4">
            {cards.map((q) => (
              <Link key={q.id}
                to={dead ? `/inventory/dead/${q.id}` : damaged ? `/inventory/damaged/${q.id}` : `/inventory/${view}/${q.id}${branchId ? `?branch=${branchId}` : ''}`}
                className="group rounded-lg border border-slate-200 bg-white p-5 hover:shadow-md hover:border-red-300 transition">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-lg font-bold text-slate-900 truncate">{q.nick}</div>
                    <div className="text-xs text-slate-500 truncate">{q.original}</div>
                  </div>
                  {damaged && <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700 ring-1 ring-red-200"><AlertTriangle className="w-3 h-3" />Damaged</span>}
                </div>
                <Qty className="mt-4" tone={dead ? 'amber' : damaged ? 'red' : VIEW_META[view].tone} takas={q.takas} meters={q.m} />
                <div className="mt-3 min-h-[26px] flex flex-wrap items-center gap-2">
                  {damaged ? (
                    <Chip tone="red">{q.takas} {q.takas === 1 ? 'taka' : 'takas'} · {fmtM(q.m)} m damaged</Chip>
                  ) : coloured ? (
                    <>
                      <Chip tone={dead ? 'amber' : VIEW_META[view].tone}>{q.shades.size} {q.shades.size === 1 ? 'colour' : 'colours'} in stock</Chip>{dead && <Chip tone="amber">idle up to {q.idle} days</Chip>}
                      {view === 'jobwork' && !dead && q.workers.size > 0 && <Chip tone="amber">{[...q.workers].slice(0, 2).join(', ')}{q.workers.size > 2 ? '…' : ''}</Chip>}
                      <span className="flex -space-x-1.5">{[...q.shades.values()].slice(0, 8).map((s, i) => <span key={i} title={s.no} className="rounded-full ring-2 ring-white"><ShadeSwatch hex={s.hex} image={s.image} size="sm" /></span>)}</span>
                    </>
                  ) : view === 'mill' ? (
                    <Chip tone="sky">{q.mills.size} {q.mills.size === 1 ? 'mill' : 'mills'}: {[...q.mills].slice(0, 2).join(', ')}{q.mills.size > 2 ? '…' : ''}</Chip>
                  ) : (
                    <Chip>{q.branches.size} {q.branches.size === 1 ? 'branch' : 'branches'}: {[...q.branches].slice(0, 2).join(', ')}{q.branches.size > 2 ? '…' : ''}</Chip>
                  )}
                </div>
                {q.jw.size > 0 && (view === 'finished' || dead) && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {[...q.jw.entries()].map(([type, j]) => <Chip key={type} tone="amber">{type} · {fmtInt(j.takas)} {j.takas === 1 ? 'taka' : 'takas'} · {fmtM(j.m)} m</Chip>)}
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </section>}
      <WithdrawChooser open={withdrawOpen} onClose={() => setWithdrawOpen(false)} />
    </div>
  );
}
