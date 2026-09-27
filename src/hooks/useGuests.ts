import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Extension, Guest, GuestStatus } from '@/lib/types';
import { getDayKey } from '@/lib/time';

export interface GuestWithExtensions extends Guest {
  extensions: Extension[];
}

interface UseGuestsResult {
  guests: GuestWithExtensions[];
  loading: boolean;
  connected: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useGuests(): UseGuestsResult {
  const [guests, setGuests] = useState<GuestWithExtensions[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('guests')
      .select('*, extensions(*)')
      .order('serial_number', { ascending: true });

    if (!mountedRef.current) return;

    if (error) {
      setError('Unable to load guest data. Please check your connection.');
      setConnected(false);
      setLoading(false);
      return;
    }

    setError(null);
    setConnected(true);
    setGuests((data ?? []) as GuestWithExtensions[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    load();

    const channel = supabase
      .channel('guests-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'guests' },
        () => load(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'extensions' },
        () => load(),
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setConnected(false);
        } else if (status === 'SUBSCRIBED') {
          setConnected(true);
        }
      });

    const onOnline = () => load();
    const onOffline = () => setConnected(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      mountedRef.current = false;
      supabase.removeChannel(channel);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [load]);

  return { guests, loading, connected, error, refresh: load };
}

export function computeStatus(
  guest: Guest,
  now: Date,
  endingSoonMinutes: number,
): GuestStatus {
  if (guest.status === 'completed') return 'completed';
  if (guest.status === 'cancelled') return 'cancelled';

  const expectedOut = new Date(guest.expected_out_time);
  const diff = expectedOut.getTime() - now.getTime();

  if (diff <= 0) return 'time_over';
  if (diff <= endingSoonMinutes * 60000) return 'ending_soon';
  return 'active';
}

export function nextSerialNumber(guests: Guest[]): number {
  const todayKey = getDayKey(new Date());
  const todayGuests = guests.filter((g) => getDayKey(g.created_at) === todayKey);
  if (todayGuests.length === 0) return 1;
  return Math.max(...todayGuests.map((g) => g.serial_number)) + 1;
}
