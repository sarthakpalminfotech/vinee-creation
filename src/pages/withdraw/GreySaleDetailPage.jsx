import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Printer, FileText, Store, Truck, ShoppingBag } from 'lucide-react';
import { PageHeader, Card, Button, Table, Th, Td, LoadState, usePaged, Pager } from '../../components/ui';
import { DetailList, SectionTitle } from '../../components/kit';
import { fmtDate, fmtM, fmtMoney } from '../../lib/format';
import * as repo from '../../db/repo';
import { useDbVersion, useBackTo } from '../../lib/live';
import { GreySalePreview } from './GreySaleDocs';

const TL_ICON = { po: FileText, received: Truck, sold: ShoppingBag };

export default function GreySaleDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const back = useBackTo('/inventory?mode=history');
  const [s, setS] = useState(null);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(false);
  const dbVersion = useDbVersion();
  useEffect(() => {
    (async () => {
      try { const d = await repo.getGreySale(id); if (!d) { navigate('/inventory?mode=history'); return; } setS(d); setError(''); } catch (e) { setError(e.message); }
    })();
  }, [id, navigate, dbVersion]);
  const paged = usePaged(s?.takas || [], 100);

  if (error) return <LoadState error={error} />;
  if (!s) return <LoadState loading />;
  return (
    <div className="page-w space-y-6">
      <PageHeader title={`Grey sale ${s.gs_label}`} description={`${s.customer_name} · ${fmtDate(s.date)}`} onBack={back}>
        <Button onClick={() => setPreview(true)}><Printer className="mr-2 h-4 w-4" /> Print / Share sale challan</Button>
      </PageHeader>

      <Card className="space-y-6 p-6">
        <h2 className="text-lg font-bold text-forest">{s.customer_name}{s.customer_gstin && <span className="ml-3 font-mono text-sm font-normal text-slate-600">GSTIN {s.customer_gstin}</span>}</h2>
        <DetailList items={[
          { label: 'Sale no', value: s.gs_label },
          { label: 'Date', value: fmtDate(s.date) },
          { label: 'Customer', value: [s.customer_city, s.customer_phone].filter(Boolean).join(' · ') || s.customer_name },
          { label: 'Associated party (weaver)', value: `${s.weaver_name} · ${s.group_name}` },
          { label: 'Quality', value: s.qualities },
          { label: 'Weaver challans', value: s.challans.map((c) => c.challan_no).join(', ') },
          { label: 'Takas', value: s.takas.length },
          { label: 'Meters', value: `${fmtM(s.meters)} m` },
          { label: 'Rate per meter', value: s.rate != null ? fmtMoney(s.rate) : null },
          { label: 'Amount', value: s.amount != null ? fmtMoney(s.amount) : null },
          { label: 'Notes', value: s.notes, wide: true },
        ]} />
      </Card>

      <section>
        <SectionTitle title="Timeline" />
        <Card className="p-5">
          <ol className="relative space-y-5 border-l-2 border-slate-200 pl-6">
            {s.timeline.map((e, i) => {
              const Icon = TL_ICON[e.kind] || Store;
              return (
                <li key={i} className="relative">
                  <span className={`absolute -left-[2.15rem] grid h-7 w-7 place-items-center rounded-full border-2 border-white ${e.kind === 'sold' ? 'bg-primary-600 text-white' : 'bg-slate-200 text-slate-600'}`}><Icon className="h-3.5 w-3.5" /></span>
                  <div className="font-semibold text-slate-900">{e.title}</div>
                  <div className="text-sm text-slate-600">{fmtDate(e.date)} · {e.sub}</div>
                </li>
              );
            })}
          </ol>
        </Card>
      </section>

      <section>
        <SectionTitle title={`Takas (${s.takas.length})`} />
        <Card>
          <Table>
            <thead><tr><Th>Taka</Th><Th>Quality</Th><Th>Branch</Th><Th className="text-right">Meters</Th></tr></thead>
            <tbody>
              {paged.rows.map((t) => (
                <tr key={t.id}><Td className="text-xs text-slate-400">#{t.label}</Td><Td>{t.nick_name}</Td><Td>{t.branch_name || '—'}</Td><Td className="text-right text-base font-semibold tabular-nums">{fmtM(t.grey_meter)}</Td></tr>
              ))}
            </tbody>
          </Table>
          <Pager paged={paged} />
        </Card>
      </section>
      {preview && <GreySalePreview id={s.id} onClose={() => setPreview(false)} />}
    </div>
  );
}
