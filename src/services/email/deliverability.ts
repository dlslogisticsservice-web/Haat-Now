// ─────────────────────────────────────────────────────────────────────────────
// Deliverability checklist. The canonical list of what must be true for production
// email to reach the inbox. DNS-level items are verified in the DNS provider (the
// runbook has the exact records); this module reports the platform-side readiness and
// surfaces the full checklist so a health probe / dashboard can render it.
// ─────────────────────────────────────────────────────────────────────────────
export type CheckStatus = 'ok' | 'action_required' | 'manual';
export type CheckOwner = 'dns' | 'provider' | 'ops';

export interface DeliverabilityItem {
  id: string;
  name: string;
  owner: CheckOwner;
  required: boolean;
  instructions: string;
}

export const DELIVERABILITY_CHECKLIST: DeliverabilityItem[] = [
  { id: 'domain_verification', name: 'Domain verification', owner: 'provider', required: true, instructions: 'Verify mail.haatnow.app in Resend and confirm status = verified.' },
  { id: 'spf', name: 'SPF', owner: 'dns', required: true, instructions: 'TXT on the sending domain: v=spf1 include:resend.com ~all' },
  { id: 'dkim', name: 'DKIM', owner: 'dns', required: true, instructions: 'Add the CNAME/TXT DKIM records Resend generates (resend._domainkey…).' },
  { id: 'dmarc', name: 'DMARC', owner: 'dns', required: true, instructions: 'TXT _dmarc.haatnow.app: v=DMARC1; p=none; rua=mailto:dmarc@haatnow.app (tighten to quarantine/reject later).' },
  { id: 'return_path', name: 'Return-Path (bounce alignment)', owner: 'dns', required: true, instructions: 'Add the Resend return-path/MX-from record so bounces align with the domain.' },
  { id: 'dns_records', name: 'DNS records propagated', owner: 'dns', required: true, instructions: 'Confirm all records resolve (dig/mxtoolbox) and Resend shows them verified.' },
  { id: 'bounce_handling', name: 'Bounce handling', owner: 'ops', required: true, instructions: 'Enable the Resend bounce webhook → emailMonitoring; auto-suppress hard bounces.' },
  { id: 'complaint_handling', name: 'Complaint handling', owner: 'ops', required: true, instructions: 'Enable the Resend complaint (spam) webhook → suppress + alert.' },
  { id: 'suppression_list', name: 'Suppression list', owner: 'ops', required: true, instructions: 'Maintain a suppression list (hard bounces + complaints) checked before send.' },
];

export interface DeliverabilityResult {
  item: DeliverabilityItem;
  status: CheckStatus;
  detail: string;
}

export interface DeliverabilityEnv {
  sendingDomainConfigured: boolean; // EMAIL_FROM / EMAIL_SENDING_DOMAIN present
  providerConfigured: boolean;      // RESEND_API_KEY present
}

/**
 * Report readiness. Platform-side prerequisites (provider/from configured) are checked
 * here; DNS + webhook items are operator actions and reported as manual until confirmed.
 */
export function checkDeliverability(env: DeliverabilityEnv): DeliverabilityResult[] {
  return DELIVERABILITY_CHECKLIST.map((item): DeliverabilityResult => {
    if (item.id === 'domain_verification') {
      return env.providerConfigured && env.sendingDomainConfigured
        ? { item, status: 'action_required', detail: 'Provider + from set; confirm domain shows verified in Resend.' }
        : { item, status: 'action_required', detail: 'Set RESEND_API_KEY + EMAIL_FROM, then verify the domain in Resend.' };
    }
    // DNS + ops items cannot be verified from the app; they are operator-confirmed.
    return { item, status: 'manual', detail: item.instructions };
  });
}

/** Compact readiness summary for a health probe. */
export function deliverabilitySummary(env: DeliverabilityEnv): { total: number; manual: number; actionRequired: number; ok: number } {
  const r = checkDeliverability(env);
  return {
    total: r.length,
    manual: r.filter(x => x.status === 'manual').length,
    actionRequired: r.filter(x => x.status === 'action_required').length,
    ok: r.filter(x => x.status === 'ok').length,
  };
}
