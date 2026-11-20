// Colour pieces of the Masters screens: the shade form (library + quality-only colours) and the per-quality Colours panel.
import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Library, Palette, Edit, Trash2, X, Search } from 'lucide-react';
import { Button, Input, Field, Modal, Alert, Empty } from '../../components/ui';
import { ShadeSwatch } from '../../components/kit';
import ImagePicker from '../../components/ImagePicker';
import { lastUsedText } from '../../lib/format';
import { useDbVersion } from '../../lib/live';
import * as repo from '../../db/repo';

/** Shade name + description + colour picker (and/or image). `value`: {number, name, hex, image_url}. */
export function ShadeFields({ value, onChange }) {
  const set = (k, v) => onChange({ ...value, [k]: v });
  return (
    <div className="space-y-4">
      <Field label="Shade name *"><Input required placeholder="e.g. Royal Blue" value={value.number || ''} onChange={(e) => set('number', e.target.value)} /></Field>
      <Field label="Description (optional)"><Input placeholder="e.g. Deep blue with a slight shine" value={value.name || ''} onChange={(e) => set('name', e.target.value)} /></Field>
      <Field label="Colour">
        <div className="flex items-center gap-3">
          <input type="color" aria-label="Pick a colour" value={value.hex || '#cccccc'} onChange={(e) => set('hex', e.target.value)} className="h-11 w-12 shrink-0 cursor-pointer rounded border border-slate-300 bg-white p-1" />
          <Input placeholder="#A1B2C3" value={value.hex || ''} onChange={(e) => set('hex', e.target.value)} />
          {value.hex && <Button type="button" variant="ghost" size="sm" onClick={() => set('hex', '')}>Clear</Button>}
        </div>
        <span className="text-xs text-slate-500">Some shades can't be made with a picker — add a photo instead (or as well).</span>
      </Field>
      <ImagePicker label="Photo of the shade" value={value.image_url || ''} onChange={(url) => set('image_url', url)} />
    </div>
  );
}

const toggleCls = (on) => `relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${on ? 'bg-emerald-500' : 'bg-slate-300'}`;
function Switch({ on, onClick, label }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onClick} className={toggleCls(on)}>
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  );
}

/** Library colour card (Masters → Shades). */
export function LibraryShadeCard({ s, onOpen, onEdit, onDelete }) {
  return (
    <div onClick={onOpen} className={`group relative overflow-hidden rounded-xl border border-slate-200 bg-white ${onOpen ? 'cursor-pointer hover:border-primary-300' : ''} ${Number(s.active ?? 1) === 1 ? '' : 'opacity-60'}`}>
      <div className="aspect-[16/9] w-full bg-slate-50"><ShadeSwatch shade={s} size="xl" shape="square" className="!rounded-none !border-0" /></div>
      <div className="p-3">
        <div className="truncate font-semibold text-slate-900">{s.number}</div>
        <div className="truncate text-xs text-slate-500">{s.name || ' '}</div>
        <div className="mt-2 text-xs text-slate-500">Used by {s.used_by} {Number(s.used_by) === 1 ? 'quality' : 'qualities'}{Number(s.active ?? 1) === 1 ? '' : ' · inactive'}</div>
      </div>
      <div className="absolute right-2 top-2 flex gap-1 rounded-lg bg-white/95 p-1 shadow-sm">
        <button type="button" aria-label="Edit shade" onClick={(e) => { e.stopPropagation(); onEdit(); }} className="p-1.5 text-slate-500 hover:text-primary-600"><Edit className="w-4 h-4" /></button>
        <button type="button" aria-label="Delete shade" onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1.5 text-slate-500 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

const EMPTY = { number: '', name: '', hex: '', image_url: '' };

/** Full-screen panel with the colours of one quality (opened from Masters → Qualities). */
export function QualityColoursPanel({ quality, onClose }) {
  const version = useDbVersion();
  const [colours, setColours] = useState(null);
  const [error, setError] = useState('');
  const [lib, setLib] = useState(null); // add-from-library modal: {rows, picked:Set, q}
  const [own, setOwn] = useState(null); // add/edit own colour modal: form values (+ id)
  const [saving, setSaving] = useState(false);
  const [modalErr, setModalErr] = useState('');

  const load = async () => {
    try { setColours(await repo.listQualityColours(quality.id)); } catch (e) { setError(e.message); }
  };
  useEffect(() => { load(); }, [quality.id, version]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && !lib && !own && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose, lib, own]);

  const act = async (fn) => { setError(''); try { await fn(); } catch (e) { setError(e.message); } };

  const openLibrary = () => act(async () => {
    const linked = new Set((colours || []).map((c) => c.shade_id));
    const rows = (await repo.listShades()).filter((s) => !linked.has(s.id) && Number(s.active ?? 1) === 1);
    setModalErr(''); setLib({ rows, picked: new Set(), q: '' });
  });
  const addPicked = async () => {
    setSaving(true); setModalErr('');
    try { await repo.addQualityColours(quality.id, [...lib.picked]); setLib(null); } catch (e) { setModalErr(e.message); } finally { setSaving(false); }
  };
  const saveOwn = async (e) => {
    e.preventDefault(); setSaving(true); setModalErr('');
    try {
      if (own.id) await repo.saveShade(own); else await repo.addOwnColour(quality.id, own);
      setOwn(null);
    } catch (err) { setModalErr(err.message); } finally { setSaving(false); }
  };

  const libShown = useMemo(() => (lib ? lib.rows.filter((s) => `${s.number} ${s.name || ''}`.toLowerCase().includes(lib.q.toLowerCase())) : []), [lib]);

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-slate-50">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
        <div className="min-w-0 mr-auto">
          <h2 className="truncate text-lg font-bold text-forest">Colours of {quality.nick_name}</h2>
          <p className="text-sm text-slate-500">Only these colours can be used in this quality's programs and orders.</p>
        </div>
        <Button variant="outline" onClick={openLibrary}><Library className="w-4 h-4 mr-2" /> Add from library</Button>
        <Button onClick={() => { setModalErr(''); setOwn({ ...EMPTY }); }}><Plus className="w-4 h-4 mr-2" /> Add own colour</Button>
        <Button variant="ghost" onClick={onClose} aria-label="Close"><X className="w-5 h-5 mr-1" /> Close</Button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <Alert className="mb-4">{error}</Alert>
        {!colours ? <div className="py-12 text-center text-slate-500">Loading...</div> : colours.length === 0 ? (
          <Empty icon={Palette} title="No colours yet" description="Add colours from the common library, or upload a colour that belongs to this quality only." />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {colours.map((c) => (
              <div key={c.shade_id} className={`overflow-hidden rounded-xl border bg-white ${c.active ? 'border-slate-200' : 'border-slate-200 opacity-60 grayscale'}`}>
                <div className="relative aspect-[16/9] w-full bg-slate-50">
                  <ShadeSwatch shade={c} size="xl" shape="square" className="!rounded-none !border-0" />
                  {c.private && <span className="absolute left-2 top-2 rounded-full bg-primary-600 px-2 py-0.5 text-[11px] font-semibold text-white">Private</span>}
                </div>
                <div className="space-y-2 p-3">
                  <div>
                    <div className="truncate font-semibold text-slate-900">{c.number}</div>
                    {c.name && <div className="truncate text-xs text-slate-500">{c.name}</div>}
                  </div>
                  <div className="text-xs text-slate-500">{lastUsedText(c)}</div>
                  <div className="flex items-center justify-between gap-2">
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                      <Switch on={c.active} label={`${c.active ? 'Deactivate' : 'Activate'} ${c.number}`} onClick={() => act(() => repo.setQualityColourActive(quality.id, c.shade_id, !c.active))} />
                      {c.active ? 'Active' : 'Inactive'}
                    </label>
                    <div className="flex gap-1">
                      {c.private && <button type="button" aria-label="Edit colour" onClick={() => { setModalErr(''); setOwn({ id: c.shade_id, number: c.number, name: c.name || '', hex: c.hex || '', image_url: c.image_url || '' }); }} className="w-10 h-10 inline-grid place-items-center rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50"><Edit className="w-4 h-4" /></button>}
                      {!c.used && <button type="button" aria-label="Remove colour" title="Never used — can be removed" onClick={() => { if (confirm(`Remove ${c.number} from ${quality.nick_name}?`)) act(() => repo.removeQualityColour(quality.id, c.shade_id)); }} className="w-10 h-10 inline-grid place-items-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-primary-50"><Trash2 className="w-4 h-4" /></button>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal isOpen={!!lib} onClose={() => setLib(null)} title="Add from library" maxWidth="max-w-3xl">
        {lib && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={lib.q} onChange={(e) => setLib({ ...lib, q: e.target.value })} placeholder="Search by shade name…" aria-label="Search library"
                className="h-11 w-full rounded-md border border-slate-300 bg-white pl-10 pr-3 text-base focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            {lib.rows.length === 0 ? <div className="py-8 text-center text-sm text-slate-500">Every library colour is already added.</div> : (
              <div className="grid max-h-[50vh] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3 md:grid-cols-4">
                {libShown.map((s) => {
                  const on = lib.picked.has(s.id);
                  return (
                    <button key={s.id} type="button" aria-pressed={on}
                      onClick={() => { const next = new Set(lib.picked); if (on) next.delete(s.id); else next.add(s.id); setLib({ ...lib, picked: next }); }}
                      className={`flex items-center gap-2 rounded-lg border p-2 text-left ${on ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-100' : 'border-slate-200 hover:bg-slate-50'}`}>
                      <ShadeSwatch shade={s} size="lg" shape="square" />
                      <span className="min-w-0"><span className="block truncate text-sm font-medium text-slate-900">{s.number}</span>{s.name && <span className="block truncate text-xs text-slate-500">{s.name}</span>}</span>
                    </button>
                  );
                })}
                {libShown.length === 0 && <div className="col-span-full py-6 text-center text-sm text-slate-500">No colour matches.</div>}
              </div>
            )}
            <Alert>{modalErr}</Alert>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-slate-500">{lib.picked.size} selected</span>
              <div className="flex gap-3">
                <Button variant="ghost" type="button" onClick={() => setLib(null)}>Cancel</Button>
                <Button type="button" disabled={saving || lib.picked.size === 0} onClick={addPicked}>{saving ? 'Adding…' : `Add ${lib.picked.size || ''} colour${lib.picked.size === 1 ? '' : 's'}`}</Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={!!own} onClose={() => setOwn(null)} title={own?.id ? 'Edit own colour' : `Add own colour for ${quality.nick_name}`} maxWidth="max-w-lg">
        {own && (
          <form onSubmit={saveOwn} className="space-y-4">
            <p className="text-sm text-slate-500">This colour belongs to {quality.nick_name} only. It is not added to the common library.</p>
            <ShadeFields value={own} onChange={setOwn} />
            <Alert>{modalErr}</Alert>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="ghost" type="button" onClick={() => setOwn(null)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

