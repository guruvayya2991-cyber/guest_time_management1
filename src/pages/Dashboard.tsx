import { useEffect, useMemo, useRef, useState } from 'react';
import { useNow } from '@/hooks/useNow';
import { useGuests, computeStatus } from '@/hooks/useGuests';
import { useSettings } from '@/context/SettingsContext';
import { useAuth } from '@/context/AuthContext';
import { formatLongDate, formatTimeWithSeconds, getDayKey } from '@/lib/time';
import { playAlertSound, showBrowserNotification } from '@/lib/notify';
import type { Guest, GuestStatus } from '@/lib/types';
import { AddGuestModal } from '@/components/AddGuestModal';
import { ExtendTimeModal } from '@/components/ExtendTimeModal';
import { EditGuestModal } from '@/components/EditGuestModal';
import { MarkOutModal } from '@/components/MarkOutModal';
import { CancelGuestModal } from '@/components/CancelGuestModal';
import { TimeOverAlert } from '@/components/TimeOverAlert';
import { GuestRow } from '@/components/GuestRow';
import { GuestCard } from '@/components/GuestCard';
import { Activity, AlertTriangle, CheckCircle2, Clock, Plus, Search, Users, Wifi, WifiOff } from 'lucide-react';

interface DashboardProps {
  onNavigate: (page: 'dashboard' | 'history' | 'settings' | 'stats' | 'staff') => void;
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const now = useNow(1000);
  const { guests, loading, connected, refresh } = useGuests();
  const { settings } = useSettings();
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [extendGuest, setExtendGuest] = useState<Guest | null>(null);
  const [editGuest, setEditGuest] = useState<Guest | null>(null);
  const [markOutGuest, setMarkOutGuest] = useState<Guest | null>(null);
  const [cancelGuest, setCancelGuest] = useState<Guest | null>(null);
  const [alertGuest, setAlertGuest] = useState<Guest | null>(null);

  // Track which guests we've already alerted for (by id) so we don't repeat
  const alertedRef = useRef<Set<string>>(new Set());

  // Compute live status + remaining for each guest
  const liveGuests = useMemo(() => {
    return guests.map((g) => {
      const status = computeStatus(g, now, settings.ending_soon_minutes);
      const remaining = new Date(g.expected_out_time).getTime() - now.getTime();
      return { guest: g, status, remaining, extensionCount: g.extensions?.length ?? 0 };
    });
  }, [guests, now, settings.ending_soon_minutes]);

  // Trigger Time Over alert once per guest crossing the threshold
  useEffect(() => {
    for (const { guest, status } of liveGuests) {
      if (status === 'time_over' && !alertedRef.current.has(guest.id)) {
        // Only alert for guests that just crossed (not ones already time_over on load)
        // We detect "just crossed" by checking if remaining is within a small recent window
        alertedRef.current.add(guest.id);
        // Only fire the popup if this is a fresh crossing (remaining > -90s, i.e. within 90s of crossing)
        // Otherwise on page reload we still highlight the row but don't spam popups.
        const remaining = new Date(guest.expected_out_time).getTime() - now.getTime();
        if (remaining > -90000 && remaining <= 0) {
          setAlertGuest(guest);
          if (settings.notification_sound) playAlertSound();
          if (settings.browser_notifications) {
            showBrowserNotification('Play Time Over', `${guest.guest_name}'s play time is over.`);
          }
        }
      }
      // Reset alert tracking if guest is no longer time_over (e.g. extended)
      if (status !== 'time_over' && alertedRef.current.has(guest.id)) {
        alertedRef.current.delete(guest.id);
      }
    }
  }, [liveGuests, now, settings.notification_sound, settings.browser_notifications]);

  // Summary counts
  const summary = useMemo(() => {
    let active = 0, endingSoon = 0, timeOver = 0, completed = 0, total = 0;
    const todayKey = getDayKey(now);
    for (const { guest, status } of liveGuests) {
      if (getDayKey(guest.created_at) !== todayKey) continue;
      total++;
      if (status === 'active') active++;
      else if (status === 'ending_soon') endingSoon++;
      else if (status === 'time_over') timeOver++;
      else if (status === 'completed') completed++;
    }
    return { active, endingSoon, timeOver, completed, total };
  }, [liveGuests, now]);

  // Filtered guests for display (today only, search applied)
  const filtered = useMemo(() => {
    const todayKey = getDayKey(now);
    let list = liveGuests.filter(({ guest }) => getDayKey(guest.created_at) === todayKey);
    // Sort: active/ending_soon/time_over first, then completed/cancelled
    const order: Record<GuestStatus, number> = { time_over: 0, ending_soon: 1, active: 2, completed: 3, cancelled: 4 };
    list = list.sort((a, b) => order[a.status] - order[b.status] || a.guest.serial_number - b.guest.serial_number);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(({ guest }) => guest.guest_name.toLowerCase().includes(q));
    }
    return list;
  }, [liveGuests, now, search]);

  const cards = [
    { label: 'Active Guests', value: summary.active, icon: Activity, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
    { label: 'Ending Soon', value: summary.endingSoon, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
    { label: 'Time Over', value: summary.timeOver, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100' },
    { label: 'Completed', value: summary.completed, icon: CheckCircle2, color: 'text-slate-500', bg: 'bg-slate-50', border: 'border-slate-200' },
    { label: 'Total Today', value: summary.total, icon: Users, color: 'text-cyan-600', bg: 'bg-cyan-50', border: 'border-cyan-100' },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-emerald-500 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5 text-white" strokeWidth={2.5} />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight leading-none">UNLIMITED FUN</h1>
                <p className="text-xs text-slate-500 font-medium mt-0.5">Guest Timing Management</p>
              </div>
            </div>

            <div className="flex items-center gap-3 sm:gap-4">
              {/* Connection */}
              <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold ${
                connected ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
              }`}>
                {connected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{connected ? 'Connected' : 'Connection Lost'}</span>
              </div>

              {/* Live Clock */}
              <div className="text-right">
                <p className="text-base sm:text-xl font-bold text-slate-900 tabular-nums leading-none">{formatTimeWithSeconds(now)}</p>
                <p className="text-xs text-slate-500 mt-0.5 hidden sm:block">{formatLongDate(now)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-2 flex items-center gap-1 overflow-x-auto">
          <NavBtn active onClick={() => onNavigate('dashboard')}>Dashboard</NavBtn>
          <NavBtn onClick={() => onNavigate('history')}>History</NavBtn>
          {isAdmin && <NavBtn onClick={() => onNavigate('stats')}>Statistics</NavBtn>}
          {isAdmin && <NavBtn onClick={() => onNavigate('staff')}>Staff</NavBtn>}
          <NavBtn onClick={() => onNavigate('settings')}>Settings</NavBtn>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-5 sm:py-6">
        {/* Connection lost banner */}
        {!connected && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-semibold flex items-center gap-2">
            <WifiOff className="w-5 h-5" />
            Connection lost. Data may not be current. Please wait before entering new guests.
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
          {cards.map((c) => (
            <div key={c.label} className={`rounded-2xl border ${c.border} ${c.bg} p-4`}>
              <div className="flex items-center gap-2 mb-2">
                <c.icon className={`w-4 h-4 ${c.color}`} />
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{c.label}</span>
              </div>
              <p className={`text-2xl sm:text-3xl font-extrabold ${c.color} tabular-nums`}>{c.value}</p>
            </div>
          ))}
        </div>

        {/* Add Guest + Search */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <button
            onClick={() => setAddOpen(true)}
            disabled={!connected}
            className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 text-white font-bold text-sm shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:translate-y-0 shrink-0"
          >
            <Plus className="w-5 h-5" /> ADD GUEST
          </button>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search guest name..."
              className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-slate-200 bg-white focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 outline-none transition-all text-slate-900 placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Guest List */}
        {loading ? (
          <div className="text-center py-16 text-slate-400">
            <div className="w-10 h-10 border-3 border-slate-200 border-t-cyan-500 rounded-full animate-spin mx-auto mb-3" />
            Loading guests...
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="text-lg font-bold text-slate-700 mb-1">{search ? 'No guests found' : 'No guests yet'}</h3>
            <p className="text-sm text-slate-400">{search ? 'Try a different name.' : 'Click ADD GUEST to get started.'}</p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden lg:block bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-3 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wide">S.No</th>
                      <th className="px-3 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wide">Guest Name</th>
                      <th className="px-3 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wide">In Time</th>
                      <th className="px-3 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wide">Duration</th>
                      <th className="px-3 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wide">Out Time</th>
                      <th className="px-3 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wide">Remaining</th>
                      <th className="px-3 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wide">Status</th>
                      <th className="px-3 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wide">Remarks</th>
                      <th className="px-3 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wide">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(({ guest, status, remaining, extensionCount }) => (
                      <GuestRow
                        key={guest.id}
                        guest={guest}
                        status={status}
                        remainingMs={remaining}
                        extensionCount={extensionCount}
                        onExtend={() => setExtendGuest(guest)}
                        onEdit={() => setEditGuest(guest)}
                        onMarkOut={() => setMarkOutGuest(guest)}
                        onCancel={() => setCancelGuest(guest)}
                        isAdmin={isAdmin}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile/Tablet Cards */}
            <div className="lg:hidden space-y-3">
              {filtered.map(({ guest, status, remaining, extensionCount }) => (
                <GuestCard
                  key={guest.id}
                  guest={guest}
                  status={status}
                  remainingMs={remaining}
                  extensionCount={extensionCount}
                  onExtend={() => setExtendGuest(guest)}
                  onEdit={() => setEditGuest(guest)}
                  onMarkOut={() => setMarkOutGuest(guest)}
                  onCancel={() => setCancelGuest(guest)}
                />
              ))}
            </div>
          </>
        )}
      </main>

      {/* Modals */}
      <AddGuestModal open={addOpen} onClose={() => setAddOpen(false)} onAdded={refresh} />
      <ExtendTimeModal open={!!extendGuest} onClose={() => setExtendGuest(null)} guest={extendGuest} onDone={refresh} />
      <EditGuestModal open={!!editGuest} onClose={() => setEditGuest(null)} guest={editGuest} onDone={refresh} />
      <MarkOutModal open={!!markOutGuest} onClose={() => setMarkOutGuest(null)} guest={markOutGuest} onDone={refresh} />
      <CancelGuestModal open={!!cancelGuest} onClose={() => setCancelGuest(null)} guest={cancelGuest} onDone={refresh} isAdmin={isAdmin} />
      <TimeOverAlert guest={alertGuest} onClose={() => setAlertGuest(null)} onMarkOut={refresh} />
    </div>
  );
}

function NavBtn({ children, active, onClick }: { children: React.ReactNode; active?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3.5 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors ${
        active ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
      }`}
    >
      {children}
    </button>
  );
}
