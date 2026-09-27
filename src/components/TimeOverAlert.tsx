import { Modal } from '@/components/Modal';
import { formatTime } from '@/lib/time';
import { markGuestOut } from '@/lib/guestOps';
import type { Guest } from '@/lib/types';
import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';

interface TimeOverAlertProps {
  guest: Guest | null;
  onClose: () => void;
  onMarkOut: () => void;
}

export function TimeOverAlert({ guest, onClose, onMarkOut }: TimeOverAlertProps) {
  const [busy, setBusy] = useState(false);

  if (!guest) return null;

  async function handleMarkOut() {
    setBusy(true);
    try {
      await markGuestOut(guest!.id, new Date());
      onMarkOut();
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={!!guest} onClose={onClose} title="" maxWidth="max-w-md" closeOnBackdrop={false}>
      <div className="text-center -mt-2">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4 animate-[pulse_1s_ease-in-out_infinite]">
          <AlertTriangle className="w-9 h-9 text-red-600" />
        </div>
        <h2 className="text-xl font-extrabold text-slate-900 mb-1">Play Time Over</h2>
        <p className="text-slate-600 mb-5">
          <span className="font-bold text-slate-900">{guest.guest_name}'s</span> play time is over.
          <br />Please call the guest / ask them to exit the play area.
        </p>

        <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 mb-5">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-red-600">Expected Out</span>
            <span className="font-bold text-red-700 tabular-nums">{formatTime(guest.expected_out_time)}</span>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-700 font-bold text-sm hover:bg-slate-200 transition-all"
          >
            OK
          </button>
          <button
            onClick={handleMarkOut}
            disabled={busy}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 transition-all disabled:opacity-60"
          >
            {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
            Mark As Out
          </button>
        </div>
      </div>
    </Modal>
  );
}
