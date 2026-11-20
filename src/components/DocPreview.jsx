import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer, Share2, X } from 'lucide-react';
import { Button } from './ui';
import logo from '../assets/logo.png';

const PORTRAIT_W = 794, LANDSCAPE_W = 1123; // A4 at 96dpi

/**
 * Renders the sheet to a multi-page A4 PDF blob (libraries are loaded on demand).
 * A document that marks its pages with data-pdf-page gets exactly one PDF page per marked element, so a table row is never cut
 * across two pages (a page taller than A4 is scaled down to fit). Without markers the sheet is sliced into A4-high strips.
 */
async function sheetToPdf(el, landscape) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
  const opts = {
    scale: 2, backgroundColor: '#ffffff', useCORS: true,
    onclone: (doc) => { doc.querySelectorAll('[data-doc-scale]').forEach((n) => { n.style.transform = 'none'; n.style.height = 'auto'; }); },
  };
  const pdf = new jsPDF(landscape ? 'l' : 'p', 'mm', 'a4');
  const pw = landscape ? 297 : 210, ph = landscape ? 210 : 297;
  const pages = [...el.querySelectorAll('[data-pdf-page]')];
  if (pages.length) {
    const M = 10; // mm margin
    for (const [i, node] of pages.entries()) {
      const canvas = await html2canvas(node, opts);
      let w = pw - 2 * M, h = (canvas.height * w) / canvas.width;
      if (h > ph - 2 * M) { h = ph - 2 * M; w = (canvas.width * h) / canvas.height; }
      if (i) pdf.addPage();
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', M + (pw - 2 * M - w) / 2, M, w, h);
    }
    return pdf.output('blob');
  }
  const canvas = await html2canvas(el, opts);
  const imgH = (canvas.height * pw) / canvas.width;
  const img = canvas.toDataURL('image/jpeg', 0.92);
  for (let y = 0, page = 0; y < imgH - 0.5; y += ph, page++) {
    if (page) pdf.addPage();
    pdf.addImage(img, 'JPEG', 0, -y, pw, imgH);
  }
  return pdf.output('blob');
}

/**
 * Full-screen document preview with Share / Print / Close.
 * `tabs` = [{key,label}] optional switcher; children receive nothing — pass the active document as children.
 */
export default function DocPreview({ title, filename, tabs, tab, onTab, onClose, landscape = false, children }) {
  const SHEET_W = landscape ? LANDSCAPE_W : PORTRAIT_W;
  const sheetRef = useRef(null);
  const wrapRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [sheetH, setSheetH] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const fit = () => setScale(Math.min(1, (window.innerWidth - 24) / SHEET_W));
    fit();
    window.addEventListener('resize', fit);
    const esc = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => { window.removeEventListener('resize', fit); window.removeEventListener('keydown', esc); };
  }, [onClose, SHEET_W]);

  useLayoutEffect(() => {
    if (!sheetRef.current) return;
    const ro = new ResizeObserver(() => setSheetH(sheetRef.current.offsetHeight));
    ro.observe(sheetRef.current);
    return () => ro.disconnect();
  }, [tab]);

  const share = async () => {
    setBusy(true); setMsg('');
    try {
      const blob = await sheetToPdf(sheetRef.current, landscape);
      const file = new File([blob], `${filename}.pdf`, { type: 'application/pdf' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = file.name; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
        setMsg('Sharing is not available on this device — the PDF was downloaded instead.');
      }
    } catch (e) {
      if (e?.name !== 'AbortError') setMsg(`Could not share: ${e.message}`);
    } finally { setBusy(false); }
  };

  return createPortal(
    <div className="doc-preview fixed inset-0 z-[60] flex flex-col bg-slate-200">
      <style media="print">{`@page { size: A4 ${landscape ? 'landscape' : 'portrait'}; margin: 12mm; }`}</style>
      <div className="doc-toolbar flex flex-wrap items-center gap-2 px-3 py-2 bg-white border-b border-slate-200 shadow-sm">
        <div className="font-semibold text-slate-900 mr-auto truncate">{title}</div>
        {tabs && (
          <div className="flex rounded-md border border-slate-300 overflow-hidden text-sm">
            {tabs.map((t) => (
              <button key={t.key} onClick={() => onTab(t.key)} className={`px-3 h-10 ${tab === t.key ? 'bg-primary-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}>{t.label}</button>
            ))}
          </div>
        )}
        <Button variant="outline" onClick={() => window.print()}><Printer className="w-4 h-4 mr-2" /> Print</Button>
        <Button onClick={share} disabled={busy}><Share2 className="w-4 h-4 mr-2" /> {busy ? 'Preparing…' : 'Share'}</Button>
        <Button variant="ghost" onClick={onClose} aria-label="Close"><X className="w-5 h-5 mr-1" /> Close</Button>
      </div>
      {msg && <div className="doc-toolbar px-4 py-2 text-sm bg-amber-50 text-amber-800 border-b border-amber-200">{msg}</div>}
      <div ref={wrapRef} className="doc-scroll flex-1 overflow-auto p-3">
        <div className="mx-auto" style={{ width: SHEET_W * scale, height: sheetH * scale }}>
          <div data-doc-scale style={{ width: SHEET_W, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
            <div ref={sheetRef} className="doc-sheet bg-white shadow-lg text-slate-900" style={{ width: SHEET_W, minHeight: landscape ? 794 : 1123, padding: 40 }}>
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Shared letterhead block for every document. */
export function DocHeader({ heading, left, right }) {
  return (
    <div className="text-center mb-6 border-b-2 border-slate-900 pb-4">
      <img src={logo} alt="" className="mx-auto mb-2 h-16 w-16 rounded-full" />
      <h1 className="text-3xl font-bold uppercase tracking-widest">Vinee Creation</h1>
      <h2 className="text-xl font-medium mt-2">{heading}</h2>
      <div className="flex justify-between items-end mt-6 text-left">
        <div>{left}</div>
        <div className="text-right">{right}</div>
      </div>
    </div>
  );
}
