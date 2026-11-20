import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { PageHeader, Card, Button, Table, Th, Td, Badge, Alert, LoadState } from '../../components/ui';
import { DetailList, StatTile, Qty, Chip, SectionTitle, ShadeSwatch } from '../../components/kit';
import { Edit, Trash2, Palette, Boxes, Plus } from 'lucide-react';
import { fmtDate, fmtM, fmtInt, fmtMoney } from '../../lib/format';
import * as repo from '../../db/repo';
import { useDbVersion } from '../../lib/live';
import { MasterFormModal, MASTER_LABELS, shadeForEdit } from './MasterForm';
import { QualityColoursPanel } from './Colours';
import { PaymentBadge } from '../orders/OrderPayments';

/** Masters tab each kind is listed under. */
const TAB_OF = { weaver_groups: 'weavers', weavers: 'weavers' };
const titleCase = (s) => s.replace(/\b\w/g, (c) => c.toUpperCase());
const STAGES = [
  ['godown', 'Grey at our place', 'slate'], ['mill', 'Grey at mill', 'sky'], ['dyeing', 'In dyeing', 'violet'],
  ['finished', 'Finished goods', 'emerald'], ['jobwork', 'FG in job work', 'amber'],
];

/** Collapsible table section: shows the first rows, "Show all" for the rest. */
function ListSection({ title, rows, empty, head, row, right, initial = 5 }) {
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, initial);
  return (
    <section>
      <SectionTitle title={`${title}${rows.length ? ` (${rows.length})` : ''}`} right={right} />
      <Card>
        {rows.length === 0 ? <div className="p-5 text-sm text-slate-500">{empty}</div> : (
          <>
            <Table className="whitespace-normal">
              <thead><tr>{head}</tr></thead>
              <tbody>{shown.map(row)}</tbody>
            </Table>
            {rows.length > initial && (
              <div className="border-t border-slate-100 p-2 text-center">
                <Button variant="ghost" size="sm" onClick={() => setAll(!all)}>{all ? 'Show less' : `Show all ${rows.length}`}</Button>
              </div>
            )}
          </>
        )}
      </Card>
    </section>
  );
}

/** Stock of this entry per stage; each tile opens the matching Inventory screen when `qualityId` is known. */
function StockTiles({ stock, onView }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      {STAGES.map(([k, label, tone]) => (
        <StatTile key={k} label={label} tone={tone} value={fmtInt(stock.views[k].takas)} unit="taka"
          sub={`${fmtM(stock.views[k].m)} m${onView && stock.views[k].takas > 0 ? ' · View' : ''}`}
          onClick={onView && stock.views[k].takas > 0 ? () => onView(k) : undefined} />
      ))}
    </div>
  );
}

const poBadge = (p) => <Badge variant={repo.PO_STATUS_META[p.status].variant}>{repo.PO_STATUS_META[p.status].label}</Badge>;
const orderBadge = (o) => (o.status === 'DONE' ? <Badge variant="success">Completed</Badge> : <Badge variant="primary">Open</Badge>);
const progBadge = (p) => (p.status === 'DONE' ? <Badge variant="success">Received</Badge> : p.status === 'PARTIAL' ? <Badge variant="warning">Partly received</Badge> : <Badge variant="primary">At mill</Badge>);

/** Details screen of one master entry: its own details first, then where it is used. Route /masters/view/:kind/:id. */
export default function MasterDetailPage() {
  const { kind, id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const version = useDbVersion();
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState(null);
  const [colours, setColours] = useState(false);

  useEffect(() => {
    let live = true;
    if (!repo.MASTER_KINDS.includes(kind)) { setError('Unknown master'); return undefined; }
    repo.getMasterDetail(kind, id)
      .then((r) => { if (!live) return; if (!r) setError('This entry no longer exists.'); else { setD(r); setError(''); } })
      .catch((e) => live && setError(e.message));
    return () => { live = false; };
  }, [kind, id, version]);

  const listUrl = `/masters/${TAB_OF[kind] || kind}`;
  const back = () => navigate(location.state?.from || listUrl);
  // screens opened from here come back here
  const go = (to) => navigate(to, { state: { from: location.pathname } });

  if (error) return <div className="space-y-4"><PageHeader title="Masters" onBack={back} /><LoadState error={error} /></div>;
  if (!d) return <LoadState loading />;
  const r = d.row;

  const remove = async () => {
    if (!confirm('Delete this record? This cannot be undone.')) return;
    try { await repo.removeMaster(kind, r.id); navigate(listUrl, { replace: true }); } catch (e) { setMsg(e.message); }
  };
  const edit = () => setForm({ type: kind, item: kind === 'shades' ? shadeForEdit(r) : r });

  const label = MASTER_LABELS[kind];
  const title = kind === 'qualities' ? r.nick_name : kind === 'shades' ? r.number : r.name;

  const info = {
    weaver_groups: [
      { label: 'Firm', value: r.name }, { label: 'Contact person', value: r.contact }, { label: 'Phone', value: r.phone }, { label: 'City', value: r.city },
      { label: 'GST number', value: r.gstin }, { label: 'Associated parties', value: d.parties?.length },
    ],
    weavers: [
      { label: 'Associated party', value: r.name }, { label: 'Firm', value: r.group_name ? <button className="text-primary-700 hover:underline" onClick={() => go(`/masters/view/weaver_groups/${r.group_id}`)}>{r.group_name}</button> : null },
      { label: 'Phone', value: r.phone }, { label: 'GST number', value: r.gstin },
    ],
    mills: [{ label: 'Mill', value: r.name }, { label: 'Contact person', value: r.contact }, { label: 'Phone', value: r.phone }, { label: 'City', value: r.city }, { label: 'GST number', value: r.gstin }],
    customers: [{ label: 'Customer', value: r.name }, { label: 'Contact person', value: r.contact }, { label: 'Phone', value: r.phone }, { label: 'City', value: r.city }, { label: 'GST number', value: r.gstin }],
    job_workers: [{ label: 'Job worker', value: r.name }, { label: 'Phone', value: r.phone }, { label: 'City', value: r.city }, { label: 'GST number', value: r.gstin }, { label: 'Notes', value: r.notes, wide: true }],
    qualities: [
      { label: 'Nickname', value: r.nick_name }, { label: 'Original name', value: r.original_name }, { label: 'Default taka length', value: `${r.taka_length} m` },
      { label: 'Colours', value: d.colourCounts ? `${d.colourCounts.active} active${d.colourCounts.total !== d.colourCounts.active ? ` of ${d.colourCounts.total}` : ''}` : null },
      { label: 'Notes', value: r.notes, wide: true },
    ],
    branches: [{ label: 'Branch', value: r.name }, { label: 'City', value: r.city }, { label: 'Address', value: r.address }, { label: 'Phone', value: r.phone }],
    shades: [
      { label: 'Shade', value: r.number }, { label: 'Description', value: r.name }, { label: 'Colour code', value: r.hex },
      { label: 'Kind', value: r.quality_id ? `Own colour of ${r.owner_quality}` : 'Library colour' },
      { label: 'Status', value: Number(r.active ?? 1) === 1 ? 'Active' : 'Inactive' },
    ],
  }[kind];

  return (
    <div className="page-w space-y-8">
      <PageHeader title={title} description={titleCase(label)} onBack={back}>
        {kind === 'weaver_groups' && <Button variant="outline" onClick={() => setForm({ type: 'weavers', item: null, extra: { group_id: r.id } })}><Plus className="w-4 h-4 mr-2" /> Add associated party</Button>}
        {kind === 'qualities' && <Button variant="outline" onClick={() => setColours(true)}><Palette className="w-4 h-4 mr-2" /> Colours</Button>}
        <Button variant="outline" onClick={edit}><Edit className="w-4 h-4 mr-2" /> Edit</Button>
        <Button variant="danger" onClick={remove}><Trash2 className="w-4 h-4 mr-2" /> Delete</Button>
      </PageHeader>
      <Alert>{msg}</Alert>

      <Card className="p-6">
        <div className="flex items-start gap-4">
          {kind === 'shades' && <div className="h-16 w-16 shrink-0"><ShadeSwatch shade={r} size="xl" shape="square" /></div>}
          <DetailList className="flex-1" items={info} />
        </div>
      </Card>

      <More d={d} kind={kind} go={go} />

      <MasterFormModal type={form?.type} item={form?.item} extra={form?.extra} onClose={() => setForm(null)} />
      {colours && <QualityColoursPanel quality={r} onClose={() => setColours(false)} />}
    </div>
  );
}

/** The "more details" part, per kind. */
function More({ d, kind, go }) {
  const r = d.row;
  const poList = (pos) => (
    <ListSection title="Purchase orders" rows={pos} empty="No PO yet."
      head={<><Th>PO</Th><Th>Quality / firm</Th><Th className="text-right">Ordered</Th><Th className="text-right">Received</Th><Th>Status</Th></>}
      row={(p) => (
        <tr key={p.id} className="cursor-pointer hover:bg-slate-50" onClick={() => go(`/po/${p.id}`)}>
          <Td><div className="font-semibold">{p.po_no}</div><div className="text-xs text-slate-500">{fmtDate(p.po_date)}</div></Td>
          <Td>{kind === 'qualities' ? p.group_name : p.nick_name}</Td>
          <Td><Qty variant="cell" meters={p.meters} /></Td><Td><Qty variant="cell" tone="emerald" meters={p.received_m} /></Td><Td>{poBadge(p)}</Td>
        </tr>
      )} />
  );
  const challanList = (rows, title = 'Weaver challans') => (
    <ListSection title={title} rows={rows} empty="No challan yet."
      head={<><Th>Challan</Th><Th>Associated party</Th><Th>Quality</Th><Th className="text-right">Received</Th></>}
      row={(c) => (
        <tr key={c.id} className="cursor-pointer hover:bg-slate-50" onClick={() => go(`/receipts/${c.id}`)}>
          <Td><div className="font-semibold">{c.challan_no}</div><div className="text-xs text-slate-500">{fmtDate(c.date)} · {c.destination === 'MILL' ? `direct to ${c.mill_name}` : c.branch_name || 'godown'}</div></Td>
          <Td>{c.weaver_name}</Td><Td>{c.nick_name}</Td><Td><Qty variant="cell" takas={c.taka_count} meters={c.total_m} /></Td>
        </tr>
      )} />
  );
  const orderList = (orders, showCustomer) => (
    <ListSection title="Orders" rows={orders} empty="No order yet."
      head={<><Th>Order</Th><Th>{showCustomer ? 'Customer' : 'Quality'}</Th><Th className="text-right">Ordered</Th><Th className="text-right">Dispatched</Th><Th>Status</Th></>}
      row={(o) => (
        <tr key={o.id} className="cursor-pointer hover:bg-slate-50" onClick={() => go(`/orders/${o.id}`)}>
          <Td><div className="font-semibold">{o.order_no}</div><div className="text-xs text-slate-500">{fmtDate(o.date)}</div></Td>
          <Td>{showCustomer ? o.customer_name : o.nick_name}</Td>
          <Td><Qty variant="cell" takas={o.total_takas > 0 ? o.total_takas : null} meters={o.total_meters > 0 ? o.total_meters : null} /></Td>
          <Td><Qty variant="cell" tone="emerald" takas={o.allocated} meters={o.allocated_m} /></Td>
          <Td><div className="flex flex-wrap gap-1">{orderBadge(o)}<PaymentBadge payment={o.payment} /></div></Td>
        </tr>
      )} />
  );
  const orderTiles = (oc, withPay) => (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <StatTile label="Orders received" value={fmtInt(oc.total)} />
      <StatTile label="Ongoing" tone="sky" value={fmtInt(oc.ongoing)} />
      <StatTile label="Completed" tone="emerald" value={fmtInt(oc.completed)} />
      {withPay
        ? <StatTile label="Payment due" tone={oc.payment.due ? 'red' : 'slate'} value={fmtMoney(oc.payment.outstanding)} sub={`${oc.payment.due} order(s) past the reminder · received ${fmtMoney(oc.payment.paid)}`} />
        : <StatTile label="Dispatched" tone="emerald" value={fmtM(oc.dispatched_m)} unit="m" />}
    </div>
  );
  const greySaleList = (rows) => (
    <ListSection title="Grey sales" rows={rows} empty="No grey sale."
      head={<><Th>Sale</Th><Th>{kind === 'customers' ? 'Associated party' : 'Customer'}</Th><Th className="text-right">Sold</Th><Th className="text-right">Amount</Th></>}
      row={(s) => (
        <tr key={s.id} className="cursor-pointer hover:bg-slate-50" onClick={() => go(`/grey-sales/${s.id}`)}>
          <Td><div className="font-semibold">{s.gs_label}</div><div className="text-xs text-slate-500">{fmtDate(s.date)}</div></Td>
          <Td>{kind === 'customers' ? s.weaver_name : s.customer_name}</Td><Td><Qty variant="cell" takas={s.takas} meters={s.meters} /></Td><Td className="text-right">{fmtMoney(s.amount)}</Td>
        </tr>
      )} />
  );
  const programList = (rows) => (
    <ListSection title="Dyeing programs" rows={rows} empty="No program yet."
      head={<><Th>Program</Th><Th>{kind === 'mills' ? 'Quality' : 'Mill'}</Th><Th className="text-right">Takas</Th><Th>Status</Th></>}
      row={(p) => (
        <tr key={p.id} className="cursor-pointer hover:bg-slate-50" onClick={() => go(`/programs/${p.id}`)}>
          <Td><div className="font-semibold">{p.program_no}</div><div className="text-xs text-slate-500">{fmtDate(p.date)}</div></Td>
          <Td>{kind === 'mills' ? p.nick_name : p.mill_name}</Td><Td className="text-right tabular-nums">{fmtInt(p.received_takas)} / {fmtInt(p.total_takas)}</Td><Td>{progBadge(p)}</Td>
        </tr>
      )} />
  );

  if (kind === 'weaver_groups') {
    return (
      <div className="space-y-8">
        <section>
          <SectionTitle title="Summary" />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatTile label="POs" value={fmtInt(d.poCounts.total)} sub={`${d.poCounts.open} open · ${d.poCounts.done} done`} />
            <StatTile label="Pending to receive" tone="amber" value={fmtM(d.poCounts.pending_m)} unit="m" />
            <StatTile label="Received" tone="emerald" value={fmtInt(d.challans.takas)} unit="taka" sub={`${fmtM(d.challans.m)} m in ${d.challans.count} challan(s)`} />
            <StatTile label="In stock now" tone="sky" value={fmtInt(d.stock.inStock.takas)} unit="taka" sub={`${fmtM(d.stock.inStock.m)} m`} />
          </div>
        </section>
        <section><SectionTitle title="Stock of this firm" /><StockTiles stock={d.stock} /></section>
        <ListSection title="Associated parties" rows={d.parties} empty="No associated party yet."
          head={<><Th>Associated party</Th><Th>GST no.</Th><Th>Phone</Th><Th className="text-right">Received</Th></>}
          row={(w) => (
            <tr key={w.id} className="cursor-pointer hover:bg-slate-50" onClick={() => go(`/masters/view/weavers/${w.id}`)}>
              <Td className="font-medium">{w.name}</Td><Td className="font-mono text-xs">{w.gstin || '-'}</Td><Td>{w.phone || '-'}</Td>
              <Td><Qty variant="cell" takas={Number(w.takas)} meters={w.meters} /></Td>
            </tr>
          )} />
        {poList(d.pos)}
        {challanList(d.receipts)}
      </div>
    );
  }
  if (kind === 'weavers') {
    return (
      <div className="space-y-8">
        <section>
          <SectionTitle title="Summary" />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatTile label="Challans" value={fmtInt(d.challans.count)} />
            <StatTile label="Received" tone="emerald" value={fmtInt(d.challans.takas)} unit="taka" sub={`${fmtM(d.challans.m)} m`} />
            <StatTile label="In stock now" tone="sky" value={fmtInt(d.stock.inStock.takas)} unit="taka" sub={`${fmtM(d.stock.inStock.m)} m`} />
            <StatTile label="Grey sold" value={fmtInt(d.stock.greySold.takas)} unit="taka" sub={`${fmtM(d.stock.greySold.m)} m`} />
          </div>
        </section>
        <section><SectionTitle title="Stock of this associated party" /><StockTiles stock={d.stock} /></section>
        {challanList(d.receipts)}
        {greySaleList(d.greySales)}
      </div>
    );
  }
  if (kind === 'mills') {
    return (
      <div className="space-y-8">
        <section>
          <SectionTitle title="Summary" />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatTile label="Mill challans" value={fmtInt(d.challans.length)} sub={d.directChallans ? `${d.directChallans} weaver challan(s) came direct` : undefined} />
            <StatTile label="Programs" value={fmtInt(d.programCounts.total)} sub={`${d.programCounts.open} at mill · ${d.programCounts.done} received`} />
            <StatTile label="At this mill now" tone="sky" value={fmtInt(d.stock.views.mill.takas + d.stock.views.dyeing.takas)} unit="taka" sub={`${fmtM(d.stock.views.mill.m + d.stock.views.dyeing.m)} m (grey + in dyeing)`} />
            <StatTile label="Finished received" tone="emerald" value={fmtInt(d.finished.takas)} unit="taka" sub={`${fmtM(d.finished.m)} m`} />
          </div>
        </section>
        <ListSection title="Mill challans" rows={d.challans} empty="Nothing sent to this mill yet."
          head={<><Th>Challan</Th><Th>Qualities</Th><Th className="text-right">Sent</Th><Th>Status</Th></>}
          row={(c) => (
            <tr key={`${c.kind}-${c.id}`} className="cursor-pointer hover:bg-slate-50" onClick={() => go(c.kind === 'main' ? `/dispatch/${c.id}` : `/dispatch/old/${c.id}`)}>
              <Td><div className="font-semibold">{c.label}</div><div className="text-xs text-slate-500">{fmtDate(c.date)}</div></Td>
              <Td>{c.qualities || c.quality_nick || '-'}</Td><Td><Qty variant="cell" takas={c.taka_count} meters={c.total_m} /></Td>
              <Td>{c.status === 'OLD' ? <Badge>Old</Badge> : c.status === 'CLOSED' ? <Badge variant="success">Closed</Badge> : <Badge variant="primary">Open</Badge>}</Td>
            </tr>
          )} />
        {programList(d.programs)}
      </div>
    );
  }
  if (kind === 'customers') {
    const oc = d.orderCounts;
    return (
      <div className="space-y-8">
        <section><SectionTitle title="Orders" />{orderTiles(oc, true)}</section>
        <section>
          <SectionTitle title="Payments" />
          <Card className="p-5">
            <DetailList items={[
              { label: 'Total expected', value: fmtMoney(oc.payment.expected) },
              { label: 'Billable (dispatched)', value: fmtMoney(oc.payment.dispatched) },
              { label: 'Received', value: fmtMoney(oc.payment.paid) },
              { label: 'Outstanding', value: fmtMoney(oc.payment.outstanding) },
              { label: 'Orders without a rate', value: oc.payment.unrated || null },
            ]} />
          </Card>
        </section>
        {orderList(d.orders, false)}
        {greySaleList(d.greySales)}
      </div>
    );
  }
  if (kind === 'job_workers') {
    return (
      <div className="space-y-8">
        <section>
          <SectionTitle title="Summary" />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <StatTile label="Challans" value={fmtInt(d.counts.total)} sub={`${d.counts.open} open · ${d.counts.done} done`} />
            <StatTile label="Pending with them" tone="amber" value={fmtInt(d.counts.pending_takas)} unit="taka" sub={`${fmtM(d.counts.pending_m)} m`} />
          </div>
        </section>
        <ListSection title="Job work challans" rows={d.challans} empty="No job work sent yet."
          head={<><Th>Challan</Th><Th>Job type</Th><Th>Status</Th><Th className="text-right">Sent</Th><Th className="text-right">Pending</Th></>}
          row={(c) => (
            <tr key={c.id} className="cursor-pointer hover:bg-slate-50" onClick={() => go(`/job-work/${c.id}`)}>
              <Td><div className="font-semibold">{c.jw_label}</div><div className="text-xs text-slate-500">{fmtDate(c.date)}</div></Td>
              <Td>{c.job_type || '-'}</Td><Td><Badge variant={repo.JW_STATUS_META[c.status].variant}>{repo.JW_STATUS_META[c.status].label}</Badge></Td>
              <Td><Qty variant="cell" takas={c.sent_takas} meters={c.sent_m} /></Td><Td><Qty variant="cell" tone="amber" takas={c.pending_takas} meters={c.pending_m} /></Td>
            </tr>
          )} />
      </div>
    );
  }
  if (kind === 'qualities') {
    const firstStock = STAGES.find(([k]) => d.stock.views[k].takas > 0)?.[0] || 'finished';
    return (
      <div className="space-y-8">
        <section><SectionTitle title="Orders" />{orderTiles(d.orderCounts, false)}</section>
        <section>
          <SectionTitle title="Inventory now" right={<Button size="sm" variant="outline" onClick={() => go(`/inventory/${firstStock}/${r.id}`)}><Boxes className="w-4 h-4 mr-2" /> View inventory</Button>} />
          {d.stock.inStock.takas === 0 && <div className="mb-3 text-sm text-slate-500">No stock of this quality at any stage right now.</div>}
          <StockTiles stock={d.stock} onView={(k) => go(`/inventory/${k}/${r.id}`)} />
          {d.dead.takas > 0 && (
            <button type="button" className="mt-3 text-sm font-medium text-amber-700 hover:underline" onClick={() => go(`/inventory/dead/${r.id}`)}>
              {d.dead.takas} taka · {fmtM(d.dead.m)} m dead stock (no movement for {d.dead.days}+ days) →
            </button>
          )}
        </section>
        <section>
          <SectionTitle title="Purchases" />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatTile label="POs" value={fmtInt(d.poCounts.total)} sub={`${d.poCounts.open} open · ${d.poCounts.done} done`} />
            <StatTile label="Ordered" value={fmtM(d.poCounts.ordered_m)} unit="m" />
            <StatTile label="Received" tone="emerald" value={fmtM(d.poCounts.received_m)} unit="m" />
            <StatTile label="Pending to receive" tone="amber" value={fmtM(d.poCounts.pending_m)} unit="m" />
          </div>
        </section>
        {orderList(d.orders, true)}
        {poList(d.pos)}
        {programList(d.programs)}
      </div>
    );
  }
  if (kind === 'branches') {
    return (
      <div className="space-y-8">
        <section>
          <SectionTitle title="Summary" />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <StatTile label="Grey here now" tone="sky" value={fmtInt(d.stock.views.godown.takas)} unit="taka" sub={`${fmtM(d.stock.views.godown.m)} m`} />
            <StatTile label="Challans received" value={fmtInt(d.challans.count)} sub={`${fmtInt(d.challans.takas)} taka · ${fmtM(d.challans.m)} m`} />
          </div>
        </section>
        <ListSection title="Grey here by quality" rows={d.godownByQuality} empty="No grey at this branch now."
          head={<><Th>Quality</Th><Th className="text-right">Stock</Th></>}
          row={(x) => (
            <tr key={x.quality_id} className="cursor-pointer hover:bg-slate-50" onClick={() => go(`/inventory/godown/${x.quality_id}?branch=${r.id}`)}>
              <Td className="font-medium">{x.nick_name}</Td><Td><Qty variant="cell" takas={x.takas} meters={x.m} /></Td>
            </tr>
          )} />
        {challanList(d.receipts, 'Weaver challans received here')}
      </div>
    );
  }
  if (kind === 'shades') {
    return (
      <div className="space-y-8">
        <section>
          <SectionTitle title="Summary" />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatTile label="Qualities" value={fmtInt(d.qualities.length)} />
            <StatTile label="Orders" value={fmtInt(d.orderCounts.total)} sub={`${d.orderCounts.ongoing} ongoing · ${d.orderCounts.completed} completed`} />
            <StatTile label="Programs" value={fmtInt(d.programs.count)} sub={`${fmtInt(d.programs.takas)} taka programmed`} />
            <StatTile label="Finished stock" tone="emerald" value={fmtInt(d.stock.views.finished.takas)} unit="taka" sub={`${fmtM(d.stock.views.finished.m)} m`} />
          </div>
        </section>
        <ListSection title="Used by qualities" rows={d.qualities} empty="Not linked to any quality."
          head={<><Th>Quality</Th><Th>Original name</Th><Th>Status</Th></>}
          row={(q) => (
            <tr key={q.id} className="cursor-pointer hover:bg-slate-50" onClick={() => go(`/masters/view/qualities/${q.id}`)}>
              <Td className="font-medium">{q.nick_name}</Td><Td>{q.original_name}</Td><Td>{Number(q.active) === 1 ? <Chip tone="emerald">Active</Chip> : <Chip>Inactive</Chip>}</Td>
            </tr>
          )} />
        <ListSection title="Orders with this shade" rows={d.orders} empty="No order asked for this shade."
          head={<><Th>Order</Th><Th>Customer</Th><Th>Quality</Th><Th className="text-right">Asked</Th><Th>Status</Th></>}
          row={(o) => (
            <tr key={o.id} className="cursor-pointer hover:bg-slate-50" onClick={() => go(`/orders/${o.id}`)}>
              <Td><div className="font-semibold">{o.order_no}</div><div className="text-xs text-slate-500">{fmtDate(o.date)}</div></Td>
              <Td>{o.customer_name}</Td><Td>{o.nick_name}</Td>
              <Td><Qty variant="cell" takas={o.taka_count > 0 ? o.taka_count : null} meters={o.meters > 0 ? o.meters : null} /></Td><Td>{orderBadge(o)}</Td>
            </tr>
          )} />
      </div>
    );
  }
  return null;
}
