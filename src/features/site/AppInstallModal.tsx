// ─────────────────────────────────────────────────────────────────────────────
// Website Platform · App Install / Smart Checkout Migration modal (Wave 3, Parts 5/6).
// Renders a fully CONFIGURABLE growth offer (title/body/media/coupon/CTAs) produced by
// the platform (growth engine / checkout migration). Value-based persuasion — NEVER
// forces: "Continue on Website" is always present. Deep-link + resume handled by the
// offer. No lib/supabase import (architecture-guard safe). Reusable by every tenant.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { GlassCard, PrimaryButton, Badge } from './ui/primitives';
import type { MigrationOffer } from '../../website-platform/growth/checkout-migration';

export interface AppInstallModalProps {
  offer: MigrationOffer;
  onContinueApp: (deepLink: string, storeUrl: string | null) => void;
  onContinueWebsite: () => void;
  onDismiss: () => void;
}

export const AppInstallModal: React.FC<AppInstallModalProps> = ({ offer, onContinueApp, onContinueWebsite, onDismiss }) => {
  if (!offer.eligible) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={offer.title}
      onKeyDown={e => { if (e.key === 'Escape') onDismiss(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)', animation: 'wp-in .25s ease both' }}
    >
      <GlassCard style={{ width: 'min(560px, 96vw)', margin: 12, padding: 20, borderRadius: 22 }}>
        {offer.imageUrl && <img src={offer.imageUrl} alt="" style={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: 14, marginBottom: 14 }} loading="lazy" />}
        {offer.couponCode && <Badge tone="promo">Code {offer.couponCode}</Badge>}
        <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-on-surface)', margin: '10px 0 6px' }}>{offer.title}</h2>
        <p style={{ fontSize: 14, color: 'var(--color-on-surface-variant)', marginBottom: 18 }}>{offer.body}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {offer.continueInApp && (
            <PrimaryButton
              variant="primary"
              ariaLabel={offer.continueInApp.label}
              onClick={() => onContinueApp(offer.continueInApp!.deepLink, offer.continueInApp!.storeUrl)}
            >
              {offer.continueInApp.label}
            </PrimaryButton>
          )}
          <PrimaryButton variant="ghost" ariaLabel={offer.continueOnWebsite.label} onClick={onContinueWebsite}>
            {offer.continueOnWebsite.label}
          </PrimaryButton>
        </div>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onDismiss}
          style={{ position: 'absolute', top: 12, insetInlineEnd: 12, background: 'transparent', border: 'none', color: 'var(--color-on-surface-variant)', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}
        >
          ×
        </button>
      </GlassCard>
    </div>
  );
};
