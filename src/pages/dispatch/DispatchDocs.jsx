// Mill-facing documents. The quality is ALWAYS shown by its nickname (never the weaver's original name).
// Full challan = a cover page (the sub-challans) + one page per sub-challan; every page is a [data-pdf-page] block so the PDF
// never cuts a table row across pages. A long taka list is split over several pages of the same sub-challan.
import React, { useEffect, useState } from 'react';
import { Alert } from '../../components/ui';
import { fmtM, fmtDate } from '../../lib/format';
import DocPreview, { DocHeader } from '../../components/DocPreview';
import { TakaList } from '../../components/TakaGrid';
import * as repo from '../../db/repo';

const COLS = 4, ROWS_PER_COL = 20, PER_PAGE = COLS * ROWS_PER_COL;

const Page = ({ first, children }) => (
  <div className={first ? '' : 'print-page-break mt-10 border-t-2 border-dashed border-slate-300 pt-10 print:mt-0 print:border-0 print:pt-0'}>
    <section data-pdf-page>{children}</section>
  </div>
);

const MillBlock = ({ main }) => (
  <>
    <p className="mb-1 font-semibold text-slate-600">Mill</p>
    <p className="text-lg font-bold">{main.mill_name}</p>
    {main.mill_gstin && <p className="text-slate-700">GSTIN: <strong>{main.mill_gstin}</strong></p>}
  </>
);

function CoverPage({ main }) {
  return (
    <>
      <DocHeader heading={`Mill Challan ${main.main_no}`}
        left={<MillBlock main={main} />}
        right={<><p className="font-semibold">Challan no: {main.main_no}</p><p className="text-slate-700">Date: {fmtDate(main.date)}</p><p className="text-slate-700">{main.sub_count} sub-challan{main.sub_count === 1 ? '' : 's'}</p></>}
      />
      <table className="w-full text-sm">
        <thead><tr className="border-b-2 border-slate-900 text-left"><th className="py-2">Sub no</th><th>Weaver challan</th><th>Associated party</th><th>Quality</th><th className="text-right">Takas</th><th className="text-right">Meters</th></tr></thead>
        <tbody>
          {main.subs.map((s) => (
            <tr key={s.id} className="border-b border-slate-300">
              <td className="py-1.5 font-bold">{s.dispatch_no}</td><td>{s.weaver_challan || '—'}</td><td>{s.weaver_name || '—'}</td><td>{s.quality_nick || s.qualities || '—'}</td>
              <td className="text-right">{s.taka_count}</td><td className="text-right font-semibold">{fmtM(s.total_m)} m</td>
            </tr>
          ))}
          <tr className="border-t-2 border-slate-900 font-bold"><td colSpan={4} className="py-3 text-right">Total</td><td className="py-3 text-right">{main.taka_count}</td><td className="py-3 text-right">{fmtM(main.total_m)} m</td></tr>
        </tbody>
      </table>
      {main.notes && <p className="mt-6 text-sm text-slate-700">Notes: {main.notes}</p>}
      <div className="mt-24 flex justify-between pt-8">
        <div className="w-48 border-t border-slate-400 pt-2 text-center"><p className="font-medium">Authorized Signatory</p></div>
        <div className="w-48 border-t border-slate-400 pt-2 text-center"><p className="font-medium">Receiver&apos;s Signature</p></div>
      </div>
    </>
  );
}

/** One page of a sub-challan: the takas as 4 columns of (taka no, meters). The last page carries totals + signatures. */
function SubPage({ main, sub, takas, part, parts }) {
  const last = part === parts;
  return (
    <>
      <DocHeader heading={`Sub-challan ${sub.dispatch_no}${parts > 1 ? ` (page ${part}/${parts})` : ''}`}
        left={<>
          <MillBlock main={main} />
          <p className="mt-2 text-slate-700">Quality: <strong>{sub.quality_nick || sub.qualities || '-'}</strong></p>
        </>}
        right={<>
          <p className="font-semibold">Sub no: {sub.dispatch_no}</p>
          <p className="text-slate-700">Main challan: {main.main_no}</p>
          <p className="text-slate-700">Weaver challan: {sub.weaver_challan || '—'}</p>
          <p className="text-slate-700">Associated party: {sub.weaver_name || '—'}</p>
          <p className="text-slate-700">Date: {fmtDate(main.date)}</p>
        </>}
      />
      <TakaList pdf showTotal={false} items={takas.map((t) => ({ id: t.id, no: t.taka_no, meters: t.grey_meter }))} />
      {last && (
        <>
          <div className="mt-4 flex justify-between border-t-2 border-slate-900 pt-3 text-base font-bold"><span>Total — {sub.taka_count} takas</span><span>{fmtM(sub.total_m)} m</span></div>
          <div className="mt-16 flex justify-between pt-6">
            <div className="w-48 border-t border-slate-400 pt-2 text-center"><p className="font-medium">Authorized Signatory</p></div>
            <div className="w-48 border-t border-slate-400 pt-2 text-center"><p className="font-medium">Receiver&apos;s Signature</p></div>
          </div>
        </>
      )}
    </>
  );
}

const subPages = (sub) => {
  const all = [...sub.takas].sort((a, b) => String(a.taka_no).localeCompare(String(b.taka_no), undefined, { numeric: true }));
  const n = Math.max(1, Math.ceil(all.length / PER_PAGE));
  return Array.from({ length: n }, (_, i) => ({ takas: all.slice(i * PER_PAGE, (i + 1) * PER_PAGE), part: i + 1, parts: n }));
};

/** `subId` given → only that sub-challan; otherwise cover page + every sub-challan. */
export function MillChallanDoc({ main, subId }) {
  const subs = subId ? main.subs.filter((s) => s.id === subId) : main.subs;
  const pages = [];
  if (!subId) pages.push(<CoverPage key="cover" main={main} />);
  for (const s of subs) for (const pg of subPages(s)) pages.push(<SubPage key={`${s.id}-${pg.part}`} main={main} sub={s} takas={pg.takas} part={pg.part} parts={pg.parts} />);
  return <div>{pages.map((pg, i) => <Page key={pg.key} first={i === 0}>{pg}</Page>)}</div>;
}

/** Preview overlay (Share / Print / Close) for a main challan: the full challan, or one sub-challan. */
export function MillChallanPreview({ id, subId, onClose }) {
  const [main, setMain] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    (async () => {
      try {
        const m = await repo.getMillChallan(id);
        if (!m) return onClose();
        setMain(m);
      } catch (e) { setError(e.message); }
    })();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (error) return <DocPreview title="Preview" filename="mill-challan" onClose={onClose}><Alert>{error}</Alert></DocPreview>;
  if (!main) return <DocPreview title="Preview" filename="mill-challan" onClose={onClose}><div className="p-12 text-center text-slate-500">Loading...</div></DocPreview>;
  const sub = subId ? main.subs.find((s) => s.id === subId) : null;
  return (
    <DocPreview title={sub ? `Sub-challan ${sub.dispatch_no}` : `Mill challan ${main.main_no}`} filename={sub ? `challan-${sub.dispatch_no}` : `mill-challan-${main.main_no}`} onClose={onClose}>
      <MillChallanDoc main={main} subId={subId} />
    </DocPreview>
  );
}

/** Old challan (before main/sub challans existed): the single-challan document. */
export function OldChallanDoc({ dispatch }) {
  return (
    <div>
      <DocHeader
        heading="Delivery Challan (Grey to Mill)"
        left={<>
          <p className="mb-1 font-semibold text-slate-600">Mill</p>
          <p className="text-lg font-bold">{dispatch.mill_name}</p>
          {dispatch.mill_gstin && <p className="text-slate-700">GSTIN: <strong>{dispatch.mill_gstin}</strong></p>}
          <p className="text-slate-700">Quality: <strong>{dispatch.qualities || '-'}</strong></p>
        </>}
        right={<>
          <p className="font-semibold">No: {dispatch.dispatch_no}</p>
          <p className="text-slate-700">Date: {fmtDate(dispatch.date)}</p>
          <p className="text-slate-700">{dispatch.taka_count} takas · {fmtM(dispatch.total_m)} m</p>
        </>}
      />
      <TakaList pdf rowsPerBlock={25} items={(dispatch.takas || []).map((t) => ({ id: t.id, no: `${t.challan_no}/${t.taka_no}`, meters: t.grey_meter }))} />
      <div className="mt-4 flex justify-between border-t-2 border-slate-900 pt-3 text-base font-bold"><span>Total — {dispatch.taka_count} takas</span><span>{fmtM(dispatch.total_m)} m</span></div>
      <div className="mt-24 flex justify-between pt-8">
        <div className="w-48 border-t border-slate-400 pt-2 text-center"><p className="font-medium">Authorized Signatory</p></div>
        <div className="w-48 border-t border-slate-400 pt-2 text-center"><p className="font-medium">Receiver&apos;s Signature</p></div>
      </div>
    </div>
  );
}

export function OldChallanPreview({ id, onClose }) {
  const [dispatch, setDispatch] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    (async () => {
      try { const d = await repo.getDispatch(id); if (!d) return onClose(); setDispatch(d); } catch (e) { setError(e.message); }
    })();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (error) return <DocPreview title="Preview" filename="challan" onClose={onClose}><Alert>{error}</Alert></DocPreview>;
  if (!dispatch) return <DocPreview title="Preview" filename="challan" onClose={onClose}><div className="p-12 text-center text-slate-500">Loading...</div></DocPreview>;
  return <DocPreview title={`Old challan ${dispatch.dispatch_no}`} filename={`challan-${dispatch.dispatch_no}`} onClose={onClose}><OldChallanDoc dispatch={dispatch} /></DocPreview>;
}
