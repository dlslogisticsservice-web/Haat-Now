// ─────────────────────────────────────────────────────────────────────────────
// Experience Platform · operator state persistence.
//
// Feature-flag toggles, experiment statuses and the rollout gate are operator decisions, so they
// must survive a reload. This uses the project's EXISTING persistence engine — `adminCrud`, the
// same repository LaunchGuardian persists through (a real table when live, localStorage in the
// sandbox). No parallel storage layer, no new service pattern, no direct localStorage access.
//
// Only OVERRIDES are stored — the shipped definitions in experience-platform.service remain the
// source of truth for what exists; this records what an operator changed about them.
// ─────────────────────────────────────────────────────────────────────────────
import { adminCrud } from './admin-crud.service';

export interface FlagStateRow { id: string; flag_id: string; enabled: boolean }
export interface ExperimentStateRow { id: string; experiment_id: string; status: string }
export interface RolloutStateRow { id: string; enabled: boolean; experiences: string; percentage: number }

const flagsRepo = adminCrud<FlagStateRow>('experience_flag_state');
const experimentsRepo = adminCrud<ExperimentStateRow>('experience_experiment_state');
const rolloutRepo = adminCrud<RolloutStateRow>('experience_rollout_state');

/** One in-memory mirror so reads during render never hit storage. Hydrated once at boot. */
const cache = {
  flags: new Map<string, boolean>(),
  experiments: new Map<string, string>(),
  rollout: null as { enabled: boolean; experiences: string[]; percentage: number } | null,
  hydrated: false,
};

/** Load persisted operator state. Safe to call repeatedly; never throws. */
export async function hydrateExperienceState(): Promise<void> {
  if (cache.hydrated) return;
  cache.hydrated = true;
  try {
    const [f, e, r] = await Promise.all([flagsRepo.list(), experimentsRepo.list(), rolloutRepo.list()]);
    (f.data ?? []).forEach(row => { if (row?.flag_id) cache.flags.set(row.flag_id, !!row.enabled); });
    (e.data ?? []).forEach(row => { if (row?.experiment_id) cache.experiments.set(row.experiment_id, String(row.status)); });
    const rollout = (r.data ?? [])[0];
    if (rollout) {
      cache.rollout = {
        enabled: !!rollout.enabled,
        experiences: String(rollout.experiences ?? '').split(',').map(s => s.trim()).filter(Boolean),
        percentage: Number(rollout.percentage ?? 0),
      };
    }
  } catch { /* storage unavailable — the shipped defaults stand */ }
}

export const persistedFlag = (flagId: string): boolean | undefined => cache.flags.get(flagId);
export const persistedExperimentStatus = (experimentId: string): string | undefined => cache.experiments.get(experimentId);
export const persistedRollout = () => cache.rollout;

/** Persist a flag toggle (upsert by flag id). Mirrors immediately so the UI stays responsive. */
export async function saveFlagState(flagId: string, enabled: boolean): Promise<void> {
  cache.flags.set(flagId, enabled);
  try {
    const { data } = await flagsRepo.list();
    const existing = (data ?? []).find(r => r.flag_id === flagId);
    if (existing) await flagsRepo.update(existing.id, { enabled } as Partial<FlagStateRow>);
    else await flagsRepo.create({ flag_id: flagId, enabled } as Partial<FlagStateRow>);
  } catch { /* the in-memory mirror still reflects the operator's intent this session */ }
}

export async function saveExperimentStatus(experimentId: string, status: string): Promise<void> {
  cache.experiments.set(experimentId, status);
  try {
    const { data } = await experimentsRepo.list();
    const existing = (data ?? []).find(r => r.experiment_id === experimentId);
    if (existing) await experimentsRepo.update(existing.id, { status } as Partial<ExperimentStateRow>);
    else await experimentsRepo.create({ experiment_id: experimentId, status } as Partial<ExperimentStateRow>);
  } catch { /* ignore */ }
}

export async function saveRolloutState(state: { enabled: boolean; experiences: string[]; percentage: number }): Promise<void> {
  cache.rollout = state;
  const row = { enabled: state.enabled, experiences: state.experiences.join(','), percentage: state.percentage };
  try {
    const { data } = await rolloutRepo.list();
    const existing = (data ?? [])[0];
    if (existing) await rolloutRepo.update(existing.id, row as Partial<RolloutStateRow>);
    else await rolloutRepo.create(row as Partial<RolloutStateRow>);
  } catch { /* ignore */ }
}

// ── Wave 20.1 · Visitor history persistence ─────────────────────────────────────
// A visitor profile is DERIVED from the event log, so persisting a *profile* would create a second
// source of truth that could drift from the log. Instead we persist the visitor's own event tail
// and replay it into the store at boot — the profile then rebuilds from the one model it always
// had, and "returning visitor" behaviour survives a reload. Same adminCrud repository as above.
export interface VisitorHistoryRow { id: string; visitor_id: string; events: string }

const historyRepo = adminCrud<VisitorHistoryRow>('experience_visitor_history');
const historyCache = new Map<string, unknown[]>();
const historyRowIds = new Map<string, string>();
let historyHydrated = false;

/** How many events per visitor survive a reload. Bounded so storage can never grow without limit. */
export const VISITOR_HISTORY_MAX = 200;

/** Load persisted visitor history. Safe to call repeatedly; never throws. */
export async function hydrateVisitorHistory(): Promise<void> {
  if (historyHydrated) return;
  historyHydrated = true;
  try {
    const { data } = await historyRepo.list();
    (data ?? []).forEach(row => {
      if (!row?.visitor_id) return;
      historyRowIds.set(row.visitor_id, row.id);
      try {
        const parsed = JSON.parse(row.events);
        if (Array.isArray(parsed)) historyCache.set(row.visitor_id, parsed);
      } catch { /* skip a corrupt row rather than losing every visitor */ }
    });
  } catch { /* storage unavailable — the visitor simply starts fresh this session */ }
}

/** The persisted event tail for a visitor, oldest first. */
export const persistedVisitorHistory = (visitorId: string): unknown[] => historyCache.get(visitorId) ?? [];
export const persistedVisitorIds = (): string[] => [...historyCache.keys()];

/** Append events to a visitor's persisted tail (upsert, newest kept). Mirrors immediately. */
export async function saveVisitorHistory(visitorId: string, events: readonly unknown[]): Promise<void> {
  if (!visitorId || events.length === 0) return;
  const merged = [...(historyCache.get(visitorId) ?? []), ...events].slice(-VISITOR_HISTORY_MAX);
  historyCache.set(visitorId, merged);
  try {
    const payload = JSON.stringify(merged);
    const rowId = historyRowIds.get(visitorId);
    if (rowId) await historyRepo.update(rowId, { events: payload } as Partial<VisitorHistoryRow>);
    else {
      const { data } = await historyRepo.create({ visitor_id: visitorId, events: payload } as Partial<VisitorHistoryRow>);
      if (data?.id) historyRowIds.set(visitorId, data.id);
    }
  } catch { /* the in-memory mirror still serves this session */ }
}
