import React, { useEffect, useRef, useState } from 'react';
import { Mic, Square, RotateCcw, Paperclip, X } from 'lucide-react';
import { Button } from './ui';

const fmtClock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/**
 * Voice note field: Record / Stop (max `maxSeconds`, then it stops by itself), play back, re-record — or attach an audio file.
 * `blob` is the current recording (Blob/File or null); `onChange(blob|null)`. Nothing is uploaded here.
 */
export default function VoiceRecorder({ blob, onChange, maxSeconds = 120 }) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState('');
  const [url, setUrl] = useState('');
  const recRef = useRef(null);
  const timerRef = useRef(null);
  const fileRef = useRef(null);
  const canRecord = typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof window.MediaRecorder !== 'undefined';

  useEffect(() => {
    if (!blob) { setUrl(''); return undefined; }
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  useEffect(() => () => { clearInterval(timerRef.current); try { recRef.current?.stream?.getTracks().forEach((t) => t.stop()); } catch { /* already stopped */ } }, []);

  const stop = () => {
    clearInterval(timerRef.current);
    const rec = recRef.current;
    if (rec && rec.state !== 'inactive') rec.stop();
  };
  const start = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks = [];
      rec.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data); };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        if (chunks.length) onChange(new Blob(chunks, { type: rec.mimeType || 'audio/webm' }));
      };
      recRef.current = rec;
      onChange(null);
      rec.start();
      setRecording(true); setSeconds(0);
      let n = 0;
      timerRef.current = setInterval(() => { n += 1; setSeconds(n); if (n >= maxSeconds) stop(); }, 1000);
    } catch (e) {
      setError(e?.name === 'NotAllowedError' ? 'Microphone access was blocked — allow it in the browser, or attach an audio file instead.' : 'Could not start recording — attach an audio file instead.');
    }
  };
  const attach = (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setError('');
    onChange(f);
  };

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-slate-700">Voice note <span className="font-normal text-slate-400">(optional, up to {Math.round(maxSeconds / 60)} min)</span></div>
      <div className="flex flex-wrap items-center gap-2">
        {recording ? (
          <>
            <Button type="button" variant="danger" onClick={stop}><Square className="w-4 h-4 mr-2" /> Stop</Button>
            <span className="inline-flex items-center gap-2 text-sm tabular-nums text-red-600"><span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" /> {fmtClock(seconds)} / {fmtClock(maxSeconds)}</span>
          </>
        ) : (
          <>
            {canRecord && <Button type="button" variant="outline" onClick={start}>{blob ? <><RotateCcw className="w-4 h-4 mr-2" /> Re-record</> : <><Mic className="w-4 h-4 mr-2" /> Record</>}</Button>}
            <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}><Paperclip className="w-4 h-4 mr-2" /> Attach</Button>
            {blob && <Button type="button" variant="ghost" onClick={() => onChange(null)} aria-label="Remove voice note"><X className="w-4 h-4 mr-1" /> Remove</Button>}
          </>
        )}
      </div>
      {url && !recording && <audio controls src={url} className="h-10 w-full max-w-sm" />}
      <input ref={fileRef} type="file" accept="audio/*" className="hidden" onChange={attach} />
      {error && <div className="text-sm text-amber-700">{error}</div>}
    </div>
  );
}
