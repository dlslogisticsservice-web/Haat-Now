// ─────────────────────────────────────────────────────────────────────────────
// Guardian Kernel · RBAC.
//
// Guardian's OWN role model — pure policy evaluation, no dependency on the app's
// auth. The host maps its identity (e.g. admin_users.role_template) onto Guardian
// roles at boot via an IdentityResolver port. The kernel never reads a session.
//
// Modules EXTEND the model by declaring their own permissions at registration
// (`ctx.permissions.definePermission(...)`) — no kernel edit to add a capability.
// ─────────────────────────────────────────────────────────────────────────────
import type { Result } from './types';
import { ok, err } from './types';

/** Built-in roles. Modules may add roles; these are the kernel's baseline. */
export type GuardianRole =
  | 'guardian_viewer'
  | 'qa_engineer'
  | 'devops'
  | 'developer'
  | 'security_engineer'
  | 'release_manager'
  | 'platform_admin'
  | 'super_admin';

export const GUARDIAN_ROLES: readonly GuardianRole[] = [
  'guardian_viewer', 'qa_engineer', 'devops', 'developer', 'security_engineer', 'release_manager', 'platform_admin', 'super_admin',
];

/** Who is asking. Supplied by the host, never read from a global. */
export interface GuardianPrincipal { id: string; roles: string[]; scope?: Record<string, string> }

export interface PermissionDef { key: string; description: string; owner: string }

/** `super_admin` short-circuits everything — mirrors the app's existing auth_has_permission semantics. */
const SUPER = 'super_admin';

export class PermissionRegistry {
  private readonly perms = new Map<string, PermissionDef>();
  private readonly grants = new Map<string, Set<string>>(); // role → permission keys

  constructor() { for (const r of GUARDIAN_ROLES) this.grants.set(r, new Set()); }

  /** A module declares a capability it owns. Duplicate keys are rejected (no silent shadowing). */
  definePermission(def: PermissionDef): Result<true> {
    if (this.perms.has(def.key)) return err(`permission already defined: ${def.key}`);
    this.perms.set(def.key, def);
    return ok(true);
  }

  defineRole(role: string): Result<true> {
    if (this.grants.has(role)) return err(`role already defined: ${role}`);
    this.grants.set(role, new Set());
    return ok(true);
  }

  /** Grant a declared permission to a role. Both must exist — typos fail loudly, not silently. */
  grant(role: string, permissionKey: string): Result<true> {
    if (!this.grants.has(role)) return err(`unknown role: ${role}`);
    if (!this.perms.has(permissionKey)) return err(`unknown permission: ${permissionKey}`);
    this.grants.get(role)!.add(permissionKey);
    return ok(true);
  }

  grantMany(role: string, keys: string[]): Result<true> {
    for (const k of keys) { const r = this.grant(role, k); if (!r.ok) return r; }
    return ok(true);
  }

  /** The single authorization question. Fail-closed: unknown role/permission ⇒ false. */
  can(principal: GuardianPrincipal, permissionKey: string): boolean {
    if (principal.roles.includes(SUPER)) return true;
    if (!this.perms.has(permissionKey)) return false;
    return principal.roles.some(r => this.grants.get(r)?.has(permissionKey) ?? false);
  }

  /** Assert form — for call sites that should throw rather than branch. */
  require(principal: GuardianPrincipal, permissionKey: string): Result<true> {
    return this.can(principal, permissionKey) ? ok(true) : err(`permission denied: ${permissionKey}`);
  }

  permissionsOf(role: string): string[] { return [...(this.grants.get(role) ?? [])].sort(); }
  listPermissions(): PermissionDef[] { return [...this.perms.values()].sort((a, b) => a.key.localeCompare(b.key)); }
  listRoles(): string[] { return [...this.grants.keys()].sort(); }
}

/** Kernel-owned permissions. Modules add their own; the kernel only claims these. */
export const KERNEL_PERMISSIONS: PermissionDef[] = [
  { key: 'guardian.view', description: 'Read Guardian state', owner: 'kernel' },
  { key: 'guardian.module.manage', description: 'Register/stop modules', owner: 'kernel' },
  { key: 'guardian.config.write', description: 'Change Guardian configuration', owner: 'kernel' },
  { key: 'guardian.audit.read', description: 'Read the audit chain', owner: 'kernel' },
  { key: 'guardian.health.ack', description: 'Acknowledge an incident', owner: 'kernel' },
  { key: 'guardian.health.resolve', description: 'Resolve an incident', owner: 'kernel' },
  { key: 'guardian.job.run', description: 'Trigger a job manually', owner: 'kernel' },
  { key: 'guardian.ai.invoke', description: 'Invoke an AI provider', owner: 'kernel' },
];

/** Baseline grants. Deliberately least-privilege; hosts may extend, never silently widen. */
export const applyKernelPolicy = (reg: PermissionRegistry): void => {
  for (const p of KERNEL_PERMISSIONS) reg.definePermission(p);
  const view = ['guardian.view'];
  reg.grantMany('guardian_viewer', view);
  reg.grantMany('qa_engineer', [...view, 'guardian.job.run']);
  reg.grantMany('developer', [...view, 'guardian.ai.invoke']);
  reg.grantMany('security_engineer', [...view, 'guardian.audit.read']);
  reg.grantMany('devops', [...view, 'guardian.health.ack', 'guardian.health.resolve', 'guardian.job.run', 'guardian.audit.read']);
  reg.grantMany('release_manager', [...view, 'guardian.health.ack', 'guardian.audit.read']);
  reg.grantMany('platform_admin', KERNEL_PERMISSIONS.map(p => p.key));
  // super_admin needs no grants — it short-circuits in can().
};
