import React, { useState } from 'react';
import { Modal, Button, Input, Field, Alert } from '../../components/ui';
import ImagePicker from '../../components/ImagePicker';
import VoiceRecorder from '../../components/VoiceRecorder';
import { fmtM } from '../../lib/format';

/**
 * Mark (or edit / remove) the damage of one taka before folding is saved.
 * damage: {meters, image_url, notes, voice: Blob|null}. onSave(damage) / onRemove().
 */
export default function DamageModal({ row, foldedMeters, damage, onSave, onRemove, onClose }) {
  const [meters, setMeters] = useState(damage?.meters ?? '');
  const [image, setImage] = useState(damage?.image_url || '');
  const [voice, setVoice] = useState(damage?.voice || null);
  const [notes, setNotes] = useState(damage?.notes || '');
  const [error, setError] = useState('');

  const save = (e) => {
    e.preventDefault();
    const n = Number(meters);
    if (!(n > 0)) return setError('Enter the damaged meters (more than 0)');
    if (Math.abs(n * 100 - Math.round(n * 100)) > 1e-6) return setError('Damaged meters can have at most 2 decimals');
    if (n > Number(foldedMeters)) return setError(`Damaged meters cannot be more than the folded meters (${fmtM(foldedMeters)} m)`);
    onSave({ meters: Math.round(n * 100) / 100, image_url: image || null, notes: notes.trim(), voice });
  };

  return (
    <Modal isOpen onClose={onClose} title={`Damage — taka ${row.label}`} maxWidth="max-w-lg">
      <form onSubmit={save} className="space-y-5">
        <Field label={`Damaged meters * (folded: ${fmtM(foldedMeters)} m)`}>
          <Input type="number" step="0.01" min="0.01" autoFocus value={meters} onChange={(e) => setMeters(e.target.value)} placeholder="e.g. 5.50" />
        </Field>
        <ImagePicker label="Photo (optional)" value={image} onChange={setImage} />
        <VoiceRecorder blob={voice} onChange={setVoice} />
        <Field label="Notes (optional)"><Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Torn near the selvedge" /></Field>
        <Alert>{error}</Alert>
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          {damage ? <Button type="button" variant="danger" onClick={onRemove}>Remove damage</Button> : <span />}
          <div className="flex gap-3">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit">Save damage</Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
