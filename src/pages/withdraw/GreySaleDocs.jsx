// Sale challan for a grey direct sell (handed to the customer). The quality is shown by its NICKNAME.
import React, { useEffect, useState } from 'react';
import { Alert } from '../../components/ui';
import { fmtDate, fmtM, fmtMoney } from '../../lib/format';
import DocPreview, { DocHeader } from '../../components/DocPreview';
import { TakaList } from '../../components/TakaGrid';
import * as repo from '../../db/repo';

const COLS = 4, ROWS_PER_COL = 20, PER_PAGE = COLS * ROWS_PER_COL;

const Page = ({ first, children }) => (
  <div className={first ? '' : 'print-page-break mt-10 border-t-2 border-dashed border-slate-300 pt-10 print:mt-0 print:border-0 print:pt-0'}>
    <section data-pdf-page>{children}</section>
  </div>
);

function SalePage({ s, takas, part, parts }) {
  const last = part === parts;
  return (
    <>
      <DocHeader heading={`Sale Challan ${s.gs_label}${parts > 1 ? ` (page ${part}/${parts})` : ''}`}
        left={<>
          <p className="mb-1 font-semibold text-slate-600">Customer</p>
          <p className="text-lg font-bold">{s.customer_name}</p>
          {s.customer_gstin && <p className="text-slate-700">GSTIN: <strong>{s.customer_gstin}</strong></p>}
          {(s.customer_city || s.customer_phone) && <p className="text-slate-700">{[s.customer_city, s.customer_phone].filter(Boolean).join(' · ')}</p>}
          <p className="mt-2 text-slate-700">Quality: <strong>{s.qualities || '-'}</strong></p>
        </>}
        right={<>
          <p className="font-semibold">Sale no: {s.gs_label}</p>
          <p className="text-slate-700">Date: {fmtDate(s.date)}</p>
          <p className="text-slate-700">Weaver challan: {s.challans.map((c) => c.challan_no).join(', ')}</p>
        </>}
      />
      <TakaList pdf showTotal={false} items={takas.map((t) => ({ id: t.id, no: t.label, meters: t.grey_meter }))} />
      {last && (
        <>
          <div className="mt-4 space-y-1 border-t-2 border-slate-900 pt-3 text-base font-bold">
            <div className="flex justify-between"><span>Total — {s.takas.length} takas</span><span>{fmtM(s.meters)} m</span></div>
            {s.rate != null && <div className="flex justify-between font-medium text-slate-700"><span>Rate per meter</span><span>{fmtMoney(s.rate)}</span></div>}
            {s.amount != null && <div className="flex justify-between"><span>Amount</span><span>{fmtMoney(s.amount)}</span></div>}
          </div>
          {s.notes && <p className="mt-4 text-sm text-slate-700">Notes: {s.notes}</p>}
          <div className="mt-16 flex justify-between pt-6">
            <div className="w-48 border-t border-slate-400 pt-2 text-center"><p className="font-medium">Authorized Signatory</p></div>
            <div className="w-48 border-t border-slate-400 pt-2 text-center"><p className="font-medium">Receiver&apos;s Signature</p></div>
          </div>
        </>
      )}
    </>
  );
}

export function GreySaleDoc({ sale }) {
  const all = [...sale.takas].sort((a, b) => String(a.label).localeCompare(String(b.label), undefined, { numeric: true }));
  const n = Math.max(1, Math.ceil(all.length / PER_PAGE));
  return <div>{Array.from({ length: n }, (_, i) => <Page key={i} first={i === 0}><SalePage s={sale} takas={all.slice(i * PER_PAGE, (i + 1) * PER_PAGE)} part={i + 1} parts={n} /></Page>)}</div>;
}

export function GreySalePreview({ id, onClose }) {
  const [sale, setSale] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    (async () => {
      try { const s = await repo.getGreySale(id); if (!s) return onClose(); setSale(s); } catch (e) { setError(e.message); }
    })();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (error) return <DocPreview title="Preview" filename="sale-challan" onClose={onClose}><Alert>{error}</Alert></DocPreview>;
  if (!sale) return <DocPreview title="Preview" filename="sale-challan" onClose={onClose}><div className="p-12 text-center text-slate-500">Loading...</div></DocPreview>;
  return <DocPreview title={`Sale challan ${sale.gs_label}`} filename={`sale-${sale.gs_label}`} onClose={onClose}><GreySaleDoc sale={sale} /></DocPreview>;
}
