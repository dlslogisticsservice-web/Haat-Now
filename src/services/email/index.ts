// Production email infrastructure — public surface.
export * from './types';
export { renderEmail, TEMPLATES, ALL_TEMPLATE_IDS, type TemplateData } from './templates';
export { renderLayout, renderText } from './layout';
export { createResendProvider, getEmailProvider, fallbackProvider, resolveResendConfig, maskEmail } from './resendProvider';
export { EmailQueue, type EmailSender, type QueueSnapshot } from './emailQueue';
export { emailMetrics, type EmailMetricsSnapshot, type EmailCounter } from './emailMetrics';
export { emailMonitoring, type EmailEvent } from './emailMonitoring';
export { emailHealth, type EmailHealth } from './emailHealth';
export { DELIVERABILITY_CHECKLIST, checkDeliverability, deliverabilitySummary, type DeliverabilityItem } from './deliverability';
export { backoffMs, DEFAULT_RETRY, withTimeout, type RetryOptions } from './retry';
export { emailService } from './emailService';
