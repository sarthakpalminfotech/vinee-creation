// Finished goods → Withdraw → Sell to order: give folded takas to an open customer order (same rule and same core as Auto-allocate).
// Pick the order → per line the takas / meters to give (prefilled with what is pending) → preview the picked takas → confirm → success.
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, ChevronRight, Search, ShoppingCart } from 'lucide-react';
import { PageHeader, Card, Button, Input, Select, Field, Alert, Modal, Empty, LoadState, useAction } from '../../components/ui';
import { Chip, ShadeSwatch, Qty, ActionBar } from '../../components/kit';
import { TakaList } from '../../components/TakaGrid';
import { fmtDate, fmtInt, fmtM } from '../../lib/format';
import * as repo from '../../db/repo';

const r2 = (n) => Math.round(Number(n) * 100) / 100;
const pendingOf = (l) => ({
  takas: Math.max(0, Number(l.taka_count) - Number(l.allocated)),
  meters: Number(l.meters) > 0 ? Math.max(0, r2(Number(l.meters) - Number(l.allocated_m))) : 0,
});
const orderPending = (o) => o.lines.reduce((a, l) => { const p = pendingOf(l); return { takas: a.takas + p.takas, meters: r2(a.meters + p.meters) }; }, { takas: 0, meters: 0 });

function OrderPicker({ onPick }) {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [customer, setCustomer] = useState('');
  const [quality, setQuality] = useState('');
  useEffect(() => { repo.listOrders().then((all) => setOrders(all.filter((o) => o.status !== 'DONE'))).catch((e) => setError(e.message)); }, []);
  const customers = useMemo(() => [...new Map((orders || []).map((o) => [o.customer_id, o.customer_name])).entries()].sort((a, b) => a[1].localeCompare(b[1])), [orders]);
  const qualities = useMemo(() => [...new Map((orders || []).map((o) => [o.quality_id, o.nick_name])).entries()].sort((a, b) => a[1].localeCompare(b[1])), [orders]);
  if (error) return <LoadState error={error} />;
  if (!orders) return <LoadState loading />;
  const needle = q.trim().toLowerCase();
  const rows = orders.filter((o) => (!customer || String(o.customer_id) === customer) && (!quality || String(o.quality_id) === quality)
    && (!needle || `${o.order_no} ${o.customer_name} ${o.nick_name}`.toLowerCase().includes(needle)));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="relative md:col-span-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input className="pl-10" placeholder="Search order, customer, quality…" aria-label="Search orders" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select aria-label="Customer" value={customer} onChange={(e) => setCustomer(e.target.value)}><option value="">All customers</option>{customers.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</Select>
        <Select aria-label="Quality" value={quality} onChange={(e) => setQuality(e.target.value)}><option value="">All qualities</option>{qualities.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</Select>
      </div>
      {rows.length === 0 ? <Empty icon={ShoppingCart} title="No open orders" description="Only open customer orders with something still pending are listed here." /> : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {rows.map((o) => {
            const p = orderPending(o);
            return (
              <button key={o.id} type="button" onClick={() => onPick(o.id)} className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-4 text-left hover:border-primary-300 hover:bg-primary-50/40">
                <span className="flex items-center gap-2">
                  <span className="font-semibold text-slate-900">{o.order_no}</span>
                  <span className="text-xs text-slate-500">{fmtDate(o.date)}</span>
                  {Number(o.job_work) === 1 && <Chip tone="amber">Job work{o.job_type ? `: ${o.job_type}` : ''}</Chip>}
                  <ChevronRight className="ml-auto h-4 w-4 text-slate-400" />
                </span>
                <span className="text-sm text-slate-700">{o.customer_name}</span>
                <span className="text-sm font-medium text-slate-900">{o.nick_name}</span>
                <span className="flex items-baseline gap-1 text-xs text-slate-500">Pending <Qty variant="inline" tone="amber" takas={p.takas} meters={p.meters} /></span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LineCard({ line, plan, want, onWant, locked }) {
  const [open, setOpen] = useState(false);
  const pend = plan.pending;
  const shortMsg = plan.short && (plan.available.takas === 0
    ? 'No eligible stock for this colour — the line stays pending.'
    : `Only ${fmtInt(plan.gotT)} taka · ${fmtM(plan.gotM)} m can be given (${fmtInt(plan.available.takas)} taka · ${fmtM(plan.available.m)} m available) — the rest stays pending.`);
  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="flex items-center gap-2"><ShadeSwatch hex={line.hex} image={line.shade_image} size="md" /><span className="font-semibold text-slate-900">{line.shade_no}</span>{line.shade_name && <span className="hidden text-sm text-slate-500 sm:inline">{line.shade_name}</span>}</span>
        <span className="ml-auto flex flex-wrap items-center gap-x-6 gap-y-1 text-sm tabular-nums text-slate-600">
          <span>Ordered <Qty variant="inline" takas={Number(line.taka_count) > 0 ? line.taka_count : null} meters={Number(line.meters) > 0 ? line.meters : null} /></span>
          <span>Given <Qty variant="inline" tone="emerald" takas={line.allocated} meters={line.allocated_m} /></span>
          <span>Pending <Qty variant="inline" tone="amber" takas={pend.takas} meters={pend.meters} /></span>
        </span>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Takas to give" className="w-32"><Input type="number" min="0" step="1" inputMode="numeric" disabled={locked} value={want.takas} onChange={(e) => onWant({ ...want, takas: e.target.value })} /></Field>
        <Field label="Meters to give" className="w-40"><Input type="number" min="0" step="0.01" inputMode="decimal" disabled={locked} value={want.meters} onChange={(e) => onWant({ ...want, meters: e.target.value })} /></Field>
        <Button type="button" variant="ghost" size="sm" disabled={locked} onClick={() => onWant({ takas: '0', meters: '0' })}>Set to 0</Button>
        <div className="ml-auto text-sm text-slate-600">Stock that can be used <Qty variant="inline" tone="emerald" takas={plan.available.takas} meters={plan.available.m} /></div>
      </div>
      {shortMsg && <Alert tone="info">{shortMsg}</Alert>}
      {plan.gotT > 0 && (
        <div>
          <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex items-center gap-2 text-sm font-medium text-primary-700 hover:underline">
            <ChevronRight className={`h-4 w-4 transition-transform ${open ? 'rotate-90' : ''}`} />
            Preview: {fmtInt(plan.gotT)} taka · {fmtM(plan.gotM)} m will be given
          </button>
          {open && <div className="mt-2"><TakaList items={plan.picked.map((t) => ({ id: t.id, no: `${t.challan_no}/${t.taka_no}`, meters: t.sellable_m, tag: t.lot_no ? `lot ${t.lot_no}` : undefined }))} /></div>}
        </div>
      )}
    </div>
  );
}

export default function SellToOrderPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const orderId = params.get('order') ? Number(params.get('order')) : null;
  const [order, setOrder] = useState(null);
  const [wants, setWants] = useState({});
  const [preview, setPreview] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [done, setDone] = useState(null);
  const { busy, error, setError, run } = useAction();

  useEffect(() => {
    setOrder(null); setPreview(null); setWants({}); setDone(null); setLoadError('');
    if (!orderId) return undefined;
    let live = true;
    repo.getOrder(orderId).then((o) => {
      if (!live) return;
      if (!o) { setLoadError('Order not found'); return; }
      setOrder(o);
      setWants(Object.fromEntries(o.lines.map((l) => { const p = pendingOf(l); return [l.id, { takas: String(p.takas), meters: p.meters ? String(p.meters) : '0' }]; })));
    }).catch((e) => live && setLoadError(e.message));
    return () => { live = false; };
  }, [orderId]);

  const wantList = useMemo(() => Object.entries(wants).map(([id, w]) => ({ order_line_id: Number(id), takas: w.takas === '' ? 0 : Number(w.takas), meters: w.meters === '' ? 0 : Number(w.meters) })), [wants]);
  const wantKey = JSON.stringify(wantList);
  const [previewError, setPreviewError] = useState('');
  useEffect(() => {
    if (!order || done) return undefined;
    let live = true;
    repo.previewOrderAllocation(order.id, wantList).then((p) => { if (live) { setPreview(p); setPreviewError(''); } }).catch((e) => { if (live) setPreviewError(e.message); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order, wantKey, done]);

  if (loadError) return <div className="page-w space-y-6"><PageHeader title="Sell to order" onBack={() => navigate('/inventory')} /><LoadState error={loadError} /></div>;

  // success
  if (done) {
    return (
      <div className="page-w-4xl space-y-6">
        <PageHeader title="Given to order" description={`Order ${done.order_no}`} />
        <Card className="space-y-4 p-6">
          <div className="flex items-center gap-3 text-emerald-700"><CheckCircle2 className="h-6 w-6" /><span className="text-lg font-semibold">{fmtInt(done.result.allocated)} taka · {fmtM(done.meters)} m given to {done.order_no}</span></div>
          <p className="text-sm text-slate-600">{done.result.done ? 'Every line is covered — the order is now Done and appears in Sell history.' : 'The order stays open; the lines that are not covered are still pending.'}</p>
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 text-sm">
            {done.rows.map((r) => (
              <li key={r.order_line_id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2">
                <span className="inline-flex items-center gap-2"><ShadeSwatch hex={r.hex} image={r.shade_image} size="sm" /><strong>{r.shade_no}</strong></span>
                <span className="ml-auto tabular-nums">{fmtInt(r.gotT)} taka · {fmtM(r.gotM)} m</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="outline" onClick={() => navigate('/inventory')}>Back to inventory</Button>
            <Button onClick={() => navigate(`/orders/${done.order_id}`)}>Open order</Button>
          </div>
        </Card>
      </div>
    );
  }

  const header = <PageHeader title="Sell to order" description="Give finished (folded) goods to an open customer order — the same as Auto-allocate on the order." onBack={() => navigate(orderId ? '/inventory/withdraw/fg-order' : '/inventory')} />;
  if (!orderId) return <div className="page-w space-y-6">{header}<OrderPicker onPick={(id) => setParams({ order: String(id) })} /></div>;
  if (!order || !preview) return <div className="page-w space-y-6">{header}{previewError ? <Alert>{previewError}</Alert> : <LoadState loading />}</div>;

  const plans = new Map(preview.lines.map((p) => [p.order_line_id, p]));
  const totals = preview.lines.reduce((a, p) => ({ takas: a.takas + p.gotT, meters: r2(a.meters + p.gotM) }), { takas: 0, meters: 0 });
  const nothing = totals.takas === 0;
  const confirm = () => run(async () => {
    const result = await repo.allocateOrderLines(order.id, wantList);
    setDone({ result, order_id: order.id, order_no: order.order_no, rows: preview.lines.filter((p) => result.lines.find((r) => r.order_line_id === p.order_line_id)?.takas > 0).map((p) => ({ ...p, gotT: result.lines.find((r) => r.order_line_id === p.order_line_id).takas, gotM: result.lines.find((r) => r.order_line_id === p.order_line_id).meters })), meters: r2(result.lines.reduce((s, r) => s + r.meters, 0)) });
    setConfirmOpen(false);
  });

  const summary = (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div><div className="text-xs font-bold text-slate-500">Takas to give</div><div className="text-2xl font-bold tabular-nums text-primary-700">{fmtInt(totals.takas)}</div></div>
        <div><div className="text-xs font-bold text-slate-500">Meters</div><div className="text-2xl font-bold tabular-nums text-slate-900">{fmtM(totals.meters)}</div></div>
      </div>
      <Button type="button" className="h-12 w-full text-base" disabled={busy || nothing} onClick={() => { setError(''); setConfirmOpen(true); }}>Review &amp; give</Button>
    </div>
  );

  return (
    <div className="page-w space-y-6 pb-24 xl:pb-0">
      {header}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <Card className="flex flex-wrap items-center gap-x-6 gap-y-2 p-4">
            <span className="text-lg font-semibold text-slate-900">{order.order_no}</span>
            <span className="text-sm text-slate-600">{order.customer_name}</span>
            <span className="text-sm font-medium text-slate-900">{order.nick_name}</span>
            {Number(order.job_work) === 1 && <Chip tone="amber">Job work{order.job_type ? `: ${order.job_type}` : ''} — job-worked stock only</Chip>}
            <Link to="/inventory/withdraw/fg-order" className="ml-auto text-sm font-medium text-primary-700 hover:underline">Change order</Link>
          </Card>
          {order.lines.map((l) => {
            const plan = plans.get(l.id);
            if (!plan) return null;
            const covered = plan.pending.takas <= 0 && plan.pending.meters <= 0;
            return <LineCard key={l.id} line={l} plan={plan} locked={covered} want={wants[l.id] || { takas: '0', meters: '0' }} onWant={(w) => setWants((p) => ({ ...p, [l.id]: w }))} />;
          })}
          <Alert>{previewError || error}</Alert>
        </div>
        <div className="hidden xl:block"><Card className="p-5 xl:sticky xl:top-6"><h3 className="mb-4 text-base font-bold text-forest">Summary</h3>{summary}</Card></div>
      </div>
      <ActionBar hideFrom="xl">{summary}</ActionBar>

      <Modal isOpen={confirmOpen} onClose={() => !busy && setConfirmOpen(false)} title={`Give to ${order.order_no}`} maxWidth="max-w-xl">
        <div className="space-y-3">
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 text-sm">
            {preview.lines.filter((p) => p.gotT > 0).map((p) => (
              <li key={p.order_line_id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2">
                <span className="inline-flex items-center gap-2"><ShadeSwatch hex={p.hex} image={p.shade_image} size="sm" /><strong>{p.shade_no}</strong></span>
                <span className="ml-auto tabular-nums">{fmtInt(p.gotT)} taka · {fmtM(p.gotM)} m{p.short ? <span className="ml-2 text-amber-600">(stays partly pending)</span> : null}</span>
              </li>
            ))}
          </ul>
          <div className="flex justify-between rounded-lg bg-slate-100 px-3 py-2 text-sm font-bold tabular-nums"><span>Total</span><span>{fmtInt(totals.takas)} taka · {fmtM(totals.meters)} m</span></div>
          <Alert>{error}</Alert>
          <div className="flex justify-end gap-3"><Button type="button" variant="outline" disabled={busy} onClick={() => setConfirmOpen(false)}>Back</Button><Button type="button" disabled={busy} onClick={confirm}>{busy ? 'Saving…' : 'Confirm'}</Button></div>
        </div>
      </Modal>
    </div>
  );
}
