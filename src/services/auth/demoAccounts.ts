// ─────────────────────────────────────────────────────────────────────────────
// Sandbox demo roster — the self-contained demo build ONLY (VITE_AUTH_MODE=sandbox).
// Channel-agnostic: each identity carries BOTH an email and a phone, so the same
// account logs in through the email provider (current) or the phone provider (future)
// with the fixed demo code. UUID ids are valid so uuid-typed queries never 22P02.
// NEVER used in a live (supabase) build.
// ─────────────────────────────────────────────────────────────────────────────
import type { DemoAccount } from './types';

/** Fixed demo verification code (sandbox only — the real OTP is server-side). */
export const DEMO_OTP = '123456';

export const DEMO_ACCOUNTS: DemoAccount[] = [
  { id: '11111111-0000-0000-0000-000000000001', role: 'customer', country: 'EG', name: 'عميل مصر',       email: 'customer.eg@haatnow.test', phone: '+201000000001' },
  { id: '11111111-0000-0000-0000-000000000002', role: 'customer', country: 'SA', name: 'عميل السعودية',  email: 'customer.sa@haatnow.test', phone: '+966500000001' },
  { id: '22222222-0000-0000-0000-000000000001', role: 'merchant', country: 'EG', name: 'تاجر مصر',       email: 'merchant.eg@haatnow.test', phone: '+201000000002' },
  { id: '22222222-0000-0000-0000-000000000002', role: 'merchant', country: 'SA', name: 'تاجر السعودية',  email: 'merchant.sa@haatnow.test', phone: '+966500000002' },
  { id: '33333333-0000-0000-0000-000000000001', role: 'driver',   country: 'EG', name: 'كابتن مصر',       email: 'driver.eg@haatnow.test',   phone: '+201000000003' },
  { id: '33333333-0000-0000-0000-000000000002', role: 'driver',   country: 'SA', name: 'كابتن السعودية',  email: 'driver.sa@haatnow.test',   phone: '+966500000003' },
  { id: '44444444-0000-0000-0000-000000000001', role: 'admin',    country: 'EG', name: 'مدير مصر',        scope: 'country', email: 'admin.eg@haatnow.test', phone: '+201000000004' },
  { id: '44444444-0000-0000-0000-000000000002', role: 'admin',    country: 'SA', name: 'مدير السعودية',   scope: 'country', email: 'admin.sa@haatnow.test', phone: '+966500000004' },
  { id: '55555555-0000-0000-0000-000000000005', role: 'admin',    country: 'EG', name: 'المدير العام',     scope: 'super',   email: 'super@haatnow.test',    phone: '+201000000005' },
];

export const demoByEmail = (email: string): DemoAccount | null =>
  DEMO_ACCOUNTS.find(a => a.email === email) ?? null;

export const demoByPhone = (phone: string): DemoAccount | null =>
  DEMO_ACCOUNTS.find(a => a.phone === phone) ?? null;

export const demoById = (id: string): DemoAccount | null =>
  DEMO_ACCOUNTS.find(a => a.id === id) ?? null;
