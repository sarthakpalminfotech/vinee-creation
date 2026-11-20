import React, { useRef, useState } from 'react';
import { Camera, Upload, X } from 'lucide-react';
import { uploadImage } from '../lib/cloudinary';
import { Button } from './ui';

/**
 * Photo field: take a picture with the camera or attach a file. The image goes through uploadImage()
 * (Cloudinary when configured, else a compressed data URL). `value` is the stored URL; `onChange(url|'')`.
 */
export default function ImagePicker({ value, onChange, label = 'Image', previewClass = 'h-28 w-28' }) {
  const camRef = useRef(null);
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true); setError('');
    try { onChange(await uploadImage(file)); } catch (err) { setError(err?.message || 'Image upload failed'); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-2">
      {label && <div className="text-sm font-medium text-slate-700">{label}</div>}
      <div className="flex flex-wrap items-center gap-3">
        {value && (
          <div className={`relative ${previewClass} shrink-0`}>
            <img src={value} alt="" crossOrigin="anonymous" className="h-full w-full rounded-lg border border-slate-200 object-cover" />
            <button type="button" onClick={() => onChange('')} aria-label="Remove image"
              className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-white border border-slate-300 text-slate-600 shadow hover:text-red-600"><X className="h-3.5 w-3.5" /></button>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={busy} onClick={() => camRef.current?.click()}><Camera className="w-4 h-4 mr-2" /> Camera</Button>
          <Button type="button" variant="outline" disabled={busy} onClick={() => fileRef.current?.click()}><Upload className="w-4 h-4 mr-2" /> Upload</Button>
        </div>
        {busy && <span className="text-sm text-slate-500">Uploading…</span>}
      </div>
      <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={pick} />
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pick} />
      {error && <div className="text-sm text-red-600">{error}</div>}
    </div>
  );
}
