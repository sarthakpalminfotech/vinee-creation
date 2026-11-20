// Masters → Message templates: the WhatsApp payment-reminder texts. A template is free text with {Field} placeholders;
// the user types the message and taps a field chip to drop e.g. {Customer name} where the cursor is.
import React, { useEffect, useRef, useState } from 'react';
import { Edit, Trash2 } from 'lucide-react';
import { Card, Button, Field, Input, Modal, Alert, useAction } from '../../components/ui';
import WhatsAppIcon from '../../components/WhatsAppIcon';
import { TEMPLATE_FIELDS, token, fillTemplate, sampleTemplateValues } from '../../lib/whatsapp';
import * as repo from '../../db/repo';

const KNOWN = new Set(TEMPLATE_FIELDS.map((f) => f.key.toLowerCase()));

/** Template text with its {Field} placeholders shown as chips (unknown {…} stay plain text). */
export function TemplateText({ body, className = '' }) {
  const parts = String(body || '').split(/(\{\s*[^{}]+?\s*\})/g);
  return (
    <p className={`whitespace-pre-line break-words text-sm text-slate-700 ${className}`}>
      {parts.map((part, i) => {
        const name = part.match(/^\{\s*([^{}]+?)\s*\}$/)?.[1];
        return name && KNOWN.has(name.toLowerCase())
          ? <span key={i} className="mx-px rounded bg-primary-50 px-1 py-px font-semibold text-primary-800">{name}</span>
          : <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </p>
  );
}

/** A template in the masters grid. */
export function TemplateCard({ t, onEdit, onDelete }) {
  return (
    <Card className="p-4 flex flex-col cursor-pointer hover:border-sage" onClick={onEdit}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#25D366]/10 text-[#1DA851]"><WhatsAppIcon className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1 pt-1.5 font-semibold text-slate-900">{t.name}</div>
        <div className="-mr-1 -mt-1 flex shrink-0">
          <button type="button" aria-label="Edit template" onClick={(e) => { e.stopPropagation(); onEdit(); }} className="w-10 h-10 inline-grid place-items-center rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50"><Edit className="w-4 h-4" /></button>
          <button type="button" aria-label="Delete template" onClick={(e) => { e.stopPropagation(); onDelete(); }} className="w-10 h-10 inline-grid place-items-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-primary-50"><Trash2 className="w-4 h-4" /></button>
        </div>
      </div>
      <TemplateText body={t.body} className="mt-3 line-clamp-5" />
    </Card>
  );
}

/** Add / edit a template: name, message with insert-a-field chips, and a live preview with sample values. */
export function TemplateFormModal({ open, item, onClose, onSaved }) {
  const [f, setF] = useState({ name: '', body: '' });
  const { busy, error, setError, run } = useAction();
  const area = useRef(null);
  useEffect(() => {
    if (open) { setF({ id: item?.id, name: item?.name || '', body: item?.body || '' }); setError(''); }
  }, [open, item]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Put {Field} where the cursor is (or replace the selection) and keep typing after it. */
  const insert = (key) => {
    const el = area.current;
    const t = token(key);
    const start = el ? el.selectionStart : f.body.length;
    const end = el ? el.selectionEnd : f.body.length;
    const body = f.body.slice(0, start) + t + f.body.slice(end);
    setF((p) => ({ ...p, body }));
    requestAnimationFrame(() => { if (el) { el.focus(); el.setSelectionRange(start + t.length, start + t.length); } });
  };

  const save = (e) => {
    e.preventDefault();
    run(async () => {
      if (!f.name.trim()) throw new Error('Give the template a name');
      if (!f.body.trim()) throw new Error('Type the message');
      await repo.saveMaster('message_templates', f);
      onSaved?.(); onClose();
    });
  };

  return (
    <Modal isOpen={open} onClose={onClose} title={item?.id ? 'Edit message template' : 'Add message template'} maxWidth="max-w-4xl">
      <form onSubmit={save} className="space-y-5">
        <Field label="Template name *"><Input required autoFocus={!item?.id} placeholder="e.g. Polite reminder" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-2">
            <label htmlFor="tpl-body" className="text-[13px] font-semibold text-slate-700">Message *</label>
            <textarea id="tpl-body" ref={area} rows={9} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })}
              placeholder={'Dear {Customer name},\nPayment of {Amount due} is pending on order {Order no}.'}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base leading-relaxed text-slate-900 focus:border-primary-600 focus:outline-none focus:ring-[3px] focus:ring-primary-600/20" />
            <div>
              <div className="mb-2 text-xs font-bold text-slate-500">Tap a field to put it where the cursor is</div>
              <div className="flex flex-wrap gap-2">
                {TEMPLATE_FIELDS.map((fd) => (
                  <button key={fd.key} type="button" title={fd.hint} onClick={() => insert(fd.key)}
                    className="h-9 rounded-full border border-primary-200 bg-primary-50 px-3 text-[13px] font-semibold text-primary-800 hover:bg-primary-100 active:scale-[0.97]">
                    + {fd.key}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="min-w-0">
            <div className="mb-2 text-[13px] font-semibold text-slate-700">Preview <span className="font-normal text-slate-500">(sample values)</span></div>
            <div className="rounded-xl bg-[#EFEAE2] p-4">
              <div className="ml-auto max-w-[95%] rounded-lg rounded-tr-none bg-[#D9FDD3] px-3 py-2 text-[15px] leading-relaxed text-slate-900 shadow-sm whitespace-pre-line break-words">
                {f.body.trim() ? fillTemplate(f.body, sampleTemplateValues()) : <span className="text-slate-500">Your message appears here.</span>}
              </div>
            </div>
          </div>
        </div>
        <Alert>{error}</Alert>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save template'}</Button>
        </div>
      </form>
    </Modal>
  );
}
