// ─────────────────────────────────────────────────────────────────────────────
// Publish Pipeline + Versioning (Phase 8J).
//
// The publish flow for the Motion Studio: Draft → Validation → Preview Candidate → Approval →
// Publish → Rollback. Publishing NEVER bypasses validation — publish() re-validates the approved
// candidate before committing. Versioning keeps a history (timestamp, editor, notes, snapshot),
// supports Restore / Rollback / Compare (diff). Session-only, in-memory — no persistence, no
// backend; a durable content backend can be attached later without changing this contract.
// ─────────────────────────────────────────────────────────────────────────────
import type { EntryKind } from '../entryModel';
import type { MotionSnapshot } from './MotionStore';

export type PublishStatus = 'candidate' | 'approved' | 'published' | 'rolledback';

export interface PublishVersion {
  id: string;
  at: number;
  editor: string;
  notes: string;
  status: PublishStatus;
  kind: EntryKind;
  snapshot: MotionSnapshot;
}

export interface ValidationReport { valid: boolean; errors: string[]; }
export interface DiffLine { field: string; from: string; to: string; }

type Listener = () => void;
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

export class PublishEngine {
  private versions: PublishVersion[] = [];
  private candidate: PublishVersion | null = null;
  private seq = 0;
  private listeners = new Set<Listener>();

  constructor(private editor = 'super-admin') {}

  /** Draft Validation — a snapshot is publishable only if it passes every rule. */
  validate(snap: MotionSnapshot): ValidationReport {
    const errors: string[] = [];
    if (!snap.model.layers.some(l => l.visible)) errors.push('At least one layer must be visible');
    if (snap.model.timeline.length === 0) errors.push('Timeline cannot be empty');
    if (snap.model.timeline.some(s => s.duration <= 0)) errors.push('Every timeline step needs a positive duration');
    if (snap.model.effects.opacity <= 0) errors.push('Foreground opacity must be greater than 0');
    return { valid: errors.length === 0, errors };
  }

  /** Draft → Preview Candidate. Blocked (no candidate) when validation fails. */
  createCandidate(snap: MotionSnapshot, kind: EntryKind): { ok: boolean; report: ValidationReport } {
    const report = this.validate(snap);
    if (!report.valid) { this.candidate = null; this.emit(); return { ok: false, report }; }
    this.candidate = { id: `v${++this.seq}`, at: Date.now(), editor: this.editor, notes: '', status: 'candidate', kind, snapshot: clone(snap) };
    this.emit();
    return { ok: true, report };
  }

  approve(): boolean {
    if (!this.candidate) return false;
    this.candidate.status = 'approved';
    this.emit();
    return true;
  }

  /** Publish — re-validates first; NEVER bypasses validation. Requires an approved candidate. */
  publish(notes: string): PublishVersion | null {
    if (!this.candidate || this.candidate.status !== 'approved') return null;
    if (!this.validate(this.candidate.snapshot).valid) return null;
    const v: PublishVersion = { ...this.candidate, status: 'published', notes: notes || 'Published', at: Date.now() };
    this.versions.push(v);
    this.candidate = null;
    this.emit();
    return v;
  }

  /** Rollback — republish the previous published version as a new version. */
  rollback(): PublishVersion | null {
    const published = this.versions.filter(v => v.status === 'published' || v.status === 'rolledback');
    if (published.length < 2) return null;
    const prev = published[published.length - 2];
    const rolled: PublishVersion = { ...clone(prev), id: `v${++this.seq}`, at: Date.now(), status: 'rolledback', notes: `Rollback → ${prev.id}` };
    this.versions.push(rolled);
    this.emit();
    return rolled;
  }

  /** Restore — return a version's snapshot to load back into the Motion Store. */
  restore(id: string): MotionSnapshot | null {
    const v = this.versions.find(x => x.id === id);
    return v ? clone(v.snapshot) : null;
  }

  /** Diff Viewer — the fields that differ between two versions' snapshots. */
  compare(aId: string, bId: string): DiffLine[] {
    const a = this.versions.find(v => v.id === aId), b = this.versions.find(v => v.id === bId);
    if (!a || !b) return [];
    const fa = flatten(a.snapshot), fb = flatten(b.snapshot);
    const keys = new Set([...Object.keys(fa), ...Object.keys(fb)]);
    const out: DiffLine[] = [];
    for (const k of keys) {
      const from = fa[k] ?? '—', to = fb[k] ?? '—';
      if (from !== to) out.push({ field: k, from, to });
    }
    return out;
  }

  history(): PublishVersion[] { return [...this.versions].reverse(); }
  currentCandidate(): PublishVersion | null { return this.candidate; }
  latestPublished(): PublishVersion | null {
    const p = this.versions.filter(v => v.status === 'published' || v.status === 'rolledback');
    return p.length ? p[p.length - 1] : null;
  }
  clear(): void { if (this.versions.length || this.candidate) { this.versions = []; this.candidate = null; this.emit(); } }

  subscribe(l: Listener): () => void { this.listeners.add(l); return () => { this.listeners.delete(l); }; }
  private emit(): void { this.listeners.forEach(l => l()); }
}

/** Flatten a snapshot into comparable field→value strings (effects, layers, timeline, preset). */
function flatten(s: MotionSnapshot): Record<string, string> {
  const o: Record<string, string> = {};
  o['preset'] = s.model.presetId ?? 'none';
  for (const [k, v] of Object.entries(s.model.effects)) o[`fx.${k}`] = String(v);
  for (const l of s.model.layers) o[`layer.${l.kind}`] = `${l.visible ? 'on' : 'off'}${l.locked ? '·locked' : ''}`;
  for (const t of s.model.timeline) o[`step.${t.id}`] = `${t.effect} ${t.duration}ms ${t.curve}`;
  return o;
}
