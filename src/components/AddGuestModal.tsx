import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Modal } from '@/components/Modal';
import { DURATION_PRESETS, REMARK_SUGGESTIONS } from '@/lib/types';
import { addMinutes, formatTime, parseTimeOnDate, toLocalInputValue } from '@/lib/time';
import { addGuest } from '@/lib/guestOps';
import { CheckCircle2, Loader2, Plus } from 'lucide-react';

interface AddGuestModalProps {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
}

export function AddGuestModal({ open, onClose, onAdded }: AddGuestModalProps) {
  const [guestName, setGuestName] = useState('');
  const [inTime, setInTime] = useState(() => toLocalInputValue(new Date()));
  const [duration, setDuration] = useState<number>(60);
  const [customDuration, setCustomDuration] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Reset form each time it opens
  useEffect(() => {
    if (open) {
      setGuestName('');
      setInTime(toLocalInputValue(new Date()));
      setDuration(60);
      setCustomDuration('');
      setUseCustom(false);
      setRemarks('');
      setBusy(false);
      setError(null);
      setSuccess(null);
    }
  }, [open]);

  const effectiveDuration = useMemo(() => {
    if (useCustom) {
      const n = parseInt(customDuration, 10);
      return Number.isFinite(n) && n > 0 ? n : 0;
    }
    return duration;
  }, [useCustom, customDuration, duration]);

  const inTimeDate = useMemo(() => parseTimeOnDate(inTime || toLocalInputValue(new Date())), [inTime]);
  const expectedOut = useMemo(() => addMinutes(inTimeDate, effectiveDuration), [inTimeDate, effectiveDuration]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!guestName.trim()) {
      setError('Please enter guest name.');
      return;
    }
    if (effectiveDuration <= 0) {
      setError('Please select play duration.');
      return;
    }

    setBusy(true);
    try {
      await addGuest({
        guest_name: guestName,
        in_time: inTimeDate,
        duration_minutes: effectiveDuration,
        remarks: remarks || null,
      });
      setSuccess(`${guestName.trim()} • ${formatTime(inTimeDate)} → ${formatTime(expectedOut)}`);
      onAdded();
      setTimeout(() => onClose(), 900);
    } catch (err) {
      setError('Unable to save guest. Please check your connection and try again.');
      console.error(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add New Guest" maxWidth="max-w-xl">
      {success ? (
        <div className="flex flex-col items-center justify-center py-8 text-center animate-[fadeIn_0.2s]">
          <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-1">Guest Added Successfully</h3>
          <p className="text-sm text-slate-500">{success}</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Guest Name */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Guest Name <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="e.g. Mahi"
              autoFocus
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 outline-none transition-all text-slate-900 placeholder:text-slate-400"
            />
          </div>

          {/* In Time */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">In Time</label>
            <input
              type="time"
              value={inTime}
              onChange={(e) => setInTime(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 outline-none transition-all text-slate-900"
            />
            <p className="text-xs text-slate-400 mt-1">Defaults to current time. Edit if needed.</p>
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Play Duration <span className="text-red-500">*</span></label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {DURATION_PRESETS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => { setDuration(d.value); setUseCustom(false); }}
                  className={`py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                    !useCustom && duration === d.value
                      ? 'bg-cyan-500 border-cyan-500 text-white shadow-sm'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {d.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setUseCustom(true)}
                className={`py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                  useCustom
                    ? 'bg-cyan-500 border-cyan-500 text-white shadow-sm'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                Custom
              </button>
            </div>
            {useCustom && (
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="number"
                  value={customDuration}
                  onChange={(e) => setCustomDuration(e.target.value)}
                  placeholder="Minutes"
                  min={1}
                  className="w-32 px-4 py-2.5 rounded-xl border border-slate-200 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 outline-none transition-all text-slate-900"
                />
                <span className="text-sm text-slate-500">minutes</span>
              </div>
            )}
          </div>

          {/* Out Time (auto) */}
          <div className="px-4 py-3 rounded-xl bg-cyan-50 border border-cyan-100">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-cyan-900">Expected Out Time</span>
              <span className="text-lg font-bold text-cyan-700 tabular-nums">{formatTime(expectedOut)}</span>
            </div>
            <p className="text-xs text-cyan-600 mt-1">Auto-calculated from In Time + Duration</p>
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Remarks <span className="text-slate-400 font-normal">(optional)</span></label>
            <input
              type="text"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Birthday Party"
              list="remark-suggestions"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 outline-none transition-all text-slate-900 placeholder:text-slate-400"
            />
            <datalist id="remark-suggestions">
              {REMARK_SUGGESTIONS.map((r) => <option key={r} value={r} />)}
            </datalist>
          </div>

          {error && (
            <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 text-white font-bold text-sm shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:translate-y-0"
          >
            {busy ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Saving...</>
            ) : (
              <><Plus className="w-5 h-5" /> START PLAY</>
            )}
          </button>
        </form>
      )}
    </Modal>
  );
}
