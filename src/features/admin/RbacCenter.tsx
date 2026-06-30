import React, { useMemo, useState } from 'react';
import { ShieldCheck, Plus, Trash2, UserCog, Check, Layers } from 'lucide-react';
import { WorkspaceHeader } from '../../components/admin/EnterpriseUI';
import { toast, inputDialog } from '../../components/ui/feedback';
import { rbacService, PERMISSION_GROUPS, PERMISSIONS, ROLE_TEMPLATES } from '../../services/rbac.service';
import { adminCrud } from '../../services/admin-crud.service';
import { useRbac } from '../../hooks/useRbac';

const surface: React.CSSProperties = { background: 'var(--color-surface-container-high)', border: '1px solid var(--color-outline-variant)' };
const audit = (action: string, meta: Record<string, any>) => { try { adminCrud('operation_events').create({ action, entity_type: 'rbac', meta, created_at: new Date().toISOString() }); } catch { /* best-effort */ } };

/** RBAC Center — roles, permission matrix, role templates, route/feature guards (acting role) + audit. */
export const RbacCenter: React.FC<{ lang: 'ar' | 'en' }> = ({ lang }) => {
  const L = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const [roles, setRoles] = useState(() => rbacService.listRoles());
  const [selId, setSelId] = useState(roles[0]?.id || '');
  const { acting, setActing, can } = useRbac();
  const GUARD_SAMPLES = [
    { perm: 'finance.pay', ar: 'دفع التسويات', en: 'Pay settlements' },
    { perm: 'compliance.kyc.approve', ar: 'اعتماد KYC', en: 'Approve KYC' },
    { perm: 'platform.whitelabel.manage', ar: 'العلامة البيضاء', en: 'White label' },
    { perm: 'security.rbac.manage', ar: 'إدارة الصلاحيات', en: 'Manage RBAC' },
  ];
  const sel = roles.find(r => r.id === selId) || roles[0];
  const refresh = () => setRoles(rbacService.listRoles().slice());

  const grouped = useMemo(() => PERMISSION_GROUPS.map(g => ({ g, perms: PERMISSIONS.filter(p => p.group === g.key) })), []);

  const toggle = (permKey: string, on: boolean) => {
    if (!sel || sel.system) { toast.error(L('دور النظام غير قابل للتعديل', 'System role is read-only')); return; }
    rbacService.setPermission(sel.id, permKey, on); audit('rbac_permission_changed', { role: sel.id, perm: permKey, on }); refresh();
  };
  const applyTpl = (tpl: string) => { if (!sel || sel.system) return; rbacService.applyTemplate(sel.id, tpl); audit('rbac_template_applied', { role: sel.id, tpl }); refresh(); toast.success(L('تم تطبيق القالب', 'Template applied')); };
  const createRole = async () => {
    const name = await inputDialog({ title: L('اسم الدور الجديد', 'New role name'), placeholder: L('مثال: مشرف منطقة', 'e.g. Zone Supervisor') });
    if (!name?.trim()) return;
    const r = rbacService.createRole(name.trim(), name.trim(), 'country'); audit('rbac_role_created', { role: r.id, name: r.en }); refresh(); setSelId(r.id);
    toast.success(L('تم إنشاء الدور', 'Role created'));
  };
  const del = (id: string) => { rbacService.deleteRole(id); audit('rbac_role_deleted', { role: id }); const next = rbacService.listRoles(); setRoles(next); setSelId(next[0]?.id || ''); toast.success(L('تم حذف الدور', 'Role deleted')); };

  return (
    <div dir={lang === 'ar' ? 'rtl' : 'ltr'} id="rbac_center">
      <WorkspaceHeader Icon={ShieldCheck} title={L('الأدوار والصلاحيات', 'Roles & Permissions')} subtitle={L('مصفوفة الصلاحيات · القوالب · حُرّاس الوصول · سجل التدقيق', 'Permission matrix · templates · guards · audit')} />

      {/* Acting role (drives live route/feature guards across the app) */}
      <div className="flex items-center gap-2 flex-wrap mb-4 p-3 rounded-2xl" style={surface}>
        <UserCog size={16} style={{ color: 'var(--color-primary-fixed)' }} />
        <span className="text-sm font-bold">{L('الدور الحالي (يطبّق الحُرّاس فورًا):', 'Acting role (applies guards live):')}</span>
        <select id="rbac_acting_select" value={acting} onChange={e => { setActing(e.target.value); toast.success(L('تم تبديل الدور الفعّال', 'Acting role switched')); }}
          className="px-3 py-1.5 rounded-lg text-sm font-bold cursor-pointer" style={{ ...surface, color: 'var(--color-on-surface)' }}>
          {roles.map(r => <option key={r.id} value={r.id}>{L(r.ar, r.en)}</option>)}
        </select>
        <span className="text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>{L('الحُرّاس (Can/route guards) يقرؤون هذا الدور.', 'Guards (Can / route guards) read this role.')}</span>
        <div className="w-full flex items-center gap-1.5 flex-wrap mt-1" id="rbac_guard_preview">
          <span className="text-[11px] font-bold" style={{ color: 'var(--color-on-surface-variant)' }}>{L('معاينة الحُرّاس:', 'Guard preview:')}</span>
          {GUARD_SAMPLES.map(s => { const allowed = can(s.perm); return (
            <span key={s.perm} className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: allowed ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.12)', color: allowed ? '#4ade80' : '#f87171' }}>
              {allowed ? '✓' : '✕'} {L(s.ar, s.en)}
            </span>
          ); })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
        {/* Roles list */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm">{L('الأدوار', 'Roles')}</h3>
            <button onClick={createRole} id="rbac_new_role" className="flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg cursor-pointer" style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-on-primary-fixed)' }}><Plus size={13} />{L('دور', 'Role')}</button>
          </div>
          {roles.map(r => (
            <button key={r.id} onClick={() => setSelId(r.id)} className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm cursor-pointer text-start"
              style={selId === r.id ? { background: 'var(--color-primary-fixed)', color: 'var(--color-on-primary-fixed)', fontWeight: 700 } : { ...surface, color: 'var(--color-on-surface)' }}>
              <span className="flex items-center gap-2"><ShieldCheck size={14} />{L(r.ar, r.en)}</span>
              <span className="text-[10px] opacity-70">{r.scope === 'super' ? '★' : `${r.permissions.length}`}</span>
            </button>
          ))}
        </div>

        {/* Permission matrix for selected role */}
        <div className="space-y-3">
          {sel && (
            <>
              <div className="flex items-center justify-between gap-2 flex-wrap p-3 rounded-2xl" style={surface}>
                <div>
                  <p className="font-bold text-sm flex items-center gap-2"><Layers size={15} />{L(sel.ar, sel.en)}</p>
                  <p className="text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>{sel.scope} · {sel.scope === 'super' ? L('كل الصلاحيات', 'All permissions') : `${sel.permissions.length}/${PERMISSIONS.length}`}</p>
                </div>
                <div className="flex items-center gap-2">
                  <select value={sel.template} onChange={e => applyTpl(e.target.value)} disabled={sel.system} className="px-2.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer" style={{ ...surface, color: 'var(--color-on-surface)' }}>
                    {ROLE_TEMPLATES.map(t => <option key={t.key} value={t.key}>{L('قالب: ', 'Template: ')}{L(t.ar, t.en)}</option>)}
                  </select>
                  {!sel.system && <button onClick={() => del(sel.id)} className="p-2 rounded-lg cursor-pointer" style={{ color: 'var(--color-error)', ...surface }}><Trash2 size={14} /></button>}
                </div>
              </div>

              {sel.system && <p className="text-[11px] px-1" style={{ color: 'var(--color-on-surface-variant)' }}>{L('المدير العام يملك كل الصلاحيات (غير قابل للتعديل).', 'Super Admin holds all permissions (read-only).')}</p>}

              {grouped.map(({ g, perms }) => (
                <div key={g.key} className="rounded-2xl p-3" style={surface}>
                  <p className="font-bold text-xs uppercase mb-2" style={{ color: 'var(--color-on-surface-variant)' }}>{L(g.ar, g.en)}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {perms.map(p => {
                      const on = sel.scope === 'super' || sel.permissions.includes(p.key);
                      return (
                        <button key={p.key} onClick={() => toggle(p.key, !on)} disabled={sel.system}
                          className="flex items-center justify-between px-2.5 py-2 rounded-lg text-xs cursor-pointer text-start"
                          style={{ background: on ? 'rgba(163,249,91,0.10)' : 'var(--color-surface-container-lowest)', border: `1px solid ${on ? 'var(--color-primary-fixed)' : 'var(--color-outline-variant)'}`, color: 'var(--color-on-surface)' }}>
                          <span>{L(p.ar, p.en)}</span>
                          <span className="w-4 h-4 rounded flex items-center justify-center shrink-0" style={{ background: on ? 'var(--color-primary-fixed)' : 'transparent', border: on ? 'none' : '1px solid var(--color-outline-variant)' }}>{on && <Check size={11} color="var(--color-on-primary-fixed)" strokeWidth={3} />}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
