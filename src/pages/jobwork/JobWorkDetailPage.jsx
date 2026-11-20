import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Printer, PackageCheck, Lock, Unlock, Link2, Unlink } from 'lucide-react';
import { PageHeader, Card, Button, Alert, Badge, Modal, Field, Select, Input, Table, Th, Td, LoadState, useAction } from '../../components/ui';
import { DetailList, Qty, Chip, ShadeSwatch, StatTile, SectionTitle } from '../../components/kit';
import { fmtDate, fmtInt, fmtM } from '../../lib/format';
import * as repo from '../../db/repo';
import { useDbVersion, useBackTo } from '../../lib/live';
import { JobWorkPreview } from './JobWorkDocs';

const TAKA_TONE = { SENT: 'amber', RECEIVED: 'emerald', NOT_RETURNED: 'red' };
const TAKA_LABEL = { SENT: 'At job worker', RECEIVED: 'Received', NOT_RETURNED: 'Not returned' };

export default function JobWorkDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const back = useBackTo('/job-work');
  const [c, setC] = useState(null);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(false);
  const [closing, setClosing] = useState(null); // {reason}
  const [linking, setLinking] = useState(null); // {orders, pick}
  const { busy, error: actError, run } = useAction();
  const dbVersion = useDbVersion();

  useEffect(() => {
    (async () => {
      try {
        const data = await repo.getJobWork(id);
        if (!data) { navigate('/job-work'); return; }
        setC(data); setError('');
      } catch (e) { setError(e.message); }
    })();
  }, [id, navigate, dbVersion]);

  if (error) return <LoadState error={error} />;
  if (!c) return <LoadState loading />;
  const st = repo.JW_STATUS_META[c.status];
  const canReceive = c.status === 'OPEN' || c.status === 'PARTIAL';

  const startLink = () => run(async () => setLinking({ orders: await repo.listJobOrders(), pick: c.order_id ? String(c.order_id) : '' }));
  const saveLink = (orderId) => run(async () => { await repo.linkJobWorkOrder(c.id, orderId); setLinking(null); });

  return (
    <div className="page-w space-y-6">
      <PageHeader title={`Job work ${c.jw_label}`} description={`${c.worker_name} · ${fmtDate(c.date)}`} onBack={back}>
        <Button onClick={() => setPreview(true)}><Printer className="mr-2 h-4 w-4" /> Print / Share challan</Button>
        {canReceive && <Button variant="outline" onClick={() => navigate(`/job-work/${c.id}/receive`)}><PackageCheck className="mr-2 h-4 w-4" /> Receive</Button>}
        {canReceive && <Button variant="outline" disabled={busy} onClick={() => setClosing({ reason: '' })}><Lock className="mr-2 h-4 w-4" /> Close (short)</Button>}
        {c.status === 'CLOSED' && <Button variant="outline" disabled={busy} onClick={() => run(() => repo.reopenJobWork(c.id))}><Unlock className="mr-2 h-4 w-4" /> Reopen</Button>}
      </PageHeader>
      <Alert>{actError}</Alert>
      {c.status === 'CLOSED' && <Alert tone="info">Closed short: {c.lost_takas} taka · {fmtM(c.lost_m)} m were written off as not returned. Reason: {c.close_reason}</Alert>}

      <Card className="space-y-6 p-6">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-bold text-forest">{c.worker_name}</h2>
          {c.worker_gstin && <span className="font-mono text-sm text-slate-600">GSTIN {c.worker_gstin}</span>}
          <Badge variant={st.variant}>{st.label}</Badge>
          {c.job_type && <Chip tone="amber">{c.job_type}</Chip>}
        </div>
        <DetailList items={[
          { label: 'Challan no', value: c.jw_label },
          { label: 'Date', value: fmtDate(c.date) },
          { label: 'Days out', value: c.days_out != null ? `${c.days_out} day${c.days_out === 1 ? '' : 's'}` : null },
          { label: 'Linked order', value: c.order_no ? <Link className="text-primary-700 hover:underline" to={`/orders/${c.order_id}`}>{c.order_no} · {c.order_customer}</Link> : 'Not linked' },
          { label: 'Notes', value: c.notes, wide: true },
        ]} />
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" disabled={busy} onClick={startLink}><Link2 className="mr-1.5 h-3.5 w-3.5" /> {c.order_id ? 'Change order' : 'Link to order'}</Button>
          {c.order_id && <Button variant="outline" size="sm" disabled={busy} onClick={() => saveLink(null)}><Unlink className="mr-1.5 h-3.5 w-3.5" /> Unlink</Button>}
        </div>
      </Card>

      <section>
        <SectionTitle title="Totals" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile label="Sent" tone="primary" value={fmtInt(c.sent_takas)} unit="taka" sub={`${fmtM(c.sent_m)} m`} />
          <StatTile label="Received" tone="emerald" value={fmtInt(c.received_takas)} unit="taka" sub={`${fmtM(c.received_m)} m`} />
          <StatTile label="Pending" tone="amber" value={fmtInt(c.pending_takas)} unit="taka" sub={`${fmtM(c.pending_m)} m`} />
          <StatTile label="Job work shortage" tone="red" value={fmtM(c.shortage_m)} unit="m" sub="sent − received, on received takas" />
        </div>
      </section>

      <section>
        <SectionTitle title="Lines" />
        <Card>
          <Table>
            <thead><tr><Th>Quality</Th><Th>Colour</Th><Th className="text-right">Sent</Th><Th className="text-right">Received</Th><Th className="text-right">Pending</Th><Th className="text-right">Shortage</Th></tr></thead>
            <tbody>
              {c.lines.map((l) => (
                <tr key={`${l.quality_id}-${l.shade_id}`}>
                  <Td className="font-semibold text-slate-900">{l.nick_name}</Td>
                  <Td><span className="inline-flex items-center gap-2"><ShadeSwatch hex={l.hex} image={l.image_url} size="md" /><span>{l.shade_no}{l.shade_name ? <span className="hidden xl:inline text-slate-500"> · {l.shade_name}</span> : null}</span></span></Td>
                  <Td><Qty variant="cell" takas={l.sent_takas} meters={l.sent_m} /></Td>
                  <Td><Qty variant="cell" tone="emerald" takas={l.received_takas} meters={l.received_m} /></Td>
                  <Td><Qty variant="cell" tone={l.pending_takas ? 'amber' : 'slate'} takas={l.pending_takas} meters={l.pending_m} /></Td>
                  <Td className="text-right font-semibold text-red-600">{fmtM(l.shortage_m)} <span className="text-xs font-normal text-slate-400">m</span>{l.lost_takas ? <div className="text-xs font-normal text-slate-500">{l.lost_takas} not returned</div> : null}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </section>

      <section>
        <SectionTitle title={`Receipts (${c.receipts.length})`} />
        <Card>
          {c.receipts.length === 0 ? <div className="p-6 text-sm text-slate-500">Nothing received yet.</div> : (
            <Table>
              <thead><tr><Th>Date</Th><Th>Job worker ref</Th><Th className="text-right">Takas</Th><Th className="text-right">Sent m</Th><Th className="text-right">Received m</Th><Th>Notes</Th></tr></thead>
              <tbody>
                {c.receipts.map((r) => (
                  <tr key={r.id}><Td>{fmtDate(r.date)}</Td><Td>{r.ref_no || '—'}</Td><Td className="text-right">{fmtInt(r.takas)}</Td><Td className="text-right">{fmtM(r.sent_m)}</Td><Td className="text-right font-semibold">{fmtM(r.meters)}</Td><Td className="max-w-[16rem] truncate">{r.notes || '—'}</Td></tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </section>

      <section>
        <SectionTitle title={`Takas (${c.takas.length})`} />
        <Card>
          <Table>
            <thead><tr><Th>Taka</Th><Th>Quality · colour</Th><Th>Lot</Th><Th>Status</Th><Th className="text-right">Sent m</Th><Th className="text-right">Received m</Th></tr></thead>
            <tbody>
              {c.takas.map((t) => (
                <tr key={t.id}>
                  <Td className="text-xs text-slate-400">#{t.label}</Td>
                  <Td><span className="inline-flex items-center gap-2"><ShadeSwatch hex={t.shade_hex} image={t.shade_image} size="sm" />{t.nick_name} · {t.shade_no}</span></Td>
                  <Td className="text-sm text-slate-600">{t.lot_no || '—'}</Td>
                  <Td><Chip tone={TAKA_TONE[t.status]}>{TAKA_LABEL[t.status]}</Chip></Td>
                  <Td className="text-right text-base font-semibold tabular-nums">{fmtM(t.sent_m)}</Td>
                  <Td className="text-right text-base font-semibold tabular-nums">{t.received_m != null ? fmtM(t.received_m) : '—'}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </section>

      {preview && <JobWorkPreview id={c.id} onClose={() => setPreview(false)} />}

      <Modal isOpen={!!closing} onClose={() => !busy && setClosing(null)} title={`Close ${c.jw_label} short`}>
        {closing && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">The {c.pending_takas} pending takas ({fmtM(c.pending_m)} m) are written off as <strong>not returned</strong> and leave the stock. You can re-open the challan later.</p>
            <Field label="Reason (required)"><Input autoFocus placeholder="e.g. Lost at the job worker" value={closing.reason} onChange={(e) => setClosing({ reason: e.target.value })} /></Field>
            <Alert>{actError}</Alert>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" disabled={busy} onClick={() => setClosing(null)}>Cancel</Button>
              <Button disabled={busy || !closing.reason.trim()} onClick={() => run(async () => { await repo.closeJobWork(c.id, closing.reason); setClosing(null); })}>{busy ? 'Closing…' : 'Close challan'}</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={!!linking} onClose={() => !busy && setLinking(null)} title="Link to an order">
        {linking && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">Only open orders with <strong>Job work required</strong> are listed. Linking is information only — it does not reserve any stock.</p>
            <Field label="Order">
              <Select value={linking.pick} onChange={(e) => setLinking({ ...linking, pick: e.target.value })}>
                <option value="">Select order…</option>
                {linking.orders.map((o) => <option key={o.id} value={o.id}>{o.order_no} · {o.customer_name}{o.job_type ? ` · ${o.job_type}` : ''}</option>)}
              </Select>
            </Field>
            <Alert>{actError}</Alert>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" disabled={busy} onClick={() => setLinking(null)}>Cancel</Button>
              <Button disabled={busy || !linking.pick} onClick={() => saveLink(Number(linking.pick))}>Link</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
