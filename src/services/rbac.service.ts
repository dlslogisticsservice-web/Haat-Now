// ─────────────────────────────────────────────────────────────────────────────
// RBAC service — enterprise roles, permissions, permission groups, role templates,
// permission matrix + guard helpers. Backed by the existing roles/permissions/
// role_permissions tables (real Supabase) and a sandbox store for the demo backend.
// Single source of truth for "who can do what" — consumed by route/feature guards.
// ─────────────────────────────────────────────────────────────────────────────

export interface Permission { key: string; group: string; ar: string; en: string }
export interface PermissionGroup { key: string; ar: string; en: string }
export interface Role { id: string; name: string; ar: string; en: string; template: string; scope: 'super' | 'country' | 'merchant' | 'driver' | 'support'; permissions: string[]; system?: boolean }
export interface RoleTemplate { key: string; ar: string; en: string; scope: Role['scope']; permissions: string[] | '*' }

// ── Permission groups (mirror the real product modules) ───────────────────────
export const PERMISSION_GROUPS: PermissionGroup[] = [
  { key: 'operations', ar: 'العمليات', en: 'Operations' },
  { key: 'fleet', ar: 'الأسطول', en: 'Fleet' },
  { key: 'orders', ar: 'الطلبات', en: 'Orders' },
  { key: 'catalog', ar: 'الكتالوج', en: 'Catalog' },
  { key: 'finance', ar: 'المالية', en: 'Finance' },
  { key: 'compliance', ar: 'الالتزام', en: 'Compliance' },
  { key: 'support', ar: 'الدعم', en: 'Support' },
  { key: 'marketing', ar: 'التسويق', en: 'Marketing' },
  { key: 'records', ar: 'السجلّات', en: 'Records' },
  { key: 'platform', ar: 'المنصّة', en: 'Platform' },
  { key: 'security', ar: 'الأمان', en: 'Security' },
  { key: 'system', ar: 'النظام', en: 'System' },
];

// ── Permission catalog ────────────────────────────────────────────────────────
export const PERMISSIONS: Permission[] = [
  { key: 'ops.command.view', group: 'operations', ar: 'عرض غرفة العمليات', en: 'View command center' },
  { key: 'ops.dispatch.manage', group: 'operations', ar: 'إدارة الإرسال', en: 'Manage dispatch' },
  { key: 'ops.zones.manage', group: 'operations', ar: 'إدارة المناطق', en: 'Manage zones' },
  { key: 'fleet.drivers.view', group: 'fleet', ar: 'عرض المندوبين', en: 'View drivers' },
  { key: 'fleet.vehicles.manage', group: 'fleet', ar: 'إدارة المركبات', en: 'Manage vehicles' },
  { key: 'fleet.performance.view', group: 'fleet', ar: 'عرض الأداء', en: 'View performance' },
  { key: 'orders.view', group: 'orders', ar: 'عرض الطلبات', en: 'View orders' },
  { key: 'orders.manage', group: 'orders', ar: 'إدارة الطلبات', en: 'Manage orders' },
  { key: 'orders.cancel', group: 'orders', ar: 'إلغاء الطلبات', en: 'Cancel orders' },
  { key: 'catalog.categories.manage', group: 'catalog', ar: 'إدارة الفئات', en: 'Manage categories' },
  { key: 'catalog.products.manage', group: 'catalog', ar: 'إدارة المنتجات', en: 'Manage products' },
  { key: 'finance.view', group: 'finance', ar: 'عرض المالية', en: 'View finance' },
  { key: 'finance.settle', group: 'finance', ar: 'توليد التسويات', en: 'Generate settlements' },
  { key: 'finance.pay', group: 'finance', ar: 'دفع التسويات', en: 'Pay settlements' },
  { key: 'finance.refund', group: 'finance', ar: 'الاستردادات والتعويضات', en: 'Refunds & compensation' },
  { key: 'compliance.kyc.view', group: 'compliance', ar: 'عرض KYC', en: 'View KYC' },
  { key: 'compliance.kyc.approve', group: 'compliance', ar: 'اعتماد/رفض KYC', en: 'Approve/reject KYC' },
  { key: 'compliance.kyc.suspend', group: 'compliance', ar: 'تعليق/حظر', en: 'Suspend/ban' },
  { key: 'support.view', group: 'support', ar: 'عرض التذاكر', en: 'View tickets' },
  { key: 'support.reply', group: 'support', ar: 'الرد على التذاكر', en: 'Reply to tickets' },
  { key: 'support.close', group: 'support', ar: 'إغلاق التذاكر', en: 'Close tickets' },
  { key: 'marketing.coupons.manage', group: 'marketing', ar: 'إدارة الكوبونات', en: 'Manage coupons' },
  { key: 'marketing.campaigns.manage', group: 'marketing', ar: 'إدارة الحملات', en: 'Manage campaigns' },
  { key: 'marketing.growth.view', group: 'marketing', ar: 'عرض النمو', en: 'View growth' },
  { key: 'records.merchants.manage', group: 'records', ar: 'إدارة التجّار', en: 'Manage merchants' },
  { key: 'records.customers.manage', group: 'records', ar: 'إدارة العملاء', en: 'Manage customers' },
  { key: 'records.drivers.manage', group: 'records', ar: 'إدارة المندوبين', en: 'Manage drivers' },
  { key: 'platform.design.manage', group: 'platform', ar: 'مركز التصميم', en: 'Design center' },
  { key: 'platform.whitelabel.manage', group: 'platform', ar: 'العلامة البيضاء', en: 'White label' },
  { key: 'platform.tenants.manage', group: 'platform', ar: 'إدارة المستأجرين', en: 'Manage tenants' },
  { key: 'security.rbac.manage', group: 'security', ar: 'إدارة الأدوار والصلاحيات', en: 'Manage RBAC' },
  { key: 'security.logs.view', group: 'security', ar: 'عرض سجلّات النظام', en: 'View system logs' },
  { key: 'platform.integrations.manage', group: 'platform', ar: 'إدارة التكاملات والمزوّدين', en: 'Manage integrations' },
  { key: 'system.settings.manage', group: 'system', ar: 'إدارة الإعدادات', en: 'Manage settings' },
  { key: 'system.notifications.manage', group: 'system', ar: 'إدارة الإشعارات', en: 'Manage notifications' },
];
const ALL_KEYS = PERMISSIONS.map(p => p.key);
const inGroups = (...groups: string[]) => PERMISSIONS.filter(p => groups.includes(p.group)).map(p => p.key);

// ── Role templates (Super Admin / Operations / Finance / Support / Compliance / Marketing / Country / Merchant / Driver) ──
export const ROLE_TEMPLATES: RoleTemplate[] = [
  { key: 'super_admin', ar: 'مدير عام', en: 'Super Admin', scope: 'super', permissions: '*' },
  { key: 'operations_manager', ar: 'مدير العمليات', en: 'Operations Manager', scope: 'country', permissions: [...inGroups('operations', 'fleet', 'orders', 'catalog'), 'finance.view', 'support.view'] },
  { key: 'finance_manager', ar: 'مدير مالي', en: 'Finance Manager', scope: 'country', permissions: [...inGroups('finance'), 'records.merchants.manage', 'fleet.drivers.view', 'orders.view'] },
  { key: 'support_agent', ar: 'موظف دعم', en: 'Support Agent', scope: 'support', permissions: [...inGroups('support'), 'orders.view', 'records.customers.manage'] },
  { key: 'compliance_officer', ar: 'مسؤول التزام', en: 'Compliance Officer', scope: 'country', permissions: [...inGroups('compliance'), 'security.logs.view', 'fleet.drivers.view', 'records.merchants.manage'] },
  { key: 'marketing_manager', ar: 'مدير تسويق', en: 'Marketing Manager', scope: 'country', permissions: [...inGroups('marketing'), 'orders.view'] },
  { key: 'country_manager', ar: 'مدير دولة', en: 'Country Manager', scope: 'country', permissions: [...inGroups('operations', 'fleet', 'orders'), 'finance.view', 'support.view', 'marketing.growth.view', 'compliance.kyc.view'] },
  { key: 'merchant_owner', ar: 'مالك متجر', en: 'Merchant Owner', scope: 'merchant', permissions: ['orders.view', 'orders.manage', ...inGroups('catalog'), 'finance.view', 'support.view'] },
  { key: 'driver', ar: 'مندوب', en: 'Driver', scope: 'driver', permissions: ['orders.view'] },
];

export function templatePermissions(key: string): string[] {
  const t = ROLE_TEMPLATES.find(r => r.key === key);
  if (!t) return [];
  return t.permissions === '*' ? [...ALL_KEYS] : [...t.permissions];
}

// ── Persistence (sandbox store; real backend uses role_permissions) ───────────
const RBAC_KEY = 'haat_sb_rbac_roles', ACTING_KEY = 'haat_sb_rbac_acting';
const read = (): Role[] => { try { const r = localStorage.getItem(RBAC_KEY); if (r) return JSON.parse(r); } catch { /* reseed */ } return seed(); };
const write = (roles: Role[]) => { try { localStorage.setItem(RBAC_KEY, JSON.stringify(roles)); } catch { /* ignore */ } };
function seed(): Role[] {
  const roles: Role[] = ROLE_TEMPLATES.map(t => ({ id: t.key, name: t.key, ar: t.ar, en: t.en, template: t.key, scope: t.scope, permissions: templatePermissions(t.key), system: t.key === 'super_admin' }));
  try { localStorage.setItem(RBAC_KEY, JSON.stringify(roles)); } catch { /* ignore */ }
  return roles;
}

export const rbacService = {
  permissions: () => PERMISSIONS,
  groups: () => PERMISSION_GROUPS,
  templates: () => ROLE_TEMPLATES,
  listRoles: (): Role[] => read(),
  getRole: (id: string): Role | undefined => read().find(r => r.id === id),

  createRole(ar: string, en: string, template: string): Role {
    const id = `role-${Date.now().toString(36)}`;
    const tpl = ROLE_TEMPLATES.find(t => t.key === template);
    const role: Role = { id, name: en.toLowerCase().replace(/[^a-z0-9]+/g, '_'), ar, en, template, scope: tpl?.scope || 'country', permissions: templatePermissions(template) };
    write([...read(), role]);
    return role;
  },
  setPermission(roleId: string, permKey: string, on: boolean) {
    const roles = read(); const r = roles.find(x => x.id === roleId); if (!r || r.system) return;
    const set = new Set(r.permissions); on ? set.add(permKey) : set.delete(permKey); r.permissions = [...set];
    write(roles);
  },
  applyTemplate(roleId: string, template: string) {
    const roles = read(); const r = roles.find(x => x.id === roleId); if (!r || r.system) return;
    r.template = template; r.permissions = templatePermissions(template); const tpl = ROLE_TEMPLATES.find(t => t.key === template); if (tpl) r.scope = tpl.scope;
    write(roles);
  },
  deleteRole(roleId: string) { const roles = read(); const r = roles.find(x => x.id === roleId); if (r?.system) return; write(roles.filter(x => x.id !== roleId)); },

  /** Does a role grant a permission? Super scope ⇒ all. */
  hasPermission(roleId: string, permKey: string): boolean {
    const r = read().find(x => x.id === roleId); if (!r) return false;
    return r.scope === 'super' || r.permissions.includes(permKey);
  },

  // Acting role (drives the live guard demo; defaults to super_admin).
  getActingRole: (): string => { try { return localStorage.getItem(ACTING_KEY) || 'super_admin'; } catch { return 'super_admin'; } },
  setActingRole: (roleId: string) => { try { localStorage.setItem(ACTING_KEY, roleId); window.dispatchEvent(new Event('rbac-acting-changed')); } catch { /* ignore */ } },
  can(permKey: string): boolean { return this.hasPermission(this.getActingRole(), permKey); },
};
