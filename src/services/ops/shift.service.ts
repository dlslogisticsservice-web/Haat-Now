import { supabase } from '../../lib/supabase';

export interface DriverShift {
  id: string;
  driver_id: string;
  zone_id: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  status: 'scheduled' | 'active' | 'closed';
  created_at: string;
}

export interface ShiftBreak {
  id: string;
  shift_id: string;
  started_at: string;
  ended_at: string | null;
}

/** Driver shift system: scheduling, attendance (actual start/end), breaks. */
export const shiftService = {
  /** Schedule a future shift (attendance plan). */
  async schedule(driverId: string, start: string, end: string, zoneId?: string): Promise<{ data: DriverShift | null; error: any }> {
    const { data, error } = await supabase.from('driver_shifts').insert({
      driver_id: driverId, scheduled_start: start, scheduled_end: end,
      zone_id: zoneId ?? null, status: 'scheduled',
    }).select().single();
    return { data: (data as any) ?? null, error };
  },

  /** Clock in — opens an active shift and brings the driver online/available. */
  async start(driverId: string, zoneId?: string): Promise<{ data: DriverShift | null; error: any }> {
    const { data, error } = await supabase.rpc('start_shift', { p_driver_id: driverId, p_zone_id: zoneId ?? null });
    return { data: (data as DriverShift) ?? null, error };
  },

  /** Clock out — closes the shift, ends any open break, sets driver offline. */
  async end(shiftId: string): Promise<{ error: any }> {
    const { error } = await supabase.rpc('end_shift', { p_shift_id: shiftId });
    return { error };
  },

  async startBreak(shiftId: string): Promise<{ error: any }> {
    const { error } = await supabase.rpc('start_break', { p_shift_id: shiftId });
    return { error };
  },

  async endBreak(shiftId: string): Promise<{ error: any }> {
    const { error } = await supabase.rpc('end_break', { p_shift_id: shiftId });
    return { error };
  },

  /** The driver's currently-active shift, if any. */
  async active(driverId: string): Promise<{ data: DriverShift | null; error: any }> {
    const { data, error } = await supabase
      .from('driver_shifts')
      .select('*')
      .eq('driver_id', driverId).eq('status', 'active')
      .order('actual_start', { ascending: false })
      .limit(1).maybeSingle();
    return { data: (data as any) ?? null, error };
  },

  /** Shift history (attendance log). */
  async history(driverId: string, limit = 30): Promise<{ data: DriverShift[]; error: any }> {
    const { data, error } = await supabase
      .from('driver_shifts')
      .select('*')
      .eq('driver_id', driverId)
      .order('created_at', { ascending: false })
      .limit(limit);
    return { data: (data as any) || [], error };
  },

  async breaks(shiftId: string): Promise<{ data: ShiftBreak[]; error: any }> {
    const { data, error } = await supabase
      .from('shift_breaks').select('*').eq('shift_id', shiftId)
      .order('started_at', { ascending: true });
    return { data: (data as any) || [], error };
  },
};
