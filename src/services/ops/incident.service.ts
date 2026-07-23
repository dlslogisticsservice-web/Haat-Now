// ─────────────────────────────────────────────────────────────────────────────
// Incident management — the one operational capability the platform had no model for.
//
// An INCIDENT is an operational event a human must own and close out: a dispatch
// outage, a payment provider degrading, a merchant going dark in a zone. It is
// deliberately NOT the same thing as:
//   · a support ticket   — one customer's problem, already modelled in support_tickets
//   · a cancelled order  — a data row, already visible in OpsIncidentLog
// Conflating them is why "incident log" previously meant "list of cancelled orders".
//
// Reuses the established ops-service shape: SANDBOX guard, adminCrud for CRUD,
// supabase only for the aggregate query. No new persistence engine.
// ─────────────────────────────────────────────────────────────────────────────
import { adminCrud } from '../admin-crud.service';
import { authService } from '../auth.service';

export type IncidentSeverity = 'sev1' | 'sev2' | 'sev3' | 'sev4';
export type IncidentStatus = 'open' | 'investigating' | 'identified' | 'monitoring' | 'resolved' | 'closed';
export type IncidentCategory =
  | 'dispatch' | 'payments' | 'merchant' | 'driver' | 'customer'
  | 'platform' | 'data' | 'third_party' | 'other';
export type IncidentEventKind =
  | 'note' | 'status_change' | 'severity_change' | 'assignment' | 'escalation'
  | 'mitigation' | 'root_cause' | 'resolution' | 'created';

export interface Incident {
  id: string;
  reference: string | null;
  title: string;
  description: string | null;
  severity: IncidentSeverity;
  status: IncidentStatus;
  category: IncidentCategory;
  entity_type: string | null;
  entity_id: string | null;
  zone_id: string | null;
  assigned_to: string | null;
  reported_by: string | null;
  root_cause: string | null;
  resolution: string | null;
  impact_summary: string | null;
  orders_affected: number;
  detected_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface IncidentEvent {
  id: string;
  incident_id: string;
  kind: IncidentEventKind;
  body: string | null;
  from_value: string | null;
  to_value: string | null;
  actor_id: string | null;
  created_at: string;
}

/** Severity definitions. Kept here so the UI and any future alerting agree on one meaning. */
export const SEVERITY: Record<IncidentSeverity, { ar: string; en: string; hint_ar: string; hint_en: string; color: string; rank: number }> = {
  sev1: { ar: 'حرج', en: 'SEV1 · Critical', hint_ar: 'توقف كامل — تدخل فوري', hint_en: 'Platform down or money at risk — page now', color: '#ef4444', rank: 1 },
  sev2: { ar: 'عالي', en: 'SEV2 · Major',    hint_ar: 'تدهور كبير في الخدمة',   hint_en: 'Major degradation, customers affected', color: '#f97316', rank: 2 },
  sev3: { ar: 'متوسط', en: 'SEV3 · Minor',   hint_ar: 'تأثير محدود',            hint_en: 'Limited impact, handle in hours',      color: '#eab308', rank: 3 },
  sev4: { ar: 'منخفض', en: 'SEV4 · Low',     hint_ar: 'متابعة فقط',             hint_en: 'Tracked annoyance, no urgency',        color: '#64748b', rank: 4 },
};

/** The lifecycle, in order. `closed` is terminal; anything before it can move back. */
export const STATUS_FLOW: IncidentStatus[] = ['open', 'investigating', 'identified', 'monitoring', 'resolved', 'closed'];

export const STATUS_LABEL: Record<IncidentStatus, { ar: string; en: string }> = {
  open:          { ar: 'مفتوح',      en: 'Open' },
  investigating: { ar: 'قيد التحقيق', en: 'Investigating' },
  identified:    { ar: 'تم التحديد',  en: 'Identified' },
  monitoring:    { ar: 'تحت المراقبة', en: 'Monitoring' },
  resolved:      { ar: 'تم الحل',     en: 'Resolved' },
  closed:        { ar: 'مغلق',        en: 'Closed' },
};

const SANDBOX = import.meta.env.VITE_AUTH_MODE === 'sandbox';

const incidents = adminCrud<any>('incidents');
const timeline = adminCrud<any>('incident_events');

const nowIso = () => new Date().toISOString();

async function actor(): Promise<string | null> {
  try { return await authService.getAuthUserId(); } catch { return null; }
}

/**
 * Append to the timeline. Every state change goes through here, so an incident's
 * history is always complete — there is no path that mutates an incident without
 * recording why.
 */
async function record(
  incidentId: string,
  kind: IncidentEventKind,
  body?: string,
  from?: string,
  to?: string,
): Promise<void> {
  await timeline.create({
    incident_id: incidentId, kind, body: body ?? null,
    from_value: from ?? null, to_value: to ?? null,
    actor_id: await actor(), created_at: nowIso(),
  });
}

/** Sandbox reference generator. Live builds get the value from the DB trigger. */
const sandboxRef = (n: number) => `INC-${String(n + 1).padStart(6, '0')}`;

export const incidentService = {
  async list(): Promise<{ data: Incident[]; error: any }> {
    const { data, error } = await incidents.list();
    const rows = (data ?? []) as Incident[];
    // Open first, then by severity, then newest — the order an operator triages in.
    rows.sort((a, b) => {
      const aClosed = a.status === 'closed' ? 1 : 0;
      const bClosed = b.status === 'closed' ? 1 : 0;
      if (aClosed !== bClosed) return aClosed - bClosed;
      const sev = (SEVERITY[a.severity]?.rank ?? 9) - (SEVERITY[b.severity]?.rank ?? 9);
      if (sev !== 0) return sev;
      return String(b.detected_at ?? '').localeCompare(String(a.detected_at ?? ''));
    });
    return { data: rows, error };
  },

  /** Only what needs a human right now — drives the command-centre alert count. */
  async open(): Promise<Incident[]> {
    const { data } = await this.list();
    return data.filter(i => i.status !== 'closed' && i.status !== 'resolved');
  },

  async timelineFor(incidentId: string): Promise<IncidentEvent[]> {
    const { data } = await timeline.list();
    return ((data ?? []) as IncidentEvent[])
      .filter(e => e.incident_id === incidentId)
      .sort((a, b) => String(a.created_at ?? '').localeCompare(String(b.created_at ?? '')));
  },

  async create(input: {
    title: string;
    description?: string;
    severity: IncidentSeverity;
    category: IncidentCategory;
    entity_type?: string;
    entity_id?: string;
    orders_affected?: number;
  }): Promise<{ data: Incident | null; error: any }> {
    if (!input.title?.trim()) return { data: null, error: { message: 'title_required' } };

    // In sandbox the DB trigger that mints the reference does not run, so derive it
    // from the existing row count. Live builds leave it null and let the trigger own it.
    let reference: string | null = null;
    if (SANDBOX) {
      const { data: existing } = await incidents.list();
      reference = sandboxRef((existing ?? []).length);
    }

    const { data, error } = await incidents.create({
      title: input.title.trim(),
      description: input.description?.trim() || null,
      severity: input.severity,
      status: 'open',
      category: input.category,
      entity_type: input.entity_type ?? null,
      entity_id: input.entity_id ?? null,
      orders_affected: input.orders_affected ?? 0,
      reported_by: await actor(),
      reference,
      detected_at: nowIso(),
      created_at: nowIso(),
      updated_at: nowIso(),
    });
    if (data?.id) await record(data.id, 'created', input.title.trim(), undefined, input.severity);
    return { data: data as Incident | null, error };
  },

  async setStatus(incident: Incident, next: IncidentStatus, note?: string): Promise<{ error: any }> {
    if (incident.status === next) return { error: null };
    const patch: Record<string, any> = { status: next, updated_at: nowIso() };
    // Sandbox has no trigger, so the lifecycle stamps are applied here too. Live
    // builds get the same values from touch_incident(); writing them twice is
    // harmless and keeps the two modes behaviourally identical.
    if (next !== 'open' && !incident.acknowledged_at) patch.acknowledged_at = nowIso();
    if (next === 'resolved') patch.resolved_at = nowIso();
    if (next === 'closed') patch.closed_at = nowIso();
    if (['open', 'investigating', 'identified', 'monitoring'].includes(next)) {
      patch.resolved_at = null; patch.closed_at = null;
    }
    const { error } = await incidents.update(incident.id, patch);
    if (!error) await record(incident.id, 'status_change', note, incident.status, next);
    return { error };
  },

  async setSeverity(incident: Incident, next: IncidentSeverity, note?: string): Promise<{ error: any }> {
    if (incident.severity === next) return { error: null };
    const { error } = await incidents.update(incident.id, { severity: next, updated_at: nowIso() });
    if (!error) await record(incident.id, 'severity_change', note, incident.severity, next);
    return { error };
  },

  async assign(incident: Incident, userId: string | null, label?: string): Promise<{ error: any }> {
    const { error } = await incidents.update(incident.id, { assigned_to: userId, updated_at: nowIso() });
    if (!error) await record(incident.id, 'assignment', label, incident.assigned_to ?? undefined, userId ?? undefined);
    return { error };
  },

  async addNote(incidentId: string, body: string): Promise<{ error: any }> {
    if (!body.trim()) return { error: { message: 'empty_note' } };
    await record(incidentId, 'note', body.trim());
    return { error: null };
  },

  /**
   * Close out an incident. Root cause and resolution are required — an incident
   * closed without them teaches nobody anything, which is the entire point of
   * tracking them.
   */
  async resolve(incident: Incident, rootCause: string, resolution: string): Promise<{ error: any }> {
    if (!rootCause.trim() || !resolution.trim()) return { error: { message: 'root_cause_and_resolution_required' } };
    const { error } = await incidents.update(incident.id, {
      root_cause: rootCause.trim(),
      resolution: resolution.trim(),
      status: 'resolved',
      resolved_at: nowIso(),
      acknowledged_at: incident.acknowledged_at ?? nowIso(),
      updated_at: nowIso(),
    });
    if (!error) {
      await record(incident.id, 'root_cause', rootCause.trim());
      await record(incident.id, 'resolution', resolution.trim(), incident.status, 'resolved');
    }
    return { error };
  },

  /** Minutes between detection and each lifecycle milestone. Null while unreached. */
  metrics(i: Incident): { toAcknowledge: number | null; toResolve: number | null; openFor: number | null } {
    const detected = Date.parse(i.detected_at);
    if (!Number.isFinite(detected)) return { toAcknowledge: null, toResolve: null, openFor: null };
    const mins = (t: string | null) => {
      const v = t ? Date.parse(t) : NaN;
      return Number.isFinite(v) ? Math.max(0, Math.round((v - detected) / 60000)) : null;
    };
    return {
      toAcknowledge: mins(i.acknowledged_at),
      toResolve: mins(i.resolved_at),
      openFor: i.resolved_at ? null : Math.max(0, Math.round((Date.now() - detected) / 60000)),
    };
  },
};
