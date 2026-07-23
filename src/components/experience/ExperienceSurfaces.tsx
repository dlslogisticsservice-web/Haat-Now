// ─────────────────────────────────────────────────────────────────────────────
// Experience surfaces — the shared, presentational pieces every product screen uses to render
// an Experience Runtime decision (Waves 1–18).
//
// Written ONCE and reused by the Customer app, Merchant portal, Driver portal and Website, so a
// flag/experiment/audience decision looks and behaves identically everywhere. These are dumb
// components: they take an already-resolved decision, they never call the engine themselves.
//
// Premium by default: glass surfaces, reduced-motion-safe entrance, full RTL/LTR via logical
// properties, dark-mode via theme tokens, and real accessibility semantics.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Sparkles, X } from 'lucide-react';
import type { DecisionContext, InteractionSignals } from '../../experience-engine';
import { trackExperienceRendered, trackExperienceDismissed, trackExperienceClicked } from '../../services/experience-platform.service';

/**
 * Wave 19 · telemetry is emitted HERE, once, for every surface. Because the Customer, Merchant,
 * Driver and Website screens all render through these components, they get rendered/dismissed/
 * clicked events automatically — no product screen builds an event by hand.
 */
export interface SurfaceTelemetry {
  /** The decision this surface was rendered from. Omit to opt a surface out of telemetry. */
  decision?: DecisionContext;
  /** Stable id of the experience being shown (e.g. 'flag.customer_welcome'). */
  experienceId?: string;
  surface?: string;
  /**
   * Wave 20.1 · what this surface is ABOUT — category, merchant, campaign, offer, cuisine, store
   * type. These feed the visitor's interest profile, so a surface that knows its subject should
   * say so. Every field is optional and only supplied signals are recorded: the platform never
   * invents a signal a surface did not declare.
   */
  signals?: InteractionSignals;
}

function useSurfaceTelemetry({ decision, experienceId, surface, signals }: SurfaceTelemetry) {
  // Signals are compared by value so a caller passing an inline object literal (the normal case)
  // does not re-fire the render event on every parent render.
  const signalKey = signals ? JSON.stringify(signals) : '';
  useEffect(() => {
    if (!decision || !experienceId) return;
    try { trackExperienceRendered(decision, experienceId, surface, signals); } catch { /* telemetry must never break a render */ }
    // Emit once per mounted experience.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decision?.identity.visitorId, experienceId, surface, signalKey]);

  return {
    onDismiss: () => { if (decision && experienceId) { try { trackExperienceDismissed(decision, experienceId, surface, signals); } catch { /* ignore */ } } },
    onClick: (element?: string) => { if (decision && experienceId) { try { trackExperienceClicked(decision, experienceId, element, surface, signals); } catch { /* ignore */ } } },
  };
}

const ACCENT = 'var(--color-primary-fixed, #a3f95b)';
const ON_ACCENT = 'var(--color-on-primary-fixed, #0c2000)';

/** One shared entrance animation, injected once, respecting prefers-reduced-motion. */
export const ExperienceKeyframes: React.FC = () => (
  <style>{`
@keyframes xpRise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.xp-rise{animation:xpRise .5s cubic-bezier(.4,0,.2,1) both}
@media (prefers-reduced-motion: reduce){.xp-rise{animation:none}}
.xp-surface{background:var(--color-surface-container,#15181a);border:1px solid var(--color-outline-variant,#2c3230);border-radius:16px}
`}</style>
);

export interface ExperienceBannerProps extends SurfaceTelemetry {
  title: string;
  body?: string;
  Icon?: LucideIcon;
  /** Experiment arm driving the treatment, when this banner is under test. */
  variant?: string | null;
  ctaLabel?: string;
  onCta?: () => void;
  onDismiss?: () => void;
  /** Shown to operators in non-production so the decision is visible while testing. */
  debugLabel?: string;
}

/**
 * A greeting / announcement banner. When an experiment supplies a variant, the `warm`/`highlight`
 * arms get the emphasised treatment — the visible difference an experiment is measuring.
 */
export const ExperienceBanner: React.FC<ExperienceBannerProps> = ({
  title, body, Icon = Sparkles, variant, ctaLabel, onCta, onDismiss, debugLabel,
  decision, experienceId, surface, signals,
}) => {
  const emphasised = variant === 'warm' || variant === 'highlight';
  const telemetry = useSurfaceTelemetry({ decision, experienceId, surface, signals });
  return (
    <section
      className="xp-rise xp-surface"
      aria-label={title}
      style={{
        padding: 16, display: 'flex', gap: 14, alignItems: 'flex-start', position: 'relative',
        background: emphasised
          ? `linear-gradient(135deg, color-mix(in srgb, ${ACCENT} 18%, var(--color-surface-container,#15181a)), var(--color-surface-container,#15181a))`
          : undefined,
        borderColor: emphasised ? `color-mix(in srgb, ${ACCENT} 45%, transparent)` : undefined,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 40, height: 40, borderRadius: 12, flexShrink: 0, display: 'grid', placeItems: 'center',
          background: emphasised ? ACCENT : 'var(--color-surface-container-high,#1e2422)',
          color: emphasised ? ON_ACCENT : ACCENT,
        }}
      >
        <Icon size={20} />
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'var(--color-on-surface,#e8ebe3)' }}>{title}</h3>
        {body && <p style={{ margin: '4px 0 0', fontSize: 13, lineHeight: 1.5, color: 'var(--color-on-surface-variant,#a7b0a6)' }}>{body}</p>}
        {ctaLabel && onCta && (
          <button
            type="button"
            onClick={() => { telemetry.onClick('cta'); onCta(); }}
            style={{
              marginTop: 12, padding: '9px 16px', borderRadius: 11, border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 800, background: ACCENT, color: ON_ACCENT,
            }}
          >
            {ctaLabel}
          </button>
        )}
        {debugLabel && (
          <div style={{ marginTop: 10, fontSize: 10, letterSpacing: .3, color: 'var(--color-on-surface-variant,#a7b0a6)', opacity: .75 }}>
            {debugLabel}
          </div>
        )}
      </div>

      {onDismiss && (
        <button
          type="button" onClick={() => { telemetry.onDismiss(); onDismiss(); }} aria-label="Dismiss"
          style={{
            width: 30, height: 30, borderRadius: 9, border: 'none', cursor: 'pointer', flexShrink: 0,
            background: 'var(--color-surface-container-high,#1e2422)', color: 'var(--color-on-surface-variant,#a7b0a6)',
            display: 'grid', placeItems: 'center',
          }}
        >
          <X size={15} />
        </button>
      )}
    </section>
  );
};

/** A compact "this is in beta / rolling out" badge for portal features behind a flag. */
export const BetaBadge: React.FC<{ label: string; tone?: 'beta' | 'rollout' }> = ({ label, tone = 'beta' }) => {
  const color = tone === 'rollout' ? '#38bdf8' : ACCENT;
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999,
        fontSize: 10, fontWeight: 800, letterSpacing: .4, textTransform: 'uppercase',
        background: `color-mix(in srgb, ${color} 16%, transparent)`, color,
        border: `1px solid color-mix(in srgb, ${color} 40%, transparent)`,
      }}
    >
      <Sparkles size={11} aria-hidden /> {label}
    </span>
  );
};

/** A lightweight feature-discovery hint (first-run education), dismissible and a11y-friendly. */
export const ExperienceHint: React.FC<{ text: string; onDismiss?: () => void } & SurfaceTelemetry> = ({ text, onDismiss, decision, experienceId, surface, signals }) => {
  const telemetry = useSurfaceTelemetry({ decision, experienceId, surface, signals });
  return (
  <div
    role="status"
    className="xp-rise"
    style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 999,
      background: `color-mix(in srgb, ${ACCENT} 12%, var(--color-surface-container,#15181a))`,
      border: `1px solid color-mix(in srgb, ${ACCENT} 30%, transparent)`,
      fontSize: 12.5, color: 'var(--color-on-surface,#e8ebe3)',
    }}
  >
    <Sparkles size={14} color={ACCENT} aria-hidden />
    <span style={{ flex: 1 }}>{text}</span>
    {onDismiss && (
      <button type="button" onClick={() => { telemetry.onDismiss(); onDismiss(); }} aria-label="Dismiss hint"
        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-on-surface-variant,#a7b0a6)', display: 'grid', placeItems: 'center' }}>
        <X size={14} />
      </button>
    )}
  </div>
  );
};

/** Skeleton used while a surface waits for its data — keeps layout stable, no spinner jank. */
export const ExperienceSkeleton: React.FC<{ lines?: number }> = ({ lines = 2 }) => (
  <div className="xp-surface" aria-hidden style={{ padding: 16, display: 'grid', gap: 10 }}>
    {Array.from({ length: lines }, (_, i) => (
      <div key={i} style={{ height: 12, borderRadius: 999, background: 'var(--color-surface-container-high,#1e2422)', width: i === lines - 1 ? '55%' : '100%' }} />
    ))}
  </div>
);
