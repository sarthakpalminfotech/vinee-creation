import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Undo2 } from 'lucide-react';
import { PageHeader, Card, Button, Alert, Badge, Modal, Table, Th, Td, LoadState, usePaged, Pager, useAction } from '../../components/ui';
import { DetailList, Qty, Chip, ShadeSwatch, SectionTitle } from '../../components/kit';
import { fmtDate, fmtM } from '../../lib/format';
import * as repo from '../../db/repo';
import { useDbVersion } from '../../lib/live';

export default function WithdrawalDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [w, setW] = useState(null);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const { busy, error: actError, run } = useAction();
  const dbVersion = useDbVersion();
  useEffect(() => {
    (async () => {
      try { const d = await repo.getWithdrawal(id); if (!d) { navigate('/inventory?mode=withdrawals'); return; } setW(d); setError(''); } catch (e) { setError(e.message); }
    })();
  }, [id, navigate, dbVersion]);
  const paged = usePaged(w?.takas || [], 100);

  if (error) return <LoadState error={error} />;
  if (!w) return <LoadState loading />;
  const active = w.status === 'ACTIVE';
  return (
    <div className="page-w space-y-6">
      <PageHeader title={`Withdrawal ${w.wd_label}`} description={`${w.kind_label} · ${fmtDate(w.date)}`} onBack={() => navigate('/inventory?mode=withdrawals')}>
        {active && <Button variant="outline" disabled={busy} onClick={() => setConfirming(true)}><Undo2 className="mr-2 h-4 w-4" /> Cancel withdrawal</Button>}
      </PageHeader>
      <Alert>{actError}</Alert>
      <Card className="space-y-6 p-6">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-bold text-forest">{w.reason}</h2>
          <Badge variant={active ? 'warning' : 'gray'}>{active ? 'Active' : 'Cancelled'}</Badge>
        </div>
        <DetailList items={[
          { label: 'Withdrawal no', value: w.wd_label },
          { label: 'Type', value: w.kind_label },
          { label: 'Date', value: fmtDate(w.date) },
          { label: 'Quality', value: w.qualities },
          { label: 'Takas', value: w.takas_n },
          { label: 'Meters', value: `${fmtM(w.meters)} m` },
          { label: 'Cancelled on', value: w.cancelled_at ? fmtDate(w.cancelled_at.slice(0, 10)) : null },
          { label: 'Notes', value: w.notes, wide: true },
        ]} />
      </Card>
      <section>
        <SectionTitle title={`Takas (${w.takas.length})`} />
        <Card>
          <Table>
            <thead><tr><Th>Taka</Th><Th>Quality</Th><Th>Colour</Th><Th>Lot</Th><Th>Was</Th><Th className="text-right">Meters</Th><Th>Now</Th></tr></thead>
            <tbody>
              {paged.rows.map((t) => (
                <tr key={t.id}>
                  <Td className="text-xs text-slate-400">#{t.label}</Td>
                  <Td>{t.nick_name}</Td>
                  <Td>{t.shade_no ? <span className="inline-flex items-center gap-2"><ShadeSwatch hex={t.shade_hex} image={t.shade_image} size="sm" />{t.shade_no}</span> : <span className="text-slate-400">grey</span>}</Td>
                  <Td className="text-sm text-slate-600">{t.lot_no || '—'}</Td>
                  <Td>{repo.STATUS_META[t.prev_status]?.label || t.prev_status}{t.jw_type ? <Chip tone="amber" className="ml-2">{t.jw_type}</Chip> : null}</Td>
                  <Td className="text-right text-base font-semibold tabular-nums">{fmtM(t.wd_m)}</Td>
                  <Td><span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${repo.STATUS_META[t.status]?.cls}`}>{repo.STATUS_META[t.status]?.label || t.status}</span></Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Pager paged={paged} />
        </Card>
      </section>
      <Modal isOpen={confirming} onClose={() => !busy && setConfirming(false)} title={`Cancel ${w.wd_label}?`}>
        <div className="space-y-4">
          <p className="text-sm text-slate-700">All {w.takas_n} taka go back to the exact status they had before ({[...new Set(w.takas.map((t) => repo.STATUS_META[t.prev_status]?.label))].join(', ')}). The withdrawal stays on record as <strong>Cancelled</strong>.</p>
          <Alert>{actError}</Alert>
          <div className="flex justify-end gap-3"><Button variant="ghost" disabled={busy} onClick={() => setConfirming(false)}>Keep it</Button><Button disabled={busy} onClick={() => run(async () => { await repo.cancelWithdrawal(w.id); setConfirming(false); })}>{busy ? 'Cancelling…' : 'Cancel withdrawal'}</Button></div>
        </div>
      </Modal>
    </div>
  );
}
