// Job work challan document (handed to the job worker). The quality is ALWAYS shown by its nickname.
// Page 1 = the challan (lines, totals); then one page per 80 takas of every line. Each page is a [data-pdf-page] block.
import React, { useEffect, useState } from 'react';
import { Alert } from '../../components/ui';
import { ShadeSwatch } from '../../components/kit';
import { fmtM, fmtDate } from '../../lib/format';
import DocPreview, { DocHeader } from '../../components/DocPreview';
import { TakaList } from '../../components/TakaGrid';
import * as repo from '../../db/repo';

const ROWS_PER_COL = 20, COLS = 4, PER_PAGE = ROWS_PER_COL * COLS;

const Page = ({ first, children }) => (
  <div className={first ? '' : 'print-page-break mt-10 border-t-2 border-dashed border-slate-300 pt-10 print:mt-0 print:border-0 print:pt-0'}>
    <section data-pdf-page>{children}</section>
  </div>
);

const Signatures = () => (
  <div className="mt-20 flex justify-between pt-6">
    <div className="w-48 border-t border-slate-400 pt-2 text-center"><p className="font-medium">Authorized Signatory</p></div>
    <div className="w-48 border-t border-slate-400 pt-2 text-center"><p className="font-medium">Job worker&apos;s Signature</p></div>
  </div>
);

const Header = ({ c, suffix = '' }) => (
  <DocHeader heading={`Job Work Challan ${c.jw_label}${suffix}`}
    left={<>
      <p className="mb-1 font-semibold text-slate-600">Job worker</p>
      <p className="text-lg font-bold">{c.worker_name}</p>
      {c.worker_gstin && <p className="text-slate-700">GSTIN: <strong>{c.worker_gstin}</strong></p>}
      {(c.worker_city || c.worker_phone) && <p className="text-slate-700">{[c.worker_city, c.worker_phone].filter(Boolean).join(' · ')}</p>}
    </>}
    right={<>
      <p className="font-semibold">Challan no: {c.jw_label}</p>
      <p className="text-slate-700">Date: {fmtDate(c.date)}</p>
      {c.job_type && <p className="text-slate-700">Job type: <strong>{c.job_type}</strong></p>}
      {c.order_no && <p className="text-slate-700">Order: {c.order_no}</p>}
    </>}
  />
);

function CoverPage({ c }) {
  const got = c.receipts.length > 0 || c.lost_takas > 0;
  return (
    <>
      <Header c={c} />
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-slate-900 text-left">
            <th className="py-2">Quality</th><th>Colour</th><th className="text-right">Takas</th><th className="text-right">Meters</th>
            {got && <><th className="text-right">Received</th><th className="text-right">Pending</th></>}
          </tr>
        </thead>
        <tbody>
          {c.lines.map((l) => (
            <tr key={`${l.quality_id}-${l.shade_id}`} className="border-b border-slate-300 align-middle">
              <td className="py-2 font-bold">{l.nick_name}</td>
              <td><span className="inline-flex items-center gap-2"><ShadeSwatch hex={l.hex} image={l.image_url} size="md" /><span>{l.shade_no}{l.shade_name ? ` · ${l.shade_name}` : ''}</span></span></td>
              <td className="text-right">{l.sent_takas}</td>
              <td className="text-right font-semibold">{fmtM(l.sent_m)} m</td>
              {got && <>
                <td className="text-right">{l.received_takas} · {fmtM(l.received_m)} m</td>
                <td className="text-right">{l.pending_takas} · {fmtM(l.pending_m)} m</td>
              </>}
            </tr>
          ))}
          <tr className="border-t-2 border-slate-900 font-bold">
            <td colSpan={2} className="py-3 text-right">Total</td><td className="py-3 text-right">{c.sent_takas}</td><td className="py-3 text-right">{fmtM(c.sent_m)} m</td>
            {got && <><td className="py-3 text-right">{c.received_takas} · {fmtM(c.received_m)} m</td><td className="py-3 text-right">{c.pending_takas} · {fmtM(c.pending_m)} m</td></>}
          </tr>
        </tbody>
      </table>
      {c.notes && <p className="mt-6 text-sm text-slate-700">Notes: {c.notes}</p>}
      <Signatures />
    </>
  );
}

function LinePage({ c, l, takas, part, parts }) {
  const last = part === parts;
  return (
    <>
      <Header c={c} suffix={parts > 1 ? ` (page ${part}/${parts})` : ''} />
      <p className="mb-3 flex items-center gap-2 text-base">
        <strong>{l.nick_name}</strong><ShadeSwatch hex={l.hex} image={l.image_url} size="md" /><span>{l.shade_no}{l.shade_name ? ` · ${l.shade_name}` : ''}</span>
      </p>
      <TakaList pdf showTotal={false} items={takas.map((t) => ({ id: t.id, no: t.label, meters: t.sent_m }))} />
      {last && (
        <>
          <div className="mt-4 flex justify-between border-t-2 border-slate-900 pt-3 text-base font-bold"><span>Total — {l.sent_takas} takas</span><span>{fmtM(l.sent_m)} m</span></div>
          <Signatures />
        </>
      )}
    </>
  );
}

export function JobWorkDoc({ challan }) {
  const pages = [<CoverPage key="cover" c={challan} />];
  for (const l of challan.lines) {
    const takas = challan.takas.filter((t) => t.quality_id === l.quality_id && t.shade_id === l.shade_id)
      .sort((a, b) => String(a.label).localeCompare(String(b.label), undefined, { numeric: true }));
    const n = Math.max(1, Math.ceil(takas.length / PER_PAGE));
    for (let i = 0; i < n; i += 1) pages.push(<LinePage key={`${l.quality_id}-${l.shade_id}-${i}`} c={challan} l={l} takas={takas.slice(i * PER_PAGE, (i + 1) * PER_PAGE)} part={i + 1} parts={n} />);
  }
  return <div>{pages.map((pg, i) => <Page key={pg.key} first={i === 0}>{pg}</Page>)}</div>;
}

/** Preview overlay (Share / Print / Close) for one job work challan. */
export function JobWorkPreview({ id, onClose }) {
  const [challan, setChallan] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    (async () => {
      try { const c = await repo.getJobWork(id); if (!c) return onClose(); setChallan(c); } catch (e) { setError(e.message); }
    })();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (error) return <DocPreview title="Preview" filename="job-work-challan" onClose={onClose}><Alert>{error}</Alert></DocPreview>;
  if (!challan) return <DocPreview title="Preview" filename="job-work-challan" onClose={onClose}><div className="p-12 text-center text-slate-500">Loading...</div></DocPreview>;
  return <DocPreview title={`Job work challan ${challan.jw_label}`} filename={`job-work-${challan.jw_label}`} onClose={onClose}><JobWorkDoc challan={challan} /></DocPreview>;
}
