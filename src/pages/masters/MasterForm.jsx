import React, { useEffect, useState } from 'react';
import { Button, Input, Modal, Field, Alert } from '../../components/ui';
import * as repo from '../../db/repo';
import { ShadeFields } from './Colours';

/** What each master is called on screen (weaver_groups = firms, weavers = the associated parties under a firm). */
export const MASTER_LABELS = {
  weaver_groups: 'firm', weavers: 'associated party', mills: 'mill', customers: 'customer', job_workers: 'job worker', qualities: 'quality', branches: 'branch',
  shades: 'shade',
};

/** A library shade as the edit form expects it. */
export const shadeForEdit = (s) => ({ ...s, hex: s.hex || '', image_url: s.image_url || '', name: s.name || '' });

/** Amber inline hint (never blocks saving): a filled GST number that does not look like 15 valid characters. */
export function GstinHint({ value }) {
  if (repo.gstinLooksValid(value)) return null;
  return <span className="text-xs text-amber-600">This doesn't look like a valid 15-character GST number</span>;
}

/** Optional GST number field, the same for every party type. */
export function GstField({ value, onChange }) {
  return (
    <Field label="GST number (optional)">
      <Input placeholder="e.g. 24AAACG1234F1Z5" maxLength={20} className="uppercase" value={value || ''} onChange={e => onChange(e.target.value.toUpperCase())} />
      <GstinHint value={value} />
    </Field>
  );
}

/**
 * Add / edit modal for any master. `type` is the table; `item` the row being edited (null = add); `extra` pre-fills a new row (e.g. {group_id}).
 * onSaved(id) runs after a successful save.
 */
export function MasterFormModal({ type, item = null, extra = {}, onClose, onSaved }) {
  const [formData, setFormData] = useState({});
  const [errorMsg, setErrorMsg] = useState(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!type) return;
    setFormData(item ? { ...item } : { ...extra });
    setErrorMsg(null);
  }, [type, item]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k, v) => setFormData(p => ({ ...p, [k]: v }));

  const save = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      let id;
      if (type === 'shades') {
        id = await repo.saveShade(formData);
        const nowActive = !(formData.active === false || formData.active === 0);
        if (item && (Number(item.active ?? 1) === 1) !== nowActive) await repo.setShadeActive(id, nowActive);
      } else {
        id = await repo.saveMaster(type, formData);
      }
      onSaved?.(id);
      onClose();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSaving(false);
    }
  };

  const footer = (
    <>
      <Alert>{errorMsg}</Alert>
      <div className="pt-4 flex justify-end gap-3">
        <Button variant="ghost" type="button" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
      </div>
    </>
  );

  const body = () => {
    if (['mills', 'customers', 'weaver_groups'].includes(type)) {
      return (
        <>
          <Field label={type === 'weaver_groups' ? 'Firm name' : 'Name'}><Input required placeholder="e.g. Ganesh" value={formData.name || ''} onChange={e => set('name', e.target.value)} /></Field>
          <Field label="Contact Person"><Input placeholder="e.g. Ramesh Bhai" value={formData.contact || ''} onChange={e => set('contact', e.target.value)} /></Field>
          <Field label="Phone"><Input placeholder="e.g. 98250 12345" value={formData.phone || ''} onChange={e => set('phone', e.target.value)} /></Field>
          <Field label="City"><Input placeholder="e.g. Surat" value={formData.city || ''} onChange={e => set('city', e.target.value)} /></Field>
          <GstField value={formData.gstin} onChange={v => set('gstin', v)} />
        </>
      );
    }
    if (type === 'job_workers') {
      return (
        <>
          <Field label="Name"><Input required placeholder="e.g. Shree Embroidery" value={formData.name || ''} onChange={e => set('name', e.target.value)} /></Field>
          <Field label="Phone"><Input placeholder="e.g. 98250 12345" value={formData.phone || ''} onChange={e => set('phone', e.target.value)} /></Field>
          <Field label="City"><Input placeholder="e.g. Surat" value={formData.city || ''} onChange={e => set('city', e.target.value)} /></Field>
          <GstField value={formData.gstin} onChange={v => set('gstin', v)} />
          <Field label="Notes"><Input placeholder="e.g. Does hand embroidery only" value={formData.notes || ''} onChange={e => set('notes', e.target.value)} /></Field>
        </>
      );
    }
    if (type === 'weavers') {
      return (
        <>
          <Field label="Associated party name"><Input required placeholder="e.g. Ganesh Fabrics" value={formData.name || ''} onChange={e => set('name', e.target.value)} /></Field>
          <GstField value={formData.gstin} onChange={v => set('gstin', v)} />
          <Field label="Phone"><Input placeholder="e.g. 98250 11223" value={formData.phone || ''} onChange={e => set('phone', e.target.value)} /></Field>
        </>
      );
    }
    if (type === 'qualities') {
      return (
        <>
          <Field label="Original name (used with weavers)"><Input required placeholder="e.g. 100% Polyester Crape" value={formData.original_name || ''} onChange={e => set('original_name', e.target.value)} /></Field>
          <Field label="Nickname (used with mills and customers)"><Input required placeholder="e.g. Gold Lava" value={formData.nick_name || ''} onChange={e => set('nick_name', e.target.value)} /></Field>
          <Field label="Default Taka Length (m)"><Input type="number" placeholder="e.g. 100" required value={formData.taka_length || ''} onChange={e => set('taka_length', e.target.value)} /></Field>
          <Field label="Notes"><Input placeholder="e.g. Shrinks 5% after dyeing" value={formData.notes || ''} onChange={e => set('notes', e.target.value)} /></Field>
        </>
      );
    }
    if (type === 'branches') {
      return (
        <>
          <Field label="Branch name"><Input required placeholder="e.g. Surat Godown" value={formData.name || ''} onChange={e => set('name', e.target.value)} /></Field>
          <Field label="City"><Input placeholder="e.g. Surat" value={formData.city || ''} onChange={e => set('city', e.target.value)} /></Field>
          <Field label="Address"><Input placeholder="e.g. Shop 6065, Textile Market" value={formData.address || ''} onChange={e => set('address', e.target.value)} /></Field>
          <Field label="Phone"><Input placeholder="e.g. 98250 12345" value={formData.phone || ''} onChange={e => set('phone', e.target.value)} /></Field>
        </>
      );
    }
    if (type === 'shades') {
      return (
        <>
          <ShadeFields value={formData} onChange={setFormData} />
          {item && (
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={formData.active !== 0 && formData.active !== false} onChange={e => set('active', e.target.checked)} /> Active in the library
            </label>
          )}
        </>
      );
    }
    return null;
  };

  return (
    <Modal
      isOpen={!!type}
      onClose={onClose}
      title={type ? `${item ? 'Edit' : 'Add'} ${MASTER_LABELS[type] || type}` : ''}
      maxWidth={type === 'shades' ? 'max-w-lg' : 'max-w-md'}
    >
      <form onSubmit={save} className="space-y-4">
        {body()}
        {footer}
      </form>
    </Modal>
  );
}
