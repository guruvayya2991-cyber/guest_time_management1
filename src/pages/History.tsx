import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { Extension, Guest, GuestStatus } from '@/lib/types';
import { getDayKey, formatDuration, formatTime, formatShortDate, toLocalInputValue } from '@/lib/time';
import { StatusBadge } from '@/components/StatusBadge';
import { ArrowLeft, Download, Search } from 'lucide-react';

interface HistoryProps {
  onNavigate: (page: 'dashboard' | 'history' | 'settings' | 'stats' | 'staff') => void;
}

interface HistoryRow extends Guest {
  extensions: Extension[];
}

export function History({ onNavigate }: HistoryProps) {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [date, setDate] = useState(() => toLocalInputValue(new Date()).slice(0, 10));
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<GuestStatus | 'all'>('all');
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      // date is YYYY-MM-DD in IST. Build IST day boundaries.
      const start = new Date(`${date}T00:00:00+05:30`).toISOString();
      const end = new Date(`${date}T23:59:59+05:30`).toISOString();
      const { data, error } = await supabase
        .from('guests')
        .select('*, extensions(*)')
        .gte('created_at', start)
        .lte('created_at', end)
        .order('serial_number', { ascending: true });
      if (error) {
        setRows([]);
      } else {
        setRows((data ?? []) as HistoryRow[]);
      }
      setLoading(false);
    }
    load();
  }, [date]);

  const filtered = useMemo(() => {
    let list = rows;
    if (statusFilter !== 'all') {
      list = list.filter((r) => r.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((r) => r.guest_name.toLowerCase().includes(q));
    }
    return list;
  }, [rows, statusFilter, search]);

  const stats = useMemo(() => {
    let totalMin = 0;
    let extCount = 0;
    for (const r of rows) {
      totalMin += r.duration_minutes;
      extCount += r.extensions?.length ?? 0;
    }
    return { count: rows.length, totalMin, extCount };
  }, [rows]);

  function exportCSV() {
    const headers = ['S.No', 'Guest Name', 'In Time', 'Expected Out', 'Actual Out', 'Duration', 'Extensions', 'Status', 'Remarks'];
    const lines = filtered.map((r) => {
      const exts = (r.extensions ?? []).map((e) => `+${e.extension_minutes}m`).join('; ');
      const row = [
        r.serial_number,
        `"${r.guest_name.replace(/"/g, '""')}"`,
        formatTime(r.in_time),
        formatTime(r.expected_out_time),
        r.actual_out_time ? formatTime(r.actual_out_time) : '—',
        formatDuration(r.duration_minutes),
        exts || '—',
        r.status,
        `"${(r.remarks ?? '').replace(/"/g, '""')}"`,
      ];
      return row.join(',');
    });
    const csv = [headers.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `unlimited-fun-${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const todayKey = getDayKey(new Date());
  const isToday = date === todayKey;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center gap-3">
          <button onClick={() => onNavigate('dashboard')} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">{isToday ? "Today's History" : 'Date History'}</h1>
            <p className="text-xs text-slate-500 font-medium">{formatShortDate(`${date}T12:00:00+05:30`)}</p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-5 sm:py-6">
        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="px-4 py-3 rounded-xl border border-slate-200 bg-white focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 outline-none transition-all text-slate-900"
          />
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search guest name..."
              className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 bg-white focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 outline-none transition-all text-slate-900 placeholder:text-slate-400"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as GuestStatus | 'all')}
            className="px-4 py-3 rounded-xl border border-slate-200 bg-white focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 outline-none transition-all text-slate-900 font-medium"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="ending_soon">Ending Soon</option>
            <option value="time_over">Time Over</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          {isAdmin && (
            <button
              onClick={exportCSV}
              disabled={filtered.length === 0}
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-900 text-white font-bold text-sm hover:bg-slate-800 transition-all disabled:opacity-50 shrink-0"
            >
              <Download className="w-4 h-4" /> Export CSV
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="rounded-xl bg-white border border-slate-200 p-3 text-center">
            <p className="text-xs text-slate-500 font-semibold uppercase">Guests</p>
            <p className="text-xl font-bold text-slate-900 tabular-nums">{stats.count}</p>
          </div>
          <div className="rounded-xl bg-white border border-slate-200 p-3 text-center">
            <p className="text-xs text-slate-500 font-semibold uppercase">Play Hours</p>
            <p className="text-xl font-bold text-slate-900 tabular-nums">{(stats.totalMin / 60).toFixed(1)}</p>
          </div>
          <div className="rounded-xl bg-white border border-slate-200 p-3 text-center">
            <p className="text-xs text-slate-500 font-semibold uppercase">Extensions</p>
            <p className="text-xl font-bold text-slate-900 tabular-nums">{stats.extCount}</p>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-center py-16 text-slate-400">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-lg font-bold text-slate-700 mb-1">No records found</p>
            <p className="text-sm text-slate-400">Try a different date or search.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-3 py-3 text-center text-xs font-bold text-slate-500 uppercase">S.No</th>
                    <th className="px-3 py-3 text-left text-xs font-bold text-slate-500 uppercase">Guest</th>
                    <th className="px-3 py-3 text-left text-xs font-bold text-slate-500 uppercase">In</th>
                    <th className="px-3 py-3 text-left text-xs font-bold text-slate-500 uppercase">Expected Out</th>
                    <th className="px-3 py-3 text-left text-xs font-bold text-slate-500 uppercase">Actual Out</th>
                    <th className="px-3 py-3 text-left text-xs font-bold text-slate-500 uppercase">Duration</th>
                    <th className="px-3 py-3 text-left text-xs font-bold text-slate-500 uppercase">Extensions</th>
                    <th className="px-3 py-3 text-left text-xs font-bold text-slate-500 uppercase">Status</th>
                    <th className="px-3 py-3 text-left text-xs font-bold text-slate-500 uppercase">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => {
                    const exts = (r.extensions ?? []).map((e) => `+${formatDuration(e.extension_minutes)}`).join(', ');
                    return (
                      <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                        <td className="px-3 py-3 text-center text-sm font-bold text-slate-400">{r.serial_number}</td>
                        <td className="px-3 py-3 text-sm font-bold text-slate-900">{r.guest_name}</td>
                        <td className="px-3 py-3 text-sm text-slate-600 tabular-nums whitespace-nowrap">{formatTime(r.in_time)}</td>
                        <td className="px-3 py-3 text-sm text-slate-600 tabular-nums whitespace-nowrap">{formatTime(r.expected_out_time)}</td>
                        <td className="px-3 py-3 text-sm text-slate-600 tabular-nums whitespace-nowrap">{r.actual_out_time ? formatTime(r.actual_out_time) : '—'}</td>
                        <td className="px-3 py-3 text-sm text-slate-600 whitespace-nowrap">{formatDuration(r.duration_minutes)}</td>
                        <td className="px-3 py-3 text-sm text-slate-600">{exts || '—'}</td>
                        <td className="px-3 py-3"><StatusBadge status={r.status} /></td>
                        <td className="px-3 py-3 text-sm text-slate-500 max-w-[120px] truncate" title={r.remarks ?? ''}>{r.remarks ?? '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
