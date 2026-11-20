// Pure helpers of the mill challan part cards (kept out of the component file so fast refresh keeps working).
import { subSuffix } from '../../db/repo'

let seq = 0
export const newPart = () => ({ key: `p${++seq}`, receipt: null, takas: [], sel: [], editing: true })

export const partTotals = (p) => {
  const set = new Set(p.sel)
  const chosen = p.takas.filter((t) => set.has(t.id))
  return { takas: chosen.length, meters: Math.round(chosen.reduce((s, t) => s + Number(t.grey_meter), 0) * 100) / 100 }
}
/** Sub-challan number of each part: the letter after the existing subs; a weaver challan that already has a sub extends it. */
export function partLabels(parts, mainNo, existing = []) {
  let next = existing.length
  return parts.map((p) => {
    const ex = p.receipt && existing.find((e) => Number(e.receipt_id) === Number(p.receipt.id))
    if (ex) return ex.dispatch_no
    return `${mainNo}${subSuffix(next++)}`
  })
}
