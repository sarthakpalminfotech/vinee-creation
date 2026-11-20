import React, { useEffect, useState } from 'react';
import { Mic, X } from 'lucide-react';
import { Modal, Button } from './ui';
import { DetailList, ShadeSwatch } from './kit';
import { fmtM, fmtDate } from '../lib/format';
import { getVoice } from '../lib/voiceStore';

/** Red "Damaged X m" tag; becomes a button (opens the details) when onClick is given. */
export function DamageTag({ t, onClick }) {
  if (t?.damage_m == null) return null;
  const cls = 'inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700 ring-1 ring-red-200';
  const label = `Damaged ${fmtM(t.damage_m)} m`;
  return onClick
    ? <button type="button" onClick={(e) => { e.stopPropagation(); onClick(t); }} className={`${cls} hover:bg-red-100`}>{label}</button>
    : <span className={cls}>{label}</span>;
}

/** The voice note of a damage: played from the URL, or from this device's own storage, or a note that it lives elsewhere. */
export function VoicePlayer({ t }) {
  const [local, setLocal] = useState(undefined); // undefined = loading, null = not on this device
  const needsLocal = !t.damage_voice && Number(t.damage_voice_local) === 1;
  useEffect(() => {
    if (!needsLocal) return undefined;
    let url = '';
    let live = true;
    getVoice(t.damage_id).then((b) => { if (!live) return; if (b) { url = URL.createObjectURL(b); setLocal(url); } else setLocal(null); });
    return () => { live = false; if (url) URL.revokeObjectURL(url); };
  }, [needsLocal, t.damage_id]);
  if (t.damage_voice) return <audio controls src={t.damage_voice} className="h-10 w-full max-w-sm" />;
  if (!needsLocal) return null;
  if (local) return <audio controls src={local} className="h-10 w-full max-w-sm" />;
  if (local === undefined) return <span className="text-sm text-slate-500">Loading voice note…</span>;
  return <span className="inline-flex items-center gap-2 text-sm text-slate-600"><Mic className="h-4 w-4" /> Voice note saved on the device that recorded it</span>;
}

/** Details of a damaged taka. `t` = a listTakas row (it carries the damage and the whole origin of the taka). */
export function DamageDetailsModal({ t, onClose }) {
  const [zoom, setZoom] = useState(false);
  if (!t) return null;
  const sellable = t.sellable_m ?? (t.folded_meter != null ? Math.round((t.folded_meter - t.damage_m) * 100) / 100 : null);
  const hasVoice = !!t.damage_voice || Number(t.damage_voice_local) === 1;
  return (
    <>
      <Modal isOpen onClose={onClose} title={`Damaged taka ${t.label}`} maxWidth="max-w-2xl">
        <div className="space-y-5">
          <DetailList items={[
            { label: 'Taka no', value: t.label },
            { label: 'Lot no', value: t.lot_no },
            { label: 'Quality', value: t.nick_name },
            { label: 'Colour', value: <span className="inline-flex items-center gap-2"><ShadeSwatch hex={t.shade_hex} image={t.shade_image} size="sm" />{t.shade_no || '—'}</span> },
            { label: 'Damaged meters', value: <span className="font-semibold text-red-600">{fmtM(t.damage_m)} m</span> },
            { label: 'Folded meters', value: `${fmtM(t.folded_meter)} m` },
            { label: 'Sellable meters', value: `${fmtM(sellable)} m` },
            { label: 'Date', value: t.damage_at ? fmtDate(String(t.damage_at).slice(0, 10)) : null },
          ]} />
          {t.damage_image && (
            <div>
              <div className="mb-1.5 text-xs font-bold text-slate-500">Photo</div>
              <button type="button" onClick={() => setZoom(true)} aria-label="Enlarge photo"><img src={t.damage_image} alt="Damage" crossOrigin="anonymous" className="h-36 w-36 rounded-lg border border-slate-200 object-cover" /></button>
            </div>
          )}
          {hasVoice && (
            <div>
              <div className="mb-1.5 text-xs font-bold text-slate-500">Voice note</div>
              <VoicePlayer t={t} />
            </div>
          )}
          {t.damage_notes && <div><div className="mb-1 text-xs font-bold text-slate-500">Notes</div><p className="text-[15px] text-slate-900">{t.damage_notes}</p></div>}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Where this taka came from</div>
            <DetailList items={[
              { label: 'Weaver challan', value: t.challan_no ? `${t.challan_no} · ${t.weaver_name}` : null },
              { label: 'Mill sub-challan', value: t.dispatch_no ? `${t.dispatch_no}${t.main_no ? ` (main ${t.main_no})` : ''}` : (t.direct ? 'Delivered directly to the mill' : null) },
              { label: 'Program', value: t.program_no ? `${t.program_no} · ${t.program_mill_name}` : null },
              { label: 'Mill return challan', value: t.finished_challan },
            ]} />
          </div>
          <div className="flex justify-end"><Button type="button" variant="outline" onClick={onClose}>Close</Button></div>
        </div>
      </Modal>
      {zoom && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4" onClick={() => setZoom(false)}>
          <button type="button" aria-label="Close photo" className="absolute right-4 top-4 rounded-full bg-white/90 p-2 text-slate-700"><X className="h-5 w-5" /></button>
          <img src={t.damage_image} alt="Damage" crossOrigin="anonymous" className="max-h-full max-w-full rounded-lg object-contain" />
        </div>
      )}
    </>
  );
}
