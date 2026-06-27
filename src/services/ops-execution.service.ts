// ─────────────────────────────────────────────────────────────────────────────
// Operations execution service — manual ops actions that PERSIST (orders/drivers/
// shifts) and write an operation_events row (the ops timeline). Built on the
// existing adminCrud engine, so every action is real Supabase in production and
// sandbox-safe in demo. RBAC is enforced by the operation_events / table RLS
// (auth_is_admin) in production; the console is admin-only in the UI.
// ─────────────────────────────────────────────────────────────────────────────
import { adminCrud } from './admin-crud.service';

const events = adminCrud('operation_events');
const shifts = adminCrud('driver_shifts');
const orders = adminCrud('orders');
const drivers = adminCrud('drivers');

async function log(action: string, entityType: string, entityId: string, meta?: Record<string, any>) {
  await events.create({ action, entity_type: entityType, entity_id: entityId, meta: meta || null, created_at: new Date().toISOString() });
}

export const opsExecution = {
  async recentEvents(limit = 25): Promise<any[]> {
    const { data } = await events.list();
    return [...data].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || ''))).slice(0, limit);
  },

  // ── Assignment ──
  async reassignOrder(orderId: string, driverId: string): Promise<{ error: any }> {
    const { error } = await orders.update(orderId, { driver_id: driverId });
    if (!error) await log('order_reassigned', 'order', orderId, { driver_id: driverId });
    return { error };
  },
  async unassignOrder(orderId: string): Promise<{ error: any }> {
    const { error } = await orders.update(orderId, { driver_id: null });
    if (!error) await log('order_unassigned', 'order', orderId);
    return { error };
  },

  // ── Driver pause/resume ──
  async pauseDriver(driverId: string): Promise<{ error: any }> {
    const { error } = await drivers.update(driverId, { is_online: false });
    if (!error) await log('driver_paused', 'driver', driverId);
    return { error };
  },
  async resumeDriver(driverId: string): Promise<{ error: any }> {
    const { error } = await drivers.update(driverId, { is_online: true });
    if (!error) await log('driver_resumed', 'driver', driverId);
    return { error };
  },

  // ── Shifts (attendance / check-in / check-out) ──
  async startShift(driverId: string): Promise<{ error: any }> {
    const { error } = await shifts.create({ driver_id: driverId, status: 'open', started_at: new Date().toISOString(), created_at: new Date().toISOString() });
    if (!error) await log('shift_started', 'driver', driverId);
    return { error };
  },
  async endShift(driverId: string): Promise<{ error: any }> {
    const { data } = await shifts.list();
    const open = [...data].filter((s: any) => s.driver_id === driverId && s.status === 'open').sort((a: any, b: any) => String(b.started_at || '').localeCompare(String(a.started_at || '')))[0];
    if (!open) return { error: { message: 'no_open_shift' } };
    const { error } = await shifts.update(open.id, { status: 'closed', ended_at: new Date().toISOString() });
    if (!error) await log('shift_closed', 'driver', driverId);
    return { error };
  },
};
