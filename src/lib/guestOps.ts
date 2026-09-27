import { supabase } from '@/lib/supabase';
import type { Extension, Guest } from '@/lib/types';
import { addMinutes, getDayKey } from '@/lib/time';

export async function fetchNextSerial(): Promise<number> {
  const todayKey = getDayKey(new Date());
  const startOfDay = new Date(`${todayKey}T00:00:00+05:30`).toISOString();
  const endOfDay = new Date(`${todayKey}T23:59:59+05:30`).toISOString();

  const { data, error } = await supabase
    .from('guests')
    .select('serial_number')
    .gte('created_at', startOfDay)
    .lte('created_at', endOfDay)
    .order('serial_number', { ascending: false })
    .limit(1);

  if (error) throw error;
  if (!data || data.length === 0) return 1;
  return (data[0].serial_number as number) + 1;
}

export async function addGuest(input: {
  guest_name: string;
  in_time: Date;
  duration_minutes: number;
  remarks?: string | null;
}): Promise<Guest> {
  const serial = await fetchNextSerial();
  const expectedOut = addMinutes(input.in_time, input.duration_minutes);

  const { data, error } = await supabase
    .from('guests')
    .insert({
      serial_number: serial,
      guest_name: input.guest_name.trim(),
      in_time: input.in_time.toISOString(),
      expected_out_time: expectedOut.toISOString(),
      duration_minutes: input.duration_minutes,
      remarks: input.remarks?.trim() || null,
      status: 'active',
    })
    .select()
    .maybeSingle();

  if (error) throw error;
  return data as Guest;
}

export async function updateGuest(
  id: string,
  patch: Partial<Pick<Guest, 'guest_name' | 'in_time' | 'expected_out_time' | 'duration_minutes' | 'remarks' | 'status'>>,
): Promise<void> {
  const { error } = await supabase.from('guests').update(patch).eq('id', id);
  if (error) throw error;
}

export async function markGuestOut(id: string, actualOut: Date): Promise<void> {
  const { error } = await supabase
    .from('guests')
    .update({
      actual_out_time: actualOut.toISOString(),
      status: 'completed',
    })
    .eq('id', id);
  if (error) throw error;
}

export async function extendGuestTime(
  guest: Guest,
  extensionMinutes: number,
): Promise<Extension> {
  const newOut = addMinutes(new Date(guest.expected_out_time), extensionMinutes);

  const { data: extData, error: extError } = await supabase
    .from('extensions')
    .insert({
      guest_id: guest.id,
      extension_minutes: extensionMinutes,
      previous_out_time: guest.expected_out_time,
      new_out_time: newOut.toISOString(),
    })
    .select()
    .maybeSingle();
  if (extError) throw extError;

  const { error: guestError } = await supabase
    .from('guests')
    .update({
      expected_out_time: newOut.toISOString(),
      // If guest was time_over, move back to active/ending_soon after extension
      status: guest.status === 'time_over' ? 'active' : guest.status,
    })
    .eq('id', guest.id);
  if (guestError) throw guestError;

  return extData as Extension;
}

export async function cancelGuest(id: string): Promise<void> {
  // Soft-delete: set status to cancelled, keep record
  const { error } = await supabase
    .from('guests')
    .update({ status: 'cancelled' })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteGuest(id: string): Promise<void> {
  // Hard delete (admin only). Extensions cascade.
  const { error } = await supabase.from('guests').delete().eq('id', id);
  if (error) throw error;
}

export function friendlyError(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const msg = String((err as { message: string }).message).toLowerCase();
    if (msg.includes('network') || msg.includes('fetch') || msg.includes('connection')) {
      return 'Unable to save. Please check your connection and try again.';
    }
  }
  return fallback;
}
