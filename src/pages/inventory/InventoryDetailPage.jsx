import React, { useState, useEffect, useMemo } from 'react';
import { Link, useParams, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { PageHeader, Card, Select, Input, Table, Th, Td, Empty, LoadState, Pager, usePaged, Field, SearchArea } from '../../components/ui';
import { Qty, StatTile, Chip, ShadeSwatch, SectionTitle, SearchToggle, FilterButton } from '../../components/kit';
import { DamageTag, DamageDetailsModal } from '../../components/DamageDetails';
import { AlertTriangle, ArrowLeft, Boxes } from 'lucide-react';
import { fmtInt, fmtM, fmtDate, daysBetween } from '../../lib/format';
import * as repo from '../../db/repo';
import { useDbVersion } from '../../lib/live';

const natural = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true });
const r2 = (n) => Math.round(n * 100) / 100;
const TONE = { godown: 'slate', mill: 'sky', dyeing: 'violet', finished: 'emerald', dead: 'amber', damaged: 'red', jobwork: 'amber' };

/** Details of one quality at one stage: totals → (colours) → filters → every taka. */
export default function InventoryDetailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  // opened from another screen (e.g. a quality's details): back returns there
  const backTo = location.state?.from;
  const { view, qualityId } = useParams();
  const [params] = useSearchParams();
  const [all, setAll] = useState(null);
  const [error, setError] = useState('');
  const dbVersion = useDbVersion();
  const [f, setF] = useState({ group_id: '', weaver_id: '', branch_id: params.get('branch') || '', mill_id: '', shade_id: '', damaged: false, jw: '', search: '' });
  const [details, setDetails] = useState(null); // damaged taka whose details are shown
  const set = (k, v) => setF((p) => ({ ...p, [k]: v, ...(k === 'group_id' ? { weaver_id: '' } : {}) }));

  useEffect(() => {
    let live = true;
    if (!repo.INVENTORY_VIEWS[view] && view !== 'dead' && view !== 'damaged') { setError('Unknown stock stage'); return undefined; }
    let fetcher;
    if (view === 'dead') {
      fetcher = repo.getDeadStockDays().then((d) => repo.deadStock(d, { quality_id: qualityId }));
    } else if (view === 'damaged') {
      fetcher = repo.damagedStock({ quality_id: qualityId });
    } else {
      fetcher = repo.inventoryList(view, { quality_id: qualityId });
    }
    fetcher
      .then((r) => live && (setAll(r), setError('')))
      .catch((e) => live && setError(e.message));
    return () => { live = false; };
  }, [view, qualityId, dbVersion]);

  const dead = view === 'dead';
  const isDamaged = view === 'damaged';
  const fin = view === 'finished' || dead; // finished goods (dead stock is a slice of them)
  const isJob = view === 'jobwork';
  const coloured = view === 'dyeing' || fin || isJob;
  const stageLabel = dead ? 'Dead stock' : isDamaged ? 'Damaged stock' : repo.INVENTORY_VIEWS[view]?.label;
  const tone = TONE[view] || 'slate';

  // everything except the colour choice, so the colour cards keep showing their full numbers
  const baseFiltered = useMemo(() => (all || []).filter((t) => (
    (!f.group_id || String(t.group_id) === f.group_id) && (!f.weaver_id || String(t.weaver_id) === f.weaver_id) &&
    (!f.branch_id || String(t.branch_id) === f.branch_id) && (!f.damaged || t.damage_m != null) &&
    (!f.mill_id || String(t.mill_id) === f.mill_id) &&
    (!f.jw || (f.jw === 'plain' ? t.jw_type == null : t.jw_type != null)) &&
    (!f.search || `${t.challan_no}/${t.taka_no} ${t.weaver_name} ${t.program_no || ''} ${t.lot_no || ''}`.toLowerCase().includes(f.search.toLowerCase()))
  )), [all, f.group_id, f.weaver_id, f.branch_id, f.damaged, f.mill_id, f.jw, f.search]);
  const shown = useMemo(() => baseFiltered.filter((t) => !f.shade_id || String(t.shade_id) === f.shade_id)
    .sort((a, b) => natural(a.challan_no, b.challan_no) || natural(a.taka_no, b.taka_no)), [baseFiltered, f.shade_id]);
  const paged = usePaged(shown, 100);

  const total = useMemo(() => ({ takas: (all || []).length, m: r2((all || []).reduce((s, t) => s + t.stock_m, 0)) }), [all]);
  const shownTotal = useMemo(() => ({ takas: shown.length, m: r2(shown.reduce((s, t) => s + t.stock_m, 0)) }), [shown]);

  // helper: group takas of the whole quality by a key → [{key,label,takas,m}]
  const by = (keyOf, labelOf) => {
    const m = new Map();
    for (const t of all || []) {
      const k = keyOf(t);
      if (k == null) continue;
      if (!m.has(k)) m.set(k, { key: k, label: labelOf(t), takas: 0, m: 0 });
      const g = m.get(k); g.takas += 1; g.m = r2(g.m + t.stock_m);
    }
    return [...m.values()].sort((a, b) => natural(a.label, b.label));
  };
  const branches = useMemo(() => by((t) => t.branch_id, (t) => t.branch_name || '—'), [all]);
  const mills = useMemo(() => by((t) => t.mill_id, (t) => t.mill_name || '—'), [all]);
  const programs = useMemo(() => by((t) => t.program_id, (t) => t.program_no), [all]);
  const groups = useMemo(() => by((t) => t.group_id, (t) => t.group_name), [all]);
  const parties = useMemo(() => by((t) => t.weaver_id, (t) => t.weaver_name).filter((p) => !f.group_id || (all || []).some((t) => t.weaver_id === p.key && String(t.group_id) === f.group_id)), [all, f.group_id]);

  // colour cards (dyeing / finished): one per item code / shade with its own totals
  const colours = useMemo(() => {
    const m = new Map();
    for (const t of baseFiltered) {
      if (!t.shade_id) continue;
      if (!m.has(t.shade_id)) m.set(t.shade_id, { id: t.shade_id, no: t.shade_no, name: t.shade_name, hex: t.shade_hex, image: t.shade_image, takas: 0, m: 0, folded: { takas: 0, m: 0 }, unfolded: { takas: 0, m: 0 }, progs: new Map() });
      const g = m.get(t.shade_id);
      g.takas += 1; g.m = r2(g.m + t.stock_m);
      if (t.status === 'FOLDED') { g.folded.takas += 1; g.folded.m = r2(g.folded.m + t.stock_m); }
      if (t.status === 'FINISHED') { g.unfolded.takas += 1; g.unfolded.m = r2(g.unfolded.m + t.stock_m); }
      if (t.program_no) g.progs.set(t.program_no, (g.progs.get(t.program_no) || 0) + 1);
    }
    return [...m.values()].sort((a, b) => natural(a.no, b.no));
  }, [baseFiltered]);

  // For damaged view: group by stage so users know where each damaged taka currently sits
  const stageGroups = useMemo(() => {
    if (!isDamaged) return null;
    const STAGE_LABEL = { GODOWN_GREY: 'Godown (Grey)', MILL_GREY: 'Mill (Grey)', IN_DYEING: 'In Dyeing', FINISHED: 'Finished', FOLDED: 'Folded', SOLD: 'Sold', JOB_WORK: 'Job work', NOT_RETURNED: 'Not returned', WITHDRAWN: 'Withdrawn', GREY_SOLD: 'Grey sold' };
    const m = new Map();
    for (const t of shown) {
      const k = t.status;
      if (!m.has(k)) m.set(k, { status: k, label: STAGE_LABEL[k] || k, takas: 0, m: 0 });
      const g = m.get(k); g.takas += 1; g.m = r2(g.m + t.stock_m);
    }
    return [...m.values()];
  }, [isDamaged, shown]);

  if (error) return <LoadState error={error} />;
  if (!all) return <LoadState loading />;
  const head = all[0];
  if (!head) {
    return (
      <div className="space-y-6">
        <PageHeader title="Inventory" onBack={() => navigate(backTo || (dead ? '/inventory?mode=dead' : isDamaged ? '/inventory?mode=damaged' : `/inventory?view=${view}`))} />
        <Empty icon={isDamaged ? AlertTriangle : Boxes} title="No stock left" description="This quality has no takas at this stage any more." />
      </div>
    );
  }
  const foldedAll = shown.filter((t) => t.status === 'FOLDED');
  const distinct = (k) => new Set(shown.map((t) => t[k]).filter((v) => v != null)).size; // KPIs follow the active filters
  const filterCount = ['group_id', 'weaver_id', 'branch_id', 'mill_id', 'shade_id', 'damaged', 'jw', 'search'].filter((k) => f[k]).length;
  const damagedAll = (all || []).filter((t) => t.damage_m != null);
  const lotCol = fin || isJob;
  const showBranch = view === 'godown', showMill = view !== 'godown' && !isDamaged && !isJob;

  const backUrl = backTo || (dead ? '/inventory?mode=dead' : isDamaged ? '/inventory?mode=damaged' : `/inventory?view=${view}`);

  return (
    <div className="space-y-8">
      <div>
        <PageHeader title={`${head.nick_name} · ${stageLabel}`} onBack={() => navigate(backUrl)}
          action={(
            <FilterButton count={filterCount - (f.search ? 1 : 0) - (f.shade_id ? 1 : 0) - (f.damaged ? 1 : 0)} title="Filter takas" onClear={() => setF((p) => ({ group_id: '', weaver_id: '', branch_id: '', mill_id: '', shade_id: p.shade_id, damaged: false, jw: '', search: p.search }))}>
              <Field label="Firm">
                <Select value={f.group_id} onChange={(e) => set('group_id', e.target.value)}>
                  <option value="">All firms</option>
                  {groups.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
                </Select>
              </Field>
              <Field label="Associated party">
                <Select value={f.weaver_id} onChange={(e) => set('weaver_id', e.target.value)}>
                  <option value="">All associated parties</option>
                  {parties.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
                </Select>
              </Field>
              {showBranch && (<Field label="Branch">
                <Select value={f.branch_id} onChange={(e) => set('branch_id', e.target.value)}>
                  <option value="">All branches</option>
                  {branches.map((b) => <option key={b.key} value={b.key}>{b.label}</option>)}
                </Select>
              </Field>)}
              {fin && (<Field label="Job work">
                <Select value={f.jw} onChange={(e) => set('jw', e.target.value)}>
                  <option value="">Plain and job-worked</option>
                  <option value="plain">Plain only</option>
                  <option value="jobworked">Job-worked only</option>
                </Select>
              </Field>)}
              {fin && (<label className="flex items-center gap-2 text-sm font-medium text-slate-700"><input type="checkbox" checked={f.damaged} onChange={(e) => set('damaged', e.target.checked)} /> Damaged takas only</label>)}
              {showMill && (<Field label="Mill">
                <Select value={f.mill_id} onChange={(e) => set('mill_id', e.target.value)}>
                  <option value="">All mills</option>
                  {mills.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
                </Select>
              </Field>)}
            </FilterButton>
          )} />
      </div>

      {/* 1 · totals for this quality at this stage */}
      <section>
        <SectionTitle title={filterCount ? 'Total in stock (filtered)' : isDamaged ? 'Damaged meters' : 'Total in stock'} />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatTile label="Takas" tone={tone} value={fmtInt(shownTotal.takas)} />
          <StatTile label={isDamaged ? 'Damaged meters' : 'Meters'} tone={tone} value={fmtM(shownTotal.m)} unit="m" />
          <StatTile label="Average per taka" value={shownTotal.takas ? fmtM(shownTotal.m / shownTotal.takas) : '—'} unit="m" />
          {dead ? (
            <StatTile label="Longest idle" tone="amber" value={fmtInt(shown.length ? Math.max(...shown.map((t) => t.idle_days)) : 0)} unit="days" />
          ) : view === 'finished' ? (
            <StatTile label="Folded (ready to sell)" tone="emerald" value={fmtInt(foldedAll.length)} unit="taka" sub={`${fmtM(r2(foldedAll.reduce((s, t) => s + t.stock_m, 0)))} sellable m · ${fmtInt(shownTotal.takas - foldedAll.length)} still to fold`} />
          ) : isJob ? (
            <StatTile label="Job workers" tone="amber" value={distinct('jw_worker_name')} />
          ) : view === 'dyeing' ? (
            <StatTile label="Programs running" tone="violet" value={distinct('program_id')} />
          ) : view === 'mill' ? (
            <StatTile label="Mills holding it" tone="sky" value={distinct('mill_id')} />
          ) : isDamaged ? (
            <StatTile label="Across stages" tone="red" value={stageGroups?.length ?? 0} unit="stage(s)" />
          ) : (
            <StatTile label="Branches" value={distinct('branch_id')} />
          )}
        </div>
        {view === 'godown' && branches.length > 0 && <BreakdownRow title="By branch" items={branches} active={f.branch_id} onPick={(k) => set('branch_id', String(f.branch_id) === String(k) ? '' : String(k))} />}
        {view === 'mill' && mills.length > 0 && <BreakdownRow title="By mill" items={mills} active={f.mill_id} onPick={(k) => set('mill_id', String(f.mill_id) === String(k) ? '' : String(k))} />}
        {view === 'dyeing' && programs.length > 0 && <BreakdownRow title="By program" items={programs} />}
        {isDamaged && stageGroups && stageGroups.length > 0 && <BreakdownRow title="By current stage" items={stageGroups.map((s) => ({ key: s.status, label: s.label, takas: s.takas, m: s.m }))} />}
      </section>

      {/* 2 · colours (dyeing / finished only) */}
      {coloured && (
        <section>
          <SectionTitle title={`Colours in stock (${colours.length})`}
            right={f.shade_id && <button className="text-xs text-primary-600 hover:underline" onClick={() => set('shade_id', '')}>Show all colours</button>} />
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,19rem),1fr))] gap-4">
            {colours.map((c) => {
              const on = String(f.shade_id) === String(c.id);
              return (
                <button key={c.id} type="button" onClick={() => set('shade_id', on ? '' : String(c.id))}
                  className={`text-left rounded-lg border bg-white p-4 transition hover:shadow-md ${on ? 'border-primary-500 ring-2 ring-primary-100' : 'border-slate-200 hover:border-slate-300'}`}>
                  <div className="flex items-center gap-3">
                    <ShadeSwatch hex={c.hex} image={c.image} size="lg" />
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 truncate">{c.no}</div>
                      <div className="text-xs text-slate-500 truncate">{c.name || '\u00a0'}</div>
                    </div>
                  </div>
                  <Qty className="mt-3" tone={tone} takas={c.takas} meters={c.m} />
                  {fin ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Chip tone="emerald">{fmtInt(c.folded.takas)} folded · {fmtM(c.folded.m)} m</Chip>
                      {c.unfolded.takas > 0 && <Chip tone="amber">{fmtInt(c.unfolded.takas)} to fold · {fmtM(c.unfolded.m)} m</Chip>}
                    </div>
                  ) : (
                    <div className="mt-3 flex flex-wrap gap-2">{[...c.progs.entries()].map(([p, n]) => <Chip key={p} tone="violet">{p} · {n} taka</Chip>)}</div>
                  )}
                </button>
              );
            })}
            {colours.length === 0 && <div className="text-sm text-slate-500">No colours match the filters.</div>}
          </div>
        </section>
      )}

      {/* 3 · filters + every taka */}
      <section>
        <SectionTitle title={`Takas (${fmtInt(shownTotal.takas)} of ${fmtInt(total.takas)})`} />
        <Card>
          <SearchArea className="p-4 border-b border-slate-100">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm text-slate-500">{filterCount > 0 ? `${filterCount} filter${filterCount > 1 ? 's' : ''} active` : 'No filters'}</div>
            <div className="flex items-center gap-2">
              {fin && [['plain', 'Plain'], ['jobworked', 'Job-worked']].map(([k, label]) => (
                <button key={k} type="button" aria-pressed={f.jw === k} onClick={() => set('jw', f.jw === k ? '' : k)}
                  className={`h-11 rounded-md border px-3 text-sm font-medium ${f.jw === k ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}>{label}</button>
              ))}
              {fin && (
                <button type="button" aria-pressed={f.damaged} onClick={() => set('damaged', !f.damaged)}
                  className={`h-11 rounded-md border px-3 text-sm font-medium ${f.damaged ? 'border-red-300 bg-red-50 text-red-700' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}>
                  Damaged{damagedAll.length ? ` (${damagedAll.length})` : ''}
                </button>
              )}
              <SearchToggle value={f.search} onChange={(v) => set('search', v)} placeholder="Challan / taka / associated party / lot…" />
            </div>
          </div>
          </SearchArea>

          {shown.length === 0 ? (
            <div className="p-6"><Empty icon={isDamaged ? AlertTriangle : Boxes} title="No takas match" description="Change or clear the filters." /></div>
          ) : (
            <>
              <Table className="whitespace-normal xl:whitespace-nowrap [&_td]:px-3 [&_th]:px-3 xl:[&_td]:px-4 xl:[&_th]:px-4">
                <thead>
                  <tr>
                    <Th>Taka</Th><Th>Associated party</Th>
                    {isDamaged && <Th>Stage</Th>}
                    {showBranch && <Th>Branch</Th>}
                    {showMill && <Th className="hidden xl:table-cell">Mill</Th>}
                    {coloured && <Th>Colour</Th>}
                    {lotCol && <Th className="hidden xl:table-cell">Lot</Th>}
                    {view === 'dyeing' && <Th>Program</Th>}
                    {isJob && <><Th>Job worker</Th><Th className="hidden xl:table-cell">Challan</Th><Th className="hidden xl:table-cell">Job type</Th><Th className="text-right">Days out</Th></>}
                    {fin && <Th>State</Th>}{dead && <Th>Idle</Th>}
                    <Th className={`text-right ${fin || isJob ? 'hidden xl:table-cell' : ''}`}>Damaged m</Th>
                    {!isDamaged && <Th className="text-right">Stock m</Th>}
                  </tr>
                </thead>
                <tbody>
                  {paged.rows.map((t) => (
                    <tr key={t.id} className={`hover:bg-slate-50 ${isDamaged ? 'cursor-pointer' : ''}`}
                      onClick={isDamaged ? () => setDetails(t) : undefined}>
                      <Td className="text-xs text-slate-400 whitespace-nowrap">{t.label}</Td>
                      <Td>{t.weaver_name}<div className="text-xs text-slate-400">{t.group_name}</div>{showMill && t.mill_name && <div className="xl:hidden text-xs text-slate-500">{t.mill_name}</div>}</Td>
                      {isDamaged && <Td><StageBadge status={t.status} /></Td>}
                      {showBranch && <Td>{t.branch_name || '—'}</Td>}
                      {showMill && <Td className="hidden xl:table-cell">{t.mill_name || '—'}</Td>}
                      {coloured && <Td><span className="inline-flex items-center gap-2"><ShadeSwatch hex={t.shade_hex} image={t.shade_image} size="sm" /><span className="font-semibold">{t.shade_no || '—'}</span></span>{lotCol && t.lot_no && <div className="xl:hidden mt-0.5 text-xs text-slate-500">Lot {t.lot_no}</div>}</Td>}
                      {lotCol && <Td className="hidden xl:table-cell text-sm text-slate-600">{t.lot_no || '—'}</Td>}
                      {view === 'dyeing' && <Td>{t.program_no}</Td>}
                      {isJob && <><Td>{t.jw_worker_name || '—'}<div className="xl:hidden text-xs text-slate-500">{[t.jw_no ? `JW-${t.jw_no}` : null, t.jw_challan_type].filter(Boolean).join(' · ')}</div></Td><Td className="hidden xl:table-cell font-medium">{t.jw_no ? `JW-${t.jw_no}` : '—'}</Td><Td className="hidden xl:table-cell">{t.jw_challan_type || '—'}</Td><Td className="text-right">{t.jw_date ? fmtInt(Math.max(0, daysBetween(t.jw_date))) : '—'}</Td></>}
                      {fin && <Td><span className="inline-flex flex-wrap items-center gap-1.5">{t.status === 'FOLDED' ? <Chip tone="emerald">Folded</Chip> : <Chip tone="amber">To fold</Chip>}{t.jw_type != null && <Chip tone="amber">{t.jw_type}{t.jw_no ? ` · JW-${t.jw_no}` : ''}</Chip>}<DamageTag t={t} onClick={setDetails} /></span></Td>}
                      {dead && <Td className="font-semibold">{fmtInt(t.idle_days)} <span className="text-[11px] font-normal text-slate-400">days</span></Td>}
                      <Td className={`text-right font-semibold tabular-nums text-red-600 ${fin || isJob ? 'hidden xl:table-cell' : ''}`}>
                        {t.damage_m != null ? <>{fmtM(t.damage_m)}<span className="ml-1 text-[11px] font-normal text-slate-400">m</span></> : <span className="text-slate-300">—</span>}
                      </Td>
                      {!isDamaged && <Td className="text-right text-base font-semibold tabular-nums">{fmtM(t.stock_m)}<span className="ml-1 text-[11px] font-normal text-slate-400">m</span>{isJob && t.damage_m != null && <div className="xl:hidden text-xs font-semibold text-red-600">{fmtM(t.damage_m)} m damaged</div>}</Td>}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50">
                    <Td colSpan={2 + (isDamaged ? 1 : 0) + (showBranch ? 1 : 0) + (coloured ? 1 : 0) + (view === 'dyeing' || fin ? 1 : 0) + (isJob ? 2 : 0) + (dead ? 1 : 0)} className="font-semibold text-slate-700">Total ({fmtInt(shownTotal.takas)} taka)</Td>
                    {/* the columns that only show from xl (mill, lot, job challan + type) */}
                    {(showMill || lotCol || isJob) && <Td className="hidden xl:table-cell" colSpan={(showMill ? 1 : 0) + (lotCol ? 1 : 0) + (isJob ? 2 : 0)} />}
                    <Td className={`text-right font-bold tabular-nums text-red-600 ${fin || isJob ? 'hidden xl:table-cell' : ''}`}>{fmtM(repo.damagedTotal(shown))}<span className="ml-1 text-[11px] font-normal text-slate-400">m</span></Td>
                    {!isDamaged && <Td className="text-right font-bold tabular-nums">{fmtM(shownTotal.m)}<span className="ml-1 text-[11px] font-normal text-slate-400">m</span></Td>}
                  </tr>
                </tfoot>
              </Table>
              <Pager paged={paged} />
            </>
          )}
        </Card>
      </section>
      <DamageDetailsModal t={details} onClose={() => setDetails(null)} />
    </div>
  );
}

/** Small coloured pill showing the current stage of a taka (used in the damaged view). */
function StageBadge({ status }) {
  const MAP = {
    GODOWN_GREY: { label: 'Godown', cls: 'bg-slate-100 text-slate-700' },
    MILL_GREY:   { label: 'Mill', cls: 'bg-sky-100 text-sky-700' },
    IN_DYEING:   { label: 'Dyeing', cls: 'bg-violet-100 text-violet-700' },
    FINISHED:    { label: 'Finished', cls: 'bg-emerald-100 text-emerald-700' },
    FOLDED:      { label: 'Folded', cls: 'bg-emerald-100 text-emerald-700' },
    SOLD:        { label: 'Sold', cls: 'bg-slate-100 text-slate-400' },
    JOB_WORK:    { label: 'Job work', cls: 'bg-amber-100 text-amber-700' },
    NOT_RETURNED: { label: 'Not returned', cls: 'bg-red-100 text-red-700' },
    WITHDRAWN:   { label: 'Withdrawn', cls: 'bg-slate-100 text-slate-500' },
    GREY_SOLD:   { label: 'Grey sold', cls: 'bg-slate-100 text-slate-400' },
  };
  const m = MAP[status] || { label: status, cls: 'bg-slate-100 text-slate-700' };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${m.cls}`}>{m.label}</span>;
}

/** Row of small figures (\"Surat Godown 36 taka · 3,536 m\"); clickable ones act as a filter. */
function BreakdownRow({ title, items, active, onPick }) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 mr-1">{title}</span>
      {items.map((i) => {
        const on = active !== undefined && String(active) === String(i.key);
        return (
          <button key={i.key} type="button" disabled={!onPick} onClick={() => onPick?.(i.key)}
            className={`rounded-lg border px-3 py-1.5 text-sm bg-white tabular-nums ${on ? 'border-primary-500 ring-2 ring-primary-100' : 'border-slate-200'} ${onPick ? 'hover:border-slate-300' : 'cursor-default'}`}>
            <span className="font-medium text-slate-800">{i.label}</span>
            <span className="mx-2 text-slate-300">|</span>
            <strong>{fmtInt(i.takas)}</strong> <span className="text-xs text-slate-400">taka</span>
            <span className="mx-1.5 text-slate-300">·</span>
            <strong>{fmtM(i.m)}</strong> <span className="text-xs text-slate-400">m</span>
          </button>
        );
      })}
    </div>
  );
}
