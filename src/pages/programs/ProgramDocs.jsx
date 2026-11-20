// Mill-facing dyeing program document. The quality is ALWAYS shown by its nickname.
// Page 1: the program grouped quality → weaver challan → colour (swatch or photo printed), totals per colour and the grand total.
// Then one page (per 80 takas) for every weaver challan + colour with its taka list. Every page is a [data-pdf-page] block.
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert } from '../../components/ui';
import { ShadeSwatch } from '../../components/kit';
import { TakaList } from '../../components/TakaGrid';
import { fmtDate, fmtM } from '../../lib/format';
import DocPreview, { DocHeader } from '../../components/DocPreview';
import * as repo from '../../db/repo';

const PER_PAGE = 80;
const r2 = (n) => Math.round(Number(n) * 100) / 100;

const Page = ({ first, children }) => (
  <div className={first ? '' : 'print-page-break mt-10 border-t-2 border-dashed border-slate-300 pt-10 print:mt-0 print:border-0 print:pt-0'}>
    <section data-pdf-page>{children}</section>
  </div>
);
const Signatures = () => (
  <div className="mt-16 flex justify-between pt-6">
    <div className="w-64 border-t border-slate-400 pt-2 text-center"><p className="font-medium">Authorized Signatory (Vinee Creation)</p></div>
    <div className="w-64 border-t border-slate-400 pt-2 text-center"><p className="font-medium">Mill Acceptance Signature &amp; Stamp</p></div>
  </div>
);
const Head = ({ program, suffix = '' }) => (
  <DocHeader heading={`Dyeing Program ${program.program_no}${suffix}`}
    left={<><p className="mb-1 font-semibold text-slate-600">To: Mill</p><p className="text-lg font-bold">{program.mill_name}</p>{program.mill_gstin && <p className="text-slate-700">GSTIN: <strong>{program.mill_gstin}</strong></p>}</>}
    right={<><p className="font-semibold">No: {program.program_no}</p><p className="text-slate-700">Date: {fmtDate(program.date)}</p></>} />
);

/** Lines grouped quality → weaver challan: [{quality_id, quality_nick, challans:[{key, receipt_id, challan_no, party, direct, sub_nos, lines:[line…]}]}]. Old lines (no weaver challan) go under "Old program". */
export function groupProgramLines(program) {
  const out = [];
  for (const l of program.lines) {
    let q = out.find((x) => x.quality_id === l.line_quality_id);
    if (!q) { q = { quality_id: l.line_quality_id, quality_nick: l.quality_nick, challans: [] }; out.push(q); }
    const key = l.receipt_id ?? 'old';
    let c = q.challans.find((x) => x.key === key);
    if (!c) { c = { key, receipt_id: l.receipt_id, challan_no: l.weaver_challan, party: l.weaver_name, direct: l.weaver_destination === 'MILL', sub_nos: l.sub_nos, lines: [] }; q.challans.push(c); }
    c.lines.push(l);
  }
  return out;
}

export function ProgramDoc({ program }) {
  const groups = groupProgramLines(program);
  const byShade = [];
  for (const l of program.lines) {
    let s = byShade.find((x) => x.shade_id === l.shade_id);
    if (!s) { s = { shade_id: l.shade_id, shade_no: l.shade_no, shade_name: l.shade_name, hex: l.hex, image: l.shade_image, takas: 0, m: 0 }; byShade.push(s); }
    s.takas += Number(l.taka_count); s.m = r2(s.m + Number(l.grey_m));
  }
  const pages = [(
    <>
      <Head program={program} />
      <p className="mb-4 text-base"><strong>Quality:</strong> {groups.map((g) => g.quality_nick).join(', ')}</p>
      <table className="w-full text-base">
        <thead><tr className="border-b-2 border-slate-900 text-left"><th className="py-2 w-20 text-center">Colour</th><th>Shade</th><th className="text-right">Takas</th><th className="text-right">Grey meters</th></tr></thead>
        <tbody>
          {groups.map((g) => (
            <React.Fragment key={g.quality_id}>
              <tr><td colSpan={4} className="bg-slate-100 px-2 py-1.5 text-sm font-bold uppercase tracking-wide">{g.quality_nick}</td></tr>
              {g.challans.map((c) => (
                <React.Fragment key={c.key}>
                  <tr><td colSpan={4} className="px-2 pt-2 text-sm font-semibold text-slate-700">{c.challan_no ? `Weaver challan ${c.challan_no}${c.party ? ` · ${c.party}` : ''}${c.direct ? ' · direct to mill' : c.sub_nos ? ` · via ${c.sub_nos}` : ''}` : 'Old program (no weaver challan)'}</td></tr>
                  {c.lines.map((l) => (
                    <tr key={l.id} className="border-b border-slate-300" style={{ breakInside: 'avoid' }}>
                      <td className="py-2 text-center"><div className="mx-auto h-12 w-12"><ShadeSwatch hex={l.hex} image={l.shade_image} size="xl" shape="square" /></div></td>
                      <td><span className="text-lg font-bold">{l.shade_no}</span>{l.shade_name ? <span className="ml-2 text-slate-600">{l.shade_name}</span> : null}</td>
                      <td className="text-right text-lg font-bold">{l.taka_count}</td>
                      <td className="text-right font-semibold">{fmtM(l.grey_m)} m</td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
      <div className="mt-6">
        <p className="mb-1 text-sm font-bold uppercase tracking-wide text-slate-600">Total per colour</p>
        <table className="w-full text-base">
          <tbody>
            {byShade.map((s) => (
              <tr key={s.shade_id} className="border-b border-slate-200"><td className="w-12 py-1"><div className="h-7 w-7"><ShadeSwatch hex={s.hex} image={s.image} size="xl" shape="square" /></div></td><td className="font-semibold">{s.shade_no}</td><td className="text-right">{s.takas} takas</td><td className="text-right font-semibold">{fmtM(s.m)} m</td></tr>
            ))}
            <tr className="border-t-2 border-slate-900 text-lg font-bold"><td colSpan={2} className="py-2">Grand total</td><td className="text-right">{program.total_takas} takas</td><td className="text-right">{fmtM(program.grey_m)} m</td></tr>
          </tbody>
        </table>
      </div>
      {program.notes && <p className="mt-4 text-sm text-slate-700">Notes: {program.notes}</p>}
      <Signatures />
    </>
  )];
  for (const g of groups) for (const c of g.challans) for (const l of c.lines) {
    const takas = program.takas.filter((t) => t.program_line_id === l.id).sort((a, b) => String(a.taka_no).localeCompare(String(b.taka_no), undefined, { numeric: true }));
    const n = Math.max(1, Math.ceil(takas.length / PER_PAGE));
    for (let i = 0; i < n; i += 1) {
      const part = takas.slice(i * PER_PAGE, (i + 1) * PER_PAGE);
      pages.push(
        <>
          <Head program={program} suffix={n > 1 ? ` (${l.shade_no} · page ${i + 1}/${n})` : ` (${l.shade_no})`} />
          <p className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-base">
            <strong>{g.quality_nick}</strong><span>{c.challan_no ? `Weaver challan ${c.challan_no}` : 'Old program'}</span>
            <span className="inline-flex items-center gap-2"><span className="inline-block h-8 w-8"><ShadeSwatch hex={l.hex} image={l.shade_image} size="xl" shape="square" /></span><strong>{l.shade_no}</strong>{l.shade_name ? <span className="text-slate-600">{l.shade_name}</span> : null}</span>
          </p>
          <TakaList pdf showTotal={false} items={part.map((t) => ({ id: t.id, no: t.taka_no, meters: t.grey_meter }))} />
          {i === n - 1 && <div className="mt-4 flex justify-between border-t-2 border-slate-900 pt-3 text-base font-bold"><span>Total — {l.taka_count} takas</span><span>{fmtM(l.grey_m)} m</span></div>}
        </>,
      );
    }
  }
  return <div>{pages.map((pg, i) => <Page key={i} first={i === 0}>{pg}</Page>)}</div>;
}

/** Preview overlay (Share / Print / Close) used right after issuing a program and from the details screen. */
export function ProgramPreview({ id, onClose }) {
  const [program, setProgram] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { repo.getProgram(id).then((p) => (p ? setProgram(p) : onClose())).catch((e) => setError(e.message)); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <DocPreview title={program ? `Program ${program.program_no}` : 'Preview'} filename={program ? `program-${program.program_no}` : 'program'} onClose={onClose}>
      {error ? <Alert>{error}</Alert> : program ? <ProgramDoc program={program} /> : <div className="p-12 text-center text-slate-500">Loading...</div>}
    </DocPreview>
  );
}
export function ProgramPreviewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  return <ProgramPreview id={id} onClose={() => navigate('/programs')} />;
}
