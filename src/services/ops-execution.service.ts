// ─────────────────────────────────────────────────────────────────────────────
// Operations execution service — manual ops actions that PERSIST (orders/drivers/
// shifts) and write an operation_events row (the ops timeline). Built on the
// existing adminCrud engine, so every action is real Supabase in production and
// sandbox-safe in demo. RBAC is enforced by the operation_events / table RLS
// (auth_is_admin) in production; the console is admin-only in the UI.
// ─────────────────────────────────────────────────────────────────────────────
import { adminCrud } from './admin-crud.service';
import { authService } from './auth.service';

const events = adminCrud('operation_events');
const shifts = adminCrud('driver_shifts');
const orders = adminCrud('orders');
const drivers = adminCrud('drivers');

/**
 * Append to the ops timeline. `actor_id` matters: an audit trail that cannot say WHO
 * performed an action is not an audit trail. The column has always existed in
 * 20260627000006; it was simply never populated.
 */
async function log(action: string, entityType: string, entityId: string, meta?: Record<string, any>) {
  let actorId: string | null = null;
  try { actorId = await authService.getAuthUserId(); } catch { /* attribution is best-effort */ }
  await events.create({
    action, entity_type: entityType, entity_id: entityId,
    actor_id: actorId, meta: meta || null, created_at: new Date().toISOString(),
  });
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
  // The live `driver_shifts` table (20260614000028:59) uses actual_start/actual_end
  // and constrains status to scheduled|active|closed. This service previously wrote
  // started_at/ended_at with status 'open' — columns and a value that do not exist —
  // so both actions failed in a live build while working in sandbox, where
  // localStorage accepts any shape. Now matched to the real schema.
  async startShift(driverId: string): Promise<{ error: any }> {
    const { error } = await shifts.create({
      driver_id: driverId, status: 'active', actual_start: new Date().toISOString(),
    });
    if (!error) await log('shift_started', 'driver', driverId);
    return { error };
  },
  async endShift(driverId: string): Promise<{ error: any }> {
    const { data } = await shifts.list();
    const open = [...data]
      .filter((s: any) => s.driver_id === driverId && s.status === 'active')
      .sort((a: any, b: any) => String(b.actual_start || '').localeCompare(String(a.actual_start || '')))[0];
    if (!open) return { error: { message: 'no_open_shift' } };
    const { error } = await shifts.update(open.id, { status: 'closed', actual_end: new Date().toISOString() });
    if (!error) await log('shift_closed', 'driver', driverId);
    return { error };
  },
};
