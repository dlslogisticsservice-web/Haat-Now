// ─────────────────────────────────────────────────────────────────────────────
// Guardian · Operations Workspace — snapshot → findings.
//
// Turns the machine-readable snapshot into the SAME OpsFinding shape every panel
// speaks. One translation, so the readiness score, the repair center and the panels
// can never disagree about what is wrong.
//
// PURE. No React, no DOM, no fs.
// ─────────────────────────────────────────────────────────────────────────────
import type { GuardianSnapshot, OpsFinding, JourneyResult, SuiteResult } from './types';

const shortPath = (p: string) => p.replace(/^src\//, '');

/** Architecture facts → findings. */
export function architectureFindings(s: GuardianSnapshot): OpsFinding[] {
  const a = s.architecture;
  const out: OpsFinding[] = [];

  a.circular.forEach((cycle, i) => out.push({
    id: `arch.cycle.${i}`,
    area: 'architecture',
    severity: 'high',
    title: `Circular dependency across ${cycle.length} modules`,
    rootCause: `These modules import each other at runtime, forming a cycle: ${cycle.map(shortPath).join(' → ')} → ${shortPath(cycle[0])}. A cycle makes module init order undefined and can yield undefined imports at runtime.`,
    files: cycle,
    recommendedFix: 'Break the cycle by extracting the shared contract into a leaf module both sides import, or invert one dependency. Type-only imports are erased and do not create cycles — prefer `import type` where the value is not needed.',
    blocker: true,
  }));

  a.layerViolations.forEach((v, i) => out.push({
    id: `arch.layer.${i}`,
    area: 'architecture',
    severity: 'high',
    title: `Layer violation: ${shortPath(v.from)} → ${shortPath(v.to)}`,
    rootCause: `${v.rule}. The import at ${v.from} reaches ${v.to}, crossing a boundary the project enforces in CI.`,
    files: [v.from, v.to],
    recommendedFix: 'Route the access through the layer that owns it (UI → Hooks → Services → Repositories → Supabase) instead of importing across the boundary.',
    blocker: true,
  }));

  a.duplicates.forEach((d, i) => out.push({
    id: `arch.dupe.${i}`,
    area: 'architecture',
    severity: 'medium',
    title: `Duplicate logic in ${d.paths.length} files`,
    rootCause: `These files have byte-identical bodies once comments and imports are stripped: ${d.paths.map(shortPath).join(', ')}. Divergent edits to one copy will silently not apply to the other.`,
    files: d.paths,
    recommendedFix: 'Keep one implementation and import it from the other call sites. Delete the copy — do not "sync" them.',
    blocker: false,
  }));

  if (a.deadCode.length) out.push({
    id: 'arch.dead',
    area: 'architecture',
    severity: 'low',
    title: `${a.deadCode.length} unreferenced file(s)`,
    rootCause: 'No module imports these files and they are not entry points, so they ship (or confuse readers) without being reachable. Note: files reached only dynamically or by config may be false positives.',
    files: a.deadCode.slice(0, 20),
    recommendedFix: 'Confirm each is genuinely unreachable, then delete it. If it is reached dynamically, add it to the discovery entry points so it stops being reported.',
    blocker: false,
  });

  return out;
}

/** Dependency drift vs the committed baseline. */
export function driftFindings(s: GuardianSnapshot): OpsFinding[] {
  if (!s.drift.hasBaseline) return [{
    id: 'arch.drift.nobaseline',
    area: 'architecture',
    severity: 'low',
    title: 'No architecture baseline recorded',
    rootCause: 'docs/guardian/baseline.json does not exist, so drift cannot be measured — the first build writes one.',
    files: ['docs/guardian/baseline.json'],
    recommendedFix: 'Commit the generated baseline so later builds compare against a known-good structure.',
    blocker: false,
  }];
  if (!s.drift.architectureChanged) return [];
  return [{
    id: 'arch.drift',
    area: 'architecture',
    severity: 'medium',
    title: 'Architecture drifted from the recorded baseline',
    rootCause: `The architecture fingerprint changed (${s.drift.summary}). That means the SHAPE of the system moved: a service, route, api, event, permission or env key was added, removed or renamed since the baseline.`,
    files: ['docs/guardian/baseline.json'],
    recommendedFix: 'Review the change. If intended, re-record the baseline in the same commit so the drift signal stays meaningful.',
    blocker: false,
  }];
}

/** Regression suites → findings. A suite that never ran is NOT a pass. */
export function regressionFindings(suites: SuiteResult[]): OpsFinding[] {
  const out: OpsFinding[] = [];
  for (const s of suites) {
    if (!s.recorded) {
      out.push({
        id: `reg.missing.${s.suite}`,
        area: 'regression',
        severity: 'medium',
        title: `${s.suite}: no recorded result`,
        rootCause: `No result file was found for this suite, so its state is unknown. Unknown is not the same as passing — the workspace refuses to imply it passed.`,
        files: [],
        recommendedFix: `Run \`${s.cmd}\` and re-generate the snapshot so the result is recorded.`,
        blocker: false,
      });
      continue;
    }
    if (s.failed > 0) out.push({
      id: `reg.fail.${s.suite}`,
      area: 'regression',
      severity: 'critical',
      title: `${s.suite}: ${s.failed} failing`,
      rootCause: `${s.failed} of ${s.passed + s.failed} checks failed on the last recorded run.`,
      files: [],
      recommendedFix: `Run \`${s.cmd}\` locally and fix the failures before release.`,
      blocker: true,
    });
  }
  return out;
}

/** Navigation inspector → findings. */
export function navigationFindings(s: GuardianSnapshot): OpsFinding[] {
  const out: OpsFinding[] = [];
  if (s.navigation.duplicateRoutes.length) out.push({
    id: 'nav.dupe',
    area: 'navigation',
    severity: 'high',
    title: `${s.navigation.duplicateRoutes.length} duplicate route path(s)`,
    rootCause: `More than one route declares the same path (${s.navigation.duplicateRoutes.join(', ')}). Which one renders depends on match order, so one screen is unreachable.`,
    files: [],
    recommendedFix: 'Remove or re-path the duplicate so each path resolves to exactly one screen.',
    blocker: true,
  });
  if (s.navigation.unreachable.length) out.push({
    id: 'nav.unreachable',
    area: 'navigation',
    severity: 'medium',
    title: `${s.navigation.unreachable.length} route(s) render no feature`,
    rootCause: `These routes are declared but resolve to no feature component: ${s.navigation.unreachable.join(', ')}. Navigating there yields a blank or fallback screen.`,
    files: [],
    recommendedFix: 'Wire each route to its screen, or remove the route declaration.',
    blocker: false,
  });
  return out;
}

/** Journey inspector → findings. */
export function journeyFindings(journeys: JourneyResult[]): OpsFinding[] {
  return journeys
    .filter(j => j.status !== 'passing')
    .map(j => ({
      id: `journey.${j.role}`,
      area: 'journey' as const,
      severity: (j.status === 'failing' ? 'critical' : 'medium') as OpsFinding['severity'],
      title: `${j.role} journey: ${j.status === 'failing' ? 'BROKEN' : 'not verified'}`,
      rootCause: j.status === 'failing'
        ? `The ${j.role} journey (${j.journey}) failed on its last recorded run. ${j.evidence}`
        : `No automated suite proves the ${j.role} journey (${j.journey}). ${j.evidence}`,
      files: [],
      recommendedFix: j.status === 'failing'
        ? 'Fix the failing step, then re-run the suite that covers this role.'
        : `Add coverage for this journey to an existing runner (docs/testing/*), then re-generate the snapshot.`,
      blocker: j.status === 'failing',
    }));
}

/**
 * A captured runtime signal. Declared structurally on purpose: the Guardian library must
 * not import from src/services (its own layer rule forbids it), and monitoring's
 * MonitorEvent satisfies this shape, so the seam stays the single source of events.
 */
export interface RuntimeSignal {
  kind: 'error' | 'log' | 'event';
  level?: string;
  message: string;
  stack?: string;
  at: string;
  source?: string;
}

const RUNTIME_RULES: { source: string; title: string; severity: OpsFinding['severity']; blocker: boolean; fix: string }[] = [
  { source: 'react', title: 'React / uncaught runtime errors', severity: 'critical', blocker: true, fix: 'Open the stack trace, reproduce the render path, and fix the throwing component. An uncaught error unmounts the tree for the user.' },
  { source: 'api', title: 'API failures', severity: 'high', blocker: false, fix: 'Inspect the failing endpoint and status. Handle the error path in the caller and confirm the request shape/permissions.' },
  { source: 'network', title: 'Network failures', severity: 'high', blocker: false, fix: 'Check connectivity, CORS and the URL. A network fault must degrade gracefully, never blank the screen.' },
  { source: 'console', title: 'Console errors / warnings', severity: 'medium', blocker: false, fix: 'Resolve the underlying warning (React keys, prop types, deprecated APIs) rather than silencing it.' },
  { source: 'performance', title: 'Performance warnings', severity: 'low', blocker: false, fix: 'Break up or defer the long task so it stops blocking the main thread.' },
];

/** Live runtime signals → findings, grouped by source (one finding per source, not per event). */
export function runtimeFindings(signals: RuntimeSignal[]): OpsFinding[] {
  const out: OpsFinding[] = [];
  for (const rule of RUNTIME_RULES) {
    const hits = signals.filter(s => s.source === rule.source && (s.kind === 'error' || s.level === 'error' || s.level === 'warn'));
    if (!hits.length) continue;
    const files = [...new Set(hits.flatMap(h => (h.stack || '').match(/\/src\/[\w./-]+/g) || []))].slice(0, 8);
    out.push({
      id: `runtime.${rule.source}`,
      area: 'runtime',
      severity: rule.severity,
      title: `${rule.title} (${hits.length})`,
      rootCause: `${hits.length} signal(s) captured this session. Most recent: "${hits[0].message}".`,
      files,
      recommendedFix: rule.fix,
      blocker: rule.blocker,
    });
  }
  return out;
}

/**
 * Authentication health. Declared structurally (the Guardian library must not import
 * registry/config/monitoring): the workspace resolves the provider status + runtime
 * auth-error counts and passes this plain shape in.
 */
export interface AuthHealthInput {
  status: 'active' | 'demo' | 'not-configured';
  isProduction: boolean;
  vendor?: string;
  /** `[auth] send_failed` signals captured this session (SMS delivery). */
  sendFailures: number;
  /** `[auth] verify_failed` signals captured this session (OTP verification). */
  verifyFailures: number;
  /** Env keys still required for auth to be production-ready. */
  requires: string[];
}

export function authFindings(a: AuthHealthInput): OpsFinding[] {
  const out: OpsFinding[] = [];

  if (a.isProduction && a.status === 'demo') {
    out.push({
      id: 'auth.demo-in-prod', area: 'runtime', severity: 'critical',
      title: 'Demo authentication active in a production build',
      rootCause: 'The auth provider is answering with demo OTP (123456) in a production data build. Real users could not sign in, and a fixed code is not a credential.',
      files: ['src/config/runtime.ts', 'src/services/auth.service.ts'],
      recommendedFix: 'Ship the production build (VITE_AUTH_MODE=supabase / HAAT_LIVE_BACKEND=1).',
      blocker: true,
    });
  }
  if (a.isProduction && a.status === 'not-configured') {
    out.push({
      id: 'auth.not-configured', area: 'runtime', severity: 'high',
      title: 'Authentication provider not production-ready',
      rootCause: `Real phone OTP needs a declared SMS vendor so the server can deliver the code. Missing: ${a.requires.join(', ') || 'VITE_SMS_PROVIDER'}. Without it, no user can log in.`,
      files: ['src/providers/registry.ts'],
      recommendedFix: 'Declare the SMS vendor (VITE_SMS_PROVIDER=<vendor>) and configure its secret in the Supabase project (server-side).',
      blocker: true,
    });
  }
  if (a.sendFailures > 0) {
    out.push({
      id: 'auth.sms-delivery', area: 'runtime', severity: 'high',
      title: `SMS delivery failures (${a.sendFailures})`,
      rootCause: `${a.sendFailures} OTP send(s) failed this session${a.vendor ? ` via ${a.vendor}` : ''}. The SMS vendor rejected or could not deliver the message.`,
      files: ['src/services/auth.service.ts'],
      recommendedFix: 'Check the SMS vendor credentials/balance/sender-id in the Supabase Auth settings, and the destination number format.',
      blocker: false,
    });
  }
  if (a.verifyFailures > 0) {
    out.push({
      id: 'auth.otp-verify', area: 'runtime', severity: 'low',
      title: `OTP verification failures (${a.verifyFailures})`,
      rootCause: `${a.verifyFailures} code(s) were rejected this session. Often a user mistype; a sustained rate can indicate delivery latency or a wrong sender.`,
      files: ['src/services/auth.service.ts'],
      recommendedFix: 'If elevated, confirm OTP delivery timing and that the code length/format matches the vendor template.',
      blocker: false,
    });
  }
  return out;
}

/**
 * Location & maps health. Structural input (Guardian must not import registry/monitoring):
 * the workspace resolves provider status + runtime counts and passes this plain shape.
 */
export interface LocationHealthInput {
  /** The device coordinate source (browser geolocation) is available. */
  locationActive: boolean;
  mapsStatus: 'active' | 'demo' | 'not-configured';
  isProduction: boolean;
  mapsVendor?: string;
  /** `[location] update_failed` signals — driver position pushes that failed. */
  updateFailures: number;
  /** `[location] permission_denied` signals — the user declined location. */
  permissionFailures: number;
  /** `[location] slow_update` signals — the live stream slowed or stalled. */
  trackingInterruptions: number;
}

export function locationFindings(l: LocationHealthInput): OpsFinding[] {
  const out: OpsFinding[] = [];

  if (!l.locationActive) {
    out.push({
      id: 'location.no-source', area: 'runtime', severity: 'high',
      title: 'Device location source unavailable',
      rootCause: 'Browser geolocation is not available, so live driver tracking and nearest-branch cannot function.',
      files: ['src/providers/registry.ts'],
      recommendedFix: 'Confirm the app runs in a secure (HTTPS) context where the Geolocation API is exposed.',
      blocker: true,
    });
  }
  if (l.isProduction && l.mapsStatus === 'not-configured') {
    out.push({
      id: 'location.maps-not-configured', area: 'runtime', severity: 'medium',
      title: 'Maps vendor not configured (geocoding/routing unavailable)',
      // Non-blocking on purpose: the core COD flow uses stored branch coordinates and the
      // pure ETA calc. Address search and drawn routes degrade until a vendor is declared.
      rootCause: 'No VITE_MAPS_PROVIDER is declared, so address↔coordinate geocoding and vendor routes are unavailable. Distance/ETA still work via the built-in calculation.',
      files: ['src/providers/registry.ts'],
      recommendedFix: 'Declare the maps vendor (VITE_MAPS_PROVIDER=<vendor>) and deploy the server-side geocoding function.',
      blocker: false,
    });
  }
  if (l.updateFailures > 0) {
    out.push({
      id: 'location.update-failures', area: 'runtime', severity: 'high',
      title: `Driver location update failures (${l.updateFailures})`,
      rootCause: `${l.updateFailures} driver position push(es) failed this session — live tracking would show a stale or missing driver.`,
      files: ['src/features/driver/DriverApp.tsx', 'src/services/tracking.service.ts'],
      recommendedFix: 'Check the driver_locations write path and connectivity; confirm the tracking policy is emitting fixes.',
      blocker: false,
    });
  }
  if (l.trackingInterruptions > 0) {
    out.push({
      id: 'location.tracking-interrupted', area: 'runtime', severity: 'low',
      title: `Tracking interruptions (${l.trackingInterruptions})`,
      rootCause: `${l.trackingInterruptions} slow/stalled update(s) — GPS signal loss or a backgrounded tab. Last-known position is shown meanwhile.`,
      files: ['src/services/tracking-policy.ts'],
      recommendedFix: 'Expected on poor signal; if sustained, review the update interval and background-tracking behaviour.',
      blocker: false,
    });
  }
  if (l.permissionFailures > 0) {
    out.push({
      id: 'location.permission', area: 'runtime', severity: 'low',
      title: `Location permission denials (${l.permissionFailures})`,
      rootCause: `${l.permissionFailures} user(s) declined location. Not a platform fault — consent is respected and the flow degrades gracefully.`,
      files: ['src/features/driver/DriverApp.tsx'],
      recommendedFix: 'No fix required unless the rate is unexpectedly high; then review the permission prompt timing/UX.',
      blocker: false,
    });
  }
  return out;
}

/**
 * Notification platform health. Structural input (Guardian must not import
 * registry/monitoring/services): the workspace resolves provider status + runtime counts
 * + queue stats and passes this plain shape.
 */
export interface NotificationHealthInput {
  /** In-app is live (stored + realtime). This is the always-available channel. */
  inAppActive: boolean;
  pushStatus: 'active' | 'demo' | 'not-configured';
  isProduction: boolean;
  pushVendor?: string;
  /** `[notify] delivery_failed` signals captured this session. */
  deliveryFailures: number;
  /** Messages retrying right now (transient failures). */
  retrying: number;
  /** Failed + expired — never reached the user. */
  dropped: number;
  /** Active backlog awaiting delivery. */
  backlog: number;
}

export function notificationFindings(n: NotificationHealthInput): OpsFinding[] {
  const out: OpsFinding[] = [];

  if (!n.inAppActive) {
    out.push({
      id: 'notify.inapp-down', area: 'runtime', severity: 'high',
      title: 'In-app notification channel unavailable',
      rootCause: 'The in-app channel (notification.service) is not answering, so users receive no notifications at all — it is the always-on fallback for push.',
      files: ['src/services/notification.service.ts'],
      recommendedFix: 'Check the notifications repository/table and realtime subscription.',
      blocker: true,
    });
  }
  if (n.isProduction && n.pushStatus === 'not-configured') {
    out.push({
      id: 'notify.push-not-configured', area: 'runtime', severity: 'medium',
      // Non-blocking: in-app still delivers. Push is an enhancement (background reach).
      title: 'Push vendor not configured (device push unavailable)',
      rootCause: 'No VITE_PUSH_PROVIDER is declared, so background/device push cannot be sent. In-app notifications still work; users just do not get pushes when the app is closed.',
      files: ['src/providers/registry.ts'],
      recommendedFix: 'Declare the push vendor (VITE_PUSH_PROVIDER=<vendor>) and deploy the server-side fan-out function.',
      blocker: false,
    });
  }
  if (n.deliveryFailures > 0) {
    out.push({
      id: 'notify.delivery-failures', area: 'runtime', severity: 'high',
      title: `Notification delivery failures (${n.deliveryFailures})`,
      rootCause: `${n.deliveryFailures} in-app send(s) failed this session — those users did not receive the message.`,
      files: ['src/services/notification.service.ts'],
      recommendedFix: 'Inspect the notifications write path and permissions; confirm the target user id and payload.',
      blocker: false,
    });
  }
  if (n.dropped > 0) {
    out.push({
      id: 'notify.dropped', area: 'runtime', severity: 'medium',
      title: `Dropped notifications (${n.dropped})`,
      rootCause: `${n.dropped} message(s) reached a terminal failed/expired state after exhausting retries or their TTL — they never reached the user.`,
      files: ['src/services/delivery-policy.ts'],
      recommendedFix: 'Review the retry strategy and provider errors; a sustained drop rate indicates a provider outage.',
      blocker: false,
    });
  }
  if (n.backlog > 0) {
    out.push({
      id: 'notify.backlog', area: 'runtime', severity: 'low',
      title: `Delivery backlog (${n.backlog})`,
      rootCause: `${n.backlog} message(s) are queued/retrying. A small transient backlog is normal; a growing one indicates the delivery worker is behind.`,
      files: ['src/services/delivery-policy.ts'],
      recommendedFix: 'Expected transiently; if sustained, scale or unblock the delivery worker.',
      blocker: false,
    });
  }
  return out;
}

/**
 * Payment platform health. Structural input (Guardian must not import
 * registry/services): the workspace resolves gateway status + runtime counts + reconcile
 * stats and passes this plain shape. COD is the launch method and always available, which
 * is why a missing card gateway is NOT a launch blocker here.
 */
export interface PaymentHealthInput {
  /** COD is wired end-to-end (the launch payment method). */
  codAvailable: boolean;
  gatewayStatus: 'active' | 'demo' | 'not-configured';
  isProduction: boolean;
  gatewayVendor?: string;
  /** `[payment] gateway_failed` signals captured this session. */
  gatewayFailures: number;
  /** `[payment] cod_ledger_failed` signals — COD accepted but its ledger row failed. */
  codLedgerFailures: number;
  /** Payments pending past the stuck threshold (from reconcileStats). */
  stuck: number;
}

export function paymentFindings(p: PaymentHealthInput): OpsFinding[] {
  const out: OpsFinding[] = [];

  if (!p.codAvailable) {
    out.push({
      id: 'payment.no-method', area: 'runtime', severity: 'critical',
      title: 'No payment method available',
      rootCause: 'COD is not available and no card gateway is active, so an order cannot be paid at all — checkout cannot complete.',
      files: ['src/services/payment-orchestrator.service.ts'],
      recommendedFix: 'Restore COD (the launch method) or configure a card gateway.',
      blocker: true,
    });
  }
  if (p.isProduction && p.gatewayStatus === 'not-configured') {
    out.push({
      id: 'payment.gateway-not-configured', area: 'runtime', severity: 'medium',
      // Non-blocking: COD launches without a gateway. Card payment is the enhancement.
      title: 'Card gateway not configured (COD-only)',
      rootCause: 'No VITE_PAYMENT_PROVIDER is declared, so card payment is unavailable. Checkout still works via Cash on Delivery.',
      files: ['src/providers/registry.ts'],
      recommendedFix: 'Declare the gateway (VITE_PAYMENT_PROVIDER=<vendor>) and configure its secret in the payment-initiate edge function (server-side).',
      blocker: false,
    });
  }
  if (p.gatewayFailures > 0) {
    out.push({
      id: 'payment.gateway-failures', area: 'runtime', severity: 'high',
      title: `Card gateway failures (${p.gatewayFailures})`,
      rootCause: `${p.gatewayFailures} charge attempt(s) were rejected by the gateway this session — those orders were not paid by card.`,
      files: ['src/services/payment-orchestrator.service.ts'],
      recommendedFix: 'Check gateway credentials/status and the payment-initiate edge function logs; the customer can fall back to COD.',
      blocker: false,
    });
  }
  if (p.stuck > 0) {
    out.push({
      id: 'payment.stuck', area: 'runtime', severity: 'high',
      title: `Stuck payments awaiting reconciliation (${p.stuck})`,
      rootCause: `${p.stuck} payment(s) have been pending past the reconciliation threshold — the gateway result never came back, so the order's paid state is unresolved.`,
      files: ['src/services/payment-policy.ts', 'src/services/payment-orchestrator.service.ts'],
      recommendedFix: 'Run reconciliation against the gateway to settle or fail each stuck payment; never assume paid.',
      blocker: false,
    });
  }
  if (p.codLedgerFailures > 0) {
    out.push({
      id: 'payment.cod-ledger', area: 'runtime', severity: 'medium',
      title: `COD ledger write failures (${p.codLedgerFailures})`,
      rootCause: `${p.codLedgerFailures} COD order(s) were accepted but their payment_attempts ledger row failed to write — reporting/receipts may be incomplete though the order proceeds.`,
      files: ['src/services/payment-orchestrator.service.ts'],
      recommendedFix: 'Check the payment_attempts write path; backfill the missing COD ledger rows.',
      blocker: false,
    });
  }
  return out;
}

/**
 * Transactional email health. Structural input (Guardian must not import
 * registry/services): the workspace resolves vendor status + runtime counts + queue stats
 * and passes this plain shape. Email is an ENHANCEMENT channel — its absence never blocks
 * launch (in-app/SMS still reach users), so nothing here is a blocker except a template
 * that cannot render (which would mean sending a broken message).
 */
export interface EmailHealthInput {
  vendorStatus: 'active' | 'demo' | 'not-configured';
  isProduction: boolean;
  vendor?: string;
  /** `[email] send_failed` signals captured this session. */
  deliveryFailures: number;
  /** `[email] template_failed` — a template could not render (missing/unknown). */
  templateFailures: number;
  /** `[email] bounce` signals — hard/soft bounces. */
  bounces: number;
  /** Emails retrying now. */
  retrying: number;
  /** Active backlog awaiting a terminal state. */
  backlog: number;
}

export function emailFindings(e: EmailHealthInput): OpsFinding[] {
  const out: OpsFinding[] = [];

  if (e.templateFailures > 0) {
    out.push({
      id: 'email.template-failures', area: 'runtime', severity: 'high',
      // The one email blocker: a template that will not render means the message goes out
      // blank (or not at all). That is a defect, not a config gap.
      title: `Email template rendering failures (${e.templateFailures})`,
      rootCause: `${e.templateFailures} email(s) had a missing/unknown template or unfilled variables — renderEmail() refused to produce a sendable message.`,
      files: ['src/services/email-templates.ts', 'src/services/comms-templates.ts'],
      recommendedFix: 'Supply every declared variable for the template, or add the missing template key. Never send a partially-rendered email.',
      blocker: true,
    });
  }
  if (e.isProduction && e.vendorStatus === 'not-configured') {
    out.push({
      id: 'email.not-configured', area: 'runtime', severity: 'medium',
      // Non-blocking: email is an enhancement channel. In-app/SMS still reach users.
      title: 'Email vendor not configured',
      rootCause: 'No VITE_EMAIL_PROVIDER is declared, so transactional email cannot be sent. Other channels (in-app, SMS) are unaffected.',
      files: ['src/providers/registry.ts'],
      recommendedFix: 'Declare the email vendor (VITE_EMAIL_PROVIDER=<vendor>) and configure its API key in the server-side send function.',
      blocker: false,
    });
  }
  if (e.deliveryFailures > 0) {
    out.push({
      id: 'email.delivery-failures', area: 'runtime', severity: 'high',
      title: `Email delivery failures (${e.deliveryFailures})`,
      rootCause: `${e.deliveryFailures} email(s) failed to send this session — the provider rejected or could not accept them.`,
      files: ['src/services/email-policy.ts'],
      recommendedFix: 'Check the email vendor status/credentials and the server-side send function logs.',
      blocker: false,
    });
  }
  if (e.bounces > 0) {
    out.push({
      id: 'email.bounces', area: 'runtime', severity: 'medium',
      title: `Email bounces (${e.bounces})`,
      rootCause: `${e.bounces} email(s) bounced. Hard bounces (dead mailboxes) are terminal and must not be retried; a rising bounce rate hurts sender reputation.`,
      files: ['src/services/email-policy.ts'],
      recommendedFix: 'Suppress hard-bounced addresses; verify address collection. Investigate if the soft-bounce rate is sustained.',
      blocker: false,
    });
  }
  if (e.backlog > 0) {
    out.push({
      id: 'email.backlog', area: 'runtime', severity: 'low',
      title: `Email queue backlog (${e.backlog})`,
      rootCause: `${e.backlog} email(s) are queued/sending/retrying. A small transient backlog is normal; a growing one means the send worker is behind.`,
      files: ['src/services/email-policy.ts'],
      recommendedFix: 'Expected transiently; if sustained, scale or unblock the email send worker.',
      blocker: false,
    });
  }
  return out;
}

/** Everything the snapshot can prove, in one list. */
export function snapshotFindings(s: GuardianSnapshot): OpsFinding[] {
  return [
    ...architectureFindings(s),
    ...driftFindings(s),
    ...regressionFindings(s.suites),
    ...navigationFindings(s),
    ...journeyFindings(s.journeys),
  ];
}

const RANK: Record<OpsFinding['severity'], number> = { critical: 0, high: 1, medium: 2, low: 3 };
export const bySeverity = (a: OpsFinding, b: OpsFinding): number => RANK[a.severity] - RANK[b.severity];
