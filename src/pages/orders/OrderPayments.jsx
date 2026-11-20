import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as Popover from '@radix-ui/react-popover';
import { Card, Button, Input, Field, Modal, Alert, Table, Th, Td } from '../../components/ui';
import { DetailList, Chip } from '../../components/kit';
import WhatsAppIcon from '../../components/WhatsAppIcon';
import { fmtDate, fmtM, fmtMoney } from '../../lib/format';
import { fillTemplate, orderTemplateValues, waLink, waPhone } from '../../lib/whatsapp';
import { IndianRupee, Trash2, BellRing, Settings2, ChevronRight } from 'lucide-react';
import * as repo from '../../db/repo';

const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

/** "Payment due" chip for list rows (nothing when no reminder is showing). */
export function PaymentBadge({ payment, className = '' }) {
  if (!payment?.due) return null;
  return <Chip tone="red" className={className}><BellRing className="h-3 w-3" /> Payment due{payment.overdue_days > 0 ? ` · ${plural(payment.overdue_days, 'day')} late` : ''}</Chip>;
}

/** One line about the reminder of an order. */
export function reminderText(p) {
  if (!(p.dispatched_m > 0)) return 'Starts when the first meters are dispatched.';
  if (p.outstanding != null && p.outstanding <= 0.005) return 'Nothing to collect right now.';
  if (!p.due_on) return '—';
  if (p.due) return `Due since ${fmtDate(p.due_on)}${p.overdue_days ? ` (${plural(p.overdue_days, 'day')} late)` : ''} — counted from ${fmtDate(p.since)}.`;
  return `Reminder on ${fmtDate(p.due_on)} (in ${plural(p.days_left, 'day')}) — counted from ${fmtDate(p.since)}.`;
}

/** Payment section of the order details screen: expected / billable / received / outstanding, the reminder and the payment log. */
export function OrderPaymentsCard({ order, onChanged }) {
  const p = order.payment;
  const [logOpen, setLogOpen] = useState(false);
  const [daysOpen, setDaysOpen] = useState(false);
  const [waTemplate, setWaTemplate] = useState(null); // template picked from the WhatsApp dropdown
  const [error, setError] = useState('');

  const remove = async (id) => {
    if (!confirm('Delete this payment entry?')) return;
    try { setError(''); await repo.removeOrderPayment(id); onChanged?.(); } catch (e) { setError(e.message); }
  };

  return (
    <Card>
      <div className="p-5 border-b border-slate-100 flex flex-wrap gap-3 justify-between items-center bg-slate-50/50">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-forest">Payment</h3>
          <PaymentBadge payment={p} />
        </div>
        <div className="flex flex-wrap gap-2">
          <WhatsAppReminderButton onPick={setWaTemplate} />
          <Button size="sm" variant="outline" onClick={() => setDaysOpen(true)}><BellRing className="w-3.5 h-3.5 mr-1.5" /> Reminder: {plural(p.days, 'day')}</Button>
          <Button size="sm" onClick={() => setLogOpen(true)}><IndianRupee className="w-3.5 h-3.5 mr-1.5" /> Log payment</Button>
        </div>
      </div>
      <div className="p-5 space-y-4">
        {p.rate == null && <Alert tone="info">No rate is set on this order, so amounts cannot be worked out. Edit the order and enter the rate per meter.</Alert>}
        <DetailList items={[
          { label: 'Rate', value: p.rate != null ? `${fmtMoney(p.rate)} / m` : null },
          { label: p.estimated ? 'Total expected (approx.)' : 'Total expected', value: p.expected_amount != null ? fmtMoney(p.expected_amount) : null },
          { label: 'Expected meters', value: `${fmtM(p.expected_m)} m${p.estimated ? ' (takas × taka length)' : ''}` },
          { label: 'Dispatched meters', value: `${fmtM(p.dispatched_m)} m` },
          { label: 'Billable (dispatched)', value: p.dispatched_amount != null ? fmtMoney(p.dispatched_amount) : null },
          { label: 'Received', value: fmtMoney(p.paid) },
          { label: 'Current payment due', value: p.outstanding != null ? <span className={p.outstanding > 0.005 ? 'text-red-600' : 'text-emerald-700'}>{fmtMoney(Math.max(0, p.outstanding))}</span> : null },
          { label: 'Advance received', value: p.outstanding != null && p.outstanding < -0.005 ? fmtMoney(-p.outstanding) : null },
          { label: 'Still to receive on the order', value: p.balance != null && p.balance > 0.005 ? fmtMoney(p.balance) : null },
          { label: `Reminder (${p.own_days ? 'this order' : 'default'})`, value: reminderText(p), wide: true },
        ]} />
        <Alert>{error}</Alert>
        {order.payments.length > 0 && (
          <Table className="whitespace-normal">
            <thead><tr><Th>Date</Th><Th className="text-right">Amount</Th><Th>Mode / ref</Th><Th>Notes</Th><Th className="w-12"></Th></tr></thead>
            <tbody>
              {order.payments.map((x) => (
                <tr key={x.id}>
                  <Td className="whitespace-nowrap">{fmtDate(x.date)}</Td>
                  <Td className="text-right font-semibold tabular-nums">{fmtMoney(x.amount)}</Td>
                  <Td>{[x.mode, x.ref_no].filter(Boolean).join(' · ') || '-'}</Td>
                  <Td>{x.notes || '-'}</Td>
                  <Td className="text-right"><button aria-label="Delete payment" onClick={() => remove(x.id)} className="w-10 h-10 inline-grid place-items-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-primary-50"><Trash2 className="w-4 h-4" /></button></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>
      <LogPaymentModal open={logOpen} order={order} onClose={() => setLogOpen(false)} onSaved={onChanged} />
      <ReminderDaysModal open={daysOpen} order={order} onClose={() => setDaysOpen(false)} onSaved={onChanged} />
      <WhatsAppSendModal template={waTemplate} order={order} onClose={() => setWaTemplate(null)} />
    </Card>
  );
}

/** WhatsApp icon on the payment section (always shown): opens a dropdown of the message templates. */
function WhatsAppReminderButton({ onPick }) {
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!open) return;
    setError('');
    repo.listMessageTemplates().then(setTemplates).catch((e) => setError(e.message));
  }, [open]);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button type="button" aria-label="Send payment reminder on WhatsApp" title="Send payment reminder on WhatsApp"
          className={`h-10 w-10 grid place-items-center rounded-lg border bg-white text-[#1DA851] hover:bg-[#25D366]/10 hover:border-[#25D366]/60 ${open ? 'border-[#25D366] ring-[3px] ring-[#25D366]/20' : 'border-slate-300'}`}>
          <WhatsAppIcon className="h-[22px] w-[22px]" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={6} collisionPadding={12}
          className="z-[150] w-[320px] max-w-[calc(100vw-24px)] rounded-xl border border-slate-200 bg-white shadow-pop outline-none animate-in fade-in-0 zoom-in-[0.98]">
          <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
            <WhatsAppIcon className="h-4 w-4 text-[#1DA851]" />
            <span className="text-sm font-bold text-forest">Payment reminder — choose a message</span>
          </div>
          <div className="max-h-[320px] overflow-y-auto thin-scroll p-1.5">
            {error && <div className="p-2"><Alert>{error}</Alert></div>}
            {!templates && !error && <div className="px-3 py-4 text-sm text-slate-500">Loading…</div>}
            {templates?.length === 0 && <div className="px-3 py-4 text-sm text-slate-600">No message templates yet. Add one in Masters → Message templates.</div>}
            {templates?.map((t) => (
              <button key={t.id} type="button" onClick={() => { setOpen(false); onPick(t); }}
                className="flex min-h-[52px] w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-primary-50">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold text-slate-900">{t.name}</span>
                  <span className="block truncate text-xs text-slate-500">{t.body.replace(/\s+/g, ' ')}</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
              </button>
            ))}
          </div>
          <Link to="/masters/templates" className="flex h-11 items-center gap-2 border-t border-slate-200 px-4 text-sm font-semibold text-primary-700 hover:bg-primary-50 rounded-b-xl">
            <Settings2 className="h-4 w-4" /> Manage templates
          </Link>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** The filled-in message and the customer's number, both editable, then "Open WhatsApp" (wa.me) with the text typed in. */
function WhatsAppSendModal({ template, order, onClose }) {
  const [phone, setPhone] = useState('');
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    if (!template) return;
    setPhone(order.customer_phone || '');
    setText(fillTemplate(template.body, orderTemplateValues(order, repo.today())));
    setError('');
  }, [template]); // eslint-disable-line react-hooks/exhaustive-deps
  const send = (e) => {
    e.preventDefault();
    if (phone.trim() && !waPhone(phone)) { setError('This does not look like a phone number. Use a 10-digit mobile number, or include the country code.'); return; }
    if (!text.trim()) { setError('The message is empty.'); return; }
    window.open(waLink(phone, text), '_blank', 'noopener');
    onClose();
  };
  return (
    <Modal isOpen={!!template} onClose={onClose} title={`WhatsApp reminder · ${order.order_no}`} maxWidth="max-w-xl">
      <form onSubmit={send} className="space-y-4">
        <div className="text-sm text-slate-600">To <strong className="text-slate-900">{order.customer_name}</strong> · payment due <strong className={order.payment.outstanding > 0.005 ? 'text-red-700' : 'text-slate-900'}>{order.payment.outstanding != null ? fmtMoney(Math.max(0, order.payment.outstanding)) : '—'}</strong> · template “{template?.name}”</div>
        <Field label="WhatsApp number">
          <Input type="tel" inputMode="tel" placeholder="e.g. 98250 11223" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        {!order.customer_phone && <p className="-mt-2 text-xs text-slate-500">This customer has no phone number in Masters. Type one, or leave it empty and pick the contact in WhatsApp.</p>}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="wa-text" className="text-[13px] font-semibold text-slate-700">Message (you can change it before sending)</label>
          <textarea id="wa-text" rows={8} value={text} onChange={(e) => setText(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-[#F4FBF1] px-3 py-2.5 text-base leading-relaxed text-slate-900 focus:border-primary-600 focus:outline-none focus:ring-[3px] focus:ring-primary-600/20" />
        </div>
        <Alert>{error}</Alert>
        <div className="flex justify-end gap-3 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="bg-[#1DA851] hover:bg-[#178E44] active:bg-[#137A3A]"><WhatsAppIcon className="mr-2 h-5 w-5" /> Open WhatsApp</Button>
        </div>
      </form>
    </Modal>
  );
}

function LogPaymentModal({ open, order, onClose, onSaved }) {
  const [f, setF] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      const due = order.payment.outstanding;
      setF({ date: repo.today(), amount: due != null && due > 0 ? String(due) : '', mode: '', ref_no: '', notes: '' });
      setError('');
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const save = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try { await repo.addOrderPayment(order.id, f); onClose(); onSaved?.(); } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return (
    <Modal isOpen={open} onClose={onClose} title={`Log payment · ${order.order_no}`}>
      <form onSubmit={save} className="space-y-4">
        {order.payment.outstanding != null && <div className="text-sm text-slate-600">Current payment due: <strong className="text-slate-900">{fmtMoney(Math.max(0, order.payment.outstanding))}</strong>. A part payment is fine — the reminder restarts from its date.</div>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Date *"><Input type="date" required value={f.date || ''} onChange={(e) => set('date', e.target.value)} /></Field>
          <Field label="Amount (₹) *"><Input type="number" min="0" step="0.01" required autoFocus value={f.amount || ''} onChange={(e) => set('amount', e.target.value)} /></Field>
          <Field label="Mode (optional)"><Input placeholder="e.g. NEFT, cheque, cash" value={f.mode || ''} onChange={(e) => set('mode', e.target.value)} /></Field>
          <Field label="Reference (optional)"><Input placeholder="e.g. UTR / cheque no." value={f.ref_no || ''} onChange={(e) => set('ref_no', e.target.value)} /></Field>
        </div>
        <Field label="Notes (optional)"><Input value={f.notes || ''} onChange={(e) => set('notes', e.target.value)} /></Field>
        <Alert>{error}</Alert>
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save payment'}</Button>
        </div>
      </form>
    </Modal>
  );
}

function ReminderDaysModal({ open, order, onClose, onSaved }) {
  const [days, setDays] = useState('');
  const [def, setDef] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!open) return;
    setDays(order.payment.own_days ? String(order.payment.days) : ''); setError('');
    repo.getPaymentDays().then(setDef).catch(() => {});
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = async (value) => {
    try { setError(''); await repo.setOrderPaymentDays(order.id, value); onClose(); onSaved?.(); } catch (e) { setError(e.message); }
  };
  return (
    <Modal isOpen={open} onClose={onClose} title="Payment reminder for this order">
      <form onSubmit={(e) => { e.preventDefault(); save(days); }} className="space-y-4">
        <p className="text-sm text-slate-600">Show “Payment due” when no payment was logged for this many days (counted from the first dispatch, or from the last payment). Leave empty to use the default{def ? ` (${plural(def, 'day')})` : ''} from Settings.</p>
        <Field label="Days"><Input type="number" min="1" step="1" placeholder={def ? `Default: ${def}` : ''} value={days} onChange={(e) => setDays(e.target.value)} /></Field>
        <div className="flex flex-wrap gap-2">
          {[30, 45, 60, 90, 120].map((n) => <Button key={n} type="button" size="sm" variant={String(n) === days ? 'primary' : 'outline'} onClick={() => setDays(String(n))}>{n} days</Button>)}
        </div>
        <Alert>{error}</Alert>
        <div className="flex justify-end gap-3 pt-2">
          {order.payment.own_days && <Button type="button" variant="ghost" onClick={() => save(null)}>Use default</Button>}
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit">Save</Button>
        </div>
      </form>
    </Modal>
  );
}
