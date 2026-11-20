import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { PageHeader, Card, Button, Drawer, Alert, Badge, Modal, useAction } from '../../components/ui';
import { Printer, Plus, Lock, Unlock, ChevronRight } from 'lucide-react';
import { fmtM, fmtDate } from '../../lib/format';
import * as repo from '../../db/repo';
import { useDbVersion, useBackTo } from '../../lib/live';
import { DetailList, Qty } from '../../components/kit';
import { MillChallanPreview, OldChallanPreview } from './DispatchDocs';
import PartBuilder from './PartBuilder';
import { newPart, partTotals } from './partLogic';
import { TakaList } from '../../components/TakaGrid';

export function DispatchPreviewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  return <MillChallanPreview id={id} onClose={() => navigate(`/dispatch/${id}`)} />;
}

function SubSection({ sub, onPrint }) {
  const [open, setOpen] = useState(false);
  return (
    <Card className="overflow-visible">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
        <button type="button" aria-expanded={open} aria-label={open ? 'Hide takas' : 'Show takas'} onClick={() => setOpen(!open)} className="rounded p-1.5 text-slate-500 hover:bg-slate-100">
          <ChevronRight className={`h-5 w-5 transition-transform ${open ? 'rotate-90' : ''}`} />
        </button>
        <button type="button" onClick={() => setOpen(!open)} className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-0.5 text-left">
          <span className="text-base font-bold text-primary-700">{sub.dispatch_no}</span>
          <span className="font-medium text-slate-900">{sub.weaver_challan || '—'}</span>
          <span className="text-sm text-slate-600">{sub.weaver_name || '—'}</span>
          <span className="text-sm text-slate-600">{sub.quality_nick || sub.qualities || '—'}</span>
        </button>
        <Qty variant="inline" takas={sub.taka_count} meters={sub.total_m} />
        <Button variant="outline" size="sm" onClick={onPrint}><Printer className="mr-1.5 h-3.5 w-3.5" /> Print this sub-challan</Button>
      </div>
      {open && (
        <div className="border-t border-slate-100 p-4">
          <TakaList items={sub.takas.map((t) => ({ id: t.id, no: t.taka_no, meters: t.grey_meter }))} />
        </div>
      )}
    </Card>
  );
}

// Main mill challan. Sub-challans: 121A, 121B … one per weaver challan. The quality is always shown by its nickname.
export default function DispatchDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const back = useBackTo('/dispatch');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [main, setMain] = useState(null);
  const [oldId, setOldId] = useState(null);
  const [preview, setPreview] = useState(null); // {subId?}
  const [adding, setAdding] = useState(null); // {challans, parts}
  const { busy, error: actError, run } = useAction();

  const dbVersion = useDbVersion();
  useEffect(() => {
    (async () => {
      try {
        const data = await repo.getMillChallan(id);
        if (data) setMain(data);
        else if (await repo.getDispatch(id)) setOldId(id); // an old link (before main challans existed)
        else navigate('/dispatch');
      } catch (e) { setError(e.message); } finally { setLoading(false); }
    })();
  }, [id, navigate, dbVersion]);

  if (oldId) return <Navigate to={`/dispatch/old/${oldId}`} replace />;
  if (loading || error || !main) {
    return <Drawer isOpen>{error ? <Alert>{error}</Alert> : <div className="p-12 text-center text-slate-500">Loading...</div>}</Drawer>;
  }
  const open = main.status === 'OPEN';

  const startAdd = () => run(async () => {
    setAdding({ challans: await repo.listGodownChallans(), parts: [newPart()], err: '' });
  });
  const valid = adding ? adding.parts.filter((p) => p.receipt && partTotals(p).takas > 0) : [];
  const saveAdd = () => run(async () => {
    if (!valid.length) throw new Error('Choose a weaver challan and select its takas');
    await repo.addToMillChallan(main.id, valid.map((p) => ({ receipt_id: p.receipt.id, taka_ids: p.sel })));
    setAdding(null);
  });

  return (
    <Drawer isOpen>
      <div className="page-w space-y-6">
        <PageHeader title={`Mill challan ${main.main_no}`} description={`Sent to ${main.mill_name} on ${fmtDate(main.date)}`} onBack={back}>
          <Button onClick={() => setPreview({})}><Printer className="mr-2 h-4 w-4" /> Print / Share full challan</Button>
          {open && <Button variant="outline" disabled={busy} onClick={startAdd}><Plus className="mr-2 h-4 w-4" /> Add another weaver challan</Button>}
          {open
            ? <Button variant="outline" disabled={busy} onClick={() => run(() => repo.closeMillChallan(main.id))}><Lock className="mr-2 h-4 w-4" /> Mark closed</Button>
            : <Button variant="outline" disabled={busy} onClick={() => run(() => repo.reopenMillChallan(main.id))}><Unlock className="mr-2 h-4 w-4" /> Reopen</Button>}
        </PageHeader>
        <Alert>{actError}</Alert>

        <Card className="space-y-6 p-6">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-bold text-forest">{main.mill_name}</h2>
            {main.mill_gstin && <span className="font-mono text-sm text-slate-600">GSTIN {main.mill_gstin}</span>}
            <Badge variant={open ? 'primary' : 'gray'}>{open ? 'Open' : 'Closed'}</Badge>
          </div>
          <DetailList items={[
            { label: 'Challan no', value: main.main_no },
            { label: 'Date', value: fmtDate(main.date) },
            { label: 'Sub-challans', value: main.sub_count },
            { label: 'Quality', value: main.qualities },
            { label: 'Takas', value: main.taka_count },
            { label: 'Total meters', value: `${fmtM(main.total_m)} m` },
            { label: 'Notes', value: main.notes, wide: true },
          ]} />
        </Card>

        <div className="space-y-3">
          <h3 className="text-base font-bold text-forest">Sub-challans</h3>
          {main.subs.map((s) => <SubSection key={s.id} sub={s} onPrint={() => setPreview({ subId: s.id })} />)}
        </div>
      </div>

      {preview && <MillChallanPreview id={main.id} subId={preview.subId} onClose={() => setPreview(null)} />}

      <Modal isOpen={!!adding} onClose={() => !busy && setAdding(null)} title={`Add to mill challan ${main.main_no}`} maxWidth="max-w-4xl">
        {adding && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">New weaver challans get the next letter. Takas of a weaver challan that already has a sub-challan ({main.subs.map((s) => s.dispatch_no).join(', ')}) are added to that sub-challan.</p>
            <PartBuilder parts={adding.parts} setParts={(p) => setAdding((a) => ({ ...a, parts: typeof p === 'function' ? p(a.parts) : p }))} mainNo={main.main_no}
              existing={main.subs} challans={adding.challans} error={adding.err} setError={(e) => setAdding((a) => ({ ...a, err: e }))} />
            <Alert>{adding.err || actError}</Alert>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" disabled={busy} onClick={() => setAdding(null)}>Cancel</Button>
              <Button disabled={busy || valid.length === 0} onClick={saveAdd}>{busy ? 'Saving…' : `Add ${valid.reduce((s, p) => s + partTotals(p).takas, 0)} takas to the challan`}</Button>
            </div>
          </div>
        )}
      </Modal>
    </Drawer>
  );
}

/** An old challan from before main/sub challans existed ("Old challan DC-0001"): shown as a single challan. */
export function OldDispatchDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const back = useBackTo('/dispatch');
  const [dispatch, setDispatch] = useState(null);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(false);
  useEffect(() => {
    (async () => {
      try { const d = await repo.getDispatch(id); if (!d) return navigate('/dispatch'); setDispatch(d); } catch (e) { setError(e.message); }
    })();
  }, [id, navigate]);
  if (error || !dispatch) return <Drawer isOpen>{error ? <Alert>{error}</Alert> : <div className="p-12 text-center text-slate-500">Loading...</div>}</Drawer>;
  return (
    <Drawer isOpen>
      <div className="page-w space-y-6">
        <PageHeader title={`Old challan ${dispatch.dispatch_no}`} description={`Sent to ${dispatch.mill_name} on ${fmtDate(dispatch.date)}`} onBack={back}>
          <Button onClick={() => setPreview(true)}><Printer className="mr-2 h-4 w-4" /> Print challan</Button>
        </PageHeader>
        <Alert tone="info">This challan was made before mill challans were issued against weaver challans, so it has no sub-challans.</Alert>
        <Card className="space-y-6 p-6">
          <h2 className="text-lg font-bold text-forest">{dispatch.mill_name}</h2>
          <DetailList items={[
            { label: 'Challan no', value: dispatch.dispatch_no },
            { label: 'Date', value: fmtDate(dispatch.date) },
            { label: 'Quality', value: dispatch.qualities },
            { label: 'Takas', value: dispatch.taka_count },
            { label: 'Total meters', value: `${fmtM(dispatch.total_m)} m` },
            { label: 'Notes', value: dispatch.notes, wide: true },
          ]} />
        </Card>
        <Card>
          <div className="rounded-t-xl border-b border-slate-100 bg-slate-50/50 p-5"><h3 className="font-bold text-forest">Takas on this challan</h3></div>
          <div className="p-4"><TakaList items={dispatch.takas.map((t) => ({ id: t.id, no: `${t.challan_no}/${t.taka_no}`, meters: t.grey_meter }))} /></div>
        </Card>
      </div>
      {preview && <OldChallanPreview id={id} onClose={() => setPreview(false)} />}
    </Drawer>
  );
}
