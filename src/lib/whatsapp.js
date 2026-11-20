// WhatsApp payment reminders. A message template (Masters → Message templates) is plain text with {Field} placeholders,
// e.g. "Dear {Customer name}, {Amount due} is pending on order {Order no}." Filling it with an order gives the message
// that opens in WhatsApp (wa.me link) ready to send.
import { fmtDate, fmtMoney } from './format'

/** The placeholders a template can use, in the order the editor offers them. `sample` is shown in the preview. */
export const TEMPLATE_FIELDS = [
  { key: 'Customer name', hint: 'Customer as in the masters', sample: 'Radhe Sarees' },
  { key: 'Contact person', hint: 'Contact person of the customer (else the customer name)', sample: 'Rameshbhai' },
  { key: 'Order no', hint: 'e.g. SO-0007', sample: 'SO-0007' },
  { key: 'Order date', hint: 'Date of the order', sample: '29 Oct 2026' },
  { key: 'Quality', hint: 'Quality nickname of the order', sample: 'Gold Lava' },
  { key: 'Amount due', hint: 'Current payment due (billed − received)', sample: '₹33,096.15' },
  { key: 'Billed amount', hint: 'Dispatched meters × rate', sample: '₹38,096.15' },
  { key: 'Received', hint: 'Payments logged so far', sample: '₹5,000' },
  { key: 'Due date', hint: 'Date the payment falls due (the reminder date of the order)', sample: '29 Dec 2026' },
  { key: 'Days late', hint: 'Days past the reminder date', sample: '12' },
  { key: 'Today', hint: "Today's date", sample: '30 Oct 2026' },
]

/** How a field is written inside a template. */
export const token = (key) => `{${key}}`

/** Placeholder values for one order (as returned by repo.getOrder, with its .payment). */
export function orderTemplateValues(order, today = new Date().toISOString().slice(0, 10)) {
  const p = order.payment || {}
  return {
    'Customer name': order.customer_name || '',
    'Contact person': order.customer_contact || order.customer_name || '',
    'Order no': order.order_no || '',
    'Order date': order.date ? fmtDate(order.date) : '',
    'Quality': order.nick_name || '',
    'Amount due': p.outstanding != null ? fmtMoney(Math.max(0, p.outstanding)) : '',
    'Billed amount': p.dispatched_amount != null ? fmtMoney(p.dispatched_amount) : '',
    'Received': fmtMoney(p.paid ?? order.paid ?? 0),
    'Due date': p.due_on ? fmtDate(p.due_on) : '',
    'Days late': String(p.overdue_days ?? 0),
    'Today': fmtDate(today),
  }
}

/** The sample values, for the template editor's preview. */
export const sampleTemplateValues = () => Object.fromEntries(TEMPLATE_FIELDS.map((f) => [f.key, f.sample]))

/** Replace every {Field} (any letter case, spaces around the name allowed) by its value; unknown {…} stay as typed. */
export function fillTemplate(body, values) {
  const byLower = new Map(Object.entries(values).map(([k, v]) => [k.toLowerCase(), v]))
  return String(body ?? '').replace(/\{\s*([^{}]+?)\s*\}/g, (m, name) => {
    const v = byLower.get(name.toLowerCase())
    return v === undefined ? m : String(v)
  })
}

/**
 * Phone number in the form wa.me wants: digits only, with the country code. A plain 10-digit Indian mobile
 * (optionally with a leading 0) gets 91 in front. Returns '' when there is no usable number.
 */
export function waPhone(raw) {
  let d = String(raw ?? '').replace(/\D/g, '')
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1)
  if (d.length === 10) d = `91${d}`
  return d.length >= 10 && d.length <= 15 ? d : ''
}

/** Link that opens WhatsApp (app on a tablet / phone, WhatsApp Web on a computer) with the message typed in. Without a number WhatsApp asks whom to send it to. */
export const waLink = (phone, text) => `https://wa.me/${waPhone(phone)}?text=${encodeURIComponent(text)}`
