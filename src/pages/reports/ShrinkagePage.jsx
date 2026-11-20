import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { PageHeader, Card, Table, Th, Td, Empty, LoadState, Badge, Button, Pager, usePaged } from '../../components/ui';
import { StatTile, Chip, DetailList, ShadeSwatch } from '../../components/kit';
import DocPreview, { DocHeader } from '../../components/DocPreview';
import { DamageTag, DamageDetailsModal } from '../../components/DamageDetails';
import { TrendingDown, ChevronRight, Printer, ArrowLeft, Coins, Layers } from 'lucide-react';
import { fmtM, fmtPct, fmtInt } from '../../lib/format';
import * as repo from '../../db/repo';
import { useDbVersion } from '../../lib/live';

// Shortage is measured only at the mill (grey − finished) and at folding (finished − folded). Damage is shown separately.
const TABS = [['byPo', 'By PO', 'PO', (t) => t.po_id], ['byParty', 'By associated party', 'Associated party', (t) => t.weaver_id], ['byQuality', 'By quality', 'Quality', (t) => t.quality_id], ['byMill', 'By mill', 'Mill', (t) => t.program_mill_id], ['byProgram', 'By program', 'Program', (t) => t.program_id]];
const shortCls = (v) => (v > 0 ? 'text-red-600' : v < 0 ? 'text-emerald-600' : 'text-slate-600');
const r2 = (n) => Math.round(n * 100) / 100;

/** Listing: just the name + the numbers that matter. Each row opens its details. */
function SummaryList({ rows, label, onOpen }) {
  if (!rows.length) return <div className="p-6"><Empty icon={TrendingDown} title="Nothing to report yet" description="Shortage appears once takas come back from the mill." /></div>;
  return (
    <Table>
      <thead>
        <tr><Th>{label}</Th><Th className="text-right">Total grey m</Th><Th className="text-right">Total finish m</Th><Th className="text-right">Total shortage m</Th><Th className="text-right">Damage m</Th><Th className="text-right">Job work shortage m</Th><Th className="w-8" /></tr>
      </thead>
      <tbody>
        {rows.map((g) => (
          <tr key={g.key} onClick={() => onOpen(g)} className="hover:bg-slate-50 cursor-pointer">
            <Td className="font-medium text-slate-900">{g.label}</Td>
            <Td className="text-right tabular-nums">{fmtM(g.start)}</Td>
            <Td className="text-right tabular-nums">{fmtM(g.finished)}</Td>
            <Td className={`text-right tabular-nums font-semibold ${shortCls(g.totalShortage)}`}>{fmtM(g.totalShortage)} <span className="text-xs font-medium text-slate-400">{fmtPct(g.totalPct)}</span></Td>
            <Td className={`text-right tabular-nums ${g.damage > 0 ? 'font-semibold text-red-600' : 'text-slate-400'}`}>{g.damage > 0 ? fmtM(g.damage) : '—'}{g.damagedTakas > 0 && <span className="ml-1 text-xs font-medium text-slate-400">{g.damagedTakas} tk</span>}</Td>
            <Td className={`text-right tabular-nums ${g.jwShortage > 0 ? 'font-semibold text-amber-700' : 'text-slate-400'}`}>{g.jwShortage > 0 ? fmtM(g.jwShortage) : '—'}</Td>
            <Td className="text-slate-300"><ChevronRight className="w-4 h-4" /></Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

function Panel({ icon: Icon, title, children, className = '' }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-5 ${className}`}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 mb-4">{Icon && <Icon className="w-4 h-4" />}{title}</div>
      {children}
    </div>
  );
}

/** One step of the journey: meters in → meters out, the shortage and how much of it. */
function StageCard({ n, title, hint, inM, outM, takas, empty }) {
  const shortage = inM != null && outM != null ? r2(inM - outM) : null;
  const pct = shortage != null && inM ? (shortage / inM) * 100 : null;
  const kept = inM ? Math.max(0, Math.min(100, (outM / inM) * 100)) : 0;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-8 h-8 rounded-full bg-slate-900 text-white text-sm font-bold flex items-center justify-center">{n}</div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h3 className="font-bold text-forest">{title}</h3>
            {shortage != null && <div className={`text-2xl font-bold tabular-nums ${shortCls(shortage)}`}>{fmtM(shortage)}<span className="ml-1 text-sm font-medium text-slate-400">m short</span></div>}
          </div>
          <p className="text-sm text-slate-500">{hint}</p>
        </div>
      </div>
      {shortage == null ? (
        <p className="mt-4 text-sm text-slate-500">{empty}</p>
      ) : (
        <>
          <div className="mt-4 flex h-2.5 rounded-full overflow-hidden bg-rose-100"><div className="bg-emerald-300" style={{ width: `${kept}%` }} /></div>
          <div className="mt-3 flex flex-wrap justify-between gap-2 text-sm text-slate-600 tabular-nums">
            <span><strong className="text-slate-900">{fmtM(inM)}</strong> m in → <strong className="text-slate-900">{fmtM(outM)}</strong> m out</span>
            <span>{pct != null ? fmtPct(pct) : '—'}{takas != null && <span className="text-slate-400"> · {fmtInt(takas)} takas</span>}</span>
          </div>
        </>
      )}
    </div>
  );
}

/** Per-taka table of one group: the chain grey → finished → folded, and the damage in its own column. */
function TakaTable({ takas, onDamage }) {
  const paged = usePaged(takas, 50);
  return (
    <Card>
      <Table>
        <thead>
          <tr><Th>Taka</Th><Th>Colour</Th><Th className="text-right">Grey m</Th><Th className="text-right">Finished m</Th><Th className="text-right">Mill shortage</Th><Th className="text-right">Folded m</Th><Th className="text-right">Fold shortage</Th><Th className="text-right">Total shortage</Th><Th>Damage</Th><Th className="text-right">Job work shortage</Th></tr>
        </thead>
        <tbody>
          {paged.rows.map((t) => (
            <tr key={t.id}>
              <Td className="font-medium text-slate-900">{t.label}</Td>
              <Td><span className="inline-flex items-center gap-2"><ShadeSwatch hex={t.shade_hex} image={t.shade_image} size="sm" />{t.shade_no || '—'}</span></Td>
              <Td className="text-right">{fmtM(t.grey)}</Td>
              <Td className="text-right">{fmtM(t.finished_meter)}</Td>
              <Td className={`text-right ${shortCls(t.millShortage)}`}>{fmtM(t.millShortage)}</Td>
              <Td className="text-right">{t.folded_meter != null ? fmtM(t.folded_meter) : '—'}</Td>
              <Td className={`text-right ${shortCls(t.foldShortage)}`}>{t.foldShortage != null ? fmtM(t.foldShortage) : '—'}</Td>
              <Td className={`text-right font-semibold ${shortCls(t.totalShortage)}`}>{fmtM(t.totalShortage)}</Td>
              <Td><DamageTag t={t} onClick={onDamage} /></Td>
              <Td className="text-right">{t.jwShortage != null ? fmtM(t.jwShortage) : '—'}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Pager paged={paged} />
    </Card>
  );
}

/** Full-screen details for one PO / party / quality / mill / program, with the shortage broken down step by step. */
function DetailsPanel({ g, kind, takas, onClose }) {
  const [damage, setDamage] = useState(null);
  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && !damage && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose, damage]);
  const po = g.po;
  const folded = g.foldedTakas || 0;
  const foldedBase = r2(g.folded + g.foldShortage); // finished meters of the takas that were folded
  const avg = (v) => (g.takas ? fmtM(v / g.takas) : '—');
  const steps = [
    { k: 'At the mill', v: g.millShortage || 0, cls: 'bg-amber-300' },
    { k: 'Folding', v: g.foldShortage || 0, cls: 'bg-rose-300' },
  ];
  const stepSum = steps.reduce((s, x) => s + Math.max(0, x.v), 0);

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex flex-col bg-slate-50">
      <header className="flex items-center gap-4 px-4 sm:px-8 py-4 bg-white border-b border-slate-200">
        <button onClick={onClose} className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"><ArrowLeft className="w-5 h-5" /></button>
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">{kind} shortage</div>
          <h2 className="text-xl font-bold text-forest truncate">{g.label}</h2>
        </div>
        <div className="ml-auto hidden sm:flex flex-wrap gap-2">
          <Chip tone="slate">{fmtInt(g.takas)} takas back from mill</Chip>
          {folded > 0 && <Chip tone="emerald">{fmtInt(folded)} folded</Chip>}
          {g.damagedTakas > 0 && <Chip tone="primary">{fmtInt(g.damagedTakas)} damaged</Chip>}
          {po?.status === 'CLOSED' && <Chip tone="amber">closed short</Chip>}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="page-w p-4 sm:p-8 space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatTile label="Grey (challan)" value={fmtM(g.start)} unit="m" />
            <StatTile label="Finished" tone="emerald" value={fmtM(g.finished)} unit="m" />
            <StatTile label="Total shortage" tone={g.totalShortage > 0 ? 'red' : 'slate'} value={fmtM(g.totalShortage)} unit="m" sub={g.totalPct != null ? `${fmtPct(g.totalPct)} of grey` : undefined} />
            <StatTile label="Avg shortage / taka" value={avg(g.totalShortage)} unit="m" />
            {g.jwShortage > 0 && <StatTile label="Job work shortage (separate)" tone="amber" value={fmtM(g.jwShortage)} unit="m" />}
          </div>

          {/* where the shortage happened */}
          <Panel icon={Layers} title="Shortage by step">
            {stepSum > 0 ? (
              <>
                <div className="flex gap-0.5 h-4 rounded-full overflow-hidden bg-slate-100">
                  {steps.map((x) => x.v > 0 && <div key={x.k} className={x.cls} style={{ width: `${(x.v / stepSum) * 100}%` }} title={`${x.k}: ${fmtM(x.v)} m`} />)}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-4">
                  {steps.map((x) => (
                    <div key={x.k}>
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500"><span className={`w-2.5 h-2.5 rounded-full ${x.cls}`} />{x.k}</div>
                      <div className="mt-1 text-xl font-bold tabular-nums text-slate-900">{fmtM(x.v)}<span className="ml-1 text-xs font-medium text-slate-400">m</span></div>
                      <div className="text-xs text-slate-400 tabular-nums">{`${Math.round((Math.max(0, x.v) / stepSum) * 100)}% of all shortage`}</div>
                    </div>
                  ))}
                </div>
              </>
            ) : <p className="text-sm text-slate-500">{g.takas ? 'No shortage recorded.' : 'No takas have come back from the mill yet.'}</p>}
          </Panel>

          {/* the journey */}
          <div>
            <h3 className="text-sm font-bold text-forest mb-3">Step by step</h3>
            <div className="grid lg:grid-cols-2 gap-4">
              <StageCard n={1} title="Shortage at the mill" hint="Grey meters on our challan vs. meters on the mill's return challan"
                inM={g.takas ? g.start : null} outM={g.takas ? g.finished : null} takas={g.takas}
                empty="Nothing has come back from the mill yet." />
              <StageCard n={2} title="Shortage at folding" hint="Finished meters vs. folded meters"
                inM={folded ? foldedBase : null} outM={folded ? g.folded : null} takas={folded}
                empty="Nothing folded yet — appears once takas are folded." />
            </div>
          </div>

          <Panel title="Damage (separate from the shortage)">
            {g.damagedTakas > 0 ? (
              <DetailList items={[
                { label: 'Damaged takas', value: fmtInt(g.damagedTakas) },
                { label: 'Damaged meters', value: <span className="text-red-600">{fmtM(g.damage)} m</span> },
                { label: 'Not sellable', value: 'Damaged meters are taken off the sellable stock' },
              ]} />
            ) : <p className="text-sm text-slate-500">No damage was marked while folding.</p>}
          </Panel>

          {po && (
            <Panel title="Purchase order">
              <DetailList items={[
                { label: 'Ordered', value: `${fmtM(po.meters)} m` },
                { label: 'Received', value: `${fmtM(po.received_m)} m` },
                { label: 'Short received', value: po.shortfall == null ? 'PO still open' : <span className={shortCls(po.shortfall)}>{fmtM(po.shortfall)} m ({fmtPct(po.shortfall_pct)})</span> },
                { label: 'Status', value: <Badge variant={po.status === 'CLOSED' ? 'danger' : po.status === 'RECEIVED' ? 'success' : 'primary'}>{po.status === 'CLOSED' ? 'Closed (short)' : po.status[0] + po.status.slice(1).toLowerCase()}</Badge> },
              ]} />
            </Panel>
          )}

          <Panel title="Averages per taka">
            <DetailList items={[
              { label: 'Grey', value: `${avg(g.start)} m` },
              { label: 'Finished', value: `${avg(g.finished)} m` },
              { label: 'Shortage', value: `${avg(g.totalShortage)} m` },
              { label: 'Folded meters', value: folded ? `${fmtM(g.folded)} m` : null },
            ]} />
          </Panel>

          {takas.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-forest mb-3">Every taka</h3>
              <TakaTable takas={takas} onDamage={setDamage} />
            </div>
          )}

          <div className="rounded-xl border-2 border-dashed border-slate-300 bg-white/60 p-5 flex items-center gap-4">
            <div className="shrink-0 w-11 h-11 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center"><Coins className="w-5 h-5" /></div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 font-semibold text-slate-900">Approx. shortage by cost <Badge variant="warning">Coming soon</Badge></div>
              <p className="text-sm text-slate-500 mt-0.5">The value of the short meters, worked out from the rate, will appear here.</p>
            </div>
          </div>
        </div>
      </div>
      <DamageDetailsModal t={damage} onClose={() => setDamage(null)} />
    </div>,
    document.body
  );
}

/** Printable table of the selected tab with every column shown on the listing screen. */
function ReportDoc({ rows, label, showPo, tabLabel }) {
  const th = 'py-2 text-right';
  const total = (f) => r2(rows.reduce((s, g) => s + (f(g) ?? 0), 0));
  const start = total((g) => g.start), shortage = total((g) => g.totalShortage);
  return (
    <div>
      <DocHeader
        heading={`Shrinkage / Shortage Report — ${tabLabel}`}
        left={<p className="text-slate-700">{rows.length} {label.toLowerCase()} entries</p>}
        right={<p className="text-slate-700">Printed {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>}
      />
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b-2 border-slate-900 text-left">
            <th className="py-2">{label}</th>
            {showPo && <><th className={th}>Ordered m</th><th className={th}>Received m</th><th className={th}>Short received</th></>}
            <th className={th}>Takas</th><th className={th}>Grey m</th><th className={th}>Finished m</th><th className={th}>Mill shortage</th><th className={th}>Folding shortage</th><th className={th}>Total shortage m</th><th className={th}>Total %</th><th className={th}>Damage m</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((g) => (
            <tr key={g.key} className="border-b border-slate-300" style={{ breakInside: 'avoid' }}>
              <td className="py-1.5 font-medium">{g.label}</td>
              {showPo && <>
                <td className="text-right">{fmtM(g.po.meters)}</td>
                <td className="text-right">{fmtM(g.po.received_m)}</td>
                <td className="text-right">{g.po.shortfall == null ? 'open' : `${fmtM(g.po.shortfall)} m (${fmtPct(g.po.shortfall_pct)})`}{g.po.status === 'CLOSED' ? ' · closed short' : ''}</td>
              </>}
              <td className="text-right">{g.takas}</td><td className="text-right">{fmtM(g.start)}</td><td className="text-right">{fmtM(g.finished)}</td>
              <td className="text-right">{fmtM(g.millShortage)}</td><td className="text-right">{g.foldedTakas ? fmtM(g.foldShortage) : '—'}</td>
              <td className="text-right font-semibold">{fmtM(g.totalShortage)}</td><td className="text-right">{fmtPct(g.totalPct)}</td>
              <td className="text-right">{g.damage > 0 ? fmtM(g.damage) : '—'}</td>
            </tr>
          ))}
          <tr className="border-t-2 border-slate-900 font-bold">
            <td className="py-2">Total</td>
            {showPo && <td colSpan={3} />}
            <td className="text-right">{total((g) => g.takas)}</td><td className="text-right">{fmtM(start)}</td><td className="text-right">{fmtM(total((g) => g.finished))}</td>
            <td className="text-right">{fmtM(total((g) => g.millShortage))}</td><td className="text-right">{fmtM(total((g) => g.foldShortage))}</td>
            <td className="text-right">{fmtM(shortage)}</td><td className="text-right">{fmtPct(start ? (shortage / start) * 100 : null)}</td>
            <td className="text-right">{fmtM(total((g) => g.damage))}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default function ShrinkagePage() {
  const [tab, setTab] = useState('byPo');
  const [rep, setRep] = useState(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null);
  const [printing, setPrinting] = useState(false);

  const dbVersion = useDbVersion();
  useEffect(() => { repo.shrinkageReport().then(setRep).catch((e) => setError(e.message)); }, [dbVersion]);
  useEffect(() => { setOpen(null); }, [tab]);

  if (!rep) return <LoadState loading={!error} error={error} />;
  const [, tabLabel, label, keyOf] = TABS.find(([k]) => k === tab);
  const rows = rep[tab];
  // keep the open panel in sync with fresh data
  const current = open ? rows.find((g) => g.key === open) : null;

  return (
    <div className="space-y-6">
      <PageHeader title="Shrinkage report" description="Grey meters, meters finished and the shortage along the way — at the mill and at folding. Damage is shown separately. Tap any line for the full picture.">
        <Button variant="outline" onClick={() => setPrinting(true)} disabled={!rows.length}><Printer className="w-4 h-4 mr-2" /> Print</Button>
      </PageHeader>

      <div className="flex overflow-x-auto no-scrollbar gap-1 border-b border-slate-200">
        {TABS.map(([k, name]) => (
          <button key={k} type="button" onClick={() => setTab(k)} className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap ${tab === k ? 'border-primary-600 text-primary-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>{name}</button>
        ))}
      </div>

      <Card><SummaryList rows={rows} label={label} onOpen={(g) => setOpen(g.key)} /></Card>

      {current && <DetailsPanel g={current} kind={label} takas={rep.rows.filter((t) => keyOf(t) === current.key)} onClose={() => setOpen(null)} />}
      {printing && (
        <DocPreview title={`Shrinkage report — ${tabLabel}`} filename={`shrinkage-${tab}`} landscape onClose={() => setPrinting(false)}>
          <ReportDoc rows={rows} label={label} showPo={tab === 'byPo'} tabLabel={tabLabel} />
        </DocPreview>
      )}
    </div>
  );
}
