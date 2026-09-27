import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { StaffUser, StaffRole } from '@/lib/types';
import { formatShortDate } from '@/lib/time';
import { ArrowLeft, Shield, Trash2, User } from 'lucide-react';

interface StaffProps {
  onNavigate: (page: 'dashboard' | 'history' | 'settings' | 'stats' | 'staff') => void;
}

export function Staff({ onNavigate }: StaffProps) {
  const { profile, refreshProfile } = useAuth();
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from('staff_users').select('*').order('created_at', { ascending: true });
    if (error) {
      setError('Unable to load staff.');
    } else {
      setStaff((data ?? []) as StaffUser[]);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function toggleRole(s: StaffUser) {
    setBusy(s.id);
    setError(null);
    const newRole: StaffRole = s.role === 'admin' ? 'staff' : 'admin';
    // Only admins can update roles — use RPC-free direct update (policy allows admin via is_admin)
    const { error } = await supabase
      .from('staff_users')
      .update({ role: newRole })
      .eq('id', s.id);
    if (error) {
      setError('Unable to update role. Make sure you are an admin.');
    } else {
      await load();
      if (s.id === profile?.id) void refreshProfile();
    }
    setBusy(null);
  }

  async function removeStaff(s: StaffUser) {
    if (!confirm(`Remove ${s.name} from staff? They will lose access to the system.`)) return;
    setBusy(s.id);
    setError(null);
    const { error } = await supabase.from('staff_users').delete().eq('id', s.id);
    if (error) {
      setError('Unable to remove staff. Please try again.');
    } else {
      await load();
    }
    setBusy(null);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center gap-3">
          <button onClick={() => onNavigate('dashboard')} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg sm:text-xl font-extrabold text-slate-900">Staff Management</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-5 sm:py-6">
        <div className="bg-cyan-50 border border-cyan-100 rounded-xl px-4 py-3 mb-4 text-sm text-cyan-800">
          <p className="font-semibold">Admin Access</p>
          <p className="text-cyan-700 mt-0.5">You can promote staff to admin or remove accounts. New staff sign up from the login screen.</p>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">{error}</div>
        )}

        {loading ? (
          <div className="text-center py-16 text-slate-400">Loading...</div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">Role</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">Joined</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-slate-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.map((s) => (
                    <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-sm font-bold text-slate-900">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                            <User className="w-4 h-4 text-slate-400" />
                          </div>
                          {s.name}
                          {s.id === profile?.id && <span className="text-xs text-cyan-600 font-semibold">(you)</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{s.email}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-full border ${
                          s.role === 'admin' ? 'bg-cyan-50 text-cyan-700 border-cyan-200' : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}>
                          {s.role === 'admin' && <Shield className="w-3 h-3" />}
                          {s.role.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500 whitespace-nowrap">{formatShortDate(s.created_at)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => toggleRole(s)}
                            disabled={busy === s.id}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors disabled:opacity-50"
                          >
                            {s.role === 'admin' ? 'Make Staff' : 'Make Admin'}
                          </button>
                          <button
                            onClick={() => removeStaff(s)}
                            disabled={busy === s.id || s.id === profile?.id}
                            className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors disabled:opacity-30"
                            title={s.id === profile?.id ? 'Cannot remove yourself' : 'Remove'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
