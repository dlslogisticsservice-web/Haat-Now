// ─────────────────────────────────────────────────────────────────────────────
// Guardian · AI Repair Center — one structured repair packet per finding.
//
// NO AI is called from here, by design (Guardian never auto-applies production
// changes — docs/launch-guardian/*). This module only PREPARES the request: root
// cause, files, severity, recommended fix, and a ready-to-send prompt that a human
// copies. The decision, and the diff, stay with the engineer.
//
// PURE. No React, no DOM, no fs, no network.
// ─────────────────────────────────────────────────────────────────────────────
import type { OpsFinding, Severity } from './types';

export interface RepairPacket {
  id: string;
  severity: Severity;
  title: string;
  rootCause: string;
  files: string[];
  recommendedFix: string;
  /** Copy-paste ready. Self-contained: an engineer can send it with no extra context. */
  prompt: string;
}

export interface RepairContext {
  sha?: string;
  env?: string;
  builtAt?: string;
}

/** House rules every generated prompt must carry — they mirror the repo's own constraints. */
const RULES = [
  'Provide the MINIMAL patch that fixes the root cause. Do NOT refactor unrelated code.',
  'Do NOT redesign the UI. Do NOT duplicate an existing service, hook or component — search first and reuse.',
  'Respect the enforced layering: UI → Hooks → Services → Repositories → Supabase. Feature code must never import lib/supabase directly.',
  'Fabricated demo content may render ONLY behind DEMO_CONTENT_ENABLED (src/config/runtime.ts).',
  'Return a unified diff touching the fewest files, preceded by a 2-line root-cause explanation.',
];

export function buildRepairPacket(f: OpsFinding, ctx: RepairContext = {}): RepairPacket {
  const build = [
    ctx.sha ? `commit ${ctx.sha}` : null,
    ctx.env ? `env ${ctx.env}` : null,
    ctx.builtAt ? `built ${ctx.builtAt}` : null,
  ].filter(Boolean).join(' · ');

  const prompt = [
    'You are fixing one defect in HAAT NOW (React 19 + Vite 6 + Tailwind v4 + TypeScript).',
    'Note: this repo has NO strictNullChecks — discriminated unions do not narrow via `if (r.ok)`; use the isOk/isErr type-predicate guards the codebase already defines.',
    '',
    `## Defect (${f.severity}${f.blocker ? ' · LAUNCH BLOCKER' : ''})`,
    f.title,
    '',
    '## Root cause',
    f.rootCause,
    '',
    '## Files involved',
    f.files.length ? f.files.map(x => `- ${x}`).join('\n') : '- not attributable to specific files from this signal; locate them from the root cause above',
    '',
    '## Recommended fix',
    f.recommendedFix,
    '',
    ...(build ? ['## Build', build, ''] : []),
    '## Rules',
    ...RULES.map(r => `- ${r}`),
    '',
    '## Verify',
    'Before claiming done: run `npm run lint` (tsc + architecture guard + demo-isolation guard) and `npm run test:website`.',
  ].join('\n');

  return {
    id: f.id,
    severity: f.severity,
    title: f.title,
    rootCause: f.rootCause,
    files: f.files,
    recommendedFix: f.recommendedFix,
    prompt,
  };
}

/** One packet per finding, worst first. */
export function buildRepairPackets(findings: OpsFinding[], ctx: RepairContext = {}): RepairPacket[] {
  const rank: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  return [...findings]
    .sort((a, b) => rank[a.severity] - rank[b.severity])
    .map(f => buildRepairPacket(f, ctx));
}
