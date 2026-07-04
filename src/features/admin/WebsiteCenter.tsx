import React, { useEffect, useMemo, useState } from 'react';
import { Globe, Eye, UploadCloud, RotateCcw, Plus, Trash2, ChevronUp, ChevronDown, History as HistoryIcon } from 'lucide-react';
import { WorkspaceHeader, SectionHeader, EmptyStateBox } from '../../components/admin/EnterpriseUI';
import { toast } from '../../components/ui/feedback';
import { tenantService } from '../../services/tenant.service';
import { platformService } from '../../platform/platform.service';
import { websiteService, type WebsiteSite, type WebsitePage, type WebsiteBlock, type BlogPost } from '../../services/website.service';

type Section = 'settings' | 'nav' | 'footer' | 'pages' | 'blog' | 'seo' | 'domain' | 'history';
const BLOCK_TYPES: WebsiteBlock['type'][] = ['hero', 'richtext', 'features', 'cta', 'faq', 'contact'];

const card: React.CSSProperties = { background: 'var(--color-surface-container)', border: '1px solid var(--color-outline-variant)', borderRadius: 14 };
const inputStyle: React.CSSProperties = { width: '100%', background: 'var(--color-surface-container-high)', border: '1px solid var(--color-outline-variant)', borderRadius: 10, padding: '9px 11px', color: 'var(--color-on-surface)', fontSize: 14, outline: 'none' };

const Field: React.FC<{ label: string; value: string; onChange: (v: string) => void; textarea?: boolean; placeholder?: string; id?: string }> = ({ label, value, onChange, textarea, placeholder, id }) => (
  <label className="block">
    <span className="text-[11px] font-bold" style={{ color: 'var(--color-on-surface-variant)' }}>{label}</span>
    {textarea
      ? <textarea id={id} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={4} style={{ ...inputStyle, resize: 'vertical', marginTop: 4 }} />
      : <input id={id} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{ ...inputStyle, marginTop: 4 }} />}
  </label>
);
const Toggle: React.FC<{ label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string; id?: string }> = ({ label, checked, onChange, hint, id }) => (
  <button id={id} onClick={() => onChange(!checked)} className="flex items-center justify-between w-full cursor-pointer" style={{ ...card, padding: '10px 12px' }}>
    <span className="text-left"><span className="text-sm font-semibold" style={{ color: 'var(--color-on-surface)' }}>{label}</span>{hint && <span className="block text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>{hint}</span>}</span>
    <span style={{ width: 40, height: 22, borderRadius: 999, background: checked ? 'var(--color-primary-fixed)' : 'var(--color-outline-variant)', position: 'relative', flexShrink: 0 }}>
      <span style={{ position: 'absolute', top: 2, insetInlineStart: checked ? 20 : 2, width: 18, height: 18, borderRadius: 999, background: '#fff', transition: 'inset-inline-start .15s' }} />
    </span>
  </button>
);
const Btn: React.FC<{ onClick: () => void; children: React.ReactNode; primary?: boolean; danger?: boolean; id?: string }> = ({ onClick, children, primary, danger, id }) => (
  <button id={id} onClick={onClick} className="inline-flex items-center gap-1.5 cursor-pointer" style={{
    padding: '8px 14px', borderRadius: 10, fontSize: 13, fontWeight: 700, border: 'none',
    background: primary ? 'var(--color-primary-fixed)' : danger ? 'rgba(248,113,113,0.14)' : 'var(--color-surface-container-high)',
    color: primary ? 'var(--color-on-primary-fixed)' : danger ? '#f87171' : 'var(--color-on-surface)',
  }}>{children}</button>
);

export const WebsiteCenter: React.FC<{ lang: 'ar' | 'en' }> = ({ lang }) => {
  const L = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const [tenants, setTenants] = useState<any[]>([]);
  const [tenantId, setTenantId] = useState('');
  const [site, setSite] = useState<WebsiteSite | null>(null);
  const [section, setSection] = useState<Section>('settings');
  const [pageId, setPageId] = useState('');
  const [postId, setPostId] = useState('');
  const [versions, setVersions] = useState<{ version: number; at: string }[]>([]);

  useEffect(() => { tenantService.list().then(({ data }) => { const ts = (data as any[]) || []; setTenants(ts); if (ts[0]) setTenantId(String(ts[0].id)); }); }, []);
  const reload = (id = tenantId) => { if (!id) return; setSite(websiteService.getDraftSite(id)); setVersions(websiteService.listVersions(id)); };
  useEffect(() => { if (tenantId) reload(tenantId); /* eslint-disable-next-line */ }, [tenantId]);

  const analyticsProviders = useMemo(() => { try { return platformService.providers().filter(p => p.category === 'analytics'); } catch { return []; } }, []);

  if (!site) return (
    <div id="website_center">
      <WorkspaceHeader Icon={Globe} title={L('مركز الموقع', 'Website Center')} subtitle={L('إدارة مواقع المستأجرين', 'Manage tenant websites')} />
      <EmptyStateBox Icon={Globe} title={L('لا يوجد مستأجر', 'No tenant selected')} description={L('اختر مستأجراً لإدارة موقعه.', 'Select a tenant to manage its website.')} />
    </div>
  );

  const patch = (p: Partial<WebsiteSite>) => { setSite({ ...site, ...p }); websiteService.saveDraft(tenantId, p); };
  const publish = () => { websiteService.publish(tenantId); reload(); toast.success(L('تم النشر', 'Published — live now')); };
  const preview = () => { try { window.open(`?site=${site.slug}&preview=1`, '_blank'); } catch { /* ignore */ } };
  const rollback = (v: number) => { websiteService.rollback(tenantId, v); reload(); toast.success(L('تمت الاستعادة', 'Rolled back')); };
  const savePage = (page: WebsitePage) => { websiteService.updatePage(tenantId, page); reload(); };
  const selectedPage = site.pages.find(p => p.id === pageId) || null;
  const selectedPost = site.blog.find(b => b.id === postId) || null;

  const TABS: { k: Section; label: string }[] = [
    { k: 'settings', label: L('الإعدادات', 'Settings') },
    { k: 'nav', label: L('التنقل', 'Navigation') },
    { k: 'footer', label: L('التذييل', 'Footer') },
    { k: 'pages', label: L('الصفحات', 'Pages') },
    { k: 'blog', label: L('المدونة', 'Blog') },
    { k: 'seo', label: L('SEO والتحليلات', 'SEO & Analytics') },
    { k: 'domain', label: L('النطاق والحالة', 'Domain & Status') },
    { k: 'history', label: L('السجل', 'History') },
  ];

  return (
    <div id="website_center" className="space-y-4" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <WorkspaceHeader Icon={Globe} title={L('مركز الموقع', 'Website Center')}
        subtitle={L('محرّرات مرئية · مسودة/نشر/معاينة/استعادة', 'Visual editors · draft / publish / preview / rollback')}
        actions={
          <div className="flex items-center gap-2">
            <select value={tenantId} onChange={e => { setTenantId(e.target.value); setPageId(''); setPostId(''); }} style={{ ...inputStyle, width: 'auto' }} id="website_tenant_select">
              {tenants.map(t => <option key={t.id} value={String(t.id)}>{t.brand_name || t.slug}</option>)}
            </select>
            <Btn onClick={preview} id="website_preview_btn"><Eye size={14} />{L('معاينة', 'Preview')}</Btn>
            <Btn onClick={publish} primary id="website_publish_btn"><UploadCloud size={14} />{L('نشر', 'Publish')}</Btn>
          </div>
        } />

      {/* Section tabs */}
      <div className="flex flex-wrap gap-1.5">
        {TABS.map(t => (
          <button key={t.k} onClick={() => setSection(t.k)} style={{
            padding: '6px 13px', borderRadius: 999, fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer',
            background: section === t.k ? 'var(--color-primary-fixed)' : 'var(--color-surface-container-high)',
            color: section === t.k ? 'var(--color-on-primary-fixed)' : 'var(--color-on-surface-variant)',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── Settings ── */}
      {section === 'settings' && (
        <div style={{ ...card, padding: 16 }} className="space-y-3 max-w-xl">
          <Field label={L('اسم الموقع', 'Site name')} value={site.siteName} onChange={v => patch({ siteName: v })} id="ws_site_name" />
          <label className="block">
            <span className="text-[11px] font-bold" style={{ color: 'var(--color-on-surface-variant)' }}>{L('حالة الموقع', 'Website status')}</span>
            <select value={site.status} onChange={e => patch({ status: e.target.value as WebsiteSite['status'] })} style={{ ...inputStyle, marginTop: 4 }} id="ws_status">
              <option value="published">{L('منشور', 'Published')}</option>
              <option value="draft">{L('مسودة', 'Draft')}</option>
              <option value="suspended">{L('موقوف', 'Suspended')}</option>
            </select>
          </label>
          <Toggle label={L('وضع الصيانة', 'Maintenance mode')} hint={L('يعرض شاشة صيانة للزوّار', 'Shows a maintenance screen to visitors')} checked={site.maintenance} onChange={v => patch({ maintenance: v })} id="ws_maintenance" />
        </div>
      )}

      {/* ── Navigation ── */}
      {section === 'nav' && (
        <div style={{ ...card, padding: 16 }} className="space-y-2 max-w-2xl">
          <SectionHeader title={L('روابط التنقل', 'Navigation links')} action={<Btn onClick={() => patch({ navigation: [...site.navigation, { label: 'New', path: '/new' }] })} id="ws_nav_add"><Plus size={14} />{L('إضافة', 'Add')}</Btn>} />
          {site.navigation.map((n, i) => (
            <div key={i} className="flex items-center gap-2">
              <input value={n.label} onChange={e => patch({ navigation: site.navigation.map((x, j) => j === i ? { ...x, label: e.target.value } : x) })} placeholder={L('التسمية', 'Label')} style={inputStyle} />
              <input value={n.path} onChange={e => patch({ navigation: site.navigation.map((x, j) => j === i ? { ...x, path: e.target.value } : x) })} placeholder="/path" style={inputStyle} />
              <button onClick={() => i > 0 && patch({ navigation: swap(site.navigation, i, i - 1) })} style={iconBtn}><ChevronUp size={15} /></button>
              <button onClick={() => i < site.navigation.length - 1 && patch({ navigation: swap(site.navigation, i, i + 1) })} style={iconBtn}><ChevronDown size={15} /></button>
              <button onClick={() => patch({ navigation: site.navigation.filter((_, j) => j !== i) })} style={{ ...iconBtn, color: '#f87171' }}><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
      )}

      {/* ── Footer ── */}
      {section === 'footer' && (
        <div style={{ ...card, padding: 16 }} className="space-y-4 max-w-2xl">
          <Field label={L('حقوق النشر', 'Copyright')} value={site.footer.copyright} onChange={v => patch({ footer: { ...site.footer, copyright: v } })} />
          {site.footer.columns.map((col, ci) => (
            <div key={ci} style={{ ...card, padding: 12 }} className="space-y-2">
              <div className="flex items-center gap-2">
                <input value={col.title} onChange={e => patch({ footer: { ...site.footer, columns: site.footer.columns.map((c, j) => j === ci ? { ...c, title: e.target.value } : c) } })} placeholder={L('عنوان العمود', 'Column title')} style={inputStyle} />
                <button onClick={() => patch({ footer: { ...site.footer, columns: site.footer.columns.filter((_, j) => j !== ci) } })} style={{ ...iconBtn, color: '#f87171' }}><Trash2 size={15} /></button>
              </div>
              {col.links.map((l, li) => (
                <div key={li} className="flex items-center gap-2 ps-3">
                  <input value={l.label} onChange={e => setColLink(patch, site, ci, li, { label: e.target.value })} placeholder={L('التسمية', 'Label')} style={inputStyle} />
                  <input value={l.path} onChange={e => setColLink(patch, site, ci, li, { path: e.target.value })} placeholder="/path" style={inputStyle} />
                  <button onClick={() => patch({ footer: { ...site.footer, columns: site.footer.columns.map((c, j) => j === ci ? { ...c, links: c.links.filter((_, k) => k !== li) } : c) } })} style={{ ...iconBtn, color: '#f87171' }}><Trash2 size={15} /></button>
                </div>
              ))}
              <Btn onClick={() => patch({ footer: { ...site.footer, columns: site.footer.columns.map((c, j) => j === ci ? { ...c, links: [...c.links, { label: 'Link', path: '/' }] } : c) } })}><Plus size={13} />{L('رابط', 'Link')}</Btn>
            </div>
          ))}
          <Btn onClick={() => patch({ footer: { ...site.footer, columns: [...site.footer.columns, { title: 'Column', links: [] }] } })} id="ws_footer_col_add"><Plus size={14} />{L('عمود', 'Column')}</Btn>
        </div>
      )}

      {/* ── Pages (visual block editor; covers home/landing/about/contact/help/privacy/terms/custom) ── */}
      {section === 'pages' && (
        <div className="grid md:grid-cols-[220px_1fr] gap-4">
          <div style={{ ...card, padding: 10 }} className="space-y-1">
            <Btn onClick={() => { const p = websiteService.addPage(tenantId, 'New page', 'new-page'); reload(); if (p) setPageId(p.id); }} id="ws_page_add"><Plus size={14} />{L('صفحة جديدة', 'New page')}</Btn>
            {site.pages.map(p => (
              <button key={p.id} onClick={() => setPageId(p.id)} className="w-full text-start px-2.5 py-2 rounded-lg text-sm cursor-pointer" style={{ background: pageId === p.id ? 'var(--color-surface-container-high)' : 'transparent', color: 'var(--color-on-surface)' }}>
                <span className="font-semibold">{p.title}</span><span className="text-[11px] block" style={{ color: 'var(--color-on-surface-variant)' }}>{p.path} · {p.kind}</span>
              </button>
            ))}
          </div>
          <div>
            {!selectedPage ? <EmptyStateBox Icon={Globe} title={L('اختر صفحة', 'Select a page')} description={L('اختر صفحة لتحرير محتواها بصرياً.', 'Pick a page to edit its content visually.')} />
              : <PageEditor page={selectedPage} onChange={savePage} onRemove={() => { websiteService.removePage(tenantId, selectedPage.id); setPageId(''); reload(); }} L={L} />}
          </div>
        </div>
      )}

      {/* ── Blog ── */}
      {section === 'blog' && (
        <div className="grid md:grid-cols-[220px_1fr] gap-4">
          <div style={{ ...card, padding: 10 }} className="space-y-1">
            <Btn onClick={() => { const post: BlogPost = { id: `b_${Date.now().toString(36)}`, slug: `post-${site.blog.length + 1}`, title: 'New post', excerpt: '', body: [{ type: 'richtext', body: '' }], author: site.siteName, publishedAt: new Date().toISOString(), tags: [], seo: {} }; websiteService.upsertPost(tenantId, post); reload(); setPostId(post.id); }} id="ws_post_add"><Plus size={14} />{L('مقال جديد', 'New post')}</Btn>
            {site.blog.map(b => (
              <button key={b.id} onClick={() => setPostId(b.id)} className="w-full text-start px-2.5 py-2 rounded-lg text-sm cursor-pointer" style={{ background: postId === b.id ? 'var(--color-surface-container-high)' : 'transparent', color: 'var(--color-on-surface)' }}>
                <span className="font-semibold">{b.title}</span><span className="text-[11px] block" style={{ color: 'var(--color-on-surface-variant)' }}>/blog/{b.slug}</span>
              </button>
            ))}
          </div>
          <div>
            {!selectedPost ? <EmptyStateBox Icon={Globe} title={L('اختر مقالاً', 'Select a post')} />
              : <PostEditor post={selectedPost} onChange={p => { websiteService.upsertPost(tenantId, p); reload(); }} onRemove={() => { websiteService.removePost(tenantId, selectedPost.id); setPostId(''); reload(); }} L={L} />}
          </div>
        </div>
      )}

      {/* ── SEO / OpenGraph / Analytics / Cookie ── */}
      {section === 'seo' && (
        <div style={{ ...card, padding: 16 }} className="space-y-3 max-w-xl">
          <SectionHeader title={L('SEO الافتراضي و OpenGraph', 'Default SEO & OpenGraph')} />
          <Field label={L('العنوان الافتراضي', 'Default title')} value={site.seoDefaults.title || ''} onChange={v => patch({ seoDefaults: { ...site.seoDefaults, title: v } })} id="ws_seo_title" />
          <Field label={L('الوصف الافتراضي', 'Default description')} value={site.seoDefaults.description || ''} onChange={v => patch({ seoDefaults: { ...site.seoDefaults, description: v } })} textarea />
          <Field label={L('صورة OpenGraph (رابط)', 'OpenGraph image URL')} value={site.seoDefaults.ogImage || ''} onChange={v => patch({ seoDefaults: { ...site.seoDefaults, ogImage: v } })} placeholder="https://…" />
          <SectionHeader title={L('التحليلات', 'Analytics')} />
          <label className="block">
            <span className="text-[11px] font-bold" style={{ color: 'var(--color-on-surface-variant)' }}>{L('مزوّد التحليلات', 'Analytics provider')}</span>
            <select value={site.analytics.providerId || ''} onChange={e => patch({ analytics: { ...site.analytics, providerId: e.target.value || undefined } })} style={{ ...inputStyle, marginTop: 4 }} id="ws_analytics_provider">
              <option value="">{L('لا شيء', 'None')}</option>
              {analyticsProviders.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <Field label={L('معرّف القياس', 'Measurement ID')} value={site.analytics.measurementId || ''} onChange={v => patch({ analytics: { ...site.analytics, measurementId: v } })} placeholder="G-XXXX / …" />
          <SectionHeader title={L('لافتة الكوكيز', 'Cookie banner')} />
          <Toggle label={L('تفعيل لافتة الكوكيز', 'Enable cookie banner')} checked={site.cookie.enabled} onChange={v => patch({ cookie: { ...site.cookie, enabled: v } })} id="ws_cookie_toggle" />
          <Field label={L('رابط سياسة الكوكيز', 'Cookie policy path')} value={site.cookie.policyPath} onChange={v => patch({ cookie: { ...site.cookie, policyPath: v } })} placeholder="/privacy" />
        </div>
      )}

      {/* ── Domain / SSL / Status ── */}
      {section === 'domain' && (
        <div style={{ ...card, padding: 16 }} className="space-y-3 max-w-xl">
          <label className="block">
            <span className="text-[11px] font-bold" style={{ color: 'var(--color-on-surface-variant)' }}>{L('النطاق الفرعي (المنصّة)', 'Tenant subdomain (managed)')}</span>
            <input value={`${site.slug}.haatnow.app`} readOnly style={{ ...inputStyle, marginTop: 4, opacity: 0.7 }} />
          </label>
          <Field label={L('نطاق مخصّص', 'Custom domain')} value={site.customDomain || ''} onChange={v => patch({ customDomain: v || undefined })} placeholder="www.example.com" id="ws_custom_domain" />
          <label className="block">
            <span className="text-[11px] font-bold" style={{ color: 'var(--color-on-surface-variant)' }}>{L('حالة SSL', 'SSL status')}</span>
            <select value={site.sslStatus || 'none'} onChange={e => patch({ sslStatus: e.target.value as WebsiteSite['sslStatus'] })} style={{ ...inputStyle, marginTop: 4 }} id="ws_ssl_status">
              <option value="none">{L('لا يوجد', 'None')}</option>
              <option value="provisioning">{L('قيد الإصدار', 'Provisioning')}</option>
              <option value="active">{L('نشط', 'Active')}</option>
            </select>
          </label>
          <p className="text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>
            {L('الأولوية وقت التشغيل: نطاق مخصّص ← نطاق فرعي ← مُعامل التطوير (‎?site=‎، ليس أساسياً).', 'Runtime priority: custom domain → subdomain → dev query param (?site=, non-primary).')}
          </p>
        </div>
      )}

      {/* ── History / Rollback ── */}
      {section === 'history' && (
        <div style={{ ...card, padding: 16 }} className="space-y-2 max-w-xl">
          <SectionHeader title={L('سجل الإصدارات', 'Version history')} />
          {versions.length === 0 ? <EmptyStateBox Icon={HistoryIcon} title={L('لا يوجد سجل بعد', 'No history yet')} description={L('كل نشر ينشئ نسخة قابلة للاستعادة.', 'Each publish creates a restorable version.')} />
            : versions.map(v => (
              <div key={v.version} className="flex items-center justify-between" style={{ ...card, padding: '10px 12px' }}>
                <span className="text-sm" style={{ color: 'var(--color-on-surface)' }}>v{v.version} · <span style={{ color: 'var(--color-on-surface-variant)' }}>{new Date(v.at).toLocaleString()}</span></span>
                <Btn onClick={() => rollback(v.version)} id={`ws_rollback_${v.version}`}><RotateCcw size={13} />{L('استعادة', 'Rollback')}</Btn>
              </div>
            ))}
        </div>
      )}
    </div>
  );
};

const iconBtn: React.CSSProperties = { width: 34, height: 34, borderRadius: 9, background: 'var(--color-surface-container-high)', border: 'none', color: 'var(--color-on-surface-variant)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 };
function swap<T>(arr: T[], i: number, j: number): T[] { const a = [...arr]; [a[i], a[j]] = [a[j], a[i]]; return a; }
function setColLink(patch: (p: any) => void, site: WebsiteSite, ci: number, li: number, part: { label?: string; path?: string }) {
  patch({ footer: { ...site.footer, columns: site.footer.columns.map((c, j) => j === ci ? { ...c, links: c.links.map((l, k) => k === li ? { ...l, ...part } : l) } : c) } });
}

// ── Visual page editor (block-based; no JSON) ─────────────────────────────────
const PageEditor: React.FC<{ page: WebsitePage; onChange: (p: WebsitePage) => void; onRemove: () => void; L: (a: string, e: string) => string }> = ({ page, onChange, onRemove, L }) => {
  const up = (patch: Partial<WebsitePage>) => onChange({ ...page, ...patch });
  const setBlock = (i: number, b: WebsiteBlock) => up({ sections: page.sections.map((x, j) => j === i ? b : x) });
  const addBlock = (t: WebsiteBlock['type']) => up({ sections: [...page.sections, newBlock(t)] });
  return (
    <div style={{ ...card, padding: 16 }} className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <input value={page.title} onChange={e => up({ title: e.target.value })} style={inputStyle} id="ws_page_title" />
        <Btn onClick={onRemove} danger id="ws_page_remove"><Trash2 size={14} />{L('حذف', 'Delete')}</Btn>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label={L('المسار', 'Path')} value={page.path} onChange={v => up({ path: v })} />
        <label className="flex items-end gap-2 pb-1"><input type="checkbox" checked={page.nav} onChange={e => up({ nav: e.target.checked })} /> <span className="text-sm" style={{ color: 'var(--color-on-surface)' }}>{L('في التنقل', 'Show in nav')}</span></label>
      </div>
      <Field label={L('عنوان SEO للصفحة', 'Page SEO title')} value={page.seo.title || ''} onChange={v => up({ seo: { ...page.seo, title: v } })} />
      <Field label={L('وصف SEO للصفحة', 'Page SEO description')} value={page.seo.description || ''} onChange={v => up({ seo: { ...page.seo, description: v } })} textarea />
      <SectionHeader title={L('الأقسام', 'Sections')} action={
        <select onChange={e => { if (e.target.value) { addBlock(e.target.value as WebsiteBlock['type']); e.target.value = ''; } }} style={{ ...inputStyle, width: 'auto' }} id="ws_block_add">
          <option value="">+ {L('قسم', 'Add block')}</option>
          {BLOCK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      } />
      {page.sections.map((b, i) => (
        <div key={i} style={{ ...card, padding: 12 }} className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase" style={{ color: 'var(--color-on-surface-variant)' }}>{b.type}</span>
            <div className="flex gap-1">
              <button onClick={() => i > 0 && up({ sections: swap(page.sections, i, i - 1) })} style={iconBtn}><ChevronUp size={14} /></button>
              <button onClick={() => i < page.sections.length - 1 && up({ sections: swap(page.sections, i, i + 1) })} style={iconBtn}><ChevronDown size={14} /></button>
              <button onClick={() => up({ sections: page.sections.filter((_, j) => j !== i) })} style={{ ...iconBtn, color: '#f87171' }}><Trash2 size={14} /></button>
            </div>
          </div>
          <BlockEditor block={b} onChange={nb => setBlock(i, nb)} L={L} />
        </div>
      ))}
    </div>
  );
};

const PostEditor: React.FC<{ post: BlogPost; onChange: (p: BlogPost) => void; onRemove: () => void; L: (a: string, e: string) => string }> = ({ post, onChange, onRemove, L }) => {
  const up = (patch: Partial<BlogPost>) => onChange({ ...post, ...patch });
  const body0 = post.body.find(b => b.type === 'richtext') as Extract<WebsiteBlock, { type: 'richtext' }> | undefined;
  return (
    <div style={{ ...card, padding: 16 }} className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <input value={post.title} onChange={e => up({ title: e.target.value })} style={inputStyle} id="ws_post_title" />
        <Btn onClick={onRemove} danger><Trash2 size={14} />{L('حذف', 'Delete')}</Btn>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Slug" value={post.slug} onChange={v => up({ slug: v })} />
        <Field label={L('الكاتب', 'Author')} value={post.author} onChange={v => up({ author: v })} />
      </div>
      <Field label={L('المقتطف', 'Excerpt')} value={post.excerpt} onChange={v => up({ excerpt: v })} textarea />
      <Field label={L('المحتوى', 'Body')} value={body0?.body || ''} onChange={v => up({ body: [{ type: 'richtext', body: v }] })} textarea />
    </div>
  );
};

function newBlock(t: WebsiteBlock['type']): WebsiteBlock {
  switch (t) {
    case 'hero': return { type: 'hero', title: 'Headline', subtitle: 'Subtitle' };
    case 'features': return { type: 'features', heading: 'Features', items: [{ title: 'Feature', body: 'Description' }] };
    case 'cta': return { type: 'cta', title: 'Call to action', button: { label: 'Get started', href: '/contact' } };
    case 'faq': return { type: 'faq', heading: 'FAQ', items: [{ q: 'Question?', a: 'Answer.' }] };
    case 'contact': return { type: 'contact', heading: 'Contact', email: '' };
    default: return { type: 'richtext', heading: '', body: '' };
  }
}

const BlockEditor: React.FC<{ block: WebsiteBlock; onChange: (b: WebsiteBlock) => void; L: (a: string, e: string) => string }> = ({ block, onChange, L }) => {
  switch (block.type) {
    case 'hero': return (<div className="space-y-2">
      <Field label={L('العنوان', 'Title')} value={block.title} onChange={v => onChange({ ...block, title: v })} />
      <Field label={L('العنوان الفرعي', 'Subtitle')} value={block.subtitle || ''} onChange={v => onChange({ ...block, subtitle: v })} />
      <div className="grid grid-cols-2 gap-2">
        <Field label={L('زر: نص', 'CTA label')} value={block.cta?.label || ''} onChange={v => onChange({ ...block, cta: { label: v, href: block.cta?.href || '/' } })} />
        <Field label={L('زر: رابط', 'CTA href')} value={block.cta?.href || ''} onChange={v => onChange({ ...block, cta: { label: block.cta?.label || 'Go', href: v } })} />
      </div>
    </div>);
    case 'richtext': return (<div className="space-y-2">
      <Field label={L('العنوان', 'Heading')} value={block.heading || ''} onChange={v => onChange({ ...block, heading: v })} />
      <Field label={L('النص', 'Body')} value={block.body} onChange={v => onChange({ ...block, body: v })} textarea />
    </div>);
    case 'cta': return (<div className="space-y-2">
      <Field label={L('العنوان', 'Title')} value={block.title} onChange={v => onChange({ ...block, title: v })} />
      <Field label={L('العنوان الفرعي', 'Subtitle')} value={block.subtitle || ''} onChange={v => onChange({ ...block, subtitle: v })} />
      <div className="grid grid-cols-2 gap-2">
        <Field label={L('زر: نص', 'Button label')} value={block.button.label} onChange={v => onChange({ ...block, button: { ...block.button, label: v } })} />
        <Field label={L('زر: رابط', 'Button href')} value={block.button.href} onChange={v => onChange({ ...block, button: { ...block.button, href: v } })} />
      </div>
    </div>);
    case 'features': return (<div className="space-y-2">
      <Field label={L('العنوان', 'Heading')} value={block.heading || ''} onChange={v => onChange({ ...block, heading: v })} />
      {block.items.map((it, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
          <Field label={L('العنوان', 'Title')} value={it.title} onChange={v => onChange({ ...block, items: block.items.map((x, j) => j === i ? { ...x, title: v } : x) })} />
          <Field label={L('الوصف', 'Body')} value={it.body} onChange={v => onChange({ ...block, items: block.items.map((x, j) => j === i ? { ...x, body: v } : x) })} />
          <button onClick={() => onChange({ ...block, items: block.items.filter((_, j) => j !== i) })} style={{ ...iconBtn, color: '#f87171', marginBottom: 2 }}><Trash2 size={14} /></button>
        </div>
      ))}
      <Btn onClick={() => onChange({ ...block, items: [...block.items, { title: 'Feature', body: 'Description' }] })}><Plus size={13} />{L('عنصر', 'Item')}</Btn>
    </div>);
    case 'faq': return (<div className="space-y-2">
      <Field label={L('العنوان', 'Heading')} value={block.heading || ''} onChange={v => onChange({ ...block, heading: v })} />
      {block.items.map((it, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
          <Field label={L('سؤال', 'Question')} value={it.q} onChange={v => onChange({ ...block, items: block.items.map((x, j) => j === i ? { ...x, q: v } : x) })} />
          <Field label={L('إجابة', 'Answer')} value={it.a} onChange={v => onChange({ ...block, items: block.items.map((x, j) => j === i ? { ...x, a: v } : x) })} />
          <button onClick={() => onChange({ ...block, items: block.items.filter((_, j) => j !== i) })} style={{ ...iconBtn, color: '#f87171', marginBottom: 2 }}><Trash2 size={14} /></button>
        </div>
      ))}
      <Btn onClick={() => onChange({ ...block, items: [...block.items, { q: 'Question?', a: 'Answer.' }] })}><Plus size={13} />{L('سؤال', 'Q&A')}</Btn>
    </div>);
    case 'contact': return (<div className="space-y-2">
      <Field label={L('العنوان', 'Heading')} value={block.heading || ''} onChange={v => onChange({ ...block, heading: v })} />
      <Field label="Email" value={block.email || ''} onChange={v => onChange({ ...block, email: v })} />
      <Field label={L('الهاتف', 'Phone')} value={block.phone || ''} onChange={v => onChange({ ...block, phone: v })} />
      <Field label={L('العنوان البريدي', 'Address')} value={block.address || ''} onChange={v => onChange({ ...block, address: v })} />
    </div>);
    default: return null;
  }
};
